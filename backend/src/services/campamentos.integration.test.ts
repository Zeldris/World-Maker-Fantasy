import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { campamentosActivos, revisarCampamentos } from './campamentos.js';
import { regionesConCampamentos } from './cronista/campamentosBandidos.js';

function semilla(s: number) {
  let x = s;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

/// CR-50 (50a): aparición y refuerzos de los campamentos de bandidos.
describe('campamentos de bandidos (CR-50 50a)', () => {
  let saveId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    saveId = (await prisma.save.create({
      data: { userId: await getDefaultUserId(), worldId: world.id, characterName: 'Observadora (CR-50)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'O' },
    })).id;
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('nada antes del día 10; el 10, uno por región con ocupantes y sitio, con su punto de banda', async () => {
    const random = semilla(4);
    expect(await revisarCampamentos(prisma, saveId, 9, random)).toBe(0);
    const n = await revisarCampamentos(prisma, saveId, 10, random);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(regionesConCampamentos().length);
    expect(await revisarCampamentos(prisma, saveId, 11, random)).toBe(0);
    const activos = await prisma.$transaction((tx) => campamentosActivos(tx, saveId));
    expect(new Set(activos.map((c) => c.region)).size).toBe(activos.length);
    const c = activos[0]!;
    expect(c.gente).toBeGreaterThanOrEqual(6);
    const punto = await prisma.zonePoint.findUniqueOrThrow({ where: { id: c.zonePointId! } });
    expect(punto).toMatchObject({ tipo: 'NPC', targetSlug: c.npcSlug, cantidad: c.gente + 1, locationId: c.locationId, saveId });
    // Nunca en un asentamiento.
    expect(await prisma.zonePoint.count({ where: { locationId: c.locationId, tipo: 'EDIFICIO', OR: [{ saveId: null }, { saveId }] } })).toBe(0);
  });

  it('refuerzos cada 3 días hasta su tope; destruido, se rehace a los 20 días en otro sitio', async () => {
    const c = (await prisma.$transaction((tx) => campamentosActivos(tx, saveId)))[0]!;
    await prisma.campamento.update({ where: { id: c.id }, data: { gente: 2, ultimoRefuerzoDia: 11 } });
    await revisarCampamentos(prisma, saveId, 17, semilla(1));
    const reforzado = await prisma.campamento.findUniqueOrThrow({ where: { id: c.id } });
    expect(reforzado.gente).toBe(4);
    expect((await prisma.zonePoint.findUniqueOrThrow({ where: { id: c.zonePointId! } })).cantidad).toBe(5);
    await prisma.campamento.update({ where: { id: c.id }, data: { estado: 'DESTRUIDO', caidoDia: 18 } });
    await revisarCampamentos(prisma, saveId, 37, semilla(2));
    expect(await prisma.campamento.count({ where: { saveId, region: c.region, estado: 'ACTIVO' } })).toBe(0);
    await revisarCampamentos(prisma, saveId, 38, semilla(2));
    const nuevo = await prisma.campamento.findFirstOrThrow({ where: { saveId, region: c.region, estado: 'ACTIVO' } });
    expect(nuevo.creadoDia).toBe(38);
  });
});

/// CR-50 (50b): asaltos de los bandidos a viajeros, caravanas y al Reino.
describe('asaltos de los campamentos (CR-50 50b)', () => {
  let saveId: string;
  let campId: string;
  let campLoc: string;
  let capitalLoc: string;

  beforeAll(async () => {
    const { enlacesDelMundo, rutaMasCorta } = await import('./viajeros.js');
    const { ownerKeyFor } = await import('./reinoOwner.js');
    const { posicionEnZona } = await import('./viajerosCruce.js');
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const enlaces = await enlacesDelMundo(prisma, world.id);
    const llanuras = await prisma.location.findMany({ where: { worldId: world.id, region: 'Las Llanuras del Viento Rojo' }, select: { id: true } });
    let par: [string, string] | null = null;
    for (const a of llanuras) for (const b of llanuras) if (!par && a.id !== b.id && rutaMasCorta(enlaces, a.id, b.id)) par = [a.id, b.id];
    [campLoc, capitalLoc] = par!;
    saveId = (await prisma.save.create({
      data: { userId: await getDefaultUserId(), worldId: world.id, characterName: 'Gorhorn (CR-50b)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G' },
    })).id;
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }), riqueza: 300 } });
    await prisma.building.create({ data: { saveId, locationId: capitalLoc, recipeKey: 'ayuntamiento', name: 'Karot', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 } });
    const c = await prisma.campamento.create({ data: { saveId, locationId: campLoc, region: 'Las Llanuras del Viento Rojo', ocupante: 'renegados-goirntes', cabecilla: 'Cabecilla de los renegados', gente: 8, tope: 8, creadoDia: 10, ultimoRefuerzoDia: 10 } });
    const p = await prisma.zonePoint.create({ data: { saveId, locationId: campLoc, tipo: 'NPC', targetSlug: 'goirnte-renegado', cantidad: 9, ...posicionEnZona(c.id) } });
    campId = (await prisma.campamento.update({ where: { id: c.id }, data: { zonePointId: p.id } })).id;
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('salen a por la Capital de su región con la mitad de su gente, como mucho cada 7 días', async () => {
    const { lanzarAsaltosAlReino } = await import('./campamentos.js');
    expect(await lanzarAsaltosAlReino(prisma, saveId, 12)).toBe(1);
    expect(await lanzarAsaltosAlReino(prisma, saveId, 13)).toBe(0);
    const v = await prisma.viajero.findFirstOrThrow({ where: { saveId, tipo: 'ASALTO' }, include: { miembros: true } });
    expect(v).toMatchObject({ origenLocationId: campLoc, destinoLocationId: capitalLoc, carga: { campamentoId: campId } });
    expect(v.miembros[0]!.genericos).toBe(4);
    expect(await prisma.campamento.findUniqueOrThrow({ where: { id: campId } })).toMatchObject({ gente: 4, ultimoAsaltoReinoDia: 12 });
    // Vuelven con botín: el campamento recupera a los suyos, guarda lo saqueado y crece.
    const { volverAlCampamento } = await import('./campamentos.js');
    await prisma.$transaction(async (tx) => volverAlCampamento(tx, { ...v, carga: { campamentoId: campId, botin: { comida: 30, goirnos: 15 } } }));
    expect(await prisma.campamento.findUniqueOrThrow({ where: { id: campId } })).toMatchObject({ gente: 8, tope: 9, botinComida: 30, botinGoirnos: 15 });
    expect((await prisma.zonePoint.findFirstOrThrow({ where: { saveId, tipo: 'NPC' } })).cantidad).toBe(9);
  });

  it('asaltan a quien pasa cerca y a las caravanas', async () => {
    const { asaltoAlViajero, asaltoACaravana } = await import('./campamentos.js');
    const { crearViajero } = await import('./viajeros.js');
    const sub = await prisma.subject.create({ data: { saveId, name: 'Cazador', role: 'cazador', notes: '', pueblo: 'orcos' } });
    const r = await prisma.$transaction((tx) => crearViajero(tx, { saveId, tipo: 'CAZA', objetivo: 'murgol', origenLocationId: capitalLoc, destinoLocationId: campLoc, dia: 14, miembros: [{ subjectId: sub.id, rol: 'cazador' }] }));
    const v = await prisma.viajero.findUniqueOrThrow({ where: { id: (r as { id: string }).id }, include: { miembros: true } });
    // Sin suerte de los bandidos (tirada alta), nada.
    expect(await prisma.$transaction((tx) => asaltoAlViajero(tx, v, campLoc, 14, () => 0.99))).toBeNull();
    const res = await prisma.$transaction((tx) => asaltoAlViajero(tx, v, campLoc, 14, () => 0.01));
    expect(['sigue', 'vuelve']).toContain(res);
    expect(await prisma.logEntry.count({ where: { saveId, text: { contains: 'Goirnte Renegado' } } })).toBe(1);
    const c = await prisma.campamento.findUniqueOrThrow({ where: { id: campId } });
    expect(c.gente).toBe((await prisma.zonePoint.findUniqueOrThrow({ where: { id: c.zonePointId! } })).cantidad - 1);
    // La caravana: con gente en el campamento.
    await prisma.campamento.update({ where: { id: campId }, data: { gente: 5 } });
    expect(await prisma.$transaction((tx) => asaltoACaravana(tx, saveId, campLoc, 40, () => 0.01))).toBe('Renegados goirntes');
    expect((await prisma.campamento.findUniqueOrThrow({ where: { id: campId } })).botinGoirnos).toBe(55);
  });
});

