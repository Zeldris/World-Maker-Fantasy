import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { ownerKeyFor } from './reinoOwner.js';
import { lanzarEjercitosContraElReino, soldadosEnCasa } from './guerraReino.js';
import { resolverAsaltoDeFondo } from './asaltos.js';
import { enlacesDelMundo, rutaMasCorta, TRABAJOS } from './viajeros.js';
import Fastify from 'fastify';
import { guerraRoutes } from '../routes/saves/guerra.js';
import { TIPO_ATAQUE_ASENTAMIENTO } from './guerraReino.js';

function semilla(s: number) {
  let x = s;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

/// CR-37 (37a): las facciones en guerra con el Reino mandan ejércitos; en la defensa pelean también
/// los guardias de fauna y el personaje si está allí.
describe('guerra contra el Reino (CR-37 37a)', () => {
  let saveId: string;
  let worldId: string;
  let casa: string;
  let suya: string;
  let enemigaId: string;
  let capitalId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const enlaces = await enlacesDelMundo(prisma, worldId);
    const llanuras = await prisma.location.findMany({ where: { worldId, region: 'Las Llanuras del Viento Rojo' }, select: { id: true } });
    let par: [string, string] | null = null;
    for (const a of llanuras) for (const b of llanuras) if (!par && a.id !== b.id && rutaMasCorta(enlaces, a.id, b.id)) par = [a.id, b.id];
    [casa, suya] = par!;
    saveId = (await prisma.save.create({
      data: { userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (CR-37)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: { fuerza: 14, destreza: 12, constitucion: 12, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G', currentLocationId: casa, worldState: { create: { fictionalMinutes: 800 * 1440 } } },
    })).id;
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }), comida: 300, riqueza: 100 } });
    const reino = await prisma.faction.create({ data: { worldId, saveId, slug: 'reino-37', name: 'Reino de Gorhorn', raza: 'orcos', description: 'x', origenSlug: null } });
    enemigaId = (await prisma.faction.create({
      data: {
        worldId, saveId, slug: 'enemiga-37', name: 'Clan Enemigo', raza: 'orcos', description: 'x', origenSlug: 'enemiga',
        kingdomStats: { create: { ownerKey: `enemiga-37-${saveId}`, poblacion: 40, soldados: 20, comida: 2000 } },
        buildings: { create: { saveId: null, locationId: suya, recipeKey: 'cocina-serhu', name: 'Cocina', kind: 'cocina', description: 'x', status: 'ACTIVO' } },
      },
    })).id;
    await prisma.factionRelation.create({ data: { worldId, sourceFactionId: enemigaId, targetFactionId: reino.id, type: 'GUERRA', presion: 95 } });
    capitalId = (await prisma.building.create({ data: { saveId, locationId: casa, recipeKey: 'ayuntamiento', name: 'Karot', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 } })).id;
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('deja un tercio de sus soldados en casa', () => {
    expect([3, 20, 50].map(soldadosEnCasa)).toEqual([1, 7, 17]);
  });

  it('manda a la Capital lo que cree necesitar (sin defensa, 2) y no otro mientras ese siga en marcha', async () => {
    expect(await lanzarEjercitosContraElReino(prisma, saveId, 800)).toBe(1);
    expect(await lanzarEjercitosContraElReino(prisma, saveId, 801)).toBe(0);
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId, factionId: enemigaId }, include: { miembros: true } });
    expect(v).toMatchObject({ tipo: 'ASALTO', origenLocationId: suya, destinoLocationId: casa, carga: { motivo: expect.stringContaining('ha reunido 20 soldados') } });
    expect(v.miembros[0]!.genericos).toBe(2);
    expect(await prisma.logEntry.count({ where: { saveId, text: { contains: 'estamos en guerra' } } })).toBe(1);
  });

  it('defienden también los guardias de fauna y el personaje con su grupo; sus muertos salen de sus soldados', async () => {
    const corral = await prisma.building.create({ data: { saveId, locationId: casa, recipeKey: 'corrales', name: 'Corrales', kind: 'corrales', description: 'x', status: 'ACTIVO', tier: 1 } });
    await prisma.ganado.create({ data: { saveId, buildingId: corral.id, especie: 'canizor', sexo: 'M', nacidoEn: 800 * 1440 - 240 * 1440 } });
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId, factionId: enemigaId }, include: { miembros: true } });
    const r = await prisma.$transaction((tx) => resolverAsaltoDeFondo(tx, saveId, v, capitalId, 805, semilla(7)));
    // Personaje y guardia (sin guarnición ni milicia).
    expect(r!.defensores).toBe(2);
    // Los 2 que salieron ya no cuentan en casa; los muertos no vuelven.
    expect((await prisma.kingdomStats.findFirstOrThrow({ where: { factionId: enemigaId } })).soldados).toBe(18);
    await prisma.$transaction(async (tx) => (await import('./viajeros.js')).TRABAJOS.ASALTO!.alVolver!(tx, await tx.viajero.findUniqueOrThrow({ where: { id: v.id }, include: { miembros: true } }), 806, () => 0.5));
    expect((await prisma.kingdomStats.findFirstOrThrow({ where: { factionId: enemigaId } })).soldados).toBe(18 + 2 - r!.caidosAsaltantes);
    expect(await prisma.logEntry.count({ where: { saveId, text: { contains: 'clan enemigo', mode: 'insensitive' } } })).toBeGreaterThan(1);
  });

  it('ante una defensa fuerte no le salen las cuentas y espera (sin temporizador)', async () => {
    await prisma.viajero.updateMany({ where: { saveId, factionId: enemigaId }, data: { estado: 'TERMINADO' } });
    for (let i = 0; i < 6; i++) await prisma.subject.create({ data: { saveId, name: `Guardia ${i}`, role: 'soldado', notes: '', pueblo: 'orcos' } });
    await prisma.kingdomStats.updateMany({ where: { factionId: enemigaId }, data: { soldados: 9 } });
    expect(await lanzarEjercitosContraElReino(prisma, saveId, 806)).toBe(0);
    // Con muchos más soldados, sí.
    await prisma.kingdomStats.updateMany({ where: { factionId: enemigaId }, data: { soldados: 40 } });
    expect(await lanzarEjercitosContraElReino(prisma, saveId, 807)).toBe(1);
  });
});

