import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

/// Icono de parcela en el mapa de Zona (docs/rpgtarkor/mundo-vivo-x4.md § 7.4, 2026-09-21) —
/// `GET /saves/:id/zona` debe exponer las `Parcela` reales de la Location actual (backend real de
/// § 7.4 ya existía, `parcelas.ts`; el enganche a `/zona` faltaba, es lo que prueba este archivo).
/// Harness real contra Postgres (sin mocks) — mismo patrón que `zonaCompanion.integration.test.ts`.
const { zonaRoutes } = await import('./zona.js');

async function buildApp() {
  const app = Fastify();
  await app.register(zonaRoutes);
  return app;
}

describe('GET /saves/:id/zona — icono de parcela', () => {
  let saveId: string;
  let worldId: string;
  let interiorLocationId: string;
  let hondonadaId: string;
  let avanzadaId: string;
  let basicaId: string;
  let buildingId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    hondonadaId = hondonada.id;

    const interiorLocation = await prisma.location.create({
      data: { worldId, slug: 'test-zona-parcelas-interior', name: 'Hogar de Prueba (parcelas)', region: 'Las Llanuras del Viento Rojo', kind: 'interior', description: 'x', aliases: [] },
    });
    interiorLocationId = interiorLocation.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (zona parcelas)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: interiorLocationId,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 500 } });

    const building = await prisma.building.create({
      data: { saveId, locationId: interiorLocationId, recipeKey: 'ayuntamiento', name: 'Ayuntamiento de Prueba', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1, x: 400, y: 300 },
    });
    buildingId = building.id;

    const avanzada = await prisma.parcela.create({
      data: { locationId: interiorLocationId, x: 400, y: 300, tipo: 'AVANZADA', recipeKeyFijo: 'ayuntamiento', buildingId: building.id },
    });
    avanzadaId = avanzada.id;
    const basica = await prisma.parcela.create({
      data: { locationId: interiorLocationId, x: 400, y: 150, tipo: 'BASICA' },
    });
    basicaId = basica.id;
  });

  afterAll(async () => {
    await prisma.parcela.deleteMany({ where: { locationId: interiorLocationId } });
    await prisma.building.deleteMany({ where: { id: buildingId } });
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.location.delete({ where: { id: interiorLocationId } });
  });

  it('una zona-interior sin ZonePoint sembrado pero con Parcela real queda disponible, con el array parcelas relleno', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/zona` });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.disponible).toBe(true);
    expect(body.parcelas).toHaveLength(2);

    const avanzada = body.parcelas.find((p: { id: string }) => p.id === avanzadaId);
    expect(avanzada).toMatchObject({ x: 400, y: 300, tipo: 'AVANZADA', building: { id: buildingId, name: 'Ayuntamiento de Prueba', status: 'ACTIVO' } });

    const basica = body.parcelas.find((p: { id: string }) => p.id === basicaId);
    expect(basica).toMatchObject({ x: 400, y: 150, tipo: 'BASICA', building: null });
  });

  it('una zona normal del mundo (sin Parcela sembrada) devuelve parcelas: []', async () => {
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(),
        worldId,
        characterName: 'Gorhorn de prueba (sin parcelas)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonadaId,
      },
    });
    await prisma.worldState.create({ data: { saveId: save.id, fictionalMinutes: 500 } });
    try {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: `/saves/${save.id}/zona` });
      expect(res.statusCode).toBe(200);
      expect(res.json().parcelas).toEqual([]);
    } finally {
      await prisma.save.delete({ where: { id: save.id } });
    }
  });
});
