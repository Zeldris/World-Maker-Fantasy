import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { recalcularZonePointsDeLocation, zonePointsSummaryFor } from './zonePoints.js';

/// Integración real (mismo criterio que recolectar.integration.test.ts — sin LLM de por medio,
/// Postgres local basta) para la Pieza 3 de "Dinamismo del mundo": confirma que
/// `recalcularZonePointsDeLocation` lee `WorldPopulation` real y mueve `ZonePoint.cantidad` según
/// el tiempo de ficción transcurrido, y que `zonePointsSummaryFor` refleja ese estado para el
/// narrador. Fixtures propios (Location + ZonePoint + WorldPopulation temporales) para no
/// depender de qué haya sembrado hoy en el mundo real de la jugadora.
describe('recalcularZonePointsDeLocation + zonePointsSummaryFor (Postgres real)', () => {
  let worldId: string;
  let locationId: string;
  let zonePointId: string;
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;

    const location = await prisma.location.create({
      data: {
        worldId,
        slug: 'zona-punto-prueba-19',
        name: 'Zona de prueba (test Pieza 3)',
        region: 'Las Llanuras del Viento Rojo',
        kind: 'hito',
        description: 'x',
      },
    });
    locationId = location.id;

    await prisma.worldPopulation.create({
      data: {
        worldId,
        targetType: 'FAUNA',
        targetSlug: 'fauna-prueba-zonepoint-19',
        label: 'Fauna de prueba (test Pieza 3)',
        poblacion: 100,
        poblacionMax: 200,
        distribucion: { 'Llanuras del Viento Rojo': 1.0 },
      },
    });

    const zonePoint = await prisma.zonePoint.create({
      data: {
        locationId,
        x: 100,
        y: 100,
        tipo: 'FAUNA',
        targetSlug: 'fauna-prueba-zonepoint-19',
        cantidad: 1,
        activo: true,
      },
    });
    zonePointId = zonePoint.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (test Pieza 3)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.zonePoint.deleteMany({ where: { locationId } });
    await prisma.worldPopulation.deleteMany({ where: { worldId, targetSlug: 'fauna-prueba-zonepoint-19' } });
    await prisma.location.delete({ where: { id: locationId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('primera vez adopta el objetivo (población regional real recortada a CANTIDAD_MAX_POR_PUNTO=20)', async () => {
    await recalcularZonePointsDeLocation(prisma, worldId, locationId, 'Las Llanuras del Viento Rojo', 480);
    const punto = await prisma.zonePoint.findUniqueOrThrow({ where: { id: zonePointId } });
    expect(punto.cantidad).toBe(20);
    expect(punto.activo).toBe(true);
    expect(punto.lastUpdatedAtMinutes).toBe(480);
  });

  it('sin tiempo transcurrido desde el último recalculo, no cambia nada', async () => {
    await recalcularZonePointsDeLocation(prisma, worldId, locationId, 'Las Llanuras del Viento Rojo', 480);
    const punto = await prisma.zonePoint.findUniqueOrThrow({ where: { id: zonePointId } });
    expect(punto.cantidad).toBe(20);
  });

  it('una región sin peso en la distribución hace que el punto baje hacia 0 (población regional real es 0)', async () => {
    await recalcularZonePointsDeLocation(prisma, worldId, locationId, 'Cristal Helado', 480 + 24 * 60);
    const punto = await prisma.zonePoint.findUniqueOrThrow({ where: { id: zonePointId } });
    // Objetivo 0, tope de bajada diaria (AJUSTE_MAXIMO_POR_DIA=3) desde 20 -> 17
    expect(punto.cantidad).toBe(17);
    expect(punto.activo).toBe(true);
  });

  it('zonePointsSummaryFor refleja la cantidad real, agrupada con ×N', async () => {
    const resumen = await zonePointsSummaryFor(prisma, locationId, saveId);
    expect(resumen).toContain('×17');
  });

  it('punto inactivo (cantidad 0) desaparece del resumen del narrador', async () => {
    await prisma.zonePoint.update({ where: { id: zonePointId }, data: { cantidad: 0, activo: false } });
    const resumen = await zonePointsSummaryFor(prisma, locationId, saveId);
    expect(resumen).toBeNull();
  });
});