/// CR-37 (37b): tributo y contraataque, por HTTP.
describe('tributo y contraataque (CR-37 37b)', () => {
  let saveId: string;
  let enemigaId: string;
  let worldId: string;
  const app = Fastify();

  beforeAll(async () => {
    await app.register(guerraRoutes);
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const enlaces = await enlacesDelMundo(prisma, worldId);
    const llanuras = await prisma.location.findMany({ where: { worldId, region: 'Las Llanuras del Viento Rojo' }, select: { id: true } });
    let par: [string, string] | null = null;
    for (const a of llanuras) for (const b of llanuras) if (!par && a.id !== b.id && rutaMasCorta(enlaces, a.id, b.id)) par = [a.id, b.id];
    const [casa, suya] = par!;
    saveId = (await prisma.save.create({
      data: { userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (CR-37b)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G', worldState: { create: { fictionalMinutes: 900 * 1440 } } },
    })).id;
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }), riqueza: 1000 } });
    await prisma.building.create({ data: { saveId, locationId: casa, recipeKey: 'ayuntamiento', name: 'Karot', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 } });
    const reino = await prisma.faction.create({ data: { worldId, saveId, slug: 'reino-37b', name: 'Reino', raza: 'orcos', description: 'x', origenSlug: null } });
    enemigaId = (await prisma.faction.create({
      data: {
        worldId, saveId, slug: 'enemiga-37b', name: 'Clan Rival', raza: 'orcos', description: 'x', origenSlug: 'rival',
        kingdomStats: { create: { ownerKey: `enemiga-37b-${saveId}`, soldados: 0, comida: 400, riqueza: 200 } },
        buildings: { create: { saveId: null, locationId: suya, recipeKey: 'cocina-serhu', name: 'Cocina', kind: 'cocina', description: 'x', status: 'ACTIVO' } },
      },
    })).id;
    await prisma.factionRelation.create({ data: { worldId, sourceFactionId: enemigaId, targetFactionId: reino.id, type: 'GUERRA', presion: 99 } });
    for (let i = 0; i < 4; i++) await prisma.subject.create({ data: { saveId, name: `Soldado ${i}`, role: 'soldado', notes: '', pueblo: 'orcos' } });
  });
  afterAll(async () => {
    await app.close();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('lista la guerra; el tributo baja la presión y pasa los Goirnos', async () => {
    const g = await app.inject({ method: 'GET', url: `/saves/${saveId}/guerra` });
    expect(g.json().enemigas[0]).toMatchObject({ id: enemigaId, relacion: 'GUERRA', presion: 99 });
    expect((await app.inject({ method: 'POST', url: `/saves/${saveId}/guerra/${enemigaId}/tributo`, payload: { goirnos: 50 } })).statusCode).toBe(400);
    const r = await app.inject({ method: 'POST', url: `/saves/${saveId}/guerra/${enemigaId}/tributo`, payload: { goirnos: 300 } });
    expect(r.json()).toMatchObject({ ok: true, pagado: 300 });
    expect((await prisma.factionRelation.findFirstOrThrow({ where: { sourceFactionId: enemigaId } })).presion).toBe(69);
    expect((await prisma.kingdomStats.findFirstOrThrow({ where: { saveId } })).riqueza).toBe(700);
    expect((await prisma.kingdomStats.findFirstOrThrow({ where: { factionId: enemigaId } })).riqueza).toBe(500);
  });

  it('el contraataque solo contra quien está en guerra; si gana, vuelve con su botín', async () => {
    await prisma.factionRelation.updateMany({ where: { sourceFactionId: enemigaId }, data: { type: 'GUERRA', presion: 95 } });
    const soldados = (await prisma.subject.findMany({ where: { saveId } })).map((s) => s.id);
    const r = await app.inject({ method: 'POST', url: `/saves/${saveId}/guerra/${enemigaId}/atacar`, payload: { subjectIds: soldados } });
    expect(r.statusCode).toBe(200);
    const v = await prisma.viajero.findUniqueOrThrow({ where: { id: r.json().id }, include: { miembros: true } });
    expect(v).toMatchObject({ tipo: TIPO_ATAQUE_ASENTAMIENTO, objetivo: enemigaId });
    // Sin soldados que la defiendan, cae.
    await prisma.$transaction((tx) => TRABAJOS[TIPO_ATAQUE_ASENTAMIENTO]!.alLlegar!(tx, v, 901, () => 0.5));
    const tras = await prisma.viajero.findUniqueOrThrow({ where: { id: v.id }, include: { miembros: true } });
    const botin = (tras.carga as { botin: { comida: number; goirnos: number } }).botin;
    expect(botin.comida).toBeGreaterThan(0);
    const antes = (await prisma.kingdomStats.findFirstOrThrow({ where: { saveId } })).riqueza;
    await prisma.$transaction((tx) => TRABAJOS[TIPO_ATAQUE_ASENTAMIENTO]!.alVolver!(tx, tras, 902, () => 0.5));
    expect((await prisma.kingdomStats.findFirstOrThrow({ where: { saveId } })).riqueza).toBe(antes + botin.goirnos);
  });
});
