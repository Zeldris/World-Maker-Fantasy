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

  // Grupos de fauna (2026-09-28): la especie se reparte en varios ZonePoint (grupos de 1-4) — lo
  // que se conserva es el TOTAL de la especie en la Location, no la cantidad de una sola fila.
  const filasDeLaEspecie = () => prisma.zonePoint.findMany({ where: { locationId, targetSlug: 'fauna-prueba-zonepoint-19' } });
  const totalDeLaEspecie = async () => (await filasDeLaEspecie()).reduce((suma, f) => suma + f.cantidad, 0);

  it('primera vez adopta el objetivo (población regional real recortada a CANTIDAD_MAX_POR_PUNTO=20), repartido en grupos de ≤4', async () => {
    await recalcularZonePointsDeLocation(prisma, worldId, locationId, 'Las Llanuras del Viento Rojo', 480);
    const filas = await filasDeLaEspecie();
    expect(await totalDeLaEspecie()).toBe(20);
    expect(filas.length).toBeGreaterThan(1);
    for (const f of filas) expect(f.cantidad).toBeLessThanOrEqual(4);
    const ancla = await prisma.zonePoint.findUniqueOrThrow({ where: { id: zonePointId } });
    expect(ancla.activo).toBe(true);
    expect(ancla.lastUpdatedAtMinutes).toBe(480);
  });

  it('sin tiempo transcurrido desde el último recalculo, no cambia nada', async () => {
    await recalcularZonePointsDeLocation(prisma, worldId, locationId, 'Las Llanuras del Viento Rojo', 480);
    expect(await totalDeLaEspecie()).toBe(20);
  });

  it('una región sin peso en la distribución hace que el total baje hacia 0 (población regional real es 0)', async () => {
    await recalcularZonePointsDeLocation(prisma, worldId, locationId, 'Cristal Helado', 480 + 24 * 60);
    // Objetivo 0, tope de bajada diaria (AJUSTE_MAXIMO_POR_DIA=3) desde 20 -> 17
    expect(await totalDeLaEspecie()).toBe(17);
    expect((await prisma.zonePoint.findUniqueOrThrow({ where: { id: zonePointId } })).id).toBe(zonePointId);
  });

  it('zonePointsSummaryFor refleja la cantidad real, agrupada con ×N, en el bloque de FAUNA (2026-09-15: resumen separado por tipo)', async () => {
    const resumen = await zonePointsSummaryFor(prisma, locationId, saveId);
    expect(resumen?.fauna).toContain('×17');
    expect(resumen?.npc).toBeNull();
    expect(resumen?.recurso).toBeNull();
    expect(resumen?.edificio).toBeNull();
  });

  it('punto inactivo (cantidad 0) desaparece del resumen del narrador', async () => {
    await prisma.zonePoint.deleteMany({ where: { locationId, targetSlug: 'fauna-prueba-zonepoint-19', id: { not: zonePointId } } });
    await prisma.zonePoint.update({ where: { id: zonePointId }, data: { cantidad: 0, activo: false } });
    const resumen = await zonePointsSummaryFor(prisma, locationId, saveId);
    expect(resumen).toBeNull();
  });

  // Bug real cazado jugando en vivo (2026-09-15): un ZonePoint de FAUNA con `label` de escenario
  // ("Colmena de Lebude") se coló en el mismo bloque de contexto que un NPC real, bajo un
  // encabezado que decía "QUIÉN ESTÁ AQUÍ" — el modelo confundió la fauna con el apellido de una
  // persona y narró "el pescador de Lebude", un NPC inventado. Este test confirma que NPC/FAUNA
  // van a listas separadas del resumen, nunca mezclados en una sola cadena de texto.
  describe('NPC y FAUNA mezclados en la misma Location van a listas separadas', () => {
    let npcZonePointId: string;

    beforeAll(async () => {
      await prisma.zonePoint.update({ where: { id: zonePointId }, data: { cantidad: 5, activo: true } });
      const npc = await prisma.npc.findFirstOrThrow({ where: { slug: 'gistera-koh' } });
      const npcZonePoint = await prisma.zonePoint.create({
        data: { locationId, x: 200, y: 200, tipo: 'NPC', targetSlug: npc.slug, cantidad: 1, activo: true },
      });
      npcZonePointId = npcZonePoint.id;
    });

    afterAll(async () => {
      await prisma.zonePoint.delete({ where: { id: npcZonePointId } });
    });

    it('el NPC real aparece en `npc`, la fauna aparece en `fauna`, nunca en la misma cadena', async () => {
      const resumen = await zonePointsSummaryFor(prisma, locationId, saveId);
      expect(resumen?.npc).toContain('Gistera Koh');
      expect(resumen?.fauna).toContain('fauna-prueba-zonepoint-19');
      expect(resumen?.npc).not.toContain('fauna-prueba-zonepoint-19');
      expect(resumen?.fauna).not.toContain('Gistera Koh');
    });
  });
});
