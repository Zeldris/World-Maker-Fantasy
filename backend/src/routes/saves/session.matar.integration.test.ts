import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { sessionRoutes } from './session.js';
import { detailRoutes } from './detail.js';

async function buildApp() {
  const app = Fastify();
  await app.register(sessionRoutes);
  return app;
}

async function buildAppWithDetail() {
  const app = Fastify();
  await app.register(sessionRoutes);
  await app.register(detailRoutes);
  return app;
}

/// "Matar" un CONVALECIENTE (2026-09-05, bug real jugando en vivo con Playwright, sesión autónoma
/// de pruebas): pulsar "Matar" solo marcaba `targetedForKill: true` en `combatNpcStates` de React
/// — se perdía al recargar la página, la tarjeta MATAR/CLEMENTE reaparecía de cero y el composer
/// volvía a bloquearse hasta pulsar Matar de nuevo (violando la directriz ya escrita en
/// docs/checklist-pruebas-juego.md: cualquier oferta/decisión debe sobrevivir a F5). Fix: nuevo
/// campo `NpcState.targetedForKill`, nuevo endpoint aquí probado, y `detail.ts` lo propaga en
/// `combateIniciado.npcs[].targetedForKill` para que el frontend lo lea ya resuelto tras recargar.
describe('POST /saves/:id/combat/matar/:npcSlug', () => {
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
        characterName: 'Gorhorn de prueba (matar)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: location.id,
        pendingCombatNpcSlugs: [npcSlug],
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('400 si el NPC todavía no está CONVALECIENTE', async () => {
    await prisma.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId, scope: '' } },
      create: { saveId, npcId, scope: '', condicionFisica: 'HERIDO' },
      update: { condicionFisica: 'HERIDO', targetedForKill: false },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/matar/${npcSlug}` });
    expect(res.statusCode).toBe(400);

    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId, scope: '' } } });
    expect(state.targetedForKill).toBe(false);
  });

  it('CONVALECIENTE: marca targetedForKill sin tocar condicionFisica ni pendingCombatNpcSlugs', async () => {
    await prisma.npcState.update({
      where: { saveId_npcId_scope: { saveId, npcId, scope: '' } },
      data: { condicionFisica: 'CONVALECIENTE' },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/matar/${npcSlug}` });
    expect(res.statusCode).toBe(204);

    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId, scope: '' } } });
    expect(state.targetedForKill).toBe(true);
    expect(state.condicionFisica).toBe('CONVALECIENTE');

    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual([npcSlug]);
  });

  it('idempotente: pulsarlo dos veces no falla ni cambia nada más', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/matar/${npcSlug}` });
    expect(res.statusCode).toBe(204);
    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId, scope: '' } } });
    expect(state.targetedForKill).toBe(true);
  });

  // El propio test que reproduce el bug real: "recargar" (GET /saves/:id) tras pulsar Matar debe
  // seguir mostrando el composer desbloqueado — la tarjeta MATAR/CLEMENTE ya NO debe reaparecer
  // para este NPC (LogPanel.tsx filtra por `!n.targetedForKill`, que ahora llega ya en `true`
  // desde el backend en vez de depender del estado efímero de React).
  it('GET /saves/:id tras "recargar": combateIniciado sigue trayendo targetedForKill:true para este NPC', async () => {
    const appDetail = await buildAppWithDetail();
    const getRes = await appDetail.inject({ method: 'GET', url: `/saves/${saveId}` });
    expect(getRes.statusCode).toBe(200);
    const { combateIniciado } = getRes.json() as { combateIniciado: { npcs: { slug: string; targetedForKill: boolean }[] } | null };

    expect(combateIniciado).not.toBeNull();
    const npc = combateIniciado!.npcs.find((n) => n.slug === npcSlug);
    expect(npc?.targetedForKill).toBe(true);
  });
});

/// Guard de save.endedAt añadido (auditoría de código backend 2026-09-07): Matar era el único de
/// los 3 desenlaces posibles desde CONVALECIENTE (junto a Capturar y Dejar-vivir, que ya lo tenían)
/// sin este guard — con la partida ya terminada, seguía marcando targetedForKill igualmente.
describe('POST /saves/:id/combat/matar/:npcSlug — guard de save.endedAt (auditoría 2026-09-07)', () => {
  let saveId: string;
  const npcSlug = 'orco-enfurecido-hondonada';

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (matar, partida ya terminada)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: location.id,
        endedAt: new Date('2026-09-07T12:00:00Z'),
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('409 en vez de marcar targetedForKill', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/matar/${npcSlug}` });
    expect(res.statusCode).toBe(409);
  });
});
