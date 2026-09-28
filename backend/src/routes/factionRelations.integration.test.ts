import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { factionRelationsRoutes } from './factionRelations.js';

/// GET de relaciones entre facciones NPC (hueco A, rediseño de frontend 2026-09-21,
/// docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.3). Test de integración real contra Postgres, sin mocks —
/// mismo patrón que reino.integration.test.ts.
async function buildApp() {
  const app = Fastify();
  await app.register(factionRelationsRoutes);
  return app;
}

describe('GET /world/:slug/faction-relations (2026-09-21)', () => {
  let worldId: string;
  let worldSlug: string;
  let saveId: string;
  let serhuId: string;
  let helsigId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    worldSlug = world.slug;
    const serhu = await prisma.faction.findFirstOrThrow({ where: { worldId, slug: 'clan-serhu' } });
    serhuId = serhu.id;
    const helsig = await prisma.faction.findFirstOrThrow({ where: { worldId, slug: 'clan-helsig' } });
    helsigId = helsig.id;

    await prisma.factionRelation.upsert({
      where: { sourceFactionId_targetFactionId: { sourceFactionId: serhuId, targetFactionId: helsigId } },
      update: { type: 'TENSION', presion: 65 },
      create: { worldId, sourceFactionId: serhuId, targetFactionId: helsigId, type: 'TENSION', presion: 65 },
    });

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (faction-relations)',
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
    await prisma.discoveredEntity.deleteMany({ where: { saveId } });
    await prisma.factionRelation.deleteMany({ where: { sourceFactionId: serhuId, targetFactionId: helsigId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin saveId (catálogo fuera de partida): todo visible', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/world/${worldSlug}/faction-relations` });
    expect(res.statusCode).toBe(200);
    const rel = res.json().relations.find((r: { sourceFactionSlug: string; targetFactionSlug: string }) => r.sourceFactionSlug === 'clan-serhu' && r.targetFactionSlug === 'clan-helsig');
    expect(rel).toMatchObject({ type: 'TENSION', presion: 65, sourceRaza: 'orcos', targetRaza: 'orcos' });
  });

  it('con saveId, ninguna facción descubierta: la relación queda oculta', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/world/${worldSlug}/faction-relations?saveId=${saveId}` });
    expect(res.statusCode).toBe(200);
    const rel = res.json().relations.find((r: { sourceFactionSlug: string; targetFactionSlug: string }) => r.sourceFactionSlug === 'clan-serhu' && r.targetFactionSlug === 'clan-helsig');
    expect(rel).toBeUndefined();
  });

  it('con saveId, solo UNA de las dos descubierta: sigue oculta (gate exige ambas)', async () => {
    await prisma.discoveredEntity.create({ data: { saveId, entityType: 'faction', entitySlug: 'clan-serhu' } });
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/world/${worldSlug}/faction-relations?saveId=${saveId}` });
    const rel = res.json().relations.find((r: { sourceFactionSlug: string; targetFactionSlug: string }) => r.sourceFactionSlug === 'clan-serhu' && r.targetFactionSlug === 'clan-helsig');
    expect(rel).toBeUndefined();
  });

  it('con saveId, AMBAS descubiertas: la relación se ve', async () => {
    await prisma.discoveredEntity.create({ data: { saveId, entityType: 'faction', entitySlug: 'clan-helsig' } });
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/world/${worldSlug}/faction-relations?saveId=${saveId}` });
    const rel = res.json().relations.find((r: { sourceFactionSlug: string; targetFactionSlug: string }) => r.sourceFactionSlug === 'clan-serhu' && r.targetFactionSlug === 'clan-helsig');
    expect(rel).toMatchObject({ type: 'TENSION', presion: 65 });
  });

  it('404 si el mundo no existe', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/world/no-existe/faction-relations' });
    expect(res.statusCode).toBe(404);
  });
});
