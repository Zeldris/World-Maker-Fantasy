import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { descansarCampamentoRoutes } from './descansarCampamento.js';

/// "Descansar en campamento" (2026-09-08) — solo disponible con un Building propio ACTIVO en la
/// Location actual, salta al 08:00 del día siguiente, fija el punto de guardado (lastRestLocationId)
/// y cura hasta HERIDO como techo. Test de integración real contra Postgres, sin mocks.
async function buildApp() {
  const app = Fastify();
  await app.register(descansarCampamentoRoutes);
  return app;
}

const ATTRS = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

describe('Descansar en campamento (2026-09-08)', () => {
  let saveId: string;
  let locationId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    locationId = hondonada.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (descansar campamento)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
        condicionFisica: 'GRAVE',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 500 } }); // Día 1, 08:20
  });

  afterEach(async () => {
    await prisma.building.deleteMany({ where: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('GET sin ningún Building propio: no disponible', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/descansar-campamento` });
    expect(res.statusCode).toBe(200);
    expect(res.json().disponible).toBe(false);
  });

  it('GET con un Building propio ACTIVO en la Location actual: disponible', async () => {
    await prisma.building.create({
      data: { saveId, locationId, recipeKey: 'campamento', name: 'Campamento de prueba', kind: 'campamento', description: 'x', status: 'ACTIVO' },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/descansar-campamento` });
    expect(res.json().disponible).toBe(true);
  });

  it('GET con un Building EN_CONSTRUCCION (no ACTIVO): no disponible', async () => {
    await prisma.building.create({
      data: { saveId, locationId, recipeKey: 'campamento', name: 'Campamento a medias', kind: 'campamento', description: 'x', status: 'EN_CONSTRUCCION' },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/descansar-campamento` });
    expect(res.json().disponible).toBe(false);
  });

  it('POST sin Building propio: rechazado con 400', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/descansar-campamento` });
    expect(res.statusCode).toBe(400);
  });

  it('POST con Building propio: salta a las 08:00 del día siguiente, cura hasta HERIDO, guarda partida', async () => {
    await prisma.building.create({
      data: { saveId, locationId, recipeKey: 'campamento', name: 'Campamento de prueba', kind: 'campamento', description: 'x', status: 'ACTIVO' },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/descansar-campamento` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.condicionFisica).toBe('HERIDO'); // GRAVE -> techo HERIDO
    expect(body.timeLabel).toContain('08:00');
    expect(body.timeLabel).toContain('Día 2'); // 500min (Día 1) -> salta al Día 2, no se queda en el mismo día

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.condicionFisica).toBe('HERIDO');
    expect(saveAfter.lastRestLocationId).toBe(locationId);
    expect(saveAfter.energia).toBeGreaterThan(0);

    const worldStateAfter = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    expect(worldStateAfter.fictionalMinutes).toBeGreaterThan(500);

    const log = await prisma.logEntry.findFirst({ where: { saveId, text: { contains: 'descansa en su campamento' } } });
    expect(log).not.toBeNull();
  });

  it('POST con condicionFisica ya mejor que HERIDO (ILESO): no empeora, se queda ILESO', async () => {
    await prisma.building.create({
      data: { saveId, locationId, recipeKey: 'campamento', name: 'Campamento de prueba', kind: 'campamento', description: 'x', status: 'ACTIVO' },
    });
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO' } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/descansar-campamento` });
    expect(res.json().condicionFisica).toBe('ILESO');
  });
});
