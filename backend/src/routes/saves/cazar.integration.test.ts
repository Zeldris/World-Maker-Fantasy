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
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
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

/// Cobertura nueva (checklist 2026-09-01, hallazgo real jugando en vivo): `particionarEnSubCombates`/
/// `MAX_COMBATIENTES_POR_BANDO` (combateMultiple.ts) existían desde 2026-08-28 con 6 tests
/// unitarios, pero nunca se enganchaban a este flujo real — cazar 5+ del mismo tipo (`buitre-cenizo`,
/// capturablePct 50 -> 5 avistados, igual que el test de arriba) creaba un único `CombatEncounter`
/// con los 6 participantes (1 JUGADOR + 5 ENEMIGO) dentro, sin ningún tope de 4. Confirmado a mano
/// en Postgres esa misma sesión. Fix: el bando ENEMIGO se parte en fragmentos de
/// `MAX_COMBATIENTES_POR_BANDO`; solo el primero (con la jugadora) es `jugable: true`, el resto se
/// crea `jugable: false` y se resuelve de una sentada con `resolverTurnosAutonomosHastaJugadora`
/// (narración muda, sin llamar a Ollama — esos intercambios nunca se le muestran en directo).
describe('Cazar: sub-partición >4v4 (checklist 2026-09-01)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (cazar, sub-partición)',
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
  });

  afterAll(async () => {
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('cazar 5 Buitre Cenizo a la vez parte el bando ENEMIGO en un CombatEncounter jugable (≤4) y uno autónomo ya RESUELTO', async () => {
    const app = await buildApp();
    // `rollGroupEngagement` (cazar.ts) mete un ±1 real sobre lo pedido — con avistados=5 (tope de
    // `buitre-cenizo`, capturablePct 50) el resultado real puede caer en 4, que ya no dispara la
    // sub-partición. Reintenta la petición real (limpiando el CombatEncounter fallido cada vez)
    // hasta que el roll dé los 5 reales — sin mockear `Math.random` para no desacoplar el test del
    // camino HTTP real de punta a punta.
    let res;
    for (let intento = 0; intento < 20; intento++) {
      await prisma.combatEncounter.deleteMany({ where: { saveId } });
      res = await app.inject({ method: 'POST', url: `/saves/${saveId}/cazar/confirmar`, payload: { slugs: ['buitre-cenizo'], cantidades: { 'buitre-cenizo': 5 } } });
      expect(res.statusCode).toBe(200);
      const total = await prisma.combatParticipant.count({ where: { encounter: { saveId }, bando: 'ENEMIGO' } });
      if (total > 4) break;
    }

    const encounters = await prisma.combatEncounter.findMany({ where: { saveId }, include: { participantes: true } });
    const jugable = encounters.find((e) => e.jugable);
    const autonomos = encounters.filter((e) => !e.jugable);

    expect(jugable).toBeDefined();
    // Tope real: 1 JUGADOR + como mucho MAX_COMBATIENTES_POR_BANDO (4) ENEMIGO en el sub-combate jugable.
    expect(jugable!.participantes.filter((p) => p.bando === 'ENEMIGO').length).toBeLessThanOrEqual(4);
    expect(jugable!.estado).toBe('EN_CURSO');

    // El resto (5 - 4 = 1 enemigo restante) va a un CombatEncounter autónomo, ya resuelto de una
    // sentada nada más terminar la petición — sin bando contrario, se cierra RESUELTO enseguida.
    expect(autonomos.length).toBeGreaterThan(0);
    for (const enc of autonomos) {
      expect(enc.estado).toBe('RESUELTO');
    }
  }, 20_000);
});
