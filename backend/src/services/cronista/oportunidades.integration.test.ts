import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { factionRepFor } from '../reputation.js';
import { evaluarConsecuencias } from './consecuencias.js';
import { procesarReacciones } from './reacciones.js';
import { registrarSuceso } from './sucesos.js';
import { abrirCampoDeBatalla, abrirCaravana, abrirEncargo, BOTIN_CARAVANA_MIN, PLAZO_CAMPO_BATALLA, REPUTACION_ENCARGO, type CtxOportunidad } from './oportunidades.js';

// CR-12 paso 12d (hito 0.2) — oportunidades con plazo contra Postgres real: campo de batalla que se
// cierra al vencer, caravana que da su carga al vencer a su guardia, y encargo de materiales que
// repara el edificio y da reputación.
describe('oportunidades (CR-12)', () => {
  const saveIds: string[] = [];
  let worldId: string;
  const DIA = 1440;

  async function partida(nombre: string) {
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'O',
        goirnos: 0, worldState: { create: { fictionalMinutes: 480 + 10 * DIA } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    return save.id;
  }
  const abrir = <T>(saveId: string, fn: (ctx: CtxOportunidad) => Promise<T>) =>
    prisma.$transaction((tx) => fn({ tx, saveId, worldId, fictionalMinutes: 480 + 10 * DIA, random: () => 0 }));
  const suceso = (s: Parameters<typeof registrarSuceso>[1]) => prisma.$transaction((tx) => registrarSuceso(tx, s));

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
  });
  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('campo de batalla: un caído y un herido en tierras de la atacada; se retiran al vencer el plazo', async () => {
    const saveId = await partida('Oportunidad (CR-12) batalla');
    const abierta = await abrir(saveId, (ctx) => abrirCampoDeBatalla(ctx, 'Clan Serhu', 'Concordia de Hierro'));
    expect(abierta?.pista).toMatch(/^Dicen que en .+ aún quedan caídos/);
    expect(abierta?.venceEn).toBe(480 + (10 + PLAZO_CAMPO_BATALLA) * DIA);
    const puntos = await prisma.zonePoint.findMany({ where: { saveId, tipo: 'NPC', activo: true } });
    expect(puntos).toHaveLength(2);
    const estados = await prisma.npcState.findMany({ where: { saveId, scope: puntos[0]!.locationId }, include: { npc: { select: { faction: true } } } });
    expect(estados.map((e) => e.condicionFisica).sort()).toEqual(['GRAVE', 'MUERTO']);
    expect(estados.find((e) => e.condicionFisica === 'MUERTO')!.npc.faction).toBe('Concordia de Hierro');
    expect(estados.every((e) => !e.muerto)).toBe(true); // una plantilla caída aquí no desaparece del resto del mundo

    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 480 + (10 + PLAZO_CAMPO_BATALLA) * DIA } });
    await evaluarConsecuencias(prisma, saveId);
    expect(await prisma.zonePoint.count({ where: { saveId, tipo: 'NPC', activo: true } })).toBe(0);

    // Sin plantillas (las facciones Feg y Keseg no tienen) no hay campo de batalla.
    expect(await abrir(saveId, (ctx) => abrirCampoDeBatalla(ctx, 'Feg Ger', 'Keseg Sael'))).toBeNull();
  });

  it('caravana: vencer a su guardia da la carga; vencer a otro no', async () => {
    const saveId = await partida('Oportunidad (CR-12) caravana');
    expect((await abrir(saveId, (ctx) => abrirCaravana(ctx, 'Concordia de Hierro', 'Clan Serhu')))?.pista).toMatch(/^La caravana pasará por /);
    const punto = await prisma.zonePoint.findFirstOrThrow({ where: { saveId, tipo: 'NPC', activo: true } });
    expect(punto.label).toBe('Caravana de Concordia de Hierro');
    const guardia = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: punto.targetSlug } });
    const otro = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'guardia-serhu' } });
    const muerte = (npcId: string) => suceso({
      saveId, tipo: 'MUERTE_CAUSADA', fictionalMinutes: 480 + 10 * DIA + 60, origen: 'JUGADOR',
      actores: [{ entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AUTOR' }, { entidadTipo: 'NPC', entidadId: npcId, papel: 'VICTIMA' }],
      datos: { personaje: 'O', victima: 'x' },
    });

    await muerte(otro.id);
    await procesarReacciones(prisma, saveId);
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).goirnos).toBe(0);

    await muerte(guardia.id);
    await procesarReacciones(prisma, saveId);
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).goirnos).toBeGreaterThanOrEqual(BOTIN_CARAVANA_MIN);
    expect((await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } })).activo).toBe(false);
  });

  it('encargo: entregar madera al encargado repara el edificio y da reputación; otra cosa no', async () => {
    const saveId = await partida('Oportunidad (CR-12) encargo');
    const edificio = await prisma.building.findFirstOrThrow({
      where: { faction: { saveId, name: 'Clan Serhu' }, locationId: { not: null } },
      include: { location: true },
    });
    await prisma.building.update({ where: { id: edificio.id }, data: { status: 'DANADO' } });
    expect((await abrir(saveId, (ctx) => abrirEncargo(ctx, 'Clan Serhu', edificio.id, edificio.locationId!, edificio.location!.name)))?.pista).toContain('buscan madera o piedra');
    const punto = await prisma.zonePoint.findFirstOrThrow({ where: { saveId, tipo: 'NPC', activo: true } });
    const encargado = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: punto.targetSlug } });
    const regalo = (categoria: string) => suceso({
      saveId, tipo: 'REGALO', fictionalMinutes: 480 + 10 * DIA + 60, origen: 'JUGADOR',
      actores: [{ entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'AUTOR' }, { entidadTipo: 'NPC', entidadId: encargado.id, papel: 'BENEFICIARIO' }],
      datos: { personaje: 'O', a: encargado.name, objeto: { nombre: 'algo', categoria } },
    });

    await regalo('hueso');
    await procesarReacciones(prisma, saveId);
    expect((await prisma.building.findUniqueOrThrow({ where: { id: edificio.id } })).status).toBe('DANADO');

    await regalo('madera');
    await procesarReacciones(prisma, saveId);
    expect((await prisma.building.findUniqueOrThrow({ where: { id: edificio.id } })).status).toBe('ACTIVO');
    const ws = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    expect((ws.factionsStatus as Record<string, number>)['Clan Serhu']).toBe(factionRepFor({}, 'Clan Serhu') + REPUTACION_ENCARGO);
    expect((await prisma.zonePoint.findUniqueOrThrow({ where: { id: punto.id } })).activo).toBe(false);
  });
});
