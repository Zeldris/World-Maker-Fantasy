import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { sessionRoutes } from './session.js';
import { guardarSlugsDeCombate } from '../../services/combateDesde.js';

/// P328/P107: todo cierre del combate 1v1 clásico (sin CombatEncounter) con un NPC lo deja DESCUBIERTO en la partida;
/// empezarlo no (P327). Punto común: `guardarSlugsDeCombate` (un rival que sale de la lista cierra su combate) y las
/// dos huidas de la jugadora, que limpian la lista de golpe.
const npcSlug = 'orco-enfurecido-hondonada';

describe('el combate 1v1 clásico descubre al NPC al cerrarse (P328/P107)', () => {
  let saveId: string;
  let npcId: string;

  const descubierto = async () => (await prisma.discoveredEntity.findFirst({ where: { saveId, entitySlug: npcSlug } }))?.fase ?? null;
  const reponer = async (condicion: 'HERIDO' | 'CONVALECIENTE') => {
    await prisma.discoveredEntity.deleteMany({ where: { saveId } });
    await prisma.npcState.upsert({
      where: { saveId_npcId_scope: { saveId, npcId, scope: '' } },
      create: { saveId, npcId, scope: '', condicionFisica: condicion },
      update: { condicionFisica: condicion },
    });
    await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [npcSlug], condicionFisica: 'ILESO' } });
  };
  const buildApp = async () => {
    const app = Fastify();
    await app.register(sessionRoutes);
    return app;
  };

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    npcId = (await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: npcSlug } })).id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (descubrir al cerrar)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 18, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('empezar el combate no descubre (P327)', async () => {
    await prisma.discoveredEntity.deleteMany({ where: { saveId } });
    await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [] } });
    await guardarSlugsDeCombate(prisma, saveId, [npcSlug]);
    expect(await descubierto()).toBeNull();
  });

  it('Clemente (dejar vivir) lo descubre', async () => {
    await reponer('CONVALECIENTE');
    const res = await (await buildApp()).inject({ method: 'POST', url: `/saves/${saveId}/combat/dejar-vivir/${npcSlug}` });
    expect(res.statusCode).toBe(200);
    expect(await descubierto()).toBe('DESCUBIERTO');
  });

  it('la huida de la jugadora antes de entrar (/combat/flee) lo descubre', async () => {
    await reponer('HERIDO');
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const res = await (await buildApp()).inject({ method: 'POST', url: `/saves/${saveId}/combat/flee` });
    expect(res.statusCode).toBe(200);
    expect(res.json().escaped).toBe(true);
    expect(await descubierto()).toBe('DESCUBIERTO');
  });

  it('la huida de la jugadora en curso (/combat/huir-en-curso) lo descubre', async () => {
    await reponer('HERIDO');
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const res = await (await buildApp()).inject({ method: 'POST', url: `/saves/${saveId}/combat/huir-en-curso` });
    expect(res.statusCode).toBe(200);
    expect(res.json().escaped).toBe(true);
    expect(await descubierto()).toBe('DESCUBIERTO');
  });

  it('una huida fallida no lo descubre: el combate sigue', async () => {
    await reponer('HERIDO');
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const res = await (await buildApp()).inject({ method: 'POST', url: `/saves/${saveId}/combat/flee` });
    expect(res.statusCode).toBe(200);
    expect(res.json().escaped).toBe(false);
    expect(await descubierto()).toBeNull();
  });

  it('victoria, muerte de la jugadora y huida del rival (el turno saca al rival de la lista) lo descubren', async () => {
    await reponer('HERIDO');
    await guardarSlugsDeCombate(prisma, saveId, []);
    expect(await descubierto()).toBe('DESCUBIERTO');
  });
});