/// CR-50 (50d, Q7): se conoce un campamento si estuviste allí, si te llegó el rumor o si lo ve una Torre.
describe('conocer los campamentos (CR-50 50d)', () => {
  let saveId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    saveId = (await prisma.save.create({
      data: { userId: await getDefaultUserId(), worldId: world.id, characterName: 'Exploradora (CR-50d)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'E', worldState: { create: { fictionalMinutes: 10 * 1440 } } },
    })).id;
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('al asentarse deja un rumor; se conoce por estar allí o porque te llega', async () => {
    const { campamentosConocidos } = await import('./campamentos.js');
    const { conocer } = await import('./cronista/difusion.js');
    await revisarCampamentos(prisma, saveId, 10, semilla(9));
    const sucesos = await prisma.suceso.findMany({ where: { saveId, tipo: 'CAMPAMENTO_NUEVO' } });
    const activos = await prisma.campamento.findMany({ where: { saveId, estado: 'ACTIVO' } });
    expect(sucesos).toHaveLength(activos.length);
    expect(await prisma.$transaction((tx) => campamentosConocidos(tx, saveId))).toHaveLength(0);
    // Estar allí.
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: activos[0]!.locationId } });
    expect(await prisma.$transaction((tx) => campamentosConocidos(tx, saveId))).toHaveLength(1);
    // Que te llegue el rumor.
    if (activos[1]) {
      const s = sucesos.find((x) => x.locationId === activos[1]!.locationId)!;
      await prisma.$transaction((tx) => conocer(tx, { saveId, sucesoId: s.id, via: 'NPC', confirmado: false, minutos: 10 * 1440, escribirNoticia: false }));
      const conocidos = await prisma.$transaction((tx) => campamentosConocidos(tx, saveId));
      expect(conocidos).toHaveLength(2);
      expect(conocidos[0]).toMatchObject({ grupo: expect.any(String), cabecilla: expect.any(String) });
    }
  });
});
