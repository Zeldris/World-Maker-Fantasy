import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { ownerKeyFor } from '../../services/reinoOwner.js';
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

  it('GET avisa de la carencia (P305), mirada al amanecer: sin comer ni beber, "ambas"; con provisiones, null', async () => {
    await prisma.building.create({
      data: { saveId, locationId, recipeKey: 'campamento', name: 'Campamento de prueba', kind: 'campamento', description: 'x', status: 'ACTIVO' },
    });
    const app = await buildApp();
    const carencia = async () => (await app.inject({ method: 'GET', url: `/saves/${saveId}/descansar-campamento` })).json().carencia;
    try {
      // Día 4, 20:00 (5.520 min); el descanso acaba el Día 5 a las 08:00 (6.240 min, 12 h después).
      await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 5520 } });
      await prisma.save.update({ where: { id: saveId }, data: { lastAteAtMinutes: 0, lastDrankAtMinutes: 0 } });
      expect(await carencia()).toBe('ambas');
      // Acaba de beber (al amanecer, sed al 50 %): queda el hambre.
      await prisma.save.update({ where: { id: saveId }, data: { lastDrankAtMinutes: 5500 } });
      expect(await carencia()).toBe('hambre');
      // Con las dos al día no hay aviso.
      await prisma.save.update({ where: { id: saveId }, data: { lastAteAtMinutes: 5500 } });
      expect(await carencia()).toBeNull();
      // Bebió hace 10 h: ahora la sed está al 50 %, pero al amanecer (22 h) llega a 0 %: el aviso ya sale.
      await prisma.save.update({ where: { id: saveId }, data: { lastDrankAtMinutes: 4920 } });
      expect(await carencia()).toBe('sed');
    } finally {
      await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 500 } });
      await prisma.save.update({ where: { id: saveId }, data: { lastAteAtMinutes: null, lastDrankAtMinutes: null } });
    }
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

  it('POST corre el tick diario del Reino al cruzar la medianoche (P217)', async () => {
    await prisma.building.create({
      data: { saveId, locationId, recipeKey: 'campamento', name: 'Campamento de prueba', kind: 'campamento', description: 'x', status: 'ACTIVO' },
    });
    const ownerKey = ownerKeyFor({ saveId });
    await prisma.kingdomStats.create({ data: { saveId, ownerKey, poblacion: 10, comida: 400, bebida: 400 } });
    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 500 } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/descansar-campamento` });
    expect(res.statusCode).toBe(200);
    const k = await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey } });
    expect(k.bebida).toBeLessThan(400);
    await prisma.kingdomStats.delete({ where: { ownerKey } });
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
