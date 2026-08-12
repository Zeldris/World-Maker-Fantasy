import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

/// Harness de integración real (mismo criterio que turn.integration.test.ts/creation.integration.
/// test.ts — sin LLM de por medio en /recolectar, así que Postgres local basta) para el bug real
/// jugando en vivo (2026-08-13, "avanzo por la hondonada buscando más elementos... ahí sí que
/// debería poder volver a usarla, al igual que si cambiamos de zona"): el cooldown de 30 min era
/// puro reloj, sin memoria de sitio — moverse a otra Location no servía de nada. Usa la fila REAL
/// (compartida, mundo `helek-sirik`) de 'roca-pilares-rotos' — snapshot/restore exactos en
/// beforeAll/afterAll para no dejar la partida real de la jugadora con población o cooldown
/// alterados tras correr los tests.
const { recolectarRoutes } = await import('./recolectar.js');

async function buildApp() {
  const app = Fastify();
  await app.register(recolectarRoutes);
  return app;
}

describe('Cooldown de recolección: cambiar de Location lo salta, quedarse quieto no', () => {
  let saveId: string;
  let worldId: string;
  let locationAId: string;
  let locationBId: string;
  let originalPopulation: { poblacion: number; lastHarvestedAt: Date | null; lastHarvestedLocationId: string | null };

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const locationA = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'agujas-iman' } });
    const locationB = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'campamento-serhu' } });
    locationAId = locationA.id;
    locationBId = locationB.id;

    const pop = await prisma.worldPopulation.findFirstOrThrow({
      where: { worldId, targetType: 'RECURSO', targetSlug: 'roca-pilares-rotos' },
    });
    originalPopulation = { poblacion: pop.poblacion, lastHarvestedAt: pop.lastHarvestedAt, lastHarvestedLocationId: pop.lastHarvestedLocationId };
    // Punto de partida limpio: nunca recolectada (cooldown irrelevante hasta que el propio test lo
    // fije), para que el primer harvest de Location A no dependa de cuándo se corrió la suite
    // anterior.
    await prisma.worldPopulation.update({
      where: { id: pop.id },
      data: { lastHarvestedAt: null, lastHarvestedLocationId: null },
    });

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba 19',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        portraitInitial: 'G',
        currentLocationId: locationAId,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.worldPopulation.updateMany({
      where: { worldId, targetType: 'RECURSO', targetSlug: 'roca-pilares-rotos' },
      data: originalPopulation,
    });
  });

  it('recolecta en Location A, un segundo intento inmediato en el MISMO sitio no da nada nuevo', async () => {
    const app = await buildApp();

    const first = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/recolectar/confirmar`,
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });
    expect(first.statusCode).toBe(200);
    const afterFirst = JSON.parse(first.body);
    expect(afterFirst.items).toHaveLength(1);
    expect(afterFirst.items[0].name).toBe('Piedra (3)');

    const popAfterFirst = await prisma.worldPopulation.findFirstOrThrow({
      where: { worldId, targetType: 'RECURSO', targetSlug: 'roca-pilares-rotos' },
    });
    expect(popAfterFirst.poblacion).toBe(originalPopulation.poblacion - 3);
    expect(popAfterFirst.lastHarvestedLocationId).toBe(locationAId);

    // Mismo sitio, sin esperar nada — sigue en cooldown, la petición no crea ni actualiza nada.
    const second = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/recolectar/confirmar`,
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });
    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body).items).toHaveLength(0);
    const popAfterSecond = await prisma.worldPopulation.findFirstOrThrow({
      where: { worldId, targetType: 'RECURSO', targetSlug: 'roca-pilares-rotos' },
    });
    expect(popAfterSecond.poblacion).toBe(originalPopulation.poblacion - 3);
  }, 15_000);

  it('moverse a Location B deja recolectar de inmediato, aunque no hayan pasado los 30 min', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: locationBId } });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/recolectar/confirmar`,
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });
    expect(res.statusCode).toBe(200);
    // Ya existe una pila de "Piedra" del test anterior en este mismo save — se acumula en vez de
    // crear una fila nueva (`updatedItems`, no `items`), mismo criterio que el resto del motor.
    const body = JSON.parse(res.body);
    expect(body.updatedItems).toEqual([expect.objectContaining({ name: 'Piedra (6)' })]);

    const pop = await prisma.worldPopulation.findFirstOrThrow({
      where: { worldId, targetType: 'RECURSO', targetSlug: 'roca-pilares-rotos' },
    });
    expect(pop.poblacion).toBe(originalPopulation.poblacion - 6);
    expect(pop.lastHarvestedLocationId).toBe(locationBId);
  }, 15_000);
});
