import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { aprenderOficioRoutes } from './aprenderOficio.js';
import { REPUTACION_MINIMA_APRENDER_OFICIO, COSTE_GOIRNOS_APRENDER_OFICIO } from '../../services/learnProfession.js';

/// Cobertura nueva (2026-08-31, "Trabajador de Reino") — mismo patrón que
/// entrega.integration.test.ts: app aislado solo con `aprenderOficioRoutes`, contra el Maestro
/// Herrero Serhu real ya sembrado (`campamento-serhu-interior`).
async function buildApp() {
  const app = Fastify();
  await app.register(aprenderOficioRoutes);
  return app;
}

describe('Aprender oficio de un Maestro (2026-08-31)', () => {
  let saveId: string;
  let worldId: string;
  let interiorId: string;
  let maestroId: string;
  let maestroSlug: string;

  beforeEach(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const interior = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'campamento-serhu-interior' } });
    const maestro = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'maestro-herrero-serhu' } });
    worldId = world.id;
    interiorId = interior.id;
    maestroId = maestro.id;
    maestroSlug = maestro.slug;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (aprender oficio)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        portraitInitial: 'G',
        currentLocationId: interior.id,
        goirnos: COSTE_GOIRNOS_APRENDER_OFICIO,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({
      data: { saveId, factionsStatus: { 'Clan Serhu': REPUTACION_MINIMA_APRENDER_OFICIO } },
    });
  });

  afterAll(async () => {
    await prisma.professionProgress.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.worldState.deleteMany({ where: { saveId } });
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('con reputación y Goirnos suficientes, cobra el coste y crea ProfessionProgress real', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/npc/${maestroSlug}/aprender-oficio` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.professionId).toBe('herrero-orco-llanuras');
    expect(body.logEntry.text).toContain('Maestro Herrero Serhu');

    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.goirnos).toBe(0);

    const progress = await prisma.professionProgress.findUnique({
      where: { saveId_professionId: { saveId, professionId: 'herrero-orco-llanuras' } },
    });
    expect(progress).toMatchObject({ nivel: 1, xp: 0 });
  });

  it('rechaza con reputación por debajo del umbral, sin cobrar ni crear ProfessionProgress', async () => {
    await prisma.worldState.update({ where: { saveId }, data: { factionsStatus: { 'Clan Serhu': REPUTACION_MINIMA_APRENDER_OFICIO - 1 } } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/npc/${maestroSlug}/aprender-oficio` });
    expect(res.statusCode).toBe(400);

    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.goirnos).toBe(COSTE_GOIRNOS_APRENDER_OFICIO);
    const progress = await prisma.professionProgress.findUnique({
      where: { saveId_professionId: { saveId, professionId: 'herrero-orco-llanuras' } },
    });
    expect(progress).toBeNull();
  });

  it('rechaza con Goirnos insuficientes, aunque la reputación sea perfecta', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { goirnos: COSTE_GOIRNOS_APRENDER_OFICIO - 1 } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/npc/${maestroSlug}/aprender-oficio` });
    expect(res.statusCode).toBe(400);
  });

  it('rechaza si el jugador ya aprendió ese oficio', async () => {
    await prisma.professionProgress.create({ data: { saveId, professionId: 'herrero-orco-llanuras' } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/npc/${maestroSlug}/aprender-oficio` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Ya conoces');
  });

  it('rechaza si el jugador no está en la misma Location que el Maestro', async () => {
    const otraLocation = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'campamento-serhu' } });
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: otraLocation.id } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/npc/${maestroSlug}/aprender-oficio` });
    expect(res.statusCode).toBe(400);
  });

  it('404 si el NPC no enseña ningún oficio', async () => {
    const otroNpc = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'torgash-ketg' } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/npc/${otroNpc.slug}/aprender-oficio` });
    expect(res.statusCode).toBe(404);
  });
});
