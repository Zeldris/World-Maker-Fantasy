import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { registrarSuceso, type ActorSuceso } from './sucesos.js';
import { procesarReacciones } from './reacciones.js';
import { conRencor, npcsConRencor, sentimientoActual, sentimientoTotal, TOPE_NIVELES_GANADOS } from './recuerdos.js';

describe('recuerdos (CR-16) — reglas puras', () => {
  it('los leves se desvanecen a la mitad cada 30 días; los graves quedan', () => {
    expect(sentimientoActual({ sentimiento: -6, importancia: 3, desdeMinutes: 0 }, 30 * 1440)).toBeCloseTo(-3);
    expect(sentimientoActual({ sentimiento: -6, importancia: 6, desdeMinutes: 0 }, 300 * 1440)).toBe(-6);
    expect(sentimientoTotal([{ sentimiento: -6, importancia: 6, desdeMinutes: 0 }, { sentimiento: 5, importancia: 3, desdeMinutes: 0 }], 0)).toBe(-1);
  });

  it('con rencor, el temperamento sube al menos a agresivo', () => {
    expect(conRencor('AMIGABLE', true)).toBe('AGRESIVO');
    expect(conRencor('ENEMIGO', true)).toBe('ENEMIGO');
    expect(conRencor('CAUTELOSO', false)).toBe('CAUTELOSO');
  });
});

describe('recuerdos (CR-16) — en una partida', () => {
  let saveId: string;
  let worldId: string;
  const MIN = 2 * 1440;
  const yo: ActorSuceso = { entidadTipo: 'PERSONAJE', entidadId: '', papel: 'AUTOR' };
  const registrar = (tipo: 'MUERTE_CAUSADA' | 'PERDON_CONCEDIDO', actores: ActorSuceso[], datos: object) =>
    prisma.$transaction((tx) => registrarSuceso(tx, { saveId, tipo, fictionalMinutes: MIN, origen: 'JUGADOR', actores, datos: datos as never }));

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

  it('el testigo de dos muertes te guarda rencor', async () => {
    const [victima, testigo] = await prisma.npc.findMany({ where: { worldId, kind: 'PRINCIPAL', saveId: null }, orderBy: { slug: 'asc' }, take: 2 });
    for (let i = 0; i < 2; i++) {
      await registrar('MUERTE_CAUSADA', [yo, { entidadTipo: 'NPC', entidadId: victima!.id, papel: 'VICTIMA' }, { entidadTipo: 'NPC', entidadId: testigo!.id, papel: 'TESTIGO' }], { personaje: 'x', victima: victima!.name });
      await procesarReacciones(prisma, saveId);
    }
    expect(await prisma.recuerdo.count({ where: { saveId, npcId: testigo!.id } })).toBe(2);
    expect((await npcsConRencor(prisma, saveId, [testigo!.id], MIN)).has(testigo!.id)).toBe(true);
  });

  it('el perdonado lo recuerda bien y vuelve como «Superviviente de Gorhorn», con tope de niveles', async () => {
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, kind: 'PRINCIPAL', saveId: null }, orderBy: { slug: 'desc' } });
    for (let i = 0; i < TOPE_NIVELES_GANADOS + 1; i++) {
      await registrar('PERDON_CONCEDIDO', [yo, { entidadTipo: 'NPC', entidadId: npc.id, papel: 'BENEFICIARIO' }], { personaje: 'x', perdonado: npc.name });
      await procesarReacciones(prisma, saveId);
    }
    const estado = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope: '' } } });
    expect(estado.nivelesGanados).toBe(TOPE_NIVELES_GANADOS);
    expect(estado.titulo).toBe('Superviviente de Gorhorn');
    expect((await prisma.recuerdo.findFirstOrThrow({ where: { saveId, npcId: npc.id } })).sentimiento).toBe(5);
  });
});
