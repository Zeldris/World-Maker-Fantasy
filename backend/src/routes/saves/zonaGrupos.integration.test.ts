import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

/// Grupos de fauna reales en el mapa (2026-09-28, Fase 1 de `plan-mecanicas-por-zona-2026-09-28.md`,
/// B26) — harness de integración real (Postgres real, sin mocks) sobre una Location/Npc propios de
/// este test, mismo patrón que `zonaMover.integration.test.ts`: una `WorldPopulation` real con
/// población regional > `CANTIDAD_MAX_POR_PUNTO` (20) para forzar un reparto en varios grupos, no un
/// único punto.
const { zonaRoutes } = await import('./zona.js');

async function buildApp() {
  const app = Fastify();
  await app.register(zonaRoutes);
  return app;
}

describe('Grupos de fauna reales (GET /zona, POST /zona/mover)', () => {
  let saveId: string;
  let worldId: string;
  let locationId: string;
  let faunaNpcId: string;
  let poblacionId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;

    const location = await prisma.location.create({
      data: {
        worldId,
        slug: 'test-zona-grupos-fauna',
        name: 'Zona de Prueba de Grupos',
        region: 'Zona de Pruebas',
        kind: 'hito',
        description: 'x',
        aliases: ['zona de prueba de grupos'],
      },
    });
    locationId = location.id;

    const fauna = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PLANTILLA',
        slug: 'test-grupos-fauna',
        name: 'Bestia de Prueba (grupos)',
        aliases: ['bestia de prueba grupos'],
        role: 'Fauna de prueba',
        level: 1,
        attributes: { fuerza: 6, destreza: 6, constitucion: 6, inteligencia: 2, voluntad: 4, carisma: 2, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null,
        temperamento: 'CAUTELOSO',
      },
    });
    faunaNpcId = fauna.id;

    // Población regional real (12, tope real `CANTIDAD_MAX_POR_PUNTO`=20 no la recorta) — 100% del
    // peso en esta región de prueba, para que `poblacionRegionalPorSlug` sea exactamente 12.
    const poblacion = await prisma.worldPopulation.create({
      data: {
        worldId,
        targetType: 'FAUNA',
        targetSlug: 'test-grupos-fauna',
        label: 'Bestia de Prueba (grupos)',
        poblacion: 12,
        poblacionMax: 40,
        distribucion: { 'Zona de Pruebas': 1 },
      },
    });
    poblacionId = poblacion.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (grupos de fauna)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: locationId,
        zonaPosX: 25, // celda (0,0)
        zonaPosY: 25,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.worldPopulation.delete({ where: { id: poblacionId } });
    await prisma.npc.delete({ where: { id: faunaNpcId } });
    await prisma.location.delete({ where: { id: locationId } });
  });

  afterEach(async () => {
    await prisma.zonePoint.deleteMany({ where: { locationId } });
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.save.update({
      where: { id: saveId },
      data: { zonaPosX: 25, zonaPosY: 25, zonaCaminoPendiente: Prisma.JsonNull, pendingDynamicModeOffer: Prisma.JsonNull, zonaUltimoEncuentro: Prisma.JsonNull },
    });
  });

  it('GET /zona sobre un único ZonePoint FAUNA ancla + población regional real reparte en varios puntos cuya suma es el objetivo, cada uno ≤6 con 2-3 sueltos (QA-27)', async () => {
    // Único punto de catálogo, sin repartir todavía (`lastUpdatedAtMinutes: null` — el mismo estado
    // que sembraba el catálogo antes de esta pieza, ×1 en vez de ×20 porque el valor exacto no
    // importa: el primer reparto ignora `cantidad` y usa la población regional real).
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'FAUNA', targetSlug: 'test-grupos-fauna', cantidad: 1, activo: true },
    });

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/zona` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    const puntosFauna = body.puntos.filter((p: { tipo: string; targetSlug: string }) => p.tipo === 'FAUNA' && p.targetSlug === 'test-grupos-fauna');
    // Grupos reales, no un único punto ×N — el objetivo del plan.
    expect(puntosFauna.length).toBeGreaterThan(1);
    const total = puntosFauna.reduce((suma: number, p: { cantidad: number }) => suma + p.cantidad, 0);
    expect(total).toBe(12);
    for (const p of puntosFauna) expect(p.cantidad).toBeLessThanOrEqual(6);
    const sueltos = puntosFauna.filter((p: { cantidad: number }) => p.cantidad === 1).length;
    expect(sueltos === 2 || sueltos === 3).toBe(true);

    // Persistido de verdad — una segunda lectura no vuelve a repartir desde cero (todas las filas
    // ya tienen `lastUpdatedAtMinutes`, `primerReparto` ya no aplica).
    const filasReales = await prisma.zonePoint.findMany({ where: { locationId, tipo: 'FAUNA' } });
    expect(filasReales.length).toBe(puntosFauna.length);
    expect(filasReales.every((f) => f.lastUpdatedAtMinutes != null)).toBe(true);
  });

  it('POST /zona/mover contra un grupo devuelve dynamicModeOffer.cantidad y zonePointId del ZonePoint colisionado', async () => {
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 75, y: 25, tipo: 'FAUNA', targetSlug: 'test-grupos-fauna', cantidad: 1, activo: true, ruta: [{ x: 75, y: 25 }] },
    });

    const app = await buildApp();
    // GET /zona dispara el primer reparto (regla 2 del plan) — el ancla y las filas nuevas quedan
    // repartidas dentro de radio 2 de su celda (celdaLibreEnEspiral, zonaPosicion.ts), así que MÁS
    // de una puede caer adyacente al primer paso del jugador — no se puede predecir con CUÁL de
    // ellas colisiona primero (mismo orden no determinista que el resto del motor, sin `orderBy`).
    const getRes = await app.inject({ method: 'GET', url: `/saves/${saveId}/zona` });
    expect(getRes.statusCode).toBe(200);

    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/zona/mover`,
      payload: { destino: { x: 375, y: 25 } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.colision).toMatchObject({ targetSlug: 'test-grupos-fauna' });
    expect(body.dynamicModeOffer).toMatchObject({ tipo: 'FAUNA', targetSlug: 'test-grupos-fauna' });
    expect(body.dynamicModeOffer.zonePointId).toBeTruthy();

    // El grupo colisionado es SIEMPRE uno real de los repartidos por el primer reparto — su
    // `cantidad` en la oferta coincide exactamente con la persistida en ese `ZonePoint`.
    const puntoColisionado = await prisma.zonePoint.findUniqueOrThrow({ where: { id: body.dynamicModeOffer.zonePointId } });
    expect(body.dynamicModeOffer.cantidad).toBe(puntoColisionado.cantidad);
    expect(puntoColisionado.cantidad).toBeGreaterThanOrEqual(1);
    expect(puntoColisionado.cantidad).toBeLessThanOrEqual(6);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingDynamicModeOffer).toMatchObject({ zonePointId: body.dynamicModeOffer.zonePointId, cantidad: puntoColisionado.cantidad });
  });
});
