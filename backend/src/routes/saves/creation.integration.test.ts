import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

/// Harness de integración real (mismo criterio que turn.integration.test.ts — sin LLM de por
/// medio en /restart, así que aquí ni hace falta mockear nada, Postgres local basta) para el bug
/// real jugando en vivo (2026-08-01, "al reiniciar la partida me empieza en combate"):
/// `Save.pendingCombatNpcSlugs`/`pendingNpcAttack` son la única fuente de la que GET /saves/:id
/// reconstruye el aviso de "Combatir" tras una resincronización (ver saves/detail.ts) — antes
/// `/restart` no los tocaba, así que un combate sin cerrar de la partida ANTERIOR sobrevivía
/// entero a un reinicio que por lo demás dejaba todo limpio (Día 1, ILESO, inventario de serie).
const { creationRoutes } = await import('./creation.js');

async function buildApp() {
  const app = Fastify();
  await app.register(creationRoutes);
  return app;
}

describe('POST /saves/:id/restart limpia el combate pendiente de la partida anterior', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (restart)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        portraitInitial: 'G',
        condicionFisica: 'INCAPACITADO',
        // Simula justo lo que se encontró en la partida real: un combate que nunca llegó a
        // cerrarse (el slug de un NPC ya derrotado/saqueado, atascado desde la sesión anterior).
        pendingCombatNpcSlugs: ['orco-enfurecido-hondonada'],
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('deja pendingCombatNpcSlugs vacío y pendingNpcAttack null tras reiniciar', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/restart`, payload: {} });
    expect(res.statusCode).toBe(200);

    const restarted = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(restarted.pendingCombatNpcSlugs).toEqual([]);
    expect(restarted.pendingNpcAttack).toBeNull();
    expect(restarted.condicionFisica).toBe('ILESO');
  }, 15_000);
});
