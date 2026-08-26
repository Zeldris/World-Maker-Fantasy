import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { sessionRoutes } from './session.js';

/// CONVALECIENTE deja de ser "victoria automática" (petición explícita, 2026-08-26) — "Dejarlo
/// vivir" saca al NPC de `pendingCombatNpcSlugs` (deja de ser objetivo activo) pero NO toca
/// `condicionFisica`: se queda CONVALECIENTE de verdad, recupera solo con las horas de ficción.
async function buildApp() {
  const app = Fastify();
  await app.register(sessionRoutes);
  return app;
}

describe('POST /saves/:id/combat/dejar-vivir/:npcSlug', () => {
  let saveId: string;
  let npcId: string;
  const npcSlug = 'orco-enfurecido-hondonada';

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: npcSlug } });
    npcId = npc.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (dejar vivir)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        portraitInitial: 'G',
        currentLocationId: location.id,
        pendingCombatNpcSlugs: [npcSlug, 'otro-npc-cualquiera'],
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('400 si el NPC todavía no está CONVALECIENTE', async () => {
    await prisma.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId, scope: '' } },
      create: { saveId, npcId, scope: '', condicionFisica: 'HERIDO' },
      update: { condicionFisica: 'HERIDO' },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/dejar-vivir/${npcSlug}` });
    expect(res.statusCode).toBe(400);

    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual([npcSlug, 'otro-npc-cualquiera']);
  });

  it('CONVALECIENTE: saca solo a ese NPC de pendingCombatNpcSlugs, sin tocar su condicionFisica ni al resto', async () => {
    await prisma.npcState.update({
      where: { saveId_npcId_scope: { saveId, npcId, scope: '' } },
      data: { condicionFisica: 'CONVALECIENTE' },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/dejar-vivir/${npcSlug}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().npcSlug).toBe(npcSlug);

    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual(['otro-npc-cualquiera']);

    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId, scope: '' } } });
    expect(state.condicionFisica).toBe('CONVALECIENTE');

    const logEntry = await prisma.logEntry.findFirstOrThrow({ where: { saveId }, orderBy: { createdAt: 'desc' } });
    expect(logEntry.text).toContain('deja con vida a Orco enfurecido');
  });

  it('dejar vivir dos veces al mismo NPC no revienta (ya no está en pendingCombatNpcSlugs, pero sigue CONVALECIENTE)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/dejar-vivir/${npcSlug}` });
    expect(res.statusCode).toBe(200);
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual(['otro-npc-cualquiera']);
  });
});
