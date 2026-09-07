import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { skillBarsRoutes } from './skillBars.js';
import { detailRoutes } from './detail.js';

/// Barras de habilidades múltiples fuera de combate (2026-09-04, rediseñado 2026-09-06 — hallazgo
/// 10 de la sesión de pruebas: 3 barras EN GENERAL sin distinguir categoría, 20 slots, en vez de 3
/// por cada una de las 3 categorías con 12 slots). Mismo patrón de setup que
/// entrega.integration.test.ts: app aislado solo con las rutas necesarias.
async function buildApp() {
  const app = Fastify();
  await app.register(skillBarsRoutes);
  await app.register(detailRoutes);
  return app;
}

describe('Barras de habilidades múltiples (2026-09-06)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (skill bars v3)',
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

    await prisma.savedAction.create({ data: { saveId, name: 'Curar', promptText: 'x', category: 'general', icon: '🌿', description: 'x' } });
    await prisma.savedAction.create({ data: { saveId, name: 'Viajar', promptText: 'x', category: 'general', icon: '🧭', description: 'x' } });
    // Habilidad de OTRA categoría — el caso central del rediseño: una misma barra debe poder
    // mezclar General + Profesión (o Reino), sin filtrar por la categoría de una barra que ya no
    // existe como concepto.
    await prisma.savedAction.create({ data: { saveId, name: 'Minar', promptText: 'x', category: 'profesion', icon: '⛏️', description: 'x' } });
    // Habilidad de COMBATE — sigue fuera del sistema de barras, para confirmar que el saneo no la
    // admite aunque se proponga explícitamente.
    await prisma.savedAction.create({ data: { saveId, name: 'Golpe certero', promptText: 'x', category: 'combate', icon: '⚔️', description: 'x' } });
  });

  afterAll(async () => {
    await prisma.skillBar.deleteMany({ where: { saveId } });
    await prisma.savedAction.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('GET /saves/:id garantiza UNA barra base la primera vez, idempotente en llamadas siguientes', async () => {
    const app = await buildApp();
    const res1 = await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    expect(res1.statusCode).toBe(200);
    const body1 = res1.json() as { skillBars: { slotIndex: number; name: string }[] };
    expect(body1.skillBars).toHaveLength(1);
    expect(body1.skillBars[0]).toMatchObject({ slotIndex: 0, name: 'Barra 1' });

    const res2 = await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    const body2 = res2.json() as { skillBars: unknown[] };
    expect(body2.skillBars).toHaveLength(1);
  });

  it('POST crea la siguiente barra libre sin category en el payload, 400 al superar el tope de 3 del save entero', async () => {
    const app = await buildApp();
    const res1 = await app.inject({ method: 'POST', url: `/saves/${saveId}/skill-bars` });
    expect(res1.statusCode).toBe(201);
    expect(res1.json().slotIndex).toBe(1);

    const res2 = await app.inject({ method: 'POST', url: `/saves/${saveId}/skill-bars` });
    expect(res2.statusCode).toBe(201);
    expect(res2.json().slotIndex).toBe(2);

    const res3 = await app.inject({ method: 'POST', url: `/saves/${saveId}/skill-bars` });
    expect(res3.statusCode).toBe(400);
  });

  it('PATCH admite mezclar habilidades de General y Profesión en la misma barra, descarta Combate y las inexistentes', async () => {
    const app = await buildApp();
    const barRes = await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    const bar = (barRes.json() as { skillBars: { id: string; slotIndex: number }[] }).skillBars.find((b) => b.slotIndex === 0)!;

    const res = await app.inject({
      method: 'PATCH',
      url: `/saves/${saveId}/skill-bars/${bar.id}`,
      payload: { name: 'Mi barra favorita', abilityNames: ['Curar', 'Minar', 'Golpe certero', 'Habilidad Inexistente'] },
    });
    expect(res.statusCode).toBe(200);
    const updated = res.json() as { name: string; abilityNames: string[] };
    expect(updated.name).toBe('Mi barra favorita');
    // 'Curar' (general) y 'Minar' (profesion) se admiten juntas; 'Golpe certero' (combate) y
    // 'Habilidad Inexistente' se descartan.
    expect(updated.abilityNames).toEqual(['Curar', 'Minar']);
  });

  it('DELETE bloquea la barra base (slotIndex 0), permite borrar una adicional y limpia active-skill-bar', async () => {
    const app = await buildApp();
    const barsRes = await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    const bars = (barsRes.json() as { skillBars: { id: string; slotIndex: number }[] }).skillBars;
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
