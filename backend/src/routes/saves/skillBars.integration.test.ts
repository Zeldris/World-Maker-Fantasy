import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { skillBarsRoutes } from './skillBars.js';
import { detailRoutes } from './detail.js';

/// Barras de habilidades múltiples fuera de combate (2026-09-04) — mismo patrón de setup que
/// entrega.integration.test.ts: app aislado solo con las rutas necesarias.
async function buildApp() {
  const app = Fastify();
  await app.register(skillBarsRoutes);
  await app.register(detailRoutes);
  return app;
}

describe('Barras de habilidades múltiples (2026-09-04)', () => {
  let saveId: string;
  let itemId1: string;
  let itemId2: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (skill bars)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });

    const curar = await prisma.savedAction.create({
      data: { saveId, name: 'Curar', promptText: 'x', category: 'general', icon: '🌿', description: 'x' },
    });
    const viajar = await prisma.savedAction.create({
      data: { saveId, name: 'Viajar', promptText: 'x', category: 'general', icon: '🧭', description: 'x' },
    });
    itemId1 = curar.id;
    itemId2 = viajar.id;
  });

  afterAll(async () => {
    await prisma.skillBar.deleteMany({ where: { saveId } });
    await prisma.savedAction.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('GET /saves/:id garantiza las 3 barras base la primera vez, idempotente en llamadas siguientes', async () => {
    const app = await buildApp();
    const res1 = await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    expect(res1.statusCode).toBe(200);
    const body1 = res1.json() as { skillBars: { category: string; slotIndex: number; name: string }[] };
    const bases = body1.skillBars.filter((b) => b.slotIndex === 0);
    expect(bases.map((b) => b.category).sort()).toEqual(['general', 'profesion', 'reino']);
    expect(bases.every((b) => b.name === 'Barra 1')).toBe(true);

    const res2 = await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    const body2 = res2.json() as { skillBars: unknown[] };
    expect(body2.skillBars).toHaveLength(3);
  });

  it('POST crea la siguiente barra libre, 400 al superar el tope de 3', async () => {
    const app = await buildApp();
    const res1 = await app.inject({ method: 'POST', url: `/saves/${saveId}/skill-bars`, payload: { category: 'general' } });
    expect(res1.statusCode).toBe(201);
    expect(res1.json().slotIndex).toBe(1);

    const res2 = await app.inject({ method: 'POST', url: `/saves/${saveId}/skill-bars`, payload: { category: 'general' } });
    expect(res2.statusCode).toBe(201);
    expect(res2.json().slotIndex).toBe(2);

    const res3 = await app.inject({ method: 'POST', url: `/saves/${saveId}/skill-bars`, payload: { category: 'general' } });
    expect(res3.statusCode).toBe(400);
  });

  it('PATCH renombra y reemplaza el contenido, saneando contra SavedAction reales de esa categoría', async () => {
    const app = await buildApp();
    const barRes = await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    const bar = (barRes.json() as { skillBars: { id: string; category: string; slotIndex: number }[] }).skillBars.find(
      (b) => b.category === 'general' && b.slotIndex === 0,
    )!;

    const res = await app.inject({
      method: 'PATCH',
      url: `/saves/${saveId}/skill-bars/${bar.id}`,
      payload: { name: 'Mi barra favorita', abilityNames: ['Curar', 'Viajar', 'Habilidad Inexistente'] },
    });
    expect(res.statusCode).toBe(200);
    const updated = res.json() as { name: string; abilityNames: string[] };
    expect(updated.name).toBe('Mi barra favorita');
    expect(updated.abilityNames).toEqual(['Curar', 'Viajar']);
  });

  it('DELETE bloquea la barra base (slotIndex 0), permite borrar una adicional y limpia active-skill-bar', async () => {
    const app = await buildApp();
    const barsRes = await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    const bars = (barsRes.json() as { skillBars: { id: string; category: string; slotIndex: number }[] }).skillBars.filter(
      (b) => b.category === 'general',
    );
    const base = bars.find((b) => b.slotIndex === 0)!;
    const extra = bars.find((b) => b.slotIndex === 1)!;

    const resBase = await app.inject({ method: 'DELETE', url: `/saves/${saveId}/skill-bars/${base.id}` });
    expect(resBase.statusCode).toBe(400);

    await app.inject({ method: 'PATCH', url: `/saves/${saveId}/active-skill-bar`, payload: { skillBarId: extra.id } });
    const resDelete = await app.inject({ method: 'DELETE', url: `/saves/${saveId}/skill-bars/${extra.id}` });
    expect(resDelete.statusCode).toBe(204);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.activeSkillBarId).toBeNull();
  });
});
