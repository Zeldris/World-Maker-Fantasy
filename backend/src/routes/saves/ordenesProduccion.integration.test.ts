import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { ordenesProduccionRoutes } from './ordenesProduccion.js';

/// CRUD de OrdenProduccion (hueco B, rediseño de Producción estilo Bellwright, 2026-09-21,
/// docs/rpgtarkor/mundo-vivo-x4.md § 4.4-ter). Test de integración real contra Postgres, sin
/// mocks — mismo patrón que parcelas.integration.test.ts.
async function buildApp() {
  const app = Fastify();
  await app.register(ordenesProduccionRoutes);
  return app;
}

describe('CRUD de OrdenProduccion (2026-09-21)', () => {
  let saveId: string;
  let buildingId: string;
  let buildingOtraSaveId: string;
  let otraSaveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (ordenes-produccion)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
    const building = await prisma.building.create({
      data: { saveId, locationId: hondonada.id, recipeKey: 'choza', name: 'Choza de prueba', kind: 'choza', description: 'x', status: 'ACTIVO' },
    });
    buildingId = building.id;

    const otraSave = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (otra partida, ordenes)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    otraSaveId = otraSave.id;
    const buildingOtraSave = await prisma.building.create({
      data: { saveId: otraSaveId, locationId: hondonada.id, recipeKey: 'choza', name: 'Choza ajena', kind: 'choza', description: 'x', status: 'ACTIVO' },
    });
    buildingOtraSaveId = buildingOtraSave.id;
  });

  afterAll(async () => {
    await prisma.ordenProduccion.deleteMany({ where: { buildingId: { in: [buildingId, buildingOtraSaveId] } } });
    await prisma.building.deleteMany({ where: { id: { in: [buildingId, buildingOtraSaveId] } } });
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.save.delete({ where: { id: otraSaveId } });
  });

  it('GET devuelve [] antes de crear ninguna orden', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/edificios/${buildingId}/ordenes` });
    expect(res.statusCode).toBe(200);
    expect(res.json().ordenes).toEqual([]);
  });

  it('404 si el Building pertenece a otra partida', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: `/saves/${saveId}/edificios/${buildingOtraSaveId}/ordenes`,
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST crea una orden real, con defaults reponer/prioridad 5/sin límite', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/edificios/${buildingId}/ordenes`,
      payload: { recipeKey: 'smokeMeat' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().orden).toMatchObject({ buildingId, recipeKey: 'smokeMeat', modo: 'reponer', prioridad: 5, limite: null, activa: true });
  });

  it('POST con el mismo recipeKey hace upsert (reactiva en vez de duplicar, mismo criterio que el botón ✕ del frontend)', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/edificios/${buildingId}/ordenes`,
      payload: { recipeKey: 'smokeMeat', prioridad: 2 },
    });
    const list = await app.inject({ method: 'GET', url: `/saves/${saveId}/edificios/${buildingId}/ordenes` });
    const filas = list.json().ordenes.filter((o: { recipeKey: string }) => o.recipeKey === 'smokeMeat');
    expect(filas).toHaveLength(1);
    expect(filas[0].prioridad).toBe(2);
  });

  it('rechaza prioridad fuera de rango 0-9', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/edificios/${buildingId}/ordenes`,
      payload: { recipeKey: 'boiledLichenWater', prioridad: 10 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rechaza modo desconocido', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/edificios/${buildingId}/ordenes`,
      payload: { recipeKey: 'boiledLichenWater', modo: 'infinito' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PATCH cambia prioridad/límite/activa de una orden real', async () => {
    const app = await buildApp();
    const created = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/edificios/${buildingId}/ordenes`,
      payload: { recipeKey: 'boiledLichenWater' },
    });
    const ordenId = created.json().orden.id;

    const patched = await app.inject({
      method: 'PATCH',
      url: `/saves/${saveId}/ordenes/${ordenId}`,
      payload: { prioridad: 0, limite: 10, activa: false },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().orden).toMatchObject({ prioridad: 0, limite: 10, activa: false });
  });

  it('PATCH 404 si la orden pertenece a un Building de otra partida', async () => {
    const app = await buildApp();
    const created = await app.inject({
      method: 'POST',
      url: `/saves/${otraSaveId}/edificios/${buildingOtraSaveId}/ordenes`,
      payload: { recipeKey: 'boiledLichenWater' },
    });
    const ordenId = created.json().orden.id;

    const res = await app.inject({ method: 'PATCH', url: `/saves/${saveId}/ordenes/${ordenId}`, payload: { prioridad: 3 } });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE borra la orden de verdad', async () => {
    const app = await buildApp();
    const created = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/edificios/${buildingId}/ordenes`,
      payload: { recipeKey: 'firstAidBandage' },
    });
    const ordenId = created.json().orden.id;

    const deleted = await app.inject({ method: 'DELETE', url: `/saves/${saveId}/ordenes/${ordenId}` });
    expect(deleted.statusCode).toBe(200);
    expect(await prisma.ordenProduccion.findUnique({ where: { id: ordenId } })).toBeNull();
  });
});
