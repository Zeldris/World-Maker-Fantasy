import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { cazarRoutes } from './cazar.js';

/// Cobertura nueva (auditoría de código 2026-08-25, condición de carrera real): el guard temprano
/// de `/cazar/confirmar` (mira `CombatEncounter` EN_CURSO) deja una ventana real entre la lectura y
/// la creación del encuentro (varias consultas async de por medio: `candidateFaunaFor`,
/// `npc.findMany`) — un doble clic en "salgo a cazar" podía pasar el guard dos veces y crear dos
/// `CombatEncounter` para la misma partida. Arreglado releyendo el guard DENTRO de una transacción
/// con la fila de `Save` bloqueada (`SELECT ... FOR UPDATE`) justo antes de crear — este test
/// dispara las dos confirmaciones a la vez con `Promise.all` contra Postgres de verdad.
async function buildApp() {
  const app = Fastify();
  await app.register(cazarRoutes);
  return app;
}

describe('Cazar: condición de carrera en confirmaciones concurrentes (auditoría de código 2026-08-25)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (cazar, condición de carrera)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('dos "salgo a cazar" simultáneos contra el mismo grupo real crean como mucho 1 CombatEncounter', async () => {
    // 'buitre-cenizo' (mismo bicho del crash real que originó este arreglo, dev-server.log
    // 2026-08-25): sin `faunaTerrainTag` propio (sin filtro de terreno, pasa en cualquier sitio) y
    // población real de sobra en Las Llanuras del Viento Rojo (capturablePct 50 -> 5 avistados,
    // `avistadosFor`) para disparar `hayGrupoReal` de verdad, sin necesitar seedear WorldPopulation
    // a mano.
    const app = await buildApp();
    const [resA, resB] = await Promise.all([
      app.inject({ method: 'POST', url: `/saves/${saveId}/cazar/confirmar`, payload: { slugs: ['buitre-cenizo'] } }),
      app.inject({ method: 'POST', url: `/saves/${saveId}/cazar/confirmar`, payload: { slugs: ['buitre-cenizo'] } }),
    ]);

    const codes = [resA.statusCode, resB.statusCode].sort();
    // La que pierde la carrera se rechaza con 400 ("ya hay un combate en curso"); la ganadora
    // termina en 200 con el actionText de siempre — nunca las dos en 200.
    expect(codes).toEqual([200, 400]);
    expect(await prisma.combatEncounter.count({ where: { saveId, estado: 'EN_CURSO' } })).toBe(1);
  }, 20_000);
});
