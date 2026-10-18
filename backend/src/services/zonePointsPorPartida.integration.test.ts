import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { asegurarZonePointsDePartida, avanzarZonePointsUnPaso, recalcularZonePointsDeLocation } from './zonePoints.js';

/// Fase 5 (plan oct-2026, B1) — `ZonePoint` por partida. Dos partidas en la MISMA Location: mover /
/// recalcular en una no cambia la otra, y la plantilla de catálogo (`saveId` null) nunca cambia.
describe('ZonePoint por partida (Postgres real)', () => {
  let worldId: string;
  let locationId: string;
  let saveA: string;
  let saveB: string;
  let plantillaId: string;
  let poblacionId: string;

  const nuevaPartida = async (nombre: string) => {
    const userId = await getDefaultUserId();
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: nombre,
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: locationId,
      },
    });
    await prisma.worldState.create({ data: { saveId: save.id, fictionalMinutes: 480 } });
    return save.id;
  };

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const location = await prisma.location.create({
      data: { worldId, slug: 'test-zonepoint-por-partida', name: 'Zona por partida', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['zona por partida'] },
    });
    locationId = location.id;
    const plantilla = await prisma.zonePoint.create({
      data: {
        locationId,
        saveId: null,
        x: 75,
        y: 25,
        origenX: 75,
        origenY: 25,
        tipo: 'FAUNA',
        targetSlug: 'test-por-partida-fauna',
        label: 'Bestia de prueba',
        cantidad: 1,
        activo: true,
        ruta: [{ x: 75, y: 25 }, { x: 125, y: 25 }, { x: 175, y: 25 }],
      },
    });
    plantillaId = plantilla.id;
    const poblacion = await prisma.worldPopulation.create({
      data: { worldId, targetType: 'FAUNA', targetSlug: 'test-por-partida-fauna', label: 'x', poblacion: 12, poblacionMax: 40, distribucion: { 'Zona de Pruebas': 1 } },
    });
    poblacionId = poblacion.id;
    saveA = await nuevaPartida('Partida A (zonepoint por partida)');
    saveB = await nuevaPartida('Partida B (zonepoint por partida)');
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: [saveA, saveB] } } });
    await prisma.worldPopulation.delete({ where: { id: poblacionId } });
    await prisma.zonePoint.deleteMany({ where: { locationId } });
    await prisma.location.delete({ where: { id: locationId } });
  });

  it('asegurarZonePointsDePartida clona la plantilla por partida (lastUpdatedAtMinutes null) y es idempotente', async () => {
    const filasA = await asegurarZonePointsDePartida(prisma, saveA, locationId);
    expect(filasA).toHaveLength(1);
    expect(filasA[0].saveId).toBe(saveA);
    expect(filasA[0].id).not.toBe(plantillaId);
    expect(filasA[0].lastUpdatedAtMinutes).toBeNull();
    expect(filasA[0].targetSlug).toBe('test-por-partida-fauna');
    expect(filasA[0].ruta).toEqual([{ x: 75, y: 25 }, { x: 125, y: 25 }, { x: 175, y: 25 }]);
    await asegurarZonePointsDePartida(prisma, saveA, locationId);
    expect(await prisma.zonePoint.count({ where: { saveId: saveA, locationId } })).toBe(1);
    const filasB = await asegurarZonePointsDePartida(prisma, saveB, locationId);
    expect(filasB).toHaveLength(1);
    expect(filasB[0].id).not.toBe(filasA[0].id);
  });

  it('un re-seed que añade puntos a una Location ya clonada llega a la partida sin tocar lo suyo (resincronización aditiva)', async () => {
    const saveR = await nuevaPartida('Partida R (resincronización)');
    const [antes] = await asegurarZonePointsDePartida(prisma, saveR, locationId);
    await prisma.zonePoint.update({ where: { id: antes.id }, data: { cantidad: 7, x: 125 } });
    const nuevas = await Promise.all([
      prisma.zonePoint.create({ data: { locationId, saveId: null, x: 50, y: 50, tipo: 'RECURSO', targetSlug: 'test-resync-recurso', label: 'Fuente nueva', cantidad: 3, activo: true } }),
      prisma.zonePoint.create({ data: { locationId, saveId: null, x: 90, y: 90, tipo: 'FAUNA', targetSlug: 'test-resync-fauna', label: 'Bestia nueva', cantidad: 2, activo: true } }),
    ]);
    try {
      const filas = await asegurarZonePointsDePartida(prisma, saveR, locationId);
      expect(filas.map((f) => f.targetSlug).sort()).toEqual(['test-por-partida-fauna', 'test-resync-fauna', 'test-resync-recurso']);
      const propia = filas.find((f) => f.id === antes.id)!;
      expect({ cantidad: propia.cantidad, x: propia.x }).toEqual({ cantidad: 7, x: 125 });
      await asegurarZonePointsDePartida(prisma, saveR, locationId);
      expect(await prisma.zonePoint.count({ where: { saveId: saveR, locationId } })).toBe(3);
    } finally {
      await prisma.save.delete({ where: { id: saveR } });
      await prisma.zonePoint.deleteMany({ where: { id: { in: nuevas.map((n) => n.id) } } });
    }
  });

  it('mover en la partida A no cambia la B ni la plantilla', async () => {
    const random = () => 0.5;
    for (let i = 0; i < 2; i++) await avanzarZonePointsUnPaso(prisma, locationId, saveA, random);
    const a = await prisma.zonePoint.findFirstOrThrow({ where: { saveId: saveA, locationId } });
    const b = await prisma.zonePoint.findFirstOrThrow({ where: { saveId: saveB, locationId } });
    const plantilla = await prisma.zonePoint.findUniqueOrThrow({ where: { id: plantillaId } });
    expect(a.pasoRuta).toBeGreaterThan(0);
    expect(b.pasoRuta).toBe(0);
    expect({ x: b.x, y: b.y }).toEqual({ x: 75, y: 25 });
    expect(plantilla.pasoRuta).toBe(0);
    expect({ x: plantilla.x, y: plantilla.y }).toEqual({ x: 75, y: 25 });
  });

  // P187 (QA-27): el ganado de un bando es un rebaño fijo; no se reparte por la población salvaje de su especie.
  it('recalcular no reparte ni cambia un rebaño con dueño de la misma especie', async () => {
    const rebano = await prisma.zonePoint.create({
      data: { locationId, saveId: saveB, x: 625, y: 125, tipo: 'FAUNA', targetSlug: 'test-por-partida-fauna', label: 'Rebaño de prueba', factionSlug: 'Clan Serhu', cantidad: 6, activo: true },
    });
    try {
      await recalcularZonePointsDeLocation(prisma, worldId, saveB, locationId, 'Zona de Pruebas', 480);
      const despues = await prisma.zonePoint.findUniqueOrThrow({ where: { id: rebano.id } });
      expect({ cantidad: despues.cantidad, activo: despues.activo }).toEqual({ cantidad: 6, activo: true });
      expect(await prisma.zonePoint.count({ where: { saveId: saveB, locationId, factionSlug: 'Clan Serhu' } })).toBe(1);
    } finally {
      await prisma.zonePoint.deleteMany({ where: { saveId: saveB, locationId } });
      await prisma.zonePoint.create({ data: { locationId, saveId: saveB, x: 75, y: 25, tipo: 'FAUNA', targetSlug: 'test-por-partida-fauna', cantidad: 1, activo: true } });
    }
  });

  it('recalcular grupos en la partida A reparte solo A; B y plantilla intactas', async () => {
    await recalcularZonePointsDeLocation(prisma, worldId, saveA, locationId, 'Zona de Pruebas', 480);
    const filasA = await prisma.zonePoint.findMany({ where: { saveId: saveA, locationId, tipo: 'FAUNA' } });
    expect(filasA.length).toBeGreaterThan(1);
    expect(filasA.reduce((s, f) => s + f.cantidad, 0)).toBe(12);
    const filasB = await prisma.zonePoint.findMany({ where: { saveId: saveB, locationId } });
    expect(filasB).toHaveLength(1);
    expect(filasB[0].cantidad).toBe(1);
    expect(filasB[0].lastUpdatedAtMinutes).toBeNull();
    const plantillas = await prisma.zonePoint.findMany({ where: { saveId: null, locationId } });
    expect(plantillas).toHaveLength(1);
    expect(plantillas[0].cantidad).toBe(1);
    expect(plantillas[0].lastUpdatedAtMinutes).toBeNull();
  });

  it('borrar la partida borra sus ZonePoint (cascade) sin tocar la plantilla', async () => {
    const saveC = await nuevaPartida('Partida C (zonepoint por partida)');
    await asegurarZonePointsDePartida(prisma, saveC, locationId);
    expect(await prisma.zonePoint.count({ where: { saveId: saveC } })).toBe(1);
    await prisma.save.delete({ where: { id: saveC } });
    expect(await prisma.zonePoint.count({ where: { saveId: saveC } })).toBe(0);
    expect(await prisma.zonePoint.count({ where: { saveId: null, locationId } })).toBe(1);
  });
});
