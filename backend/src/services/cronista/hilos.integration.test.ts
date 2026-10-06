import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { registrarSuceso, type ActorSuceso } from './sucesos.js';
import { procesarReacciones } from './reacciones.js';
import { desenlace } from './hilos.js';

describe('hilos (CR-17) — desenlaces', () => {
  it('una venganza se cierra si muere el vengador o al verse las caras; una caída, cuando la facción cae', () => {
    const venganza = { patron: 'VENGANZA', actores: [{ entidadTipo: 'NPC', entidadId: 'v' }, { entidadTipo: 'PERSONAJE', entidadId: 's' }] };
    expect(desenlace(venganza, { tipo: 'MUERTE_NPC', actores: [{ entidadTipo: 'NPC', entidadId: 'v', papel: 'VICTIMA' }] })).toBe('El vengador ha muerto.');
    expect(desenlace(venganza, { tipo: 'COMBATE_PERDIDO', actores: [{ entidadTipo: 'NPC', entidadId: 'v', papel: 'AUTOR' }] })).toBe('Por fin se han visto las caras.');
    expect(desenlace(venganza, { tipo: 'MUERTE_NPC', actores: [{ entidadTipo: 'NPC', entidadId: 'otro', papel: 'VICTIMA' }] })).toBeNull();
    expect(desenlace({ patron: 'CAIDA', actores: [{ entidadTipo: 'FACCION', entidadId: 'f' }] }, { tipo: 'FACCION_CAE', actores: [{ entidadTipo: 'FACCION', entidadId: 'f', papel: 'VICTIMA' }] })).toBe('Y cae.');
  });
});

describe('hilos (CR-17) — en una partida', () => {
  let saveId: string;
  let worldId: string;
  const MIN = 2 * 1440;
  const yo: ActorSuceso = { entidadTipo: 'PERSONAJE', entidadId: '', papel: 'AUTOR' };
  const registrar = (tipo: 'MUERTE_CAUSADA' | 'MUERTE_NPC' | 'PERDON_CONCEDIDO' | 'REGALO', actores: ActorSuceso[], datos: object, min = MIN) =>
    prisma.$transaction((tx) => registrarSuceso(tx, { saveId, tipo, fictionalMinutes: min, origen: 'JUGADOR', actores, datos: datos as never }));

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
        worldState: { create: { fictionalMinutes: MIN } },
      },
    })).id;
    yo.entidadId = saveId;
    await asegurarMundoDePartida(prisma, saveId);
    await procesarReacciones(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('matar ante un testigo de su facción abre una venganza, que se cierra cuando muere el vengador', async () => {
    const [victima, vengador] = await prisma.npc.findMany({ where: { worldId, saveId: null, faction: 'Clan Serhu' }, orderBy: { slug: 'asc' }, take: 2 });
    await registrar('MUERTE_CAUSADA', [yo, { entidadTipo: 'NPC', entidadId: victima!.id, papel: 'VICTIMA' }, { entidadTipo: 'NPC', entidadId: vengador!.id, papel: 'TESTIGO' }], { personaje: 'x', victima: victima!.name });
    await procesarReacciones(prisma, saveId);
    const hilo = await prisma.hilo.findUniqueOrThrow({ where: { saveId_clave: { saveId, clave: `VENGANZA:${vengador!.id}` } } });
    expect(hilo.estado).toBe('ABIERTO');
    expect(hilo.resumen).toContain(`quiere vengar a ${victima!.name}`);
    await registrar('MUERTE_NPC', [{ entidadTipo: 'NPC', entidadId: vengador!.id, papel: 'VICTIMA' }], { npc: vengador!.name }, MIN + 10);
    await procesarReacciones(prisma, saveId);
    expect((await prisma.hilo.findUniqueOrThrow({ where: { id: hilo.id } })).estado).toBe('CERRADO');
  });

  it('perdonar abre una deuda; se salda cuando te devuelve el favor', async () => {
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, saveId: null, kind: 'PRINCIPAL' }, orderBy: { slug: 'desc' } });
    await registrar('PERDON_CONCEDIDO', [yo, { entidadTipo: 'NPC', entidadId: npc.id, papel: 'BENEFICIARIO' }], { personaje: 'x', perdonado: npc.name });
    await procesarReacciones(prisma, saveId);
    expect((await prisma.hilo.findUniqueOrThrow({ where: { saveId_clave: { saveId, clave: `DEUDA:${npc.id}` } } })).estado).toBe('ABIERTO');
    await registrar('REGALO', [{ entidadTipo: 'NPC', entidadId: npc.id, papel: 'AUTOR' }, { entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'BENEFICIARIO' }], { personaje: npc.name, a: 'x', objeto: { nombre: 'algo' } }, MIN + 20);
    await procesarReacciones(prisma, saveId);
    expect((await prisma.hilo.findUniqueOrThrow({ where: { saveId_clave: { saveId, clave: `DEUDA:${npc.id}` } } })).estado).toBe('CERRADO');
  });

  it('dos buenos actos tras ganarse «Carnicero» lo apagan: redención', async () => {
    const suceso = await registrar('PERDON_CONCEDIDO', [yo], { personaje: 'x', perdonado: 'nadie' }, MIN + 30);
    await prisma.etiqueta.create({ data: { saveId, entidadTipo: 'PERSONAJE', entidadId: saveId, clave: 'CARNICERO', texto: 'Carnicero', sucesoId: suceso, desdeMinutes: MIN + 40 } });
    await procesarReacciones(prisma, saveId);
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, saveId: null, kind: 'PRINCIPAL' }, orderBy: { slug: 'asc' } });
    for (const m of [MIN + 50, MIN + 60]) {
      await registrar('PERDON_CONCEDIDO', [yo, { entidadTipo: 'NPC', entidadId: npc.id, papel: 'BENEFICIARIO' }], { personaje: 'x', perdonado: npc.name }, m);
      await procesarReacciones(prisma, saveId);
    }
    expect((await prisma.etiqueta.findFirstOrThrow({ where: { saveId, clave: 'CARNICERO' } })).activa).toBe(false);
    expect(await prisma.hilo.count({ where: { saveId, patron: 'REDENCION', estado: 'CERRADO' } })).toBe(1);
  });
});
