import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { goirnosDeBotin } from '../services/turnResolution.js';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asegurarMundoDePartida } from '../services/mundoPartida.js';
import { env } from '../config/env.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { resolveDueTransits, startEagerTransitResolution } from '../workers/worldTick.js';
import { recolectarRoutes } from './saves/recolectar.js';
import { panelsRoutes } from './saves/panels.js';
import { detailRoutes } from './saves/detail.js';
import { energiaMaxFor } from '../services/energy.js';
import { deathRoutes } from './saves/death.js';
import { entregaRoutes } from './saves/entrega.js';
import { sessionRoutes } from './saves/session.js';
import { progressionRoutes } from './saves/progression.js';
import { questsRoutes } from './saves/quests.js';
import { minutosConDestreza, bandaForMinutos } from '../services/travel.js';
import { ownerKeyFor } from '../services/reinoOwner.js';
import type { NarrationResult } from '../services/narrador.js';
import { hasFalseTravelClaim, hasFalsePhantomTravel } from '../services/narrador.js';
import type { TravelResolution } from '../services/travel.js';
import type { TravelInterruption } from '../services/travelInterruption.js';
import type { AttributeBlock } from '../services/dice.js';
import { iniciarCombatEncounter } from '../services/combateMultipleOrquestacion.js';
import { appendSessionFacts } from '../services/worldFacts.js';
import { esperarSegundoPlano } from '../services/avanceDiario.js';
import { procesarReacciones } from '../services/cronista/reacciones.js';

/// Harness de integración de la misión de apertura (2026-07-31, "checklist de mejoras de
/// narración" — acordado al principio de la sesión de replanteamiento de arquitectura y retomado
/// ahora que el local-first hace viable correr esto contra Postgres de verdad). A diferencia de
/// turn.test.ts/turn.classify.test.ts (que mockean prisma entero para aislar validaciones), aquí
/// se usa el cliente REAL contra el Postgres local — factible ahora que es rápido, no lo era
/// contra Supabase remoto. Solo se mockea la frontera del LLM (`narrador.js`): todo lo demás
/// (detección de NPCs, resolución de combate, condición física, cierre de misión) corre con el
/// código real, exactamente como en partida. Objetivo: detectar en segundos una regresión que
/// antes solo se encontraba jugando a mano y auditando el log.
const classifyAction = vi.fn();
const narrateAction = vi.fn(async (ctx: { onNarrationChunk?: (d: string) => void }): Promise<NarrationResult> => {
  ctx.onNarrationChunk?.('El golpe conecta.');
  return { narration: 'El golpe conecta.', newFacts: [] };
});
// Narración de aceptación de misión (2026-08-30, POST /quests/aceptar) — mismo motivo que
// classifyAction/narrateAction: sin mockear, `generateQuestResponseNarration` llamaría a Ollama
// real dentro de un test de integración. Texto fijo predecible, distinto del texto legado (el test
// de abajo asume EXACTAMENTE el texto legado "acepta la misión" — se actualiza junto con esto).
const generateQuestResponseNarration = vi.fn(async (ctx: { characterName: string; questTitle: string; accepted: boolean }) => {
  return `${ctx.characterName} ${ctx.accepted ? 'acepta' : 'rechaza'} la misión: ${ctx.questTitle}.`;
});

// P164: ir por varios tramos de una vez es cosa de una montura; los viajes largos de abajo la llevan.
const tieneMontura = vi.fn(async (..._args: unknown[]) => false);
vi.mock('../services/monturas.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('../services/monturas.js')>()), tieneMontura: (...a: unknown[]) => tieneMontura(...a) }));

vi.mock('../services/narrador.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/narrador.js')>();
  return {
    ...actual,
    classifyAction: (...args: unknown[]) => classifyAction(...args),
    narrateAction: (ctx: Parameters<typeof narrateAction>[0]) => narrateAction(ctx),
    generateQuestResponseNarration: (ctx: Parameters<typeof generateQuestResponseNarration>[0]) => generateQuestResponseNarration(ctx),
  };
});

// Combate múltiple (Grupo 3 § Mundo determinista, Capa 4, 2026-08-25) — mismo motivo que el mock
// de narrador.js arriba: `narrarTurnoCombateMultiple` (Ollama real) corre DENTRO de la propia
// `prisma.$transaction` de cada intercambio (`combateMultipleOrquestacion.ts`), y una llamada real
// lenta revienta el timeout de 5s de la transacción interactiva de Prisma — mismo motivo por el
// que `combateMultipleOrquestacion.integration.test.ts` inyecta un `narrarFn` rápido al llamar
// directamente a sus funciones. Aquí no hay forma de inyectarlo (el turno real pasa por
// `narrateAndPersistTurn` → `resolverTurnoJugador`/`resolverTurnosAutonomosHastaJugadora`, que
// siempre usan el default del módulo), así que se mockea el módulo entero.
vi.mock('../services/combateMultipleNarracion.js', () => ({
  narrarTurnoCombateMultiple: async () => 'Narración de prueba.',
}));

// Eventos de viaje interactivos (2026-08-05) — SOLO la selección de candidato se mockea aquí
// (`pickTravelInterruption`), no `truncateTravelResolution`/`bandaForMinutos` (que siguen siendo
// las reales de travel.ts). Motivo: el mundo de test real ("helek-sirik") ya tiene sus propios
// NPCs itinerantes de catálogo (mercader-de-paso, peregrino-de-los-tumulos...) que también
// calificarían como candidatos — depender de la ponderación real por `WorldPopulation` haría el
// test no determinista (qué candidato "gana" dependería de datos de catálogo que pueden cambiar
// en una futura sesión de lore). La selección en sí ya tiene su propia cobertura aislada y
// determinista en travelInterruption.test.ts; aquí solo se verifica el ENGANCHE end-to-end
// (turn.ts → CharacterTransit → worldTick → turnResolution → combate forzado).
const pickTravelInterruptionMock = vi.fn();
vi.mock('../services/travelInterruption.js', () => ({
  pickTravelInterruption: (...args: unknown[]) => pickTravelInterruptionMock(...args),
}));

const { turnRoutes } = await import('./turn.js');

async function buildApp() {
  const app = Fastify();
  await app.register(turnRoutes);
  await app.register(sessionRoutes);
  return app;
}

/// `/turn/narrate` transmite NDJSON (una línea por evento: chunk/reset/done) — el resultado real
/// del turno va en la última línea (`type: 'done'`), nunca en un único JSON parseable de un tirón.
function lastNdjsonLine(payload: string): Record<string, unknown> {
  const lines = payload.trim().split('\n');
  return JSON.parse(lines[lines.length - 1]);
}

/// Candado de turno (auditoría de código completa, 2026-08-07, turnLock.ts): desde que existe,
/// dos "mismo turno" casi simultáneos para la MISMA partida ya no se resuelven los dos en paralelo
/// — el segundo se rechaza con 409 antes de tocar narración/Ollama, ni siquiera llega a emitir
/// NDJSON. Las pruebas de "condición de carrera" de aquí abajo verificaban antes que un guard MÁS
/// PROFUNDO (dentro de la transacción) evitaba duplicar efectos aunque los dos llegaran a narrar;
/// ahora el candado corta antes de eso, así que se adapta la comprobación: sigue habiendo
/// exactamente un ganador (con su narración de éxito) y un perdedor, pero el perdedor ahora es un
/// 409 seco, nunca una narración de "ya se lo llevaron" (esa rama de código sigue viva y sigue
/// protegiendo OTRO vector — worldTick.ts resolviendo un tránsito diferido en paralelo con una
/// acción en vivo pasa por un candado compartido, pero un reintento de red que sortee este candado
/// por microsegundos de diferencia real seguiría cayendo en el guard interno).
function splitLockWinnerAndLoser(responses: { statusCode: number; payload: string }[]): {
  ganador: Record<string, unknown>;
  perdedorStatusCode: number;
} {
  const locked = responses.filter((r) => r.statusCode === 409);
  const ok = responses.filter((r) => r.statusCode !== 409);
  expect(locked).toHaveLength(1);
  expect(ok).toHaveLength(1);
  return { ganador: lastNdjsonLine(ok[0].payload), perdedorStatusCode: locked[0].statusCode };
}

const ATTRS = { fuerza: 15, destreza: 10, constitucion: 12, inteligencia: 8, voluntad: 8, carisma: 8, magia: 4 };

describe('Misión de apertura: combate contra el Orco Enfurecido (integración real, solo LLM mockeado)', () => {
  let saveId: string;
  let worldId: string;
  let npcId: string;

  beforeAll(async () => {
    // Dados pinchados al máximo (2026-07-31, mismo criterio que combatExchange.test.ts): con
    // Math.random() siempre alto, CUALQUIER intercambio de combate resuelve "claro" en ambos
    // lados → 'golpes_mutuos' (ver resolveExchange) → el NPC SIEMPRE recibe un golpe cada turno,
    // progresión 100% determinista sin depender de qué tan improbable sea una racha real.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'orco-enfurecido-hondonada' } });
    npcId = npc.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'Recuperar el honor de los Maktor',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('atacar repetidamente reduce la condición física del NPC hasta CONVALECIENTE, sin llamar a Ollama (camino tabulado)', async () => {
    const app = await buildApp();
    const action = "Descargo un golpe directo con todo el peso de mi arma detrás 'Orco enfurecido'.";
    // Feedback de UX (2026-08-30, "falta que la suma de repu... se refleje en la UX") — se captura
    // el body del turno que de verdad deja al NPC CONVALECIENTE (el Orco Enfurecido es Clan Serhu),
    // para comprobar que la respuesta HTTP trae `factionRepChange` en ese turno exacto.
    type NarrateBodyOnKill = { factionRepChange: { faction: string; delta: number; newValue: number } | null; nextInitiativeRoll?: unknown };
    let narrateBodyOnKill: NarrateBodyOnKill | null = null;

    for (let turno = 0; turno < 4; turno++) {
      const classifyRes = await app.inject({
        method: 'POST',
        url: '/turn/classify',
        payload: { saveId, action, enCombate: true },
      });
      expect(classifyRes.statusCode).toBe(200);
      const { classification, roll } = classifyRes.json();
      expect(classification.razon).toMatch(/tabla, sin llamada a Ollama/);

      const narrateRes = await app.inject({
        method: 'POST',
        url: '/turn/narrate',
        payload: { saveId, action, classification, roll, enCombate: true },
      });
      expect(narrateRes.statusCode).toBe(200);

      const state = await prisma.npcState.findFirst({ where: { saveId, npcId } });
      if (state?.condicionFisica === 'CONVALECIENTE') {
        narrateBodyOnKill = lastNdjsonLine(narrateRes.payload) as unknown as NarrateBodyOnKill;
        break;
      }
    }

    expect(classifyAction).not.toHaveBeenCalled();

    const finalState = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(finalState?.condicionFisica).toBe('CONVALECIENTE');
    expect(finalState?.saqueado).toBe(false); // nunca se saquea solo por incapacitarlo

    // El Orco Enfurecido es Clan Serhu (worldCatalog.ts) — dejarlo CONVALECIENTE YA NO resta
    // reputación (bug real jugando en vivo, 2026-09-04: "me resta la reputación antes de
    // matarlo... si elijo matar tiene que esperar a que resuelva el combate antes de restarlo, en
    // el turno final") — `applyKillSideEffects` solo aplica el delta cuando `nuevaCondicion ===
    // 'MUERTO'`. La decisión real (Matar/Capturar/Clemente) todavía no se ha tomado en este punto.
    expect(narrateBodyOnKill?.factionRepChange).toBeNull();
    // P64 (QA-27): con el rival ya CONVALECIENTE no se tira iniciativa para otro intercambio.
    expect(narrateBodyOnKill?.nextInitiativeRoll ?? null).toBeNull();
    // Sin ningún delta aplicado, la clave de esa facción ni siquiera llega a crearse en el JSON
    // (`factionRepFor` solo devuelve 2500 como default cuando la clave falta, no lo persiste) —
    // `undefined` es la prueba real de que nunca se tocó `factionsStatus`.
    const worldStateAfter = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    expect((worldStateAfter.factionsStatus as Record<string, number> | null)?.['Clan Serhu']).toBeUndefined();

    // `golpes_mutuos` (ambos lados conectan con dados pinchados al máximo) — pero Gorhorn siempre
    // gana la iniciativa con este mock (empate → gana jugador, ver rollInitiative), así que el NPC
    // nunca llega a atacar de verdad en estos 4 turnos, solo se defiende. Auditoría 2026-08-14
    // ("me hizo daño con una habilidad defensiva... solo las de ataque hacen daño"): el golpe de
    // vuelta del NPC en `golpes_mutuos` ahora exige que SU habilidad de defensa tenga
    // `effect:'ATAQUE'` (ninguna la tiene) — antes del fix, cualquier `golpes_mutuos` hería a
    // Gorhorn igual aunque el NPC solo se defendiera, que es justo el bug que se corrigió. Gorhorn
    // se queda ILESO de verdad: nunca recibió un ataque real, solo asestó los suyos.
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).toBe('ILESO');
  }, 30_000);

  it('el `/turn/narrate` de después de incapacitar no vuelve a bajar la condición ni permite un segundo saqueo automático', async () => {
    const app = await buildApp();
    const stateBefore = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(stateBefore?.condicionFisica).toBe('CONVALECIENTE');

    const classifyRes = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId, action: 'Registro el cuerpo del orco enfurecido.', enCombate: false },
    });
    const { classification, roll } = classifyRes.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: 'Registro el cuerpo del orco enfurecido.', classification, roll, enCombate: false },
    });

    const stateAfter = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(stateAfter?.condicionFisica).toBe('CONVALECIENTE'); // nunca "mejora" ni cambia por saquear
  }, 15_000);

  // Cobertura nueva (2026-07-31, petición explícita: "si no saqueas todo el botón sigue para poder
  // saquear lo que dejaste") — el Orco Enfurecido lleva 3 objetos de catálogo (Maza orca, Vendaje
  // improvisado orco de las Llanuras, Ración de carne ahumada — "Mapa de las Llanuras" se quitó
  // del loadout el 2026-08-13, ahora solo se entrega como recompensa de misión; "Amuleto de
  // hueso" se quitó el 2026-09-04, rebalanceo del primer combate, sustituido por el vendaje+
  // ración de arriba, ver worldCatalog.ts); saquear solo uno dejando el resto NO debe marcarlo
  // `saqueado`, y una segunda pasada por lo que falta no debe duplicar lo ya tomado.
  it('saqueo parcial: dejar objetos sin marcar no marca `saqueado`, y una segunda pasada no duplica lo ya tomado', async () => {
    // A diferencia del ataque tabulado (test de arriba), "registrar el cuerpo" no tiene atajo
    // tabulado propio en /turn/classify — cae a `classifyAction` (mockeada en todo el archivo,
    // sin valor resuelto en este describe porque el resto de sus tests no la necesitan).
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockClear();
    // CONVALECIENTE deja de ser saqueable (2026-08-26) — el test anterior lo dejó CONVALECIENTE;
    // el saqueo parcial en sí (lo que prueba este test) es ortogonal a la condición, así que se
    // fuerza MUERTO a mano en vez de montar un turno real de "Matar".
    await prisma.npcState.updateMany({ where: { saveId, npcId }, data: { condicionFisica: 'MUERTO' } });
    const app = await buildApp();
    const action = "Registro el cuerpo de 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();

    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, lootItemNames: ['Maza orca'] },
    });

    const afterFirst = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(afterFirst?.saqueado).toBe(false); // quedan 2 objetos sin tomar
    expect(afterFirst?.lootedItemNames).toEqual(['Maza orca']);
    const inventoryAfterFirst = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(inventoryAfterFirst.map((i) => i.name)).toEqual(['Maza orca']);

    // Bug real jugando en vivo (2026-08-04, "ronda larga de pruebas"): un turno de solo-saqueo no
    // aportaba nada a `combatSlugsWithAttack`/`executeSlugs`, así que `Save.pendingCombatNpcSlugs`
    // se sobrescribía a `[]` aunque el NPC siguiera con botín pendiente — un resync/recarga justo
    // ahí perdía el aviso de "sigue saqueable" para el resto del botín.
    const saveAfterPartialLoot = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfterPartialLoot.pendingCombatNpcSlugs).toEqual(['orco-enfurecido-hondonada']);

    // Bug real (2026-07-31→2026-08-01, "saquear no cita los objetos que has saqueado bien, y no
    // sale el link a la Enciclopedia" — el primer intento de solo AVISAR al modelo del nombre
    // exacto seguía inventando objetos que no existen): saquear ya no llama al LLM en absoluto —
    // la narración se construye a mano citando el nombre EXACTO del objeto concedido, así que
    // EnciclopediaLinkedText (frontend) siempre tiene algo real que enlazar, y nunca alucina un
    // objeto de más.
    expect(narrateAction).not.toHaveBeenCalled();
    expect(lastNdjsonLine(narrateRes.payload).narration).toEqual({ narration: expect.stringContaining('Maza orca'), newFacts: [] });

    // Segunda pasada — re-selecciona "Maza orca" (ya tomada) + los 2 que faltaban: no debe
    // duplicar la maza, y ahora sí debe quedar completamente saqueado.
    const classifyRes2 = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification: classification2, roll: roll2 } = classifyRes2.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: {
        saveId,
        action,
        classification: classification2,
        roll: roll2,
        enCombate: true,
        lootItemNames: ['Maza orca', 'Vendaje improvisado orco de las Llanuras', 'Ración de carne ahumada'],
      },
    });

    const afterSecond = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(afterSecond?.saqueado).toBe(true);
    expect(afterSecond?.lootedItemNames).toEqual(
      expect.arrayContaining(['Maza orca', 'Vendaje improvisado orco de las Llanuras', 'Ración de carne ahumada']),
    );
    const inventoryAfterSecond = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(inventoryAfterSecond.map((i) => i.name).sort()).toEqual(
      ['Maza orca', 'Ración de carne ahumada', 'Vendaje improvisado orco de las Llanuras'].sort(),
    );
    // Ya saqueado del todo — no hay nada pendiente, `pendingCombatNpcSlugs` vuelve a quedar vacío.
    const saveAfterFullLoot = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfterFullLoot.pendingCombatNpcSlugs).toEqual([]);
  }, 30_000);

  // Cobertura nueva (2026-08-01, "revisa bien en todos los sitios que pendingCombatNpcSlugs se
  // actualiza bien al acabar un combate" — tras el bug real "el orco que metí volvió a aparecer"):
  // `agresivoSlugsInScene`/`shouldForceCombat` (turnResolution.ts) no miraban `condicionFisica` —
  // un NPC ya MUERTO seguía contando como amenaza (su temperamento de catálogo no cambia al
  // morir) si volvía a matchear en escena vía un hecho de sesión, aunque la acción del turno no
  // tuviera nada que ver con él. Decapita al orco (ya CONVALECIENTE+saqueado de las dos pruebas de
  // arriba) para dejarlo MUERTO de verdad, deja un hecho de sesión que lo siga mencionando (mismo
  // mecanismo real por el que un NPC sigue siendo "candidato" de detectNpcsInScene mucho después
  // de la pelea) y confirma que un turno sin ninguna relación con él no reabre combate.
  it('un NPC ya MUERTO/saqueado no reabre combate aunque su alias siga en hechos de sesión recientes', async () => {
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    const app = await buildApp();
    const executeAction = "Remato a Orco enfurecido, asestándole el golpe de gracia final.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: executeAction, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: executeAction, classification, roll, enCombate: true },
    });
    const stateAfterExecute = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(stateAfterExecute?.condicionFisica).toBe('MUERTO');

    await prisma.$executeRaw`
      INSERT INTO "SessionFact" (id, "saveId", text, embedding, "createdAt")
      VALUES (${crypto.randomUUID()}, ${saveId}, 'Gorhorn derrotó al Orco Enfurecido en la Hondonada del Eco.', NULL, ${new Date()})
    `;

    const exploreAction = 'Exploro la zona';
    const classifyRes2 = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: exploreAction, enCombate: false } });
    const { classification: classification2, roll: roll2 } = classifyRes2.json();
    const narrateRes2 = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: exploreAction, classification: classification2, roll: roll2, enCombate: false },
    });

    expect(lastNdjsonLine(narrateRes2.payload).combateIniciado).toBeNull();
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingCombatNpcSlugs).toEqual([]);
  }, 30_000);

  // Bug real jugando en vivo (2026-09-04/05, sesión autónoma de pruebas con Playwright, partida
  // real de la usuaria): tras Matar → Rematar → Saquear un NPC, `Save.pendingCombatNpcSlugs` podía
  // quedar con el slug del NPC ya MUERTO Y SAQUEADO (confirmado en la partida real: el turno de
  // saqueo persistió su `LogEntry` de acción pero sin `resolveCombatSlugsAndPersist` limpiando el
  // array — el turno de narración de respuesta nunca llegó a completarse). Sin ninguna vía de
  // recuperación: `GameView.tsx` (`composerDisabled = !!combateIniciado && !combat.combatOpen`)
  // bloqueaba el composer para siempre, y "Salir" del panel de combate (`closeCombat`,
  // `useCombatFlow.ts`) solo limpiaba el estado LOCAL de React, nunca el backend. Fix: nuevo
  // endpoint `POST /saves/:id/combat/cerrar`, llamado por `closeCombat` — vacía
  // `pendingCombatNpcSlugs` de verdad, validando en servidor que no quede nada pendiente real
  // (CONVALECIENTE sin resolver o botín sin saquear) antes de aceptarlo.
  it('POST /saves/:id/combat/cerrar limpia pendingCombatNpcSlugs cuando el NPC ya está MUERTO y saqueado', async () => {
    const app = await buildApp();
    const executeAction = "Remato a Orco enfurecido, asestándole el golpe de gracia final.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: executeAction, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: executeAction, classification, roll, enCombate: true },
    });
    const stateAfterExecute = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(stateAfterExecute?.condicionFisica).toBe('MUERTO');

    // Se fuerza el escenario roto directamente (en vez de depender de reproducir el camino exacto
    // que lo dejó así en producción): el array sigue con el slug pese al NPC ya resuelto — este es
    // justo el estado real encontrado en la partida bloqueada. `saqueado: false` explícito (otro
    // test anterior de este mismo describe pudo dejarlo ya saqueado) para comprobar de verdad el
    // camino de rechazo.
    await prisma.npcState.update({ where: { id: stateAfterExecute!.id }, data: { saqueado: false, lootedItemNames: [] } });
    await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: ['orco-enfurecido-hondonada'] } });

    // Sin saquear todavía: el endpoint debe rechazar el cierre (409) — de verdad queda botín.
    const rejectedRes = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/cerrar` });
    expect(rejectedRes.statusCode).toBe(409);
    const saveStillDirty = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveStillDirty.pendingCombatNpcSlugs).toEqual(['orco-enfurecido-hondonada']);

    // Saqueado del todo (mismo criterio que hasPendingLoot: sin groupSize, `saqueado: true` basta).
    await prisma.npcState.update({ where: { id: stateAfterExecute!.id }, data: { saqueado: true } });

    const okRes = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/cerrar` });
    expect(okRes.statusCode).toBe(204);
    const saveClean = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveClean.pendingCombatNpcSlugs).toEqual([]);
  }, 30_000);

  it('POST /saves/:id/combat/cerrar rechaza (409) si el NPC sigue CONVALECIENTE sin resolver', async () => {
    const app = await buildApp();
    // Reutiliza el estado ya CONVALECIENTE que dejó el primer test de este describe (el Orco no
    // se remató en este test) — si otro test previo ya lo remató a MUERTO, se fuerza aquí a mano.
    await prisma.npcState.updateMany({ where: { saveId, npcId }, data: { condicionFisica: 'CONVALECIENTE', saqueado: false } });
    await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: ['orco-enfurecido-hondonada'] } });

    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/combat/cerrar` });
    expect(res.statusCode).toBe(409);
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual(['orco-enfurecido-hondonada']);
  }, 15_000);
});

// "Saquear" general (2026-08-17, petición explícita: "que funcione igual que saquear de un
// combate, detectando los npcs muertos de la zona" — CONVALECIENTE dejó de ser saqueable el
// 2026-08-26) — el nuevo GET /saves/:id/saquear-zona encuentra al orco muerto sin que el jugador
// lo nombre. El
// saqueo en sí se manda con `enCombate: true` (mismo criterio EXACTO que ya usa
// `handleSaquearSeleccion` en combate, incluso cuando el combate ya terminó de verdad — "Registrar/
// Decapitar/Saquear son justo las acciones que la pantalla de combate YA terminado ofrece") — evita
// el atajo de `detectsPostCombatInteraction` (turn.ts, solo para `!enCombate`), que está pensado
// para UN único objetivo citado en texto libre, no para un barrido de varios a la vez. Fixture
// propio (no reutiliza el describe de arriba) para no interferir con su secuencia de saqueo.
// P167 (QA-27): tras «Responder» (un turno de texto libre), la tarjeta del encuentro seguía con
// Interactuar, Responder e Ignorar activos: la oferta pacífica seguía pendiente.
describe('Un turno de texto libre deja respondida la oferta pacífica pendiente (P167)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'Recuperar el honor de los Maktor',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
        pendingDynamicModeOffer: { tipo: 'NPC', targetSlug: 'cazadora-serhu', targetName: 'Cazadora Serhu', quienInicia: 'npc' },
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('la oferta se borra y la respuesta lo dice', async () => {
    classifyAction.mockResolvedValue({ requiereTirada: false, atributo: 'carisma', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0 });
    const app = await buildApp();
    const action = 'Le digo a la cazadora serhu: Saludos.';
    const { classification, roll } = (await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action } })).json();
    const narrateRes = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll } });
    expect(narrateRes.statusCode).toBe(200);
    const cuerpo = lastNdjsonLine(narrateRes.payload) as unknown as { ofertaDescartada?: true; dynamicModeOffer: { targetSlug: string } | null };
    expect(cuerpo.ofertaDescartada).toBe(true);
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    const pendiente = save.pendingDynamicModeOffer as { targetSlug: string } | null;
    expect(pendiente?.targetSlug ?? null).not.toBe('cazadora-serhu');
  }, 60_000);
});

// P148 (QA-27): al rematar a un convaleciente salía «Orco enfurecido se defiende con…» encima de
// «no puede defenderse: el golpe acierta sin tirada». Un golpe de gracia no trae defensa del NPC.
describe('Golpe de gracia sin defensa del NPC (P148)', () => {
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    npcId = npc.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'Recuperar el honor de los Maktor',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el golpe a un convaleciente no trae la defensa del NPC', async () => {
    const app = await buildApp();
    const action = "Descargo un golpe directo con todo el peso de mi arma detrás 'Orco enfurecido'.";
    type Cuerpo = { npcAbilityUsed: unknown; combatExchangeDisplay?: { golpeDeGracia?: true } | null };
    let golpeDeGracia: Cuerpo | null = null;
    for (let turno = 0; turno < 6 && !golpeDeGracia; turno++) {
      const { classification, roll } = (await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } })).json();
      const narrateRes = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll, enCombate: true } });
      const cuerpo = lastNdjsonLine(narrateRes.payload) as unknown as Cuerpo;
      if (cuerpo.combatExchangeDisplay?.golpeDeGracia) golpeDeGracia = cuerpo;
    }
    expect(golpeDeGracia).not.toBeNull();
    expect(golpeDeGracia?.npcAbilityUsed).toBeNull();
    const estado = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(estado).not.toBeNull();
  }, 60_000);
});

describe('Saquear zona: GET /saves/:id/saquear-zona + saqueo fuera del panel de combate', () => {
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    npcId = npc.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (saquear zona)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // MUERTO de entrada, sin pasar por un combate real — mismo atajo que usan otros describe de
    // este archivo para dejar el NpcState en el estado exacto que hace falta probar. CONVALECIENTE
    // deja de ser saqueable (2026-08-26, decisión explícita junto con Matar/Capturar/Clemente).
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'MUERTO', saqueado: false } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('GET /saves/:id/saquear-zona encuentra al orco muerto, y el saqueo funciona con lootItemNames', async () => {
    const panelsApp = Fastify();
    await panelsApp.register(panelsRoutes);
    const zonaRes = await panelsApp.inject({ method: 'GET', url: `/saves/${saveId}/saquear-zona` });
    expect(zonaRes.statusCode).toBe(200);
    const { candidates } = zonaRes.json() as { candidates: { slug: string; name: string; condicionFisica: string }[] };
    expect(candidates).toHaveLength(1);
    expect(candidates[0].slug).toBe('orco-enfurecido-hondonada');
    expect(candidates[0].condicionFisica).toBe('MUERTO');

    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    const app = await buildApp();
    const goirnosAntes = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).goirnos;
    const orco = await prisma.npc.findFirstOrThrow({ where: { slug: 'orco-enfurecido-hondonada' } });
    const action = 'Registro los cuerpos de: Orco enfurecido.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, lootItemNames: ['Maza orca'] },
    });
    expect(narrateRes.statusCode).toBe(200);

    const inventoryAfter = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(inventoryAfter.map((i) => i.name)).toContain('Maza orca');
    // B27 (2026-09-28): primer registro de un humanoide → sus Goirnos.
    const goirnosDespues = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).goirnos;
    expect(goirnosDespues).toBe(goirnosAntes + goirnosDeBotin(orco.level));

    // Saqueado parcial (solo Maza orca) — sigue apareciendo en el barrido, con el resto de su
    // loadout todavía disponible.
    const zonaRes2 = await panelsApp.inject({ method: 'GET', url: `/saves/${saveId}/saquear-zona` });
    const { candidates: candidates2 } = zonaRes2.json() as { candidates: { slug: string }[] };
    expect(candidates2).toHaveLength(1);
  }, 15_000);

  // Rama sin cubrir hasta ahora (auditoría de deuda técnica 2026-08-18): el predicado de la línea
  // `hasPendingLoot` (npcScene.ts) tiene una rama de `groupSize` que ya causó un bug real
  // (2026-08-17, "Saquear" marcaba `saqueado:true` de golpe en una presa cazada en grupo) — hasta
  // ahora ningún test de `/saquear-zona` la ejercitaba, solo el camino `!saqueado` de un NPC
  // solitario (el orco de arriba).
  it('caza en grupo: sigue apareciendo mientras corpsesLooted < groupDefeated, y desaparece en cuanto se iguala', async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const corretolvas = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'corretolvas' } });
    const groupSave = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (saquear zona, grupo)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    try {
      // 3 individuos, 2 ya caídos, solo 1 despiezado — aún queda un cadáver real por saquear.
      await prisma.npcState.create({
        data: {
          saveId: groupSave.id,
          npcId: corretolvas.id,
          scope: location.id,
          condicionFisica: 'MUERTO',
          groupSize: 3,
          groupDefeated: 2,
          corpsesLooted: 1,
        },
      });
      const panelsApp = Fastify();
      await panelsApp.register(panelsRoutes);
      const res = await panelsApp.inject({ method: 'GET', url: `/saves/${groupSave.id}/saquear-zona` });
      expect(res.statusCode).toBe(200);
      const { candidates } = res.json() as { candidates: { slug: string }[] };
      expect(candidates.map((c) => c.slug)).toContain('corretolvas');

      // Se iguala corpsesLooted a groupDefeated (despiezado el último cadáver real disponible) —
      // ya no queda nada pendiente de ESTE grupo, deja de listarse.
      await prisma.npcState.update({
        where: { saveId_npcId_scope: { saveId: groupSave.id, npcId: corretolvas.id, scope: location.id } },
        data: { corpsesLooted: 2 },
      });
      const res2 = await panelsApp.inject({ method: 'GET', url: `/saves/${groupSave.id}/saquear-zona` });
      const { candidates: candidates2 } = res2.json() as { candidates: { slug: string }[] };
      expect(candidates2.map((c) => c.slug)).not.toContain('corretolvas');
    } finally {
      await prisma.save.delete({ where: { id: groupSave.id } });
    }
  }, 15_000);
});

// "Volver al campamento"/"Viajar" (2026-08-17, comentarios de startingAbilities.ts) — ambos
// paneles solo LISTAN candidatos; viajar de verdad sigue pasando por el motor de turno normal
// (`resolveTravel`), no probado aquí (ya tiene su propia cobertura en travel.test.ts).
describe('GET /saves/:id/campamentos y /saves/:id/destinos-viaje', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const pozo = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'pozo-cauce-viejo' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (paneles)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.building.create({
      data: { saveId, locationId: hondonada.id, recipeKey: 'campamento', name: 'un campamento base', kind: 'campamento', description: 'x', status: 'ACTIVO' },
    });
    await prisma.locationVisit.create({ data: { saveId, locationId: pozo.id } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('lista el campamento activo con su Location real', async () => {
    const app = Fastify();
    await app.register(panelsRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/campamentos` });
    expect(res.statusCode).toBe(200);
    const { camps } = res.json() as { camps: { locationSlug: string; locationName: string; region: string }[] };
    expect(camps).toEqual([expect.objectContaining({ locationSlug: 'hondonada-del-eco', locationName: 'La Hondonada del Eco' })]);
  });

  it('sin mapa, solo lista ubicaciones ya visitadas (nunca la actual)', async () => {
    const app = Fastify();
    await app.register(panelsRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/destinos-viaje` });
    expect(res.statusCode).toBe(200);
    const { hasMap, destinations } = res.json() as { hasMap: boolean; destinations: { locationSlug: string }[] };
    expect(hasMap).toBe(false);
    expect(destinations).toEqual([expect.objectContaining({ locationSlug: 'pozo-cauce-viejo' })]);
  });

  // Tiempo de juego real hasta cada destino (petición explícita, 2026-08-18) — mismo grafo/fórmula
  // que `resolveTravel` de verdad (buildAdjacency + shortestPath + minutosConDestreza), no una
  // estimación aparte.
  it('cada destino con camino real por el grafo trae minutos/banda ya ajustados a destreza', async () => {
    const app = Fastify();
    await app.register(panelsRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/destinos-viaje` });
    const { destinations } = res.json() as { destinations: { locationSlug: string; minutos: number | null; banda: string | null }[] };
    const pozo = destinations.find((d) => d.locationSlug === 'pozo-cauce-viejo');
    expect(pozo).toBeDefined();
    expect(pozo!.minutos).toBeGreaterThan(0);
    expect(['corta', 'extendida', 'larga']).toContain(pozo!.banda);
  });

  it('con el mapa de las Llanuras en el inventario, lista TODAS las ubicaciones de esa región, visitadas o no', async () => {
    await prisma.inventoryItem.create({
      data: { saveId, name: 'Mapa de las Llanuras', description: 'x', catalogSlug: 'mapa-de-las-llanuras', origin: 'partida' },
    });
    const app = Fastify();
    await app.register(panelsRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/destinos-viaje` });
    const { hasMap, destinations } = res.json() as { hasMap: boolean; destinations: { locationSlug: string }[] };
    expect(hasMap).toBe(true);
    expect(destinations.length).toBeGreaterThan(1); // más que solo el Pozo ya visitado
    expect(destinations.map((d) => d.locationSlug)).not.toContain('hondonada-del-eco'); // nunca la ubicación actual
  });
});

// Cobertura nueva (2026-08-01, "revisar partida" — bug real jugando en vivo: con hacha en
// ARMA_PRINCIPAL y cuchillo en ARMA_SECUNDARIA, un "Ataque Básico" (siempre mano principal, ver
// tarkor_ataque_normal_mano_principal_2026-07-30) narró "le clava su cuchillo de hielo sílice" —
// el arma equivocada. El bloque "ARMA DEL PERSONAJE" ya existente lista las dos sin decir cuál usa
// ESTE golpe; el fix añade un aviso aparte, solo para Ataque Básico con las dos manos ocupadas.
describe('Ataque Básico: atribución de arma cuando hay dos armas equipadas', () => {
  let saveId: string;
  let savedActionId: string;

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 3',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.inventoryItem.create({ data: { saveId, name: 'Hacha de guerra rota', description: 'x', slot: 'ARMA_PRINCIPAL' } });
    await prisma.inventoryItem.create({ data: { saveId, name: 'Cuchillo de hielo sílice', description: 'x', slot: 'ARMA_SECUNDARIA' } });
    const savedAction = await prisma.savedAction.create({
      data: { saveId, name: 'Ataque Básico', promptText: 'Ataco con un golpe directo, con el arma que llevo en la mano principal.', category: 'combate' },
    });
    savedActionId = savedAction.id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el contexto del Narrador nombra el arma de la mano principal, nunca la secundaria', async () => {
    narrateAction.mockClear();
    const app = await buildApp();
    const action = "Ataco con un golpe directo, con el arma que llevo en la mano principal 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId } });
    expect(classifyRes.statusCode).toBe(200);
    const { classification, roll } = classifyRes.json();
    expect(classification.razon).toMatch(/tabla, sin llamada a Ollama/); // confirma que tabuló, no hizo falta mockear classifyAction

    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId },
    });

    const narrateCallArgs = narrateAction.mock.calls.at(-1)?.[0] as { worldFacts?: string[] };
    const hint = narrateCallArgs.worldFacts?.find((f) => f.includes('ESTE GOLPE EN CONCRETO'));
    expect(hint).toContain('Hacha de guerra rota');
    expect(hint).toContain('mano PRINCIPAL');
    expect(hint).not.toMatch(/con Cuchillo de hielo sílice \(la que lleva/);
  }, 15_000);

  // Bug real jugando en vivo (2026-08-01, "revisar partida", misma auditoría): "Tajo Horizontal"
  // (la real de HACHA) narró "lanza su cuchillo de hielo sílice" — la secundaria, no el hacha.
  // Reproducido con la misma pareja de armas que el test de arriba, pero apuntando ambas a un
  // catalogSlug real (worldCatalog.ts) para que `equippedWeaponSlotsForAbilities` sepa su
  // categoría — sin eso, `weaponCategoryForRealAbilityName` no tendría nada contra qué matchear.
  it('el contexto del Narrador nombra el arma exacta de una habilidad real por categoría, aunque viva en la mano secundaria', async () => {
    narrateAction.mockClear();
    await prisma.inventoryItem.updateMany({ where: { saveId, name: 'Hacha de guerra rota' }, data: { catalogSlug: 'hacha-guerra-maktor-rota' } });
    await prisma.inventoryItem.updateMany({ where: { saveId, name: 'Cuchillo de hielo sílice' }, data: { catalogSlug: 'cuchillo-hielo-silice' } });
    const tajoHorizontal = await prisma.savedAction.create({
      data: {
        saveId,
        name: 'Tajo Horizontal',
        promptText: 'Lanzo un tajo amplio en horizontal, buscando cortar con todo el filo de mi hacha.',
        category: 'combate',
      },
    });
    const app = await buildApp();
    const action = "Lanzo un tajo amplio en horizontal, buscando cortar con todo el filo de mi hacha 'Orco enfurecido'.";
    const classifyRes = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId, action, enCombate: true, savedActionId: tajoHorizontal.id },
    });
    const { classification, roll } = classifyRes.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: tajoHorizontal.id },
    });

    const narrateCallArgs = narrateAction.mock.calls.at(-1)?.[0] as { worldFacts?: string[] };
    const hint = narrateCallArgs.worldFacts?.find((f) => f.includes('ESTE GOLPE EN CONCRETO'));
    // El arma correcta (hacha) va en el "es con", la incorrecta (cuchillo) solo puede aparecer en
    // el "nunca con" que la descarta explícitamente — nunca al revés.
    expect(hint).toMatch(/^ESTE GOLPE EN CONCRETO es con Hacha de guerra rota/);
    expect(hint).toContain('nunca con Cuchillo de hielo sílice');
  }, 15_000);
});

// Cobertura nueva (rediseño de combate, 2026-08-09, petición explícita: "una habilidad defensiva
// o de utilidad nunca hará daño directo... las de ataque sí" + "si uso un consumible el rival
// también puede actuar"): las 4 habilidades de clase reconvertidas a rol:'utilidad' reactivo
// (Contraataque/Grito de Guerra/Instinto Salvaje solo se disparan si el rival ataca con daño Y la
// tirada propia tiene éxito; Analizar rival nunca es reactiva) y el gate de daño incondicional
// ahora depende de `rol`, no de `effect`. Dados pinchados al máximo (mismo criterio que "Misión de
// apertura" más arriba) — con Math.random()=0.99, CUALQUIER tirada de este archivo resuelve
// 'claro', así que un intercambio reactivo se dispara siempre que la condición de rol se cumpla.
describe('Rediseño de combate: habilidades de utilidad reactivas y consumibles con turno real', () => {
  let saveId: string;
  let worldId: string;
  let npcId: string;
  let npcSlug: string;
  let contraataqueId: string;
  let gritoDeGuerraId: string;
  let analizarRivalId: string;
  let vorticeMenorId: string;
  let opresionMentalId: string;
  let golpeRunaColeraId: string;
  let golpeEnvenenadoId: string;
  let ataqueBasicoId: string;
  let golpeCanalizadoId: string;

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'orco-enfurecido-hondonada' } });
    npcId = npc.id;
    npcSlug = npc.slug;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba utilidad',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });

    // Mismos nombre/effect/rol/preferredAttribute reales que classAbilities.ts — creados a mano
    // porque este personaje de prueba no se llama 'Gorhorn' (classAbilityUnlocksFor no las
    // sembraría solo).
    contraataqueId = (
      await prisma.savedAction.create({
        data: {
          saveId,
          name: 'Contraataque',
          promptText: 'Aprieto los dientes, aguanto el golpe entrante sin ceder terreno.',
          category: 'combate',
          effects: ['ATAQUE'],
          rol: 'utilidad',
          preferredAttribute: 'voluntad',
          // `attributeBonus: 30` (hallazgo 12, revisar-partida-hallazgos.md 2026-09-06) — antes
          // de este hallazgo, ATAQUE reactivo siempre resolvía por resolveIndependentExchange
          // (dificultad fija propia, sin margen entre lados); ahora que "para el ataque" pasa a
          // tirada-vs-tirada directa (resolveExchange), necesita el mismo bonus artificial que ya
          // usan Vórtice Menor/Opresión Mental/Golpe Runa de Cólera más abajo para garantizar el
          // margen decisivo (`defensor_contragolpea`, ±10) sin depender de qué defensa elija
          // `chooseNpcAbility` este turno.
          attributeBonus: 30,
        },
      })
    ).id;
    gritoDeGuerraId = (
      await prisma.savedAction.create({
        data: {
          saveId,
          name: 'Grito de Guerra',
          promptText: 'Suelto un grito de guerra que retumba antes del choque.',
          category: 'combate',
          effects: ['INTIMIDACION'],
          rol: 'utilidad',
          preferredAttribute: 'carisma',
        },
      })
    ).id;
    analizarRivalId = (
      await prisma.savedAction.create({
        data: {
          saveId,
          name: 'Analizar rival',
          promptText: 'Estudio a mi enemigo un instante, leyendo su punto débil.',
          category: 'combate',
          effects: ['ANALISIS'],
          rol: 'utilidad',
          preferredAttribute: 'inteligencia',
        },
      })
    ).id;
    // CONTRA/CONTROL (2026-08-26, mismo criterio de arriba: creadas a mano con el mismo
    // effects/rol/preferredAttribute real que classAbilities.ts § Vórtice Menor/Opresión Mental,
    // pero con `attributeBonus` mucho más alto que el real — solo para garantizar un margen ≥10
    // (`defensor_contragolpea`) frente al Orco Enfurecido con los dados pinchados al máximo de
    // este describe (roll empatado a 20 en ambos lados, así que el margen sale solo del atributo).
    vorticeMenorId = (
      await prisma.savedAction.create({
        data: {
          saveId,
          name: 'Vórtice Menor',
          promptText: 'Invoco un torbellino menor para esquivar el golpe de mi rival.',
          category: 'combate',
          effects: ['AGUANTE', 'CONTRA'],
          rol: 'defensa',
          preferredAttribute: 'destreza',
          attributeBonus: 30,
        },
      })
    ).id;
    opresionMentalId = (
      await prisma.savedAction.create({
        data: {
          saveId,
          name: 'Opresión Mental',
          promptText: 'Impongo una presión mental invasiva sobre mi rival, buscando desorientarlo.',
          category: 'combate',
          effects: ['CONTROL'],
          rol: 'utilidad',
          preferredAttribute: 'magia',
        },
      })
    ).id;
    // AUMENTO/DEBILIDAD (Fase 2, 2026-08-26) — mismo criterio que Vórtice Menor arriba:
    // `attributeBonus: 30` (muy por encima de la cifra real, 5) solo para garantizar un margen
    // decisivo ('golpe_pleno') en un golpe de ATAQUE del jugador contra la defensa del Orco, sin
    // depender de qué habilidad de defensa concreta elija `chooseNpcAbility` este turno.
    golpeRunaColeraId = (
      await prisma.savedAction.create({
        data: {
          saveId,
          name: 'Golpe Runa de Cólera',
          promptText: 'Grabo una runa de cólera en mi golpe.',
          category: 'combate',
          effects: ['ATAQUE', 'AUMENTO'],
          rol: 'ataque',
          preferredAttribute: 'magia',
          attributeBonus: 30,
          durationEffectMagnitude: 5,
          durationEffectTurns: 1,
        },
      })
    ).id;
    golpeEnvenenadoId = (
      await prisma.savedAction.create({
        data: {
          saveId,
          name: 'Golpe Envenenado',
          promptText: 'Lanzo un tajo rápido untado en veneno.',
          category: 'combate',
          effects: ['ATAQUE', 'DEBILIDAD'],
          rol: 'ataque',
          preferredAttribute: 'destreza',
          attributeBonus: 30,
          durationEffectMagnitude: -4,
          durationEffectTurns: 2,
        },
      })
    ).id;
    ataqueBasicoId = (await prisma.savedAction.create({ data: { saveId, name: 'Ataque Básico', promptText: 'Ataco con un golpe directo.', category: 'combate' } })).id;
    golpeCanalizadoId = (
      await prisma.savedAction.create({
        data: {
          saveId,
          name: 'Golpe Devastador',
          promptText: 'Canalizo toda mi fuerza en un golpe devastador.',
          category: 'combate',
          effects: ['ATAQUE', 'CANALIZAR', 'LETAL'],
          rol: 'ataque',
          preferredAttribute: 'fuerza',
          attributeBonus: 30,
        },
      })
    ).id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  // Hallazgo 12 (revisar-partida-hallazgos.md 2026-09-06) — reescrito: antes de este hallazgo,
  // Contraataque resolvía por resolveIndependentExchange (dificultad fija propia, sin relación
  // con la tirada del NPC) y el golpe base del NPC SIEMPRE llegaba si su propia tirada tenía
  // éxito, sin importar si el jugador también acertaba la suya — "recibes Y devuelves". Ahora que
  // una utilidad que PARA un ataque pasa a tirada-vs-tirada directa (resolveExchange, como
  // ataque/defensa), ganar el contraste de forma decisiva significa PARAR el golpe entrante Y
  // contragolpear — no ya "los dos golpean a la vez". Coherente con el resto de resolveExchange
  // (ninguna otra rama de ataque-vs-defensa deja pasar el golpe base cuando el defensor gana).
  it('Contraataque: si gana el contraste de forma decisiva, para el golpe entrante Y devuelve el suyo propio', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({
      where: { id: saveId },
      data: {
        condicionFisica: 'ILESO',
        pendingCombatNpcSlugs: [npcSlug],
        pendingNpcAttack: {
          npcId,
          attribute: 'fuerza',
          effects: ['ATAQUE'],
          rol: 'ataque',
          abilityName: 'Ataque base',
          abilityDescription: 'Golpe improvisado.',
          energyCost: 5,
          energyRegen: 0,
        },
      },
    });

    const app = await buildApp();
    const action = "Aguanto el golpe entrante y me preparo para responder 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: contraataqueId } });
    expect(classifyRes.statusCode).toBe(200);
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: contraataqueId },
    });
    expect(narrateRes.statusCode).toBe(200);

    // El jugador PARA el golpe base del NPC (gana el contraste de forma decisiva, attributeBonus
    // artificial de por medio) — a diferencia del camino independiente antiguo, aquí ganar
    // significa no recibir daño.
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).toBe('ILESO');
    // Contraataque disparado: el NPC también acusa un golpe de vuelta.
    const npcState = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(npcState?.condicionFisica).not.toBe('ILESO');
  }, 15_000);

  it('Grito de Guerra: si el NPC ataca con daño y la tirada propia tiene éxito, cancela el golpe entrante del todo y te deja la iniciativa', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({
      where: { id: saveId },
      data: {
        condicionFisica: 'ILESO',
        pendingCombatNpcSlugs: [npcSlug],
        pendingNpcAttack: {
          npcId,
          attribute: 'fuerza',
          effects: ['ATAQUE'],
          rol: 'ataque',
          abilityName: 'Ataque base',
          abilityDescription: 'Golpe improvisado.',
          energyCost: 5,
          energyRegen: 0,
        },
      },
    });

    const app = await buildApp();
    const action = "Suelto un grito de guerra justo antes del choque 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: gritoDeGuerraId } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: gritoDeGuerraId },
    });
    expect(narrateRes.statusCode).toBe(200);

    // Cancelado del todo — el jugador NO recibe el golpe, pese a que el NPC "ganó" su propia tirada.
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).toBe('ILESO');
    // Te llevas la iniciativa siguiente — no queda un nuevo pendingNpcAttack esperando defensa.
    const done = lastNdjsonLine(narrateRes.payload);
    expect(done.esperandoDefensaJugador).toBe(false);
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingNpcAttack).toBeNull();
  }, 15_000);

  // Bug real jugando en vivo (2026-09-28, Playwright contra el Orco Enfurecido): el texto real de
  // una defensa ("Me planto y aguanto el golpe que venga...") NO nombra al rival — todos los tests
  // de arriba lo añaden a mano ('Orco enfurecido'), el frontend no. Sin nombre, el orco no salía
  // en `npcsInScene`, la defensa caía al clasificador LLM (sin tirada) y el turno vaciaba
  // `pendingCombatNpcSlugs`: combate terminado en el backend a mitad de pelea.
  it('una defensa que no nombra al rival sigue tabulándose contra él y el combate no se cae', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({
      where: { id: saveId },
      data: {
        condicionFisica: 'ILESO',
        pendingCombatNpcSlugs: [npcSlug],
        pendingNpcAttack: {
          npcId,
          attribute: 'fuerza',
          effects: ['ATAQUE'],
          rol: 'ataque',
          abilityName: 'Ataque base',
          abilityDescription: 'Golpe improvisado.',
          energyCost: 5,
          energyRegen: 0,
        },
      },
    });
    await prisma.sessionFact.deleteMany({ where: { saveId } });

    const app = await buildApp();
    const action = 'Me planto y aguanto el golpe que venga con pura resistencia física.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    expect(classifyRes.statusCode).toBe(200);
    const { classification, roll, npcsInScene } = classifyRes.json();
    expect(npcsInScene.map((n: { slug: string }) => n.slug)).toContain(npcSlug);
    expect(classification.requiereTirada).toBe(true);

    const narrateRes = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll, enCombate: true, npcsInScene } });
    expect(narrateRes.statusCode).toBe(200);
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    // La defensa consumió el ataque pendiente de verdad (hubo intercambio real)...
    expect(saveAfter.pendingNpcAttack === null || (saveAfter.pendingNpcAttack as { abilityName?: string }).abilityName !== undefined).toBe(true);
    // ...y el rival sigue enganchado al combate salvo que haya muerto en este mismo intercambio.
    const npcState = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    if (npcState?.condicionFisica !== 'MUERTO') expect(saveAfter.pendingCombatNpcSlugs).toContain(npcSlug);
    await prisma.save.update({ where: { id: saveId }, data: { pendingNpcAttack: Prisma.JsonNull } });
  }, 15_000);

  it('Analizar rival: nunca hace daño, y marca NpcState.analizado tras usarla con éxito en tu propio turno de iniciativa', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', pendingCombatNpcSlugs: [], pendingNpcAttack: Prisma.JsonNull } });

    const app = await buildApp();
    const action = "Estudio un instante a 'Orco enfurecido', leyendo su punto débil.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: analizarRivalId } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: analizarRivalId },
    });
    expect(narrateRes.statusCode).toBe(200);

    const npcState = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(npcState?.analizado).toBe(true);
    // Nunca hace daño por sí sola — el NPC sigue ILESO (o lo que fuera antes), nunca peor SOLO por
    // usar Analizar rival.
    expect(npcState?.condicionFisica ?? 'ILESO').toBe('ILESO');

    // Bug real (auditoría 2026-08-14, "acaba de salir pero en el siguiente turno" — la Ficha del
    // rival en el frontend seguía vacía hasta el turno siguiente pese a que NpcState.analizado ya
    // era `true` arriba): `combateIniciado.npcs[].analizado` en la respuesta de ESTE MISMO turno
    // venía de `npcsInScene`, leído antes de la transacción — sin el override, mentía a pesar de
    // que la BD ya tenía el dato correcto.
    const { combateIniciado } = lastNdjsonLine(narrateRes.payload) as { combateIniciado: { npcs: { slug: string; analizado: boolean }[] } | null };
    expect(combateIniciado?.npcs?.find((n) => n.slug === 'orco-enfurecido-hondonada')?.analizado).toBe(true);

    // Hallazgo 12 (revisar-partida-hallazgos.md 2026-09-06) — ANALISIS nunca es reactiva: sigue
    // resolviéndose en el camino independiente, pero ahora contra utilityDifficultyFor (suma de
    // atributos) en vez de difficultyHintFor (nivel). Orco (suma=27) muy por debajo del jugador
    // (ATTRS, suma=65) → diff=-38 ≤ -8 → dificultad 6 (Fácil), no la vieja escala por nivel.
    const combatExchangeDisplay = lastNdjsonLine(narrateRes.payload).combatExchangeDisplay as { atacanteEsJugador: boolean; atacante: { difficulty: number } } | null;
    expect(combatExchangeDisplay?.atacanteEsJugador).toBe(true);
    expect(combatExchangeDisplay?.atacante.difficulty).toBe(6);
  }, 15_000);

  // CONTRA (2026-08-26) — defiende con éxito Y devuelve el golpe, solo si el ataque entrante NO
  // fue de Magia (proxy de "físico"). El NPC ataca con 'fuerza' aquí — CONTRA debe disparar.
  it('Vórtice Menor (CONTRA): defiende con éxito y contragolpea a un ataque físico, sin recibir el golpe', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({
      where: { id: saveId },
      data: {
        condicionFisica: 'ILESO',
        pendingCombatNpcSlugs: [npcSlug],
        pendingNpcAttack: {
          npcId,
          attribute: 'fuerza',
          effects: ['ATAQUE'],
          rol: 'ataque',
          abilityName: 'Ataque base',
          abilityDescription: 'Golpe improvisado.',
          energyCost: 5,
          energyRegen: 0,
        },
      },
    });

    const app = await buildApp();
    const action = "Invoco un torbellino menor para esquivar el golpe de 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: vorticeMenorId } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: vorticeMenorId },
    });
    expect(narrateRes.statusCode).toBe(200);

    // Defensa con éxito — el jugador no recibe el golpe.
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).toBe('ILESO');
    // Pero contragolpea de vuelta — el NPC sí acusa un golpe.
    const npcState = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(npcState?.condicionFisica).not.toBe('ILESO');
  }, 15_000);

  // REFRACTAR/CONTRA (2026-08-26) — mismo margen decisivo que arriba, pero el ataque entrante es
  // de Magia: una habilidad con solo CONTRA (sin REFRACTAR) NO debe contragolpear.
  it('Vórtice Menor (CONTRA): NO contragolpea un ataque de Magia — ese lo cubriría REFRACTAR, no CONTRA', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({
      where: { id: saveId },
      data: {
        condicionFisica: 'ILESO',
        pendingCombatNpcSlugs: [npcSlug],
        pendingNpcAttack: {
          npcId,
          attribute: 'magia',
          effects: ['ATAQUE'],
          rol: 'ataque',
          abilityName: 'Descarga arcana',
          abilityDescription: 'Un golpe de energía pura.',
          energyCost: 5,
          energyRegen: 0,
        },
      },
    });

    const app = await buildApp();
    const action = "Invoco un torbellino menor para esquivar el golpe de 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: vorticeMenorId } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: vorticeMenorId },
    });
    expect(narrateRes.statusCode).toBe(200);

    const npcState = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(npcState?.condicionFisica ?? 'ILESO').toBe('ILESO');
  }, 15_000);

  // CONTROL en 1vs1 (2026-08-26, "si es 1vs1 CONTROL pasa a ser un aturdimiento") — mismo
  // comportamiento observable que Grito de Guerra/Instinto Salvaje: se queda con la iniciativa,
  // sin `pendingNpcAttack` esperando defensa.
  it('Opresión Mental (CONTROL): si dispara, te deja con la iniciativa del próximo intercambio', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({
      where: { id: saveId },
      data: {
        condicionFisica: 'ILESO',
        pendingCombatNpcSlugs: [npcSlug],
        pendingNpcAttack: {
          npcId,
          attribute: 'fuerza',
          effects: ['ATAQUE'],
          rol: 'ataque',
          abilityName: 'Ataque base',
          abilityDescription: 'Golpe improvisado.',
          energyCost: 5,
          energyRegen: 0,
        },
      },
    });

    const app = await buildApp();
    const action = "Impongo una presión mental invasiva sobre 'Orco enfurecido', buscando desorientarlo.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: opresionMentalId } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: opresionMentalId },
    });
    expect(narrateRes.statusCode).toBe(200);

    const done = lastNdjsonLine(narrateRes.payload);
    expect(done.esperandoDefensaJugador).toBe(false);
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingNpcAttack).toBeNull();
  }, 15_000);

  // Fase 2 de efectos de clase (2026-08-26, docs/producto/21-roadmap.md) — AUMENTO: el jugador ataca con la
  // iniciativa (sin `pendingNpcAttack`, mismo patrón que "Ataque Básico" más arriba en el archivo),
  // conecta de forma decisiva y se empuja un `ActiveEffect` sobre su propio `Save.activeEffects`.
  // Un segundo turno (Ataque Básico normal) debe decrementarlo hasta expirar (turnsRemaining: 1 →
  // 0 → fuera del array).
  it('Golpe Runa de Cólera (AUMENTO): un golpe decisivo empuja un efecto activo sobre el propio jugador, y expira un turno después', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', pendingCombatNpcSlugs: [npcSlug], pendingNpcAttack: Prisma.JsonNull, activeEffects: [] } });

    const app = await buildApp();
    const action = "Grabo una runa de cólera en mi golpe contra 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: golpeRunaColeraId } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: golpeRunaColeraId },
    });
    expect(narrateRes.statusCode).toBe(200);

    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.activeEffects).toEqual([{ attribute: 'magia', magnitude: 5, turnsRemaining: 1, sourceAbility: 'Golpe Runa de Cólera' }]);

    // Segundo turno cualquiera con intercambio real — el efecto ya existía ANTES de este turno, así
    // que decrementa y expira (a diferencia del turno en que nace, que no se decrementa a sí mismo).
    // Fuerza la iniciativa del jugador de nuevo (turno 1 pudo dejársela al NPC) para que este
    // segundo golpe pase seguro por CASO ATAQUE, no por una defensa a ciegas.
    await prisma.save.update({ where: { id: saveId }, data: { pendingNpcAttack: Prisma.JsonNull } });
    const action2 = "Ataco con un golpe directo 'Orco enfurecido'.";
    const classifyRes2 = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: action2, enCombate: true, savedActionId: ataqueBasicoId } });
    const { classification: classification2, roll: roll2 } = classifyRes2.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: action2, classification: classification2, roll: roll2, enCombate: true, savedActionId: ataqueBasicoId },
    });
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.activeEffects).toEqual([]);
  }, 20_000);

  // DEBILIDAD — mismo mecanismo espejado sobre el NPC objetivo del golpe (nunca sobre quien la usó).
  it('Golpe Envenenado (DEBILIDAD): un golpe decisivo empuja un efecto activo sobre el NPC golpeado, y decrementa en el turno siguiente', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', pendingCombatNpcSlugs: [npcSlug], pendingNpcAttack: Prisma.JsonNull, activeEffects: [] } });

    const app = await buildApp();
    const action = "Lanzo un tajo rápido untado en veneno contra 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: golpeEnvenenadoId } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: golpeEnvenenadoId },
    });
    expect(narrateRes.statusCode).toBe(200);

    const npcState = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId } });
    expect(npcState.activeEffects).toEqual([{ attribute: 'destreza', magnitude: -4, turnsRemaining: 2, sourceAbility: 'Golpe Envenenado' }]);

    // Fuerza la iniciativa del jugador de nuevo, mismo motivo que el test de AUMENTO de arriba.
    await prisma.save.update({ where: { id: saveId }, data: { pendingNpcAttack: Prisma.JsonNull } });
    const action2 = "Ataco con un golpe directo 'Orco enfurecido'.";
    const classifyRes2 = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: action2, enCombate: true, savedActionId: ataqueBasicoId } });
    const { classification: classification2, roll: roll2 } = classifyRes2.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: action2, classification: classification2, roll: roll2, enCombate: true, savedActionId: ataqueBasicoId },
    });
    const npcStateAfter = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId } });
    expect(npcStateAfter.activeEffects).toEqual([{ attribute: 'destreza', magnitude: -4, turnsRemaining: 1, sourceAbility: 'Golpe Envenenado' }]);
  }, 20_000);

  // Cierre del hueco de motor (2026-09-09, `NpcCombatAbility.durationEffectMagnitude/Turns` +
  // `PendingNpcAttack.durationEffectMagnitude/Turns`, npcCombatAbilities.ts/combatExchange.ts) —
  // hasta ahora ningún atacante AUTÓNOMO (NPC rival o Companion) podía generar AUMENTO/DEBILIDAD
  // con duración, solo el jugador (tests de arriba). Mismo `pendingNpcAttack` sembrado a mano que
  // Contraataque/Grito de Guerra, pero con los campos nuevos poblados — camino espejo: AUMENTO va
  // al propio NPC atacante (NpcState.activeEffects), DEBILIDAD al jugador que lo recibe
  // (Save.activeEffects). El jugador responde con Ataque Básico (sin attributeBonus) para que el
  // margen decisivo salga a favor del NPC (attributeBonus artificial en el pendingNpcAttack).
  it('un NPC que ataca con una habilidad de AUMENTO/DEBILIDAD y golpea de forma decisiva empuja ActiveEffect reales (NPC y jugador)', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({
      where: { id: saveId },
      data: {
        condicionFisica: 'ILESO',
        pendingCombatNpcSlugs: [npcSlug],
        activeEffects: [],
        pendingNpcAttack: {
          npcId,
          attribute: 'fuerza',
          effects: ['ATAQUE', 'AUMENTO', 'DEBILIDAD'],
          rol: 'ataque',
          abilityName: 'Golpe Runa de Cólera del Orco',
          abilityDescription: 'Un golpe cargado de runas hostiles.',
          energyCost: 5,
          energyRegen: 0,
          attributeBonus: 30,
          durationEffectMagnitude: 5,
          durationEffectTurns: 1,
        },
      },
    });

    const app = await buildApp();
    const action = "Ataco con un golpe directo 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: ataqueBasicoId } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: ataqueBasicoId },
    });
    expect(narrateRes.statusCode).toBe(200);

    const npcState = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId } });
    expect(npcState.activeEffects).toEqual([{ attribute: 'fuerza', magnitude: 5, turnsRemaining: 1, sourceAbility: 'Golpe Runa de Cólera del Orco' }]);
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.activeEffects).toEqual([{ attribute: 'fuerza', magnitude: 5, turnsRemaining: 1, sourceAbility: 'Golpe Runa de Cólera del Orco' }]);
  }, 15_000);

  // CANALIZAR real (2026-09-09, cierre de hueco de motor — bloqueaba capstones nv.40 de Tirador/
  // Rúnico/Convocador/Maestro Arquero/Maestro Ballestero/Berserker) — diseño confirmado por la
  // usuaria: "no da nada por sí solo... si te golpean se corta; iniciativa normal, turno normal".
  it('CANALIZAR: empezar a canalizar no tira dados ni ataca — solo siembra Save.pendingCanalizacion', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', pendingCombatNpcSlugs: [npcSlug], pendingNpcAttack: Prisma.JsonNull, pendingCanalizacion: Prisma.JsonNull } });

    const app = await buildApp();
    const action = "Canalizo toda mi fuerza en un golpe devastador contra 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: golpeCanalizadoId } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: golpeCanalizadoId },
    });
    expect(narrateRes.statusCode).toBe(200);

    // El NPC sigue ILESO — canalizar no golpea este turno.
    const npcState = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(npcState?.condicionFisica ?? 'ILESO').toBe('ILESO');

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingCanalizacion).not.toBeNull();
    expect((saveAfter.pendingCanalizacion as { abilityName: string }).abilityName).toBe('Golpe Devastador');

    await prisma.save.update({ where: { id: saveId }, data: { pendingCanalizacion: Prisma.JsonNull } });
  }, 15_000);

  it('CANALIZAR: sin interrupción, el turno siguiente dispara el ataque real diferido (con LETAL)', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({
      where: { id: saveId },
      data: {
        condicionFisica: 'ILESO',
        pendingCombatNpcSlugs: [npcSlug],
        pendingNpcAttack: Prisma.JsonNull,
        pendingCanalizacion: {
          abilityName: 'Golpe Devastador',
          attribute: 'fuerza',
          attributeBonus: 30,
          effects: ['ATAQUE', 'CANALIZAR', 'LETAL'],
          npcId,
        },
      },
    });

    const app = await buildApp();
    // Cualquier acción en combate dispara la resolución de la canalización pendiente — se ignora
    // la habilidad que se mande este turno (mismo criterio que la defensa a ciegas de pendingNpcAttack).
    const action = "Sigo presionando a 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: ataqueBasicoId } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: ataqueBasicoId },
    });
    expect(narrateRes.statusCode).toBe(200);

    // El golpe canalizado se disparó de verdad — con LETAL, mata directo (margen decisivo
    // garantizado por attributeBonus:30 + Math.random fijo a 0.99 en todo este describe).
    const npcState = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId } });
    expect(npcState.condicionFisica).toBe('MUERTO');

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingCanalizacion).toBeNull();
  }, 15_000);

  it('CANALIZAR: un golpe decisivo del NPC mientras se canaliza la corta — el turno siguiente no dispara el ataque diferido', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({
      where: { id: saveId },
      data: {
        condicionFisica: 'ILESO',
        pendingCombatNpcSlugs: [npcSlug],
        pendingCanalizacion: {
          abilityName: 'Golpe Devastador',
          attribute: 'fuerza',
          attributeBonus: 30,
          effects: ['ATAQUE', 'CANALIZAR', 'LETAL'],
          npcId,
        },
        // El NPC ya ganó la iniciativa de este intercambio (CASO DEFENSA) — un golpe suyo
        // decisivo mientras el jugador canaliza debe cortarla. `attributeBonus` alto en el
        // ataque del NPC (artificial) garantiza `golpe_pleno` sin depender de qué defensa
        // elija el jugador con Ataque Básico (sin bonus propio).
        pendingNpcAttack: {
          npcId,
          attribute: 'fuerza',
          effects: ['ATAQUE'],
          rol: 'ataque',
          abilityName: 'Ataque base',
          abilityDescription: 'Golpe improvisado.',
          energyCost: 5,
          energyRegen: 0,
          attributeBonus: 30,
        },
      },
    });

    const app = await buildApp();
    const action = "Aguanto el golpe entrante 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: ataqueBasicoId } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: ataqueBasicoId },
    });
    expect(narrateRes.statusCode).toBe(200);

    // El jugador recibió el golpe decisivo del NPC.
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).not.toBe('ILESO');
    // La canalización se cortó — nunca queda viva para el turno siguiente.
    expect(save.pendingCanalizacion).toBeNull();

    // Turno siguiente (sin pendingNpcAttack, el jugador tiene la iniciativa de nuevo): confirma
    // que el golpe canalizado NUNCA se dispara — el Orco sigue vivo, no MUERTO por LETAL.
    await prisma.save.update({ where: { id: saveId }, data: { pendingNpcAttack: Prisma.JsonNull, condicionFisica: 'ILESO' } });
    const action2 = "Ataco con un golpe directo 'Orco enfurecido'.";
    const classifyRes2 = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: action2, enCombate: true, savedActionId: ataqueBasicoId } });
    const { classification: classification2, roll: roll2 } = classifyRes2.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: action2, classification: classification2, roll: roll2, enCombate: true, savedActionId: ataqueBasicoId },
    });
    const npcStateAfter = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId } });
    expect(npcStateAfter.condicionFisica).not.toBe('MUERTO');
  }, 20_000);

  it('consumir un objeto en combate activa el intercambio (el NPC puede actuar), pero nunca cuenta como golpe propio', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', pendingCombatNpcSlugs: [], pendingNpcAttack: Prisma.JsonNull } });
    // Sin intención de ataque ni savedActionId, /turn/classify no tabula — cae a `classifyAction`
    // (mockeada en todo el archivo, sin valor por defecto: hay que dárselo aquí).
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });

    const app = await buildApp();
    const action = "Bebo mi poción de curación 'Orco enfurecido'.";
    // Sin savedActionId — un consumible se manda como texto libre (GameView.tsx § handleCombatUseItem).
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, isItemUse: true },
    });
    expect(narrateRes.statusCode).toBe(200);

    // El intercambio se activó de verdad (antes del rediseño, `combateActivo` salía false y esto
    // nunca ocurría) — `combatExchangeDisplay` solo se rellena cuando `exchangeHappened`.
    const done = lastNdjsonLine(narrateRes.payload);
    expect(done.combatExchangeDisplay).not.toBeNull();
    // Nunca cuenta como golpe propio — el NPC no puede acabar peor SOLO por esto (sea cual sea el
    // resultado de la tirada del NPC contra el jugador, nunca al revés).
    const npcState = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(npcState?.condicionFisica ?? 'ILESO').toBe('ILESO');
  }, 15_000);

  // Multi-efecto (2026-08-15, "que una habilidad pueda tener múltiples AbilityEffects"): una
  // habilidad con effects: ['ATAQUE', 'ATURDIMIENTO'] dispara los DOS efectos en el mismo
  // intercambio — antes del rediseño solo el primero de la cascada (else-if) se aplicaba. Mismo
  // montaje que el test de Contraataque de arriba (pendingNpcAttack rol:'ataque', dados pinchados
  // al máximo con Math.random=0.99), pero comprobando ambas consecuencias mecánicas a la vez.
  it('una habilidad con effects: [ATAQUE, ATURDIMIENTO] devuelve el golpe Y se queda con la iniciativa, las dos cosas en el mismo intercambio', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({
      where: { id: saveId },
      data: {
        condicionFisica: 'ILESO',
        pendingCombatNpcSlugs: [npcSlug],
        pendingNpcAttack: {
          npcId,
          attribute: 'fuerza',
          effects: ['ATAQUE'],
          rol: 'ataque',
          abilityName: 'Ataque base',
          abilityDescription: 'Golpe improvisado.',
          energyCost: 5,
          energyRegen: 0,
        },
      },
    });
    const golpeAturdidorId = (
      await prisma.savedAction.create({
        data: {
          saveId,
          name: 'Golpe Aturdidor',
          promptText: 'Aprovecho la apertura para golpear y desequilibrarlo del todo.',
          category: 'combate',
          effects: ['ATAQUE', 'ATURDIMIENTO'],
          rol: 'utilidad',
          preferredAttribute: 'voluntad',
          // `attributeBonus: 30` (hallazgo 12) — mismo motivo que Contraataque más arriba: ATAQUE
          // reactivo ahora pasa por resolveExchange (tirada-vs-tirada), necesita el margen
          // decisivo garantizado sin depender de la defensa real que elija el NPC.
          attributeBonus: 30,
        },
      })
    ).id;

    const app = await buildApp();
    const action = "Aprovecho la apertura para golpear y desequilibrarlo del todo 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: golpeAturdidorId } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: golpeAturdidorId },
    });
    expect(narrateRes.statusCode).toBe(200);

    // Hallazgo 12 — mismo cambio de comportamiento que Contraataque arriba: ganar el contraste de
    // forma decisiva para el golpe entrante del NPC (no ya "recibes Y devuelves").
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).toBe('ILESO');
    // Efecto ATAQUE: el NPC también acusa un golpe de vuelta.
    const npcState = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(npcState?.condicionFisica).not.toBe('ILESO');
    // Efecto ATURDIMIENTO, EN EL MISMO intercambio: el jugador se queda con la iniciativa
    // siguiente — no queda un pendingNpcAttack nuevo esperando defensa (igual que Grito de
    // Guerra arriba).
    const done = lastNdjsonLine(narrateRes.payload);
    expect(done.esperandoDefensaJugador).toBe(false);
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingNpcAttack).toBeNull();
  }, 15_000);

  // maxUsesPerCombat/LIMITADA (2026-08-17): una habilidad con tope de usos se cuenta en
  // NpcState.abilityUsesThisEncounter la primera vez, y en cuanto se agota, el segundo intento
  // dentro del MISMO combate se trata mecánicamente como si no se hubiera pulsado ningún botón
  // (cae al Narrador con un aviso explícito) — sin volver a incrementar el contador.
  it('Golpe Preciso (maxUsesPerCombat: 1): se cuenta la primera vez; la segunda, en el mismo combate, se bloquea y no se recuenta', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'ILESO', pendingCombatNpcSlugs: [], pendingNpcAttack: Prisma.JsonNull } });
    const golpePrecisoId = (
      await prisma.savedAction.create({
        data: {
          saveId,
          name: 'Golpe Preciso',
          promptText: 'Busco el hueco exacto en su guardia para un solo golpe limpio.',
          category: 'combate',
          effects: ['LIMITADA'],
          maxUsesPerCombat: 1,
          rol: 'utilidad',
          preferredAttribute: 'destreza',
        },
      })
    ).id;

    const app = await buildApp();
    const action = "Busco el hueco exacto en su guardia para un solo golpe limpio 'Orco enfurecido'.";

    const classifyRes1 = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: golpePrecisoId } });
    const { classification: c1, roll: r1 } = classifyRes1.json();
    const narrateRes1 = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification: c1, roll: r1, enCombate: true, savedActionId: golpePrecisoId },
    });
    expect(narrateRes1.statusCode).toBe(200);
    const npcStateAfterFirst = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(npcStateAfterFirst?.abilityUsesThisEncounter).toEqual({ 'Golpe Preciso': 1 });

    const classifyRes2 = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: golpePrecisoId } });
    const { classification: c2, roll: r2 } = classifyRes2.json();
    const narrateRes2 = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification: c2, roll: r2, enCombate: true, savedActionId: golpePrecisoId },
    });
    expect(narrateRes2.statusCode).toBe(200);

    // Nunca se recuenta más allá de su propio tope, aunque se haya vuelto a pulsar.
    const npcStateAfterSecond = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(npcStateAfterSecond?.abilityUsesThisEncounter).toEqual({ 'Golpe Preciso': 1 });

    // El segundo intento avisa al Narrador de que la habilidad ya está agotada este combate.
    const narrateCallArgs = narrateAction.mock.calls.at(-1)?.[0] as { worldFacts?: string[] };
    expect(narrateCallArgs.worldFacts?.some((f) => f.includes('ya agotó sus 1 uso(s) de este combate'))).toBe(true);
  }, 20_000);

  // RECUPERACION (2026-08-17, primera mecánica real de los ~19 AbilityEffect que solo tenían
  // nombre + comentario) — reactiva a un ataque del NPC (mismo montaje que Contraataque), recupera
  // un extra de energía (RECUPERACION_ENERGY_BONUS=15) aparte del `energyRegen` propio de la
  // habilidad (aquí puesto a 0 para que la diferencia observada sea SOLO el bonus).
  it('una habilidad con effects: [RECUPERACION] recupera energía extra al dispararse, aparte de su propio energyRegen', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId } });
    const saveBefore = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    await prisma.save.update({
      where: { id: saveId },
      data: {
        condicionFisica: 'ILESO',
        energia: 0,
        pendingCombatNpcSlugs: [npcSlug],
        pendingNpcAttack: {
          npcId,
          attribute: 'fuerza',
          effects: ['ATAQUE'],
          rol: 'ataque',
          abilityName: 'Ataque base',
          abilityDescription: 'Golpe improvisado.',
          energyCost: 5,
          energyRegen: 0,
        },
      },
    });
    const respiroId = (
      await prisma.savedAction.create({
        data: {
          saveId,
          name: 'Respiro táctico',
          promptText: 'Me concentro un momento en plena guardia, buscando recobrar fuerzas.',
          category: 'combate',
          effects: ['RECUPERACION'],
          rol: 'utilidad',
          preferredAttribute: 'voluntad',
          energyCost: 0,
          energyRegen: 0,
        },
      })
    ).id;

    const app = await buildApp();
    const action = "Me concentro un momento en plena guardia, buscando recobrar fuerzas 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: respiroId } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: respiroId },
    });
    expect(narrateRes.statusCode).toBe(200);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.energia).toBe(15); // 0 (energyCost/energyRegen propios) + 15 del bonus de RECUPERACION
    expect(saveBefore.energia).not.toBe(saveAfter.energia);
  }, 15_000);
});

// Cobertura nueva (2026-07-31, petición explícita: "que aparezca en la narración del personaje el
// título de la misión y el objetivo, a modo de notificación") — `newQuestInfo` solo se rellena el
// turno EXACTO en que se crea una misión de verdad, nunca antes ni después.
describe('newQuestInfo: notificación de misión aceptada', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 2',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
        // Reconectado al sistema de posición en Zona (auditoría de pruebas en vivo, 2026-09-16):
        // la fase 1/2 de Gistera Koh ya no depende de contar turnos, exige que el jugador esté en
        // la misma celda o adyacente a su ZonePoint real (worldCatalog.ts, x:220/y:500 en la
        // Hondonada del Eco) — sin esto, `gisteraKoh` sería siempre null y el gancho no dispararía.
        zonaPosX: 220,
        zonaPosY: 500,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // REDISEÑO 2026-08-30 (bug real jugando en vivo, "sigue sin salir el boton aceptar y
    // cancelar"): antes se sembraba `gisteraYaPresentada = true` a mano (SessionFact directa) y se
    // esperaba que un turno de ACEPTACIÓN VERBAL disparara `newQuestOfferInfo` — ya no es así, el
    // botón debe ofrecerse en el turno en que Gistera SE PRESENTA (`gisteraSePresentaEsteTurno`),
    // no cuando el jugador ya aceptó por texto libre. Sin sembrar nada aquí: `gisteraYaPresentada`
    // debe empezar en `false` de verdad, para que el propio turno de diálogo del test la dispare.
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  // `enCombate: true` en las dos pruebas de abajo — no porque sea combate de verdad (no hay
  // ningún NPC en escena, `combateActivo` nunca llega a activarse), sino para tomar el mismo atajo
  // que ya usa el resto de este archivo: sin esto, `narrateAndPersistTurn` llamaría a
  // `retrieveLore` (RAG de lore) de verdad, que necesita Ollama arriba solo para embeber la
  // consulta — nada que ver con lo que se comprueba aquí. `classifyAction` sí hace falta mockearla
  // (a diferencia del resto del archivo, que tabula sin llamarla): sin un NPC en escena tampoco
  // tabula por su cuenta.
  // REDISEÑO 2026-08-30 (bug real jugando en vivo, "sigue sin salir el boton aceptar y cancelar"):
  // antes el botón exigía una frase de ACEPTACIÓN VERBAL en texto libre; ahora se ofrece en el
  // turno de PRESENTACIÓN (diálogo, `gisteraSePresentaEsteTurno`) — sin sembrar `gisteraYaPresentada`
  // a mano, para que sea literalmente el primer turno de diálogo con ella en la partida.
  it('al hablar con Gistera Koh cuando se presenta, newQuestOfferInfo ofrece la misión con botones', async () => {
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'voluntad', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    const app = await buildApp();
    // Turno de relleno primero (a propósito): la partida es nueva, así que la acción de aceptar
    // sería la ACCIÓN Nº1 del jugador — eso dispara el gancho de fase-1 de Gistera Koh
    // (`gisteraKoh = playerActionCount === 1 ? ...`, turnResolution.ts), que añade un `newFacts`
    // propio y necesitaría Ollama arriba solo para embeberlo, algo que no tiene nada que ver con
    // lo que prueba este test. Un turno cualquiera antes corre ese gancho a un lado.
    const filler = 'Miro alrededor con calma';
    const fillerClassify = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: filler, enCombate: true } });
    const fillerParsed = fillerClassify.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: filler, classification: fillerParsed.classification, roll: fillerParsed.roll, enCombate: true },
    });

    // `detectsDialogueIntent` exige un signo de pregunta/exclamación o un verbo de diálogo —
    // "Yo me encargo de tu perseguidor" (texto viejo) no matcheaba nada de eso.
    const action = '¿Quién eres?';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });
    // Bug real 2026-08-28 ("misión se salta los botones Aceptar/Cancelar" — petición explícita:
    // "quiero que las misiones pasen todas por aceptar y cancelar, sin excepción"): este camino
    // creaba la Quest YA ACTIVA directamente aquí (`newQuestInfo`), saltándose los botones. Ahora
    // solo OFRECE, igual que el camino genérico — `newQuestOfferInfo`, sin crear la Quest todavía.
    const body = lastNdjsonLine(narrateRes.payload);
    expect(body.newQuestInfo).toBeNull();
    expect(body.newQuestOfferInfo).toEqual({
      title: 'Acabar con el Orco Enfurecido',
      description: 'Gistera Koh, expulsada del Clan Serhu, pide ayuda para acabar con el guerrero que la persigue. Aceptar la pondría a salvo.',
    });
    const quest = await prisma.quest.findFirst({ where: { saveId, title: 'Acabar con el Orco Enfurecido' } });
    expect(quest).toBeNull();
  }, 30_000);

  it('en un turno que no crea ninguna misión, newQuestInfo es null', async () => {
    classifyAction.mockResolvedValueOnce({
      requiereTirada: false, atributo: 'voluntad', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    const app = await buildApp();
    const action = 'Miro el paisaje con calma';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });
    expect(lastNdjsonLine(narrateRes.payload).newQuestInfo).toBeNull();
  }, 30_000);
});

// Botones Aceptar/Cancelar (2026-08-26, petición explícita: "en vez de depender de que la jugadora
// escriba texto libre para aceptar... que 'Aceptar' genere una narración determinista de
// aceptación") — el camino GENÉRICO de `narration.newQuest` (a diferencia del determinista de
// Gistera/Orco Enfurecido de arriba, que sigue igual) ya NO crea la Quest en el propio turno: solo
// la ofrece. `POST /saves/:id/quests/aceptar` es quien la materializa de verdad.
describe('newQuestOfferInfo + POST /saves/:id/quests/aceptar: oferta de misión sin aceptar todavía', () => {
  let saveId: string;
  let orcoId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const orco = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    orcoId = orco.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 14',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // LogEntry de jugador sembrado a mano (no vía doTurn) — el guion de Gistera Koh se dispara
    // exactamente en `playerActionCount === 1` (turnResolution.ts), así que empezar ya en 2
    // evita el guion entero sin arriesgarse a que un turno de relleno real dispare OTRO
    // determinismo inesperado (ocurrió probando esto: "Examino el terreno" activó recolección).
    await prisma.logEntry.create({
      data: { saveId, channel: 'CHARACTER', text: 'relleno', timeLabel: 'Día 1, mañana', fictionalMinutes: 480, isPlayerAction: true },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'carisma', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  // CR-40 (hito 0.2, Q1): el narrador ya no crea misiones — un `newQuest` del modelo se ignora (ni
  // oferta ni `Quest`). Las misiones secundarias salen del motor (tablones de avisos y NPC). La ruta
  // de aceptar sigue sirviendo a la oferta fija de Gistera y a ofertas antiguas guardadas.
  it('CR-40: el turno ignora un newQuest del narrador (ni oferta ni misión)', async () => {
    narrateAction.mockResolvedValueOnce({
      narration: 'El Orco Enfurecido te ofrece una tregua si le traes su maza perdida.',
      newFacts: [],
      newQuest: { title: 'Recuperar la maza del Orco Enfurecido', description: 'El Orco Enfurecido ofrece una tregua a cambio de su maza perdida.' },
    });
    const res = await doTurn(saveId, "Me acerco despacio a 'Orco enfurecido' sin decir nada.");
    const body = lastNdjsonLine(res.payload);

    expect(body.newQuestInfo).toBeNull();
    expect(body.newQuestOfferInfo).toBeNull();
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).pendingQuestOfferInfo).toBeNull();
    const quest = await prisma.quest.findFirst({ where: { saveId, title: 'Recuperar la maza del Orco Enfurecido' } });
    expect(quest).toBeNull();
  }, 20_000);

  it('POST /quests/aceptar materializa la misión de verdad, con el anclaje real resuelto y un LogEntry determinista', async () => {
    const app = await buildApp();
    await app.register(questsRoutes);
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/quests/aceptar`,
      payload: { title: 'Recuperar la maza del Orco Enfurecido', description: 'El Orco Enfurecido ofrece una tregua a cambio de su maza perdida.' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.alreadyExisted).toBe(false);
    expect(body.quest.targetNpcId).toBe(orcoId);
    expect(body.logEntry.text).toBe('Gorhorn de prueba 14 acepta la misión: Recuperar la maza del Orco Enfurecido.');

    const quest = await prisma.quest.findFirstOrThrow({ where: { saveId, title: 'Recuperar la maza del Orco Enfurecido' } });
    expect(quest.status).toBe('ACTIVA');
    expect(quest.targetNpcId).toBe(orcoId);
  }, 20_000);

  it('aceptar dos veces la misma misión es idempotente — no duplica la Quest', async () => {
    const app = await buildApp();
    await app.register(questsRoutes);
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/quests/aceptar`,
      payload: { title: 'Recuperar la maza del Orco Enfurecido', description: 'El Orco Enfurecido ofrece una tregua a cambio de su maza perdida.' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().alreadyExisted).toBe(true);

    const count = await prisma.quest.count({ where: { saveId, title: 'Recuperar la maza del Orco Enfurecido' } });
    expect(count).toBe(1);
  }, 20_000);

  // Bug real encontrado verificando en vivo la Pieza 5 (2026-09-03): aceptar "Acabar con el Orco
  // Enfurecido" por el botón narraba la despedida de Gistera Koh (texto fijo) pero nunca hacía el
  // `npcsRetiredForever: { push: 'gistera-koh' } }` equivalente que sí hace `gisteraAceptaEsteTurno`
  // en turnResolution.ts para el camino de texto libre — el mecanismo GENERAL que otros consumidores
  // (`detectNpcsInScene`/`filterFarewellFacts`, npcScene.ts y worldFacts.ts) consultan quedaba sin
  // aplicar en el camino recomendado desde 2026-08-26.
  it('aceptar "Acabar con el Orco Enfurecido" por el botón retira a Gistera Koh para siempre (npcsRetiredForever)', async () => {
    const app = await buildApp();
    await app.register(questsRoutes);
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/quests/aceptar`,
      payload: { title: 'Acabar con el Orco Enfurecido', description: 'Gistera Koh pidió ayuda para acabar con el guerrero que la persigue.' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().logEntry.text).toContain('Gistera Koh asiente, aliviada');

    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId }, select: { npcsRetiredForever: true } });
    expect(save.npcsRetiredForever).toContain('gistera-koh');
  }, 20_000);

  // questSlug estructurado (roadmap 2026-09-03): el caso especial de Orco Enfurecido/Gistera ya no
  // se reconoce ni se persiste solo por TÍTULO EXACTO (`quests.ts`, antes `ORCO_ENFURECIDO_QUEST_TITLE`
  // comparado contra `Quest.title`) — ahora la mecánica queda anclada a `Quest.questSlug`, un campo
  // separado del título narrativo que ve la jugadora.
  it('la Quest de Orco Enfurecido/Gistera persiste con questSlug, no solo por título', async () => {
    const app = await buildApp();
    await app.register(questsRoutes);
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/quests/aceptar`,
      payload: { title: 'Acabar con el Orco Enfurecido', description: 'Gistera Koh pidió ayuda para acabar con el guerrero que la persigue.' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().quest.questSlug).toBe('orco-enfurecido-hondonada-gistera');

    // Idempotencia también vía questSlug: pulsar "Aceptar" otra vez no duplica la Quest.
    const res2 = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/quests/aceptar`,
      payload: { title: 'Acabar con el Orco Enfurecido', description: 'Gistera Koh pidió ayuda para acabar con el guerrero que la persigue.' },
    });
    expect(res2.json().alreadyExisted).toBe(true);
    const count = await prisma.quest.count({ where: { saveId, questSlug: 'orco-enfurecido-hondonada-gistera' } });
    expect(count).toBe(1);
  }, 20_000);
});

// Menú contextual de interacción con NPC (2026-09-06, "Aprender oficio" deja de depender de una
// habilidad suelta) — `npcInteractionOffer` (turnResolution.ts) solo se ofrece para NPC con
// `interactionTypes` no vacío en catálogo. `orco-enfurecido-hondonada` no lo tiene sembrado por
// defecto — se actualiza a mano y se restaura en `afterAll` para no dejar el catálogo real tocado
// tras el test (compartido con el resto de la suite, sin transacción entre archivos).
describe('npcInteractionOffer: menú contextual al hablar con un NPC con interactionTypes', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    await prisma.npc.updateMany({
      where: { worldId: world.id, slug: 'orco-enfurecido-hondonada', saveId: null },
      data: { interactionTypes: ['NPC_LORE'] },
    });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba npc-interaction',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.logEntry.create({
      data: { saveId, channel: 'CHARACTER', text: 'relleno', timeLabel: 'Día 1, mañana', fictionalMinutes: 480, isPlayerAction: true },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'carisma', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    await prisma.npc.updateMany({
      where: { worldId: world.id, slug: 'orco-enfurecido-hondonada', saveId: null },
      data: { interactionTypes: [] },
    });
  });

  it('hablar con un NPC con interactionTypes escribe npcInteractionOffer y lo persiste en Save', async () => {
    narrateAction.mockResolvedValueOnce({ narration: 'El Orco Enfurecido te mira en silencio.', newFacts: [] });
    const res = await doTurn(saveId, "Hablo con 'Orco enfurecido'.");
    const body = lastNdjsonLine(res.payload);

    expect(body.npcInteractionOffer).toEqual({
      npcSlug: 'orco-enfurecido-hondonada',
      npcName: expect.any(String),
      options: ['Charlar', 'Combatir', 'Salir'],
    });
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingNpcInteractionOffer).toEqual(body.npcInteractionOffer);
  }, 20_000);

  it('sin intención de diálogo (acción sin señales de habla): npcInteractionOffer es null', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { pendingNpcInteractionOffer: Prisma.JsonNull } });
    narrateAction.mockResolvedValueOnce({ narration: 'Gorhorn observa el terreno en silencio.', newFacts: [] });
    const res = await doTurn(saveId, 'Examino el terreno cercano.');
    const body = lastNdjsonLine(res.payload);

    expect(body.npcInteractionOffer).toBeNull();
  }, 20_000);
});

// Bug real jugando en vivo (2026-09-03, "misión de apertura no sobrevive a un F5") —
// `pendingQuestOfferInfo` (schema.prisma) persiste la oferta para que GET /saves/:id la reconstruya
// tras recargar, y se limpia al Aceptar o Cancelar — mismo patrón exacto ya probado para
// `pendingDynamicModeOffer`.
describe('pendingQuestOfferInfo: la oferta de misión sobrevive a un F5 (auditoría "sesión de juego" 2026-09-03)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (pendingQuestOfferInfo)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // Mismo motivo que el describe hermano de arriba: empezar en playerActionCount=2 evita
    // disparar el guion completo de Gistera Koh, que también propone una misión determinista.
    await prisma.logEntry.create({
      data: { saveId, channel: 'CHARACTER', text: 'relleno', timeLabel: 'Día 1, mañana', fictionalMinutes: 480, isPlayerAction: true },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'carisma', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  // CR-40: la oferta ya no la crea un `newQuest` del narrador; se siembra como la dejaría la oferta
  // fija de Gistera (o una partida antigua) para comprobar que sobrevive a una recarga.
  it('la oferta guardada se mantiene, y GET /saves/:id la reconstruye tras "recargar"', async () => {
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingQuestOfferInfo: { title: 'Recuperar la maza del Orco Enfurecido (F5)', description: 'El Orco Enfurecido ofrece una tregua a cambio de su maza perdida.' } },
    });
    await doTurn(saveId, "Me acerco despacio a 'Orco enfurecido' sin decir nada.");

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingQuestOfferInfo).toEqual({
      title: 'Recuperar la maza del Orco Enfurecido (F5)',
      description: 'El Orco Enfurecido ofrece una tregua a cambio de su maza perdida.',
    });

    const detailApp = await buildApp();
    await detailApp.register(detailRoutes);
    const detailRes = await detailApp.inject({ method: 'GET', url: `/saves/${saveId}` });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json().pendingQuestOfferInfo).toEqual({
      title: 'Recuperar la maza del Orco Enfurecido (F5)',
      description: 'El Orco Enfurecido ofrece una tregua a cambio de su maza perdida.',
    });
  }, 20_000);

  it('POST /quests/aceptar limpia pendingQuestOfferInfo — ya no reaparece tras recargar', async () => {
    const app = await buildApp();
    await app.register(questsRoutes);
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/quests/aceptar`,
      payload: { title: 'Recuperar la maza del Orco Enfurecido (F5)', description: 'El Orco Enfurecido ofrece una tregua a cambio de su maza perdida.' },
    });
    expect(res.statusCode).toBe(200);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingQuestOfferInfo).toBeNull();
  }, 20_000);

  it('POST /quests/cancelar limpia pendingQuestOfferInfo sin crear ninguna Quest', async () => {
    await prisma.save.update({
      where: { id: saveId },
      data: { pendingQuestOfferInfo: { title: 'Recuperar el casco del Orco Enfurecido', description: 'El Orco Enfurecido ofrece una tregua a cambio de su casco perdido.' } },
    });
    const saveWithOffer = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveWithOffer.pendingQuestOfferInfo).not.toBeNull();

    const app = await buildApp();
    await app.register(questsRoutes);
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/quests/cancelar` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingQuestOfferInfo).toBeNull();
    const quest = await prisma.quest.findFirst({ where: { saveId, title: 'Recuperar el casco del Orco Enfurecido' } });
    expect(quest).toBeNull();
  }, 20_000);
});

// Cobertura (auditoría de deuda técnica AMPLIA 2026-08-04 + guard de catálogo 2026-08-25, Grupo 3
// § Mundo determinista): `narration.newItem` (objeto narrativo libre propuesto por el LLM) ya no
// crea un `InventoryItem` sin más — desde 2026-08-25 exige que el nombre coincida con un item REAL
// del `ItemCatalog` del mundo (antes cualquier nombre inventado se creaba igual, sin
// `catalogSlug`, con `equipSlot`/`effectKey`/`tipo` siempre `null`). Si coincide, hereda esos
// campos reales del catálogo — si no, se descarta sin crear nada.
describe('newInventoryItems: narration.newItem exige catálogo real (Grupo 3 § Mundo determinista)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 12',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un nombre que coincide con el catálogo se crea de verdad, con equipSlot/tipo reales heredados', async () => {
    narrateAction.mockResolvedValueOnce({
      narration: 'Gorhorn encuentra un cuchillo de hielo sílice entre las rocas.',
      newFacts: [],
      newItem: { name: 'Cuchillo de hielo sílice', description: 'Tallado a mano, sin adornos.' },
    });
    const res = await doTurn(saveId, 'Busco entre las rocas.');
    const body = lastNdjsonLine(res.payload);

    const row = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, name: 'Cuchillo de hielo sílice' } });
    expect(row.catalogSlug).toBe('cuchillo-hielo-silice');
    expect(body.newInventoryItems).toEqual([
      expect.objectContaining({ id: row.id, name: 'Cuchillo de hielo sílice', slot: null, equipSlot: 'ARMA_PRINCIPAL', tipo: 'EQUIPABLE' }),
    ]);
  }, 20_000);

  it('un nombre inventado, sin catálogo real detrás, no crea ningún objeto', async () => {
    narrateAction.mockResolvedValueOnce({
      narration: 'Gorhorn talla un amuleto tosco con el hueso que encontró.',
      newFacts: [],
      newItem: { name: 'Amuleto tosco de hueso inventado sin catálogo', description: 'Tallado a mano, sin adornos.' },
    });
    const res = await doTurn(saveId, 'Tallo un amuleto con este hueso que encontré.');
    const body = lastNdjsonLine(res.payload);

    const row = await prisma.inventoryItem.findFirst({ where: { saveId, name: 'Amuleto tosco de hueso inventado sin catálogo' } });
    expect(row).toBeNull();
    expect(body.newInventoryItems).toEqual([]);
  }, 20_000);
});

// Cobertura nueva (2026-08-04, "el campamento" — primera construcción anclada al mapa): igual que
// el saqueo, construir con una receta fija (CONSTRUCTION_RECIPES) ya no depende del LLM en
// absoluto — nombre/descripción salen de la receta, nunca de `narration.newBuilding` libre.
describe('Construcción determinista: campamento', () => {
  let saveId: string;
  let locationId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    locationId = location.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 3',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
        // Posición de entrada de Zona ya conocida (2026-09-08, ver test de Building.x/y más abajo)
        // — sin esto el Building creado quedaría con x/y null, comportamiento válido para una
        // partida que nunca "entró" a la Zona, pero no lo que este fixture quiere ejercitar.
        zonaPosEntradaX: 400,
        zonaPosEntradaY: 300,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // Materiales EXACTOS que pide CAMPAMENTO_RECIPE (construction.ts, rebalanceo 2026-08-24): 6
    // madera, 8 piedra, 2 piel — catalogSlugs reales de worldCatalog.ts, cada uno con su
    // categoría correcta.
    await prisma.inventoryItem.createMany({
      data: [
        { saveId, name: 'Leña de matorral de cuerno (6)', description: 'x', catalogSlug: 'lena-matorral-cuerno', origin: 'partida' },
        { saveId, name: 'Piedra (8)', description: 'x', catalogSlug: 'piedra', origin: 'partida' },
        { saveId, name: 'Lana de múrgol (2)', description: 'x', catalogSlug: 'lana-murgol', origin: 'partida' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('con materiales suficientes: construye sin llamar al LLM, consume los materiales y ancla el Building a la ubicación actual', async () => {
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'larga', duracionEstimadaMinutos: 4320,
    });
    const app = await buildApp();

    // Turno de relleno (mismo motivo que en 'newQuestInfo' de arriba): esquivar el gancho de
    // fase-1 de Gistera Koh en la acción #1 de la partida, que añadiría texto ajeno a lo que se
    // comprueba aquí.
    const filler = 'Miro alrededor con calma';
    const fillerClassify = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: filler, enCombate: true } });
    const fillerParsed = fillerClassify.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: filler, classification: fillerParsed.classification, roll: fillerParsed.roll, enCombate: true },
    });

    narrateAction.mockClear();
    const action = 'Construyo un campamento base en este lugar.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });

    expect(narrateAction).not.toHaveBeenCalled();
    const body = lastNdjsonLine(narrateRes.payload);
    expect(body.narration).toEqual({ narration: expect.stringContaining('Campamento'), newFacts: [] });

    const building = await prisma.building.findFirstOrThrow({ where: { saveId } });
    expect(building.recipeKey).toBe('campamento');
    expect(building.locationId).toBe(locationId);
    expect(building.status).toBe('ACTIVO');
    expect(building.name).toBe('Campamento Base Orco de las Llanuras');
    // Posición en el lienzo de Zona (2026-09-08, ver comentario de Building.x/y en schema.prisma —
    // hallazgo real: el campamento nunca aparecía en el mapa de Zona, solo en el panel de Reino).
    expect(building.x).not.toBeNull();
    expect(building.y).not.toBeNull();

    // Los 3 materiales se consumieron EXACTOS (6/8/2, sin remanente) — no debe quedar nada.
    const inventoryAfter = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(inventoryAfter).toEqual([]);
  }, 30_000);

  it('sin materiales suficientes: no crea ningún Building y deja que el LLM narre el intento', async () => {
    narrateAction.mockClear();
    const app = await buildApp();
    const action = 'Construyo un campamento base en este lugar.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });

    expect(narrateAction).toHaveBeenCalledTimes(1);
    // Sigue habiendo solo el Building de la prueba anterior — este turno no añade ninguno.
    const buildings = await prisma.building.findMany({ where: { saveId } });
    expect(buildings).toHaveLength(1);
  }, 15_000);

  it('sin materiales suficientes, aunque el LLM desobedezca y rellene newBuilding igualmente: NO crea ningún Building (auditoría 2026-08-06)', async () => {
    // Bug real: el candado de "construcción rechazada" solo limpiaba `narration.newFacts`, nunca
    // `narration.newBuilding` — un modelo que ignorase la instrucción de "no completes la
    // construcción" podía conseguir un edificio real sin materiales ni comprobar ninguna regla de
    // reino, con solo rellenar ese campo estructurado aparte.
    narrateAction.mockClear();
    narrateAction.mockResolvedValueOnce({
      narration: 'Gorhorn se pone manos a la obra y termina de levantar un pequeño ayuntamiento.',
      newFacts: [],
      newBuilding: { name: 'un ayuntamiento colado', kind: 'ayuntamiento', description: 'x' },
    });
    const app = await buildApp();
    const action = 'Construyo un ayuntamiento aquí mismo.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });

    expect(narrateAction).toHaveBeenCalledTimes(1);
    // Sigue sin haber ningún ayuntamiento — ni ese ni ningún otro edificio nuevo aparte del
    // campamento ya existente de la prueba anterior.
    const buildings = await prisma.building.findMany({ where: { saveId } });
    expect(buildings).toHaveLength(1);
    expect(buildings[0].recipeKey).toBe('campamento');
  }, 15_000);
});

// Cobertura nueva (hallazgo real jugando en vivo, 2026-09-08): nada impedía construir un
// campamento personal DENTRO de una Location que ya tiene infraestructura de una facción NPC
// sembrada de catálogo (Ketg'lukar, Herrería... del Clan Serhu, todas `ZonePoint tipo: EDIFICIO`
// sin `Building` real asociado — el viejo tope de `maxPerRegion` solo contaba `Building` del
// propio jugador, nunca veía esos `ZonePoint`). Fix en `computeBuildBlockedReason`
// (construction.ts): bloquea cualquier receta si la Location actual ya tiene algún `ZonePoint
// tipo: EDIFICIO`.
describe('Construcción rechazada: territorio ya ocupado por otra facción (hallazgo real 2026-09-08)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    // 'campamento-serhu-interior' (Ketg'lukar) — mismo sitio real donde se reprodujo el hallazgo,
    // ya sembrado con varios ZonePoint tipo EDIFICIO (Ketg'lukar/Herrería/Curtiduría/Cocina).
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'campamento-serhu-interior' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (territorio ajeno)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.inventoryItem.createMany({
      data: [
        { saveId, name: 'Leña de matorral de cuerno (6)', description: 'x', catalogSlug: 'lena-matorral-cuerno', origin: 'partida' },
        { saveId, name: 'Piedra (8)', description: 'x', catalogSlug: 'piedra', origin: 'partida' },
        { saveId, name: 'Lana de múrgol (2)', description: 'x', catalogSlug: 'lana-murgol', origin: 'partida' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('con materiales de sobra: NO crea ningún Building dentro del asentamiento de otra facción', async () => {
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'larga', duracionEstimadaMinutos: 4320,
    });
    narrateAction.mockClear();
    const app = await buildApp();
    const action = 'Construyo un campamento base en este lugar.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });

    // El LLM narra el intento (mismo camino que "sin materiales suficientes") — ningún Building
    // real se crea, pese a tener todos los materiales de sobra.
    expect(narrateAction).toHaveBeenCalledTimes(1);
    const buildings = await prisma.building.findMany({ where: { saveId } });
    expect(buildings).toHaveLength(0);
  }, 15_000);
});

// Cobertura nueva (auditoría en vivo, 2026-09-01, hallazgo de un agente investigando "la
// construcción rechaza materiales válidos y deja el Building EN_CONSTRUCCION huérfano"): el
// camino DIFERIDO real de construcción (`Building` `EN_CONSTRUCCION` creado por `/turn/classify`,
// completado más tarde por `startEagerTransitResolution` vía `earlyBuildingId`) nunca tenía NINGÚN
// test — toda la suite de "Construcción determinista" de arriba llama a `/turn/narrate`
// directamente, con `earlyBuildingId` siempre `undefined` (comentario propio de
// `turnResolution.ts`: "nunca pasa hoy, todas las recetas son banda larga"). Este test ejercita el
// camino real de producción de punta a punta.
//
// De paso, confirma el fix de staleness de `catalogBySlug` (turnResolution.ts): antes de ese fix,
// un material cuyo `catalogSlug` no estuviera ya en el snapshot pre-transacción de
// `narrateAndPersistTurn` podía undercontarse al revalidar dentro de la transacción
// (`matchesRow`/ingredients.ts, lookup por categoría) — aquí no se fuerza esa ventana exacta con
// timing real (frágil e indeterminista desde fuera de la función), pero si esa relectura no
// ampliara el mapa correctamente, este mismo test fallaría igual en cuanto tocara cualquier
// material no visto por `planDeterministicBuild` (que sí usa su propio catálogo fresco al crear
// el `CharacterTransit`).
describe('Construcción diferida (camino real de producción, startEagerTransitResolution) — nunca antes cubierto por ningún test (auditoría 2026-09-01)', () => {
  let saveId: string;
  let locationId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    locationId = location.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (construcción diferida real)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.inventoryItem.createMany({
      data: [
        { saveId, name: 'Leña de matorral de cuerno (6)', description: 'x', catalogSlug: 'lena-matorral-cuerno', origin: 'partida' },
        { saveId, name: 'Piedra (8)', description: 'x', catalogSlug: 'piedra', origin: 'partida' },
        { saveId, name: 'Lana de múrgol (2)', description: 'x', catalogSlug: 'lana-murgol', origin: 'partida' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('con earlyBuildingId real: completa el Building a ACTIVO y consume los materiales exactos', async () => {
    const action = 'Construyo un campamento base en este lugar.';
    const earlyBuilding = await prisma.building.create({
      data: {
        saveId,
        locationId,
        recipeKey: 'campamento',
        name: 'Campamento Base Orco de las Llanuras',
        kind: 'campamento',
        description: 'x',
        status: 'EN_CONSTRUCCION',
      },
    });
    const transit = await prisma.characterTransit.create({
      data: {
        saveId,
        activity: action,
        busyUntil: new Date(Date.now() + 10 * 60_000), // lejos a propósito: notBefore manda
        zoneContext: {
          action,
          classification: { requiereTirada: false, atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'larga', duracionEstimadaMinutos: 4320 },
          roll: undefined,
          travel: null,
          buildingId: earlyBuilding.id,
        } as object,
      },
    });

    await startEagerTransitResolution(transit.id, new Date());

    const building = await prisma.building.findUniqueOrThrow({ where: { id: earlyBuilding.id } });
    expect(building.status).toBe('ACTIVO');

    // Los 3 materiales se consumieron EXACTOS — nada queda en el inventario. Si el fix de
    // staleness de `catalogBySlug` se rompiera, este `Building` se quedaría `EN_CONSTRUCCION`
    // igual que en el bug real reportado.
    const inventoryAfter = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(inventoryAfter).toEqual([]);

    // El CharacterTransit se borra al completar — ya no queda ningún tránsito "colgado".
    const transitAfter = await prisma.characterTransit.findUnique({ where: { id: transit.id } });
    expect(transitAfter).toBeNull();
  }, 15_000);
});

// BUG CERRADO (auditoría en vivo, 2026-09-01): mencionar "leña" al construir (materiales que el
// jugador ya lleva, texto libre normal) disparaba la regex de producción de leña de
// `computeDuration` (timedActions.ts) EN PARALELO a la construcción real, creando un InventoryItem
// fantasma ("Leña (N)", N absurdo por la fórmula de minutos×fuerza de una banda "larga") sin
// relación con la construcción. Partida propia (materiales/ubicación aparte del describe de
// arriba) para no interferir con su estado compartido.
describe('Construcción determinista: mencionar "leña" en el texto no crea un InventoryItem fantasma (auditoría 2026-09-01)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (campamento con leña en el texto)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.inventoryItem.createMany({
      data: [
        { saveId, name: 'Leña de matorral de cuerno (6)', description: 'x', catalogSlug: 'lena-matorral-cuerno', origin: 'partida' },
        { saveId, name: 'Piedra (8)', description: 'x', catalogSlug: 'piedra', origin: 'partida' },
        { saveId, name: 'Lana de múrgol (2)', description: 'x', catalogSlug: 'lana-murgol', origin: 'partida' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('construye el campamento y consume los materiales exactos, sin crear ningún InventoryItem "Leña" nuevo', async () => {
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'larga', duracionEstimadaMinutos: 4320,
    });
    const app = await buildApp();

    // Turno de relleno (mismo motivo que en el describe hermano de arriba): esquivar el gancho de
    // fase-1 de Gistera Koh en la acción #1 de la partida, que añadiría un newFact ajeno a lo que
    // se comprueba aquí.
    const filler = 'Miro alrededor con calma';
    const fillerClassify = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: filler, enCombate: true } });
    const fillerParsed = fillerClassify.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: filler, classification: fillerParsed.classification, roll: fillerParsed.roll, enCombate: true },
    });

    const action = 'Construyo un campamento base aquí mismo, usando la leña, piedra y piel que llevo.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });

    const body = lastNdjsonLine(narrateRes.payload);
    expect(body.narration).toEqual({ narration: expect.stringContaining('Campamento'), newFacts: [] });

    const building = await prisma.building.findFirstOrThrow({ where: { saveId } });
    expect(building.recipeKey).toBe('campamento');
    expect(building.status).toBe('ACTIVO');

    // Los 3 materiales originales se consumieron EXACTOS — y sobre todo, NO aparece ningún
    // InventoryItem nuevo de "Leña" (el objeto fantasma que causaba el bug).
    const inventoryAfter = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(inventoryAfter).toEqual([]);
  }, 30_000);
});

const ATTRS_CARISMATICO = { ...ATTRS, carisma: 18 };

async function giveMaterials(saveId: string, items: { name: string; catalogSlug: string }[]) {
  await prisma.inventoryItem.createMany({
    data: items.map((i) => ({ saveId, name: i.name, description: 'x', catalogSlug: i.catalogSlug, origin: 'partida' })),
  });
}

async function doTurn(saveId: string, action: string) {
  const app = await buildApp();
  const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
  const { classification, roll } = classifyRes.json();
  return app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll, enCombate: true } });
}

// Cobertura nueva (2026-08-04, docs/mecanicas/17-reglas-construcciones-reino.md): cupo de 1 campamento
// activo por región — dos ubicaciones REALES de la misma región (Las Llanuras del Viento Rojo).
describe('Campamento: cupo de 1 activo por región', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 5',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'larga', duracionEstimadaMinutos: 4320,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un segundo campamento en OTRA ubicación de la MISMA región se rechaza', async () => {
    await giveMaterials(saveId, [
      { name: 'Leña de matorral de cuerno (20)', catalogSlug: 'lena-matorral-cuerno' },
      { name: 'Piedra (10)', catalogSlug: 'piedra' },
      { name: 'Lana de múrgol (5)', catalogSlug: 'lana-murgol' },
    ]);
    narrateAction.mockClear();
    await doTurn(saveId, 'Construyo un campamento base en este lugar.');
    expect(narrateAction).not.toHaveBeenCalled();
    expect(await prisma.building.count({ where: { saveId, recipeKey: 'campamento' } })).toBe(1);

    // Viaja a otra ubicación de la MISMA región y lo intenta otra vez.
    const pozo = await prisma.location.findFirstOrThrow({ where: { slug: 'pozo-cauce-viejo' } });
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: pozo.id } });
    await giveMaterials(saveId, [
      { name: 'Leña de matorral de cuerno (20)', catalogSlug: 'lena-matorral-cuerno' },
      { name: 'Piedra (10)', catalogSlug: 'piedra' },
      { name: 'Lana de múrgol (5)', catalogSlug: 'lana-murgol' },
    ]);
    narrateAction.mockClear();
    await doTurn(saveId, 'Construyo un campamento base en este lugar.');
    expect(narrateAction).toHaveBeenCalledTimes(1); // rechazado, cae al LLM a narrar el intento
    expect(await prisma.building.count({ where: { saveId, recipeKey: 'campamento' } })).toBe(1); // sigue habiendo solo 1
  }, 20_000);
});

// Cobertura nueva (2026-08-04): Ayuntamiento — fundación, "solo 1 por continente", desbloqueo de
// Choza, y mejora IN-PLACE (nunca crea un segundo Building).
describe('Ayuntamiento: fundación, desbloqueo de reino y mejora in-place', () => {
  let saveId: string;
  let hondonadaId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    hondonadaId = hondonada.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 6',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS_CARISMATICO,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'carisma', dificultad: 15, razon: 'x', banda: 'larga', duracionEstimadaMinutos: 4320,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('choza: rechazada sin Ayuntamiento construido todavía', async () => {
    await giveMaterials(saveId, [
      { name: 'Piel de gargantúa (10)', catalogSlug: 'piel-gargantua' },
      { name: 'Hueso largo de gargantúa (6)', catalogSlug: 'hueso-largo-gargantua' },
      { name: 'Cuerda de tendón (4)', catalogSlug: 'cuerda-tendon' },
    ]);
    narrateAction.mockClear();
    await doTurn(saveId, 'Construyo una choza de piel y hueso aquí.');
    expect(narrateAction).toHaveBeenCalledTimes(1);
    expect(await prisma.building.count({ where: { saveId, recipeKey: 'choza' } })).toBe(0);
    await prisma.inventoryItem.deleteMany({ where: { saveId } }); // no interfiere con las siguientes pruebas
  }, 15_000);

  it('funda el Ayuntamiento (tier 1) — reputación neutra con Clan Serhu = fundación pacífica, crea Territory RECLAMADO', async () => {
    // Materiales del pequeño tras el rebalanceo 2026-08-24 (6 categorías, ver
    // AYUNTAMIENTO_PEQUENO_RECIPE): 14 piedra, 6 leña, 6 hueso, 8 resina, 2 mena, 8 fibra.
    await giveMaterials(saveId, [
      { name: 'Piedra (14)', catalogSlug: 'piedra' },
      { name: 'Leña de matorral de cuerno (6)', catalogSlug: 'lena-matorral-cuerno' },
      { name: 'Hueso largo de gargantúa (6)', catalogSlug: 'hueso-largo-gargantua' },
      { name: 'Resina de trepador del ocaso (8)', catalogSlug: 'resina-trepador-ocaso' },
      { name: 'Mena de Hierro de las Llanuras (2)', catalogSlug: 'mena-hierro-llanuras' },
      { name: 'Fibra de enredaderas (8)', catalogSlug: 'fibra-enredaderas-llanuras' },
    ]);
    narrateAction.mockClear();
    const res = await doTurn(saveId, 'Construyo un ayuntamiento aquí mismo.');
    expect(narrateAction).not.toHaveBeenCalled();
    const body = lastNdjsonLine(res.payload);
    // 'Gorhorn de prueba 6' !== 'Gorhorn' exacto — nombre sugerido null, editable.
    expect(body.newKingdomFounded).toEqual({
      title: 'un pequeño ayuntamiento',
      region: 'Las Llanuras del Viento Rojo',
      outcome: 'CONQUISTADA',
      suggestedName: null,
      nameLocked: false,
    });

    const ayuntamiento = await prisma.building.findFirstOrThrow({ where: { saveId, recipeKey: 'ayuntamiento' } });
    expect(ayuntamiento.tier).toBe(1);
    expect(ayuntamiento.locationId).toBe(hondonadaId);
    expect(ayuntamiento.territoryId).not.toBeNull();
    const territory = await prisma.territory.findUniqueOrThrow({ where: { id: ayuntamiento.territoryId! } });
    expect(territory.control).toBe('RECLAMADO');
    expect(territory.region).toBe('Las Llanuras del Viento Rojo');
  }, 15_000);

  it('un segundo Ayuntamiento NUEVO (no una mejora) se rechaza — máximo 1 por continente', async () => {
    await giveMaterials(saveId, [
      { name: 'Piedra (14)', catalogSlug: 'piedra' },
      { name: 'Leña de matorral de cuerno (6)', catalogSlug: 'lena-matorral-cuerno' },
      { name: 'Hueso largo de gargantúa (6)', catalogSlug: 'hueso-largo-gargantua' },
      { name: 'Resina de trepador del ocaso (8)', catalogSlug: 'resina-trepador-ocaso' },
      { name: 'Mena de Hierro de las Llanuras (2)', catalogSlug: 'mena-hierro-llanuras' },
      { name: 'Fibra de enredaderas (8)', catalogSlug: 'fibra-enredaderas-llanuras' },
    ]);
    narrateAction.mockClear();
    await doTurn(saveId, 'Construyo un ayuntamiento aquí mismo.');
    expect(narrateAction).toHaveBeenCalledTimes(1);
    expect(await prisma.building.count({ where: { saveId, recipeKey: 'ayuntamiento' } })).toBe(1);
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
  }, 15_000);

  it('choza: ahora sí se construye, con Ayuntamiento ya en la misma región', async () => {
    await giveMaterials(saveId, [
      { name: 'Piel de gargantúa (10)', catalogSlug: 'piel-gargantua' },
      { name: 'Hueso largo de gargantúa (6)', catalogSlug: 'hueso-largo-gargantua' },
      { name: 'Cuerda de tendón (4)', catalogSlug: 'cuerda-tendon' },
    ]);
    narrateAction.mockClear();
    await doTurn(saveId, 'Construyo una choza de piel y hueso aquí.');
    expect(narrateAction).not.toHaveBeenCalled();
    expect(await prisma.building.count({ where: { saveId, recipeKey: 'choza', status: 'ACTIVO' } })).toBe(1);
  }, 15_000);

  // Materiales procesados (2026-08-24, Grupo 3 § materiales procesados de construcción) — antes
  // solo 30 piedra + 25 leña crudas; ahora ~75% procesado/25% crudo por categoría. La suposición
  // original de que este save "ya empieza con constructor-orcos-llanuras" era falsa (ver comentario
  // real dentro del test, corregido 2026-08-25) — se siembra a mano ahí.
  it('mejora el Ayuntamiento a mediano IN-PLACE — mismo Building.id, sin duplicar Territory', async () => {
    const before = await prisma.building.findFirstOrThrow({ where: { saveId, recipeKey: 'ayuntamiento' } });
    const territoriesBefore = await prisma.territory.count({ where: { saveId } });
    // Bug real encontrado con Postgres real (2026-08-25): el comentario de arriba asumía que este
    // save "empieza con constructor-orcos-llanuras" (GORHORN_STARTING_PROFESSIONS), pero esa lista
    // solo se siembra en el flujo real de creación de partida (creation.ts) — este save se crea a
    // mano con `prisma.save.create` en el `beforeAll` de este describe, sin pasar por ahí, así que
    // nunca tuvo ninguna fila de ProfessionProgress. Desde que mediano/grande exigen oficio de
    // verdad (OFICIOS_CONSTRUCCION_REQUERIDOS, construction.ts), este test fallaba en silencio en
    // cualquier corrida contra Postgres real — invisible en el sandbox sin DB, donde este archivo
    // nunca llega a ejecutarse de verdad.
    await prisma.professionProgress.create({ data: { saveId, professionId: 'constructor-orcos-llanuras', nivel: 1 } });
    await giveMaterials(saveId, [
      { name: 'Bloque de piedra tallada (3)', catalogSlug: 'bloque-piedra-tallada' },
      { name: 'Piedra (5)', catalogSlug: 'piedra' },
      { name: 'Lingote de hierro (1)', catalogSlug: 'lingote-de-hierro' },
      { name: 'Mena de Hierro de las Llanuras (1)', catalogSlug: 'mena-hierro-llanuras' },
      { name: 'Viga de madera tallada (2)', catalogSlug: 'viga-madera-tallada' },
      { name: 'Leña de matorral de cuerno (3)', catalogSlug: 'lena-matorral-cuerno' },
      { name: 'Columna de hueso (2)', catalogSlug: 'columna-hueso' },
      { name: 'Hueso largo de gargantúa (2)', catalogSlug: 'hueso-largo-gargantua' },
      { name: 'Cordaje trenzado (2)', catalogSlug: 'cordaje-trenzado' },
      { name: 'Fibra de enredaderas (3)', catalogSlug: 'fibra-enredaderas-llanuras' },
      { name: 'Resina de trepador del ocaso (12)', catalogSlug: 'resina-trepador-ocaso' },
    ]);
    narrateAction.mockClear();
    const res = await doTurn(saveId, 'Mejoro mi ayuntamiento a mediano.');
    expect(narrateAction).not.toHaveBeenCalled();
    expect(lastNdjsonLine(res.payload).newKingdomFounded).toBeNull(); // solo se notifica al FUNDAR, no al mejorar

    const after = await prisma.building.findFirstOrThrow({ where: { saveId, recipeKey: 'ayuntamiento' } });
    expect(after.id).toBe(before.id);
    expect(after.tier).toBe(2);
    expect(after.name).toBe('un ayuntamiento mediano');
    expect(await prisma.building.count({ where: { saveId, recipeKey: 'ayuntamiento' } })).toBe(1);
    expect(await prisma.territory.count({ where: { saveId } })).toBe(territoriesBefore);
  }, 15_000);
});

// Cobertura nueva (2026-08-23, Grupo 3 § Territory.control/population — docs/mecanicas/10-niveles-xp-reino.md
// § 5.4, diseñado desde 2026-07-23 pero nunca conectado hasta ahora). Territory/KingdomStats se
// siembran DIRECTO por Prisma (no fundando de verdad) para controlar la felicidad exacta desde el
// primer día — lo que se prueba aquí es el enganche real dentro de turnResolution.ts, no el propio
// tick puro (eso ya lo cubre kingdomTick.test.ts a fondo). Un solo turno con `duracionEstimadaMinutos`
// enorme cruza los 7 días de golpe (mismo patrón ya usado por el resto de este archivo con
// construcciones "banda larga"), evitando 7 turnos reales por test.
describe('Territory.control/population: felicidad sostenida consolida o rebela (Grupo 3, 2026-08-23)', () => {
  let saveId: string;
  let territoryId: string;
  let buildingId: string;

  async function setUp(felicidadFija: number) {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: `Gorhorn de prueba reino ${felicidadFija}`,
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS_CARISMATICO,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    const territory = await prisma.territory.create({
      data: { saveId, name: 'Territorio de prueba', region: 'Las Llanuras del Viento Rojo', description: 'x', control: 'RECLAMADO', population: 15 },
    });
    territoryId = territory.id;
    const building = await prisma.building.create({
      data: { saveId, territoryId, name: 'Choza de prueba', kind: 'choza', recipeKey: 'choza', description: 'x', status: 'ACTIVO' },
    });
    buildingId = building.id;
    // Felicidad fija: `poblacion`/`soldados`/`visitantes` en 0 → `bocas` = 0 → sin déficit/superávit
    // real que la mueva sola, se queda plana durante los 7 días (aísla la racha de lo que ya
    // cubren los tests de tickKingdomOneDay).
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }), felicidad: felicidadFija } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'voluntad', dificultad: 15, razon: 'x', banda: 'larga', duracionEstimadaMinutos: 7 * 1440 + 60,
    });
  }

  // QA-63: borrar la partida espera al avance diario de fondo (`vitest.bdReal.setup.ts`), y tras un
  // salto de 7 días ese avance tarda 6-21 s; con el límite de 10 s de los hooks fallaba. El salto es lo
  // que se prueba, así que el borrado tiene su propio límite.
  afterEach(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  }, 60_000);

  // `doTurn` (definido más abajo) fuerza `enCombate: true` en las dos llamadas — un guard real de
  // turn.ts ("acción de combate clasificada como banda larga... forzada a instantánea") colapsa
  // entonces la banda 'larga' mockeada a 'instantanea' cuando la escena trae cualquier NPC (aquí,
  // el gancho de sesión de Hondonada del Eco), rompiendo el salto de 7 días de golpe que necesita
  // este test. "Espero aquí" no es una acción de combate — `enCombate: false` es lo correcto Y
  // evita el guard.
  //
  // "varios días" en el texto (2026-09-04, hallazgo real generalizando la red de seguridad de
  // duración sospechosa): turn.ts también topa a 60 min cualquier acción sin duración EXPLÍCITA
  // del jugador que el clasificador clasifique como banda no-instantánea — el mock de `setUp`
  // fija `duracionEstimadaMinutos: 7*1440+60` a propósito para simular el salto real de 7 días
  // del Reino, así que el texto tiene que declarar esa duración con un número/palabra reconocido
  // por `mentionsExplicitDuration` ("varios días") para que ningún guard lo capture y lo cape.
  // Fase C del hito 0.1 (2026-10-01, test intermitente en CI): NO pasar por `/turn/classify`. Con banda
  // 'larga', classify crea un `CharacterTransit` y lanza `startEagerTransitResolution` en segundo
  // plano sin esperarla; el `/turn/narrate` de después competía con ella por el candado de turno
  // (`claimTurnInFlight`). Si ganaba la de fondo, narraba pero no persistía hasta `busyUntil` (30 min
  // reales) y el test leía el Reino sin el tick diario (~1 de cada 5 en local); además seguía viva
  // tras el `afterEach` y escribía sobre la partida ya borrada (error de FK de `ZonePoint` en la CI).
  // Lo que se prueba aquí es el tick dentro de `narrateAndPersistTurn`, así que se narra directo con
  // la misma clasificación que devolvería el mock — el frontend tampoco llama a narrate tras un tránsito.
  async function doPassiveTurn(action: string) {
    const app = await buildApp();
    const classification = await classifyAction();
    return app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll: undefined, enCombate: false } });
  }

  it('felicidad ≥70 sostenida 7 días consolida el territorio y da 300 XP de Reino', async () => {
    await setUp(70);
    const xpAntes = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).xp;
    narrateAction.mockClear();
    // A diferencia de las construcciones deterministas (Ayuntamiento, más abajo), "esperar" SÍ es
    // una acción narrada por el LLM de verdad (mockeado) — no hay atajo determinista que la evite,
    // así que aquí no se comprueba si `narrateAction` se llamó o no, solo el resultado mecánico
    // real de Territory/KingdomStats tras el salto de 7 días.
    const res = await doPassiveTurn('Espero aquí varios días, dejando pasar el tiempo tranquilamente.');

    const territory = await prisma.territory.findUniqueOrThrow({ where: { id: territoryId } });
    expect(territory.control).toBe('CONSOLIDADO');
    expect(territory.population).toBe(15); // REI-118: la población ya no crece sola, son los súbditos

    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.xp - xpAntes).toBe(300);
    expect(lastNdjsonLine(res.payload)).toBeTruthy();
  }, 20_000);

  it('felicidad ≤20 sostenida 7 días pierde el territorio (población a 0) y abandona sus edificios', async () => {
    await setUp(20);
    narrateAction.mockClear();
    await doPassiveTurn('Espero aquí varios días, dejando pasar el tiempo tranquilamente.');

    const territory = await prisma.territory.findUniqueOrThrow({ where: { id: territoryId } });
    expect(territory.control).toBe('PERDIDO');
    expect(territory.population).toBe(0);

    const building = await prisma.building.findUniqueOrThrow({ where: { id: buildingId } });
    expect(building.status).toBe('ABANDONADO');
  }, 20_000);

  it('felicidad neutral (50) no consolida ni rebela — el territorio se queda RECLAMADO', async () => {
    await setUp(50);
    narrateAction.mockClear();
    await doPassiveTurn('Espero aquí varios días, dejando pasar el tiempo tranquilamente.');

    const territory = await prisma.territory.findUniqueOrThrow({ where: { id: territoryId } });
    expect(territory.control).toBe('RECLAMADO');
    expect(territory.population).toBe(15); // ni crece ni decrece en la banda neutral

    const building = await prisma.building.findUniqueOrThrow({ where: { id: buildingId } });
    expect(building.status).toBe('ACTIVO');
  }, 20_000);
});

// Panel de Reino real (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.4-ter, 2026-09-21) — lo que se prueba
// aquí es el ENGANCHE real dentro de turnResolution.ts (lectura/escritura Prisma real, contra
// Postgres real), no el propio motor puro (eso ya lo cubre kingdomProduction.test.ts a fondo).
// Mismo patrón que el describe de arriba: Building/Companion/OrdenProduccion sembrados directo por
// Prisma, un turno pasivo con salto de 7 días de golpe.
describe('OrdenProduccion: tick real de producción de Reino (§ 4.4-ter, 2026-09-21)', () => {
  let saveId: string;
  let buildingId: string;
  let companionId: string;

  async function setUp() {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba OrdenProduccion',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS_CARISMATICO,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    const building = await prisma.building.create({
      data: { saveId, name: 'Choza de prueba', kind: 'choza', description: 'x', status: 'ACTIVO' },
    });
    buildingId = building.id;
    const companion = await prisma.companion.create({
      data: { saveId, name: 'Trabajador de prueba', role: 'trabajador', notes: 'x', rolReino: 'trabajador', buildingId },
    });
    companionId = companion.id;
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'voluntad', dificultad: 15, razon: 'x', banda: 'larga', duracionEstimadaMinutos: 7 * 1440 + 60,
    });
  }

  // QA-63: borrar la partida espera al avance diario de fondo (`vitest.bdReal.setup.ts`), y tras un
  // salto de 7 días ese avance tarda 6-21 s; con el límite de 10 s de los hooks fallaba. El salto es lo
  // que se prueba, así que el borrado tiene su propio límite.
  afterEach(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  }, 60_000);

  // Fase C del hito 0.1 (2026-10-01, test intermitente en CI): NO pasar por `/turn/classify`. Con banda
  // 'larga', classify crea un `CharacterTransit` y lanza `startEagerTransitResolution` en segundo
  // plano sin esperarla; el `/turn/narrate` de después competía con ella por el candado de turno
  // (`claimTurnInFlight`). Si ganaba la de fondo, narraba pero no persistía hasta `busyUntil` (30 min
  // reales) y el test leía el Reino sin el tick diario (~1 de cada 5 en local); además seguía viva
  // tras el `afterEach` y escribía sobre la partida ya borrada (error de FK de `ZonePoint` en la CI).
  // Lo que se prueba aquí es el tick dentro de `narrateAndPersistTurn`, así que se narra directo con
  // la misma clasificación que devolvería el mock — el frontend tampoco llama a narrate tras un tránsito.
  async function doPassiveTurn(action: string) {
    const app = await buildApp();
    const classification = await classifyAction();
    return app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll: undefined, enCombate: false } });
  }

  it('con materia prima en el Almacén, un trabajador sin oficio produce una receta sin oficio (smokeMeat)', async () => {
    await setUp();
    await prisma.almacenItem.create({ data: { saveId, name: 'Ración de carne fresca', description: 'x', catalogSlug: 'racion-carne' } });
    await prisma.ordenProduccion.create({ data: { buildingId, recipeKey: 'smokeMeat', modo: 'reponer', prioridad: 5 } });
    narrateAction.mockClear();

    await doPassiveTurn('Espero aquí varios días, dejando pasar el tiempo tranquilamente.');

    const almacen = await prisma.almacenItem.findMany({ where: { saveId } });
    expect(almacen).toHaveLength(1);
    expect(almacen[0].catalogSlug).toBe('racion-carne-ahumada'); // el crudo se consumió, el resultado ocupó su lugar

    const orden = await prisma.ordenProduccion.findFirstOrThrow({ where: { buildingId, recipeKey: 'smokeMeat' } });
    expect(orden.cantidadProducidaAcumulada).toBe(1);
  }, 20_000);

  it('sin materia prima en el Almacén, la orden no produce nada (Almacén se queda vacío)', async () => {
    await setUp();
    await prisma.ordenProduccion.create({ data: { buildingId, recipeKey: 'smokeMeat', modo: 'reponer', prioridad: 5 } });
    narrateAction.mockClear();

    await doPassiveTurn('Espero aquí varios días, dejando pasar el tiempo tranquilamente.');

    expect(await prisma.almacenItem.count({ where: { saveId } })).toBe(0);
    const orden = await prisma.ordenProduccion.findFirstOrThrow({ where: { buildingId, recipeKey: 'smokeMeat' } });
    expect(orden.cantidadProducidaAcumulada).toBe(0);
  }, 20_000);

  it('receta con oficio de tier alto: sin ningún trabajador con nivel suficiente, no produce (decisión explícita: el jugador no cuenta)', async () => {
    await setUp();
    // coraceloMace es tier 3 (herrero-orcos-llanuras) — tier 1 (boiledLichenWater) lo cubre
    // cualquier trabajador de nivel 1 por defecto sin ayuda de oficio real, no sirve para probar
    // el gate. Necesita tier > 1 para que "nivel 1 sin fila propia" falle de verdad.
    await prisma.almacenItem.create({ data: { saveId, name: 'Cola de Coracelo', description: 'x', catalogSlug: 'cola-coracelo' } });
    await prisma.ordenProduccion.create({ data: { buildingId, recipeKey: 'coraceloMace', modo: 'reponer', prioridad: 5 } });
    // El JUGADOR sí tiene nivel alto de ese oficio — no debe importar, el trabajador de Reino es
    // otro Companion sin ninguna fila de ProfessionProgress propia (nivel 1 por defecto).
    await prisma.professionProgress.create({ data: { saveId, professionId: 'herrero-orcos-llanuras', nivel: 9, xp: 8000 } });
    narrateAction.mockClear();

    await doPassiveTurn('Espero aquí varios días, dejando pasar el tiempo tranquilamente.');

    expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug: 'maza-coracelo' } })).toBe(0);
    const orden = await prisma.ordenProduccion.findFirstOrThrow({ where: { buildingId, recipeKey: 'coraceloMace' } });
    expect(orden.cantidadProducidaAcumulada).toBe(0);
  }, 20_000);

  it('orden en modo "unico" con límite alcanzado se desactiva sola tras producir', async () => {
    await setUp();
    await prisma.almacenItem.createMany({
      data: [
        { saveId, name: 'Ración de carne fresca', description: 'x', catalogSlug: 'racion-carne' },
        { saveId, name: 'Ración de carne fresca', description: 'x', catalogSlug: 'racion-carne' },
      ],
    });
    await prisma.ordenProduccion.create({ data: { buildingId, recipeKey: 'smokeMeat', modo: 'unico', limite: 1, prioridad: 5 } });
    narrateAction.mockClear();

    await doPassiveTurn('Espero aquí varios días, dejando pasar el tiempo tranquilamente.');

    const orden = await prisma.ordenProduccion.findFirstOrThrow({ where: { buildingId, recipeKey: 'smokeMeat' } });
    expect(orden.activa).toBe(false);
    expect(orden.cantidadProducidaAcumulada).toBe(1);
    // Solo se consumió 1 ración de carne — la segunda se quedó cruda, la orden ya estaba
    // desactivada antes de poder gastarla.
    expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug: 'racion-carne' } })).toBe(1);
  }, 20_000);

  it('tope de AlmacenLimite alcanzado: la orden se salta y el trabajador queda libre para narración normal', async () => {
    await setUp();
    await prisma.almacenItem.createMany({
      data: Array.from({ length: 5 }, () => ({ saveId, name: 'Ración de carne ahumada', description: 'x', catalogSlug: 'racion-carne-ahumada' })),
    });
    await prisma.almacenItem.create({ data: { saveId, name: 'Ración de carne fresca', description: 'x', catalogSlug: 'racion-carne' } });
    await prisma.almacenLimite.create({ data: { saveId, catalogSlug: 'racion-carne-ahumada', limite: 5 } });
    await prisma.ordenProduccion.create({ data: { buildingId, recipeKey: 'smokeMeat', modo: 'reponer', prioridad: 5 } });
    narrateAction.mockClear();

    await doPassiveTurn('Espero aquí varios días, dejando pasar el tiempo tranquilamente.');

    // El crudo NUNCA se tocó (la orden se saltó antes de comprobar materia prima) — sigue habiendo
    // exactamente 5 ahumadas (el tope) + 1 cruda sin consumir.
    expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug: 'racion-carne-ahumada' } })).toBe(5);
    expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug: 'racion-carne' } })).toBe(1);
    const orden = await prisma.ordenProduccion.findFirstOrThrow({ where: { buildingId, recipeKey: 'smokeMeat' } });
    expect(orden.cantidadProducidaAcumulada).toBe(0);
  }, 20_000);

  it('CR-61 (61d): un plato de cocina suma al Reino lo que vale (Guiso de Múrgol: 64 de curaHambre → 6 de comida)', async () => {
    await setUp();
    await prisma.kingdomStats.create({ data: { saveId, ownerKey: `save:${saveId}`, comida: 0, poblacion: 0, trabajadores: 0 } });
    await prisma.almacenItem.createMany({
      data: [
        { saveId, name: 'Ración de carne fresca', description: 'x', catalogSlug: 'racion-carne' },
        { saveId, name: 'Ración de carne fresca', description: 'x', catalogSlug: 'racion-carne' },
        { saveId, name: 'Leche de múrgol', description: 'x', catalogSlug: 'leche-murgol' },
      ],
    });
    await prisma.ordenProduccion.create({ data: { buildingId, recipeKey: 'murgolStew', modo: 'unico', limite: 1, prioridad: 5 } });
    // Nivel 4 de cocinero (el nivel sale de la XP): alcanza una receta de tier 4.
    await prisma.professionProgress.create({ data: { companionId, professionId: 'cocinero-orcos-llanuras', nivel: 4, xp: 350 } });
    narrateAction.mockClear();

    await doPassiveTurn('Espero aquí varios días, dejando pasar el tiempo tranquilamente.');

    expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug: 'guiso-murgol' } })).toBe(1);
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: `save:${saveId}` } })).comida).toBe(6);
  }, 20_000);

  it('el trabajador que produce sube de nivel de oficio propio (ProfessionProgress.companionId), nunca el del jugador', async () => {
    await setUp();
    await prisma.almacenItem.create({ data: { saveId, name: 'Liquen húmedo del cauce', description: 'x', catalogSlug: 'liquen-humedo' } });
    await prisma.ordenProduccion.create({ data: { buildingId, recipeKey: 'boiledLichenWater', modo: 'reponer', prioridad: 5 } });
    await prisma.professionProgress.create({ data: { companionId, professionId: 'cocinero-orcos-llanuras', nivel: 1, xp: 0 } });
    narrateAction.mockClear();

    await doPassiveTurn('Espero aquí varios días, dejando pasar el tiempo tranquilamente.');

    const progresoTrabajador = await prisma.professionProgress.findFirstOrThrow({ where: { companionId, professionId: 'cocinero-orcos-llanuras' } });
    expect(progresoTrabajador.xp).toBeGreaterThan(0);
    const progresoJugador = await prisma.professionProgress.findFirst({ where: { saveId, professionId: 'cocinero-orcos-llanuras' } });
    expect(progresoJugador).toBeNull(); // el jugador nunca gana XP por el trabajo de su Reino
  }, 20_000);

  // Gate NIVEL_EDIFICIO_INSUFICIENTE (docs/rpgtarkor/sistemas-reino/edificios-de-oficio.md § 2/§ 7,
  // 2026-09-28) — un Building con `tier: 1` (Taller) no admite una receta de tier > 3, aunque el
  // trabajador y la materia prima sobren.
  it('Taller (tier 1) no admite una receta de tier alto, aunque haya trabajador y materia prima', async () => {
    await setUp();
    await prisma.building.update({ where: { id: buildingId }, data: { tier: 1 } });
    await prisma.almacenItem.create({ data: { saveId, name: 'Cola de Coracelo', description: 'x', catalogSlug: 'cola-coracelo' } });
    await prisma.ordenProduccion.create({ data: { buildingId, recipeKey: 'coraceloMace', modo: 'reponer', prioridad: 5 } }); // tier 3, sigue dentro del Taller
    await prisma.professionProgress.create({ data: { companionId, professionId: 'herrero-orcos-llanuras', nivel: 9, xp: 8000 } });
    narrateAction.mockClear();

    await doPassiveTurn('Espero aquí varios días, dejando pasar el tiempo tranquilamente.');

    // tier 3 SÍ cabe en un Taller (tier 1 admite 1-3) — confirma que el gate no bloquea de más.
    expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug: 'maza-coracelo' } })).toBe(1);
  }, 20_000);

  // Servicio de la Casa de curas (§ 3/§ 7, 2026-09-28) — hermano del tick de OrdenProduccion, cura
  // a TODOS los Companion de Reino heridos de la partida, no solo a los que trabajan en ella.
  it('Casa de curas ACTIVA cura un escalón a un Companion de Reino herido, aunque no trabaje ahí', async () => {
    await setUp();
    const hondonada = await prisma.location.findFirstOrThrow({ where: { slug: 'hondonada-del-eco' } });
    await prisma.building.create({
      data: { saveId, locationId: hondonada.id, recipeKey: 'casa-de-curas', tier: 1, name: 'Casa de curas de prueba', kind: 'casa-de-curas', description: 'x', status: 'ACTIVO' },
    });
    const heridoGuardia = await prisma.companion.create({
      data: { saveId, name: 'Guardia herido de prueba', role: 'guardia', notes: 'x', rolReino: 'guardia', condicionFisica: 'GRAVE' },
    });
    narrateAction.mockClear();

    await doPassiveTurn('Espero aquí varios días, dejando pasar el tiempo tranquilamente.');

    const actualizado = await prisma.companion.findUniqueOrThrow({ where: { id: heridoGuardia.id } });
    expect(actualizado.condicionFisica).toBe('HERIDO');
  }, 20_000);

  it('sin ninguna Casa de curas ACTIVA, un Companion de Reino herido no mejora solo', async () => {
    await setUp();
    const heridoGuardia = await prisma.companion.create({
      data: { saveId, name: 'Guardia herido sin curas de prueba', role: 'guardia', notes: 'x', rolReino: 'guardia', condicionFisica: 'GRAVE' },
    });
    narrateAction.mockClear();

    await doPassiveTurn('Espero aquí varios días, dejando pasar el tiempo tranquilamente.');

    const actualizado = await prisma.companion.findUniqueOrThrow({ where: { id: heridoGuardia.id } });
    expect(actualizado.condicionFisica).toBe('GRAVE');
  }, 20_000);
  // (La producción de facción ya no corre en el turno: ver factionEconomy.integration.test.ts.)
});

// Cobertura nueva (auditoría de deuda técnica 2026-08-04, bug real de condición de carrera):
// `buildBlockedReason`/`buildRecipeCheck` (turnResolution.ts) se calculaban con `prisma`, ANTES de
// la transacción real — dos turnos de "fundo un ayuntamiento" casi simultáneos (doble clic,
// reintento de red, dos pestañas) podían colar ambos por ese primer chequeo sobre la misma foto ya
// obsoleta y crear dos Building+Territory para la misma partida, o levantar la construcción sin
// gastar materiales. Arreglado revalidando fresco DENTRO de la transacción
// (computeBuildBlockedReason + planRecipeConsumption con `tx`) — este test dispara los dos turnos
// a la vez con Promise.all para comprobarlo de verdad, no solo leyendo el código.
describe('Construcción: condición de carrera en turnos concurrentes (auditoría 2026-08-04)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 8',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS_CARISMATICO,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'carisma', dificultad: 15, razon: 'x', banda: 'larga', duracionEstimadaMinutos: 4320,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('dos "fundo un ayuntamiento" simultáneos con materiales para uno solo crean como mucho 1 Building + 1 Territory', async () => {
    await giveMaterials(saveId, [
      { name: 'Piedra (14)', catalogSlug: 'piedra' },
      { name: 'Leña de matorral de cuerno (6)', catalogSlug: 'lena-matorral-cuerno' },
      { name: 'Hueso largo de gargantúa (6)', catalogSlug: 'hueso-largo-gargantua' },
      { name: 'Resina de trepador del ocaso (8)', catalogSlug: 'resina-trepador-ocaso' },
      { name: 'Mena de Hierro de las Llanuras (2)', catalogSlug: 'mena-hierro-llanuras' },
      { name: 'Fibra de enredaderas (8)', catalogSlug: 'fibra-enredaderas-llanuras' },
    ]);
    narrateAction.mockClear();
    const [resA, resB] = await Promise.all([
      doTurn(saveId, 'Construyo un ayuntamiento aquí mismo.'),
      doTurn(saveId, 'Construyo un ayuntamiento aquí mismo.'),
    ]);

    expect(await prisma.building.count({ where: { saveId, recipeKey: 'ayuntamiento' } })).toBe(1);
    expect(await prisma.territory.count({ where: { saveId } })).toBe(1);
    // Con el candado de turno (turnLock.ts, 2026-08-07) el segundo "fundo un ayuntamiento" ya ni
    // llega a narrar — 409 seco, antes de tocar materiales/Ollama. El ganador sí termina de
    // construir de verdad.
    const { ganador } = splitLockWinnerAndLoser([resA, resB]);
    expect((ganador.narration as { narration: string }).narration).toMatch(/termina de construir/);
    // Los materiales se consumieron una sola vez — ninguna fila de piedra/leña suelta ni
    // duplicada.
    expect(await prisma.inventoryItem.count({ where: { saveId } })).toBe(0);
  }, 20_000);
});

// Cobertura (2026-08-04, guard de temperamento 2026-08-25 — Grupo 3 § Mundo determinista): slots
// de compañero — 0 de base, cada construcción propia ACTIVA da los suyos. `newCompanion` del LLM
// (mockeado aquí, a diferencia del resto del archivo) solo se materializa de verdad si hay hueco
// Y el NPC propuesto es real, está en escena y su temperamento efectivo es AMIGABLE/INOFENSIVO
// (nunca un nombre inventado sin más) — Hagar Kiugh/Kael Dorn son NPC reales del catálogo,
// `faction: null`/`temperamento: 'INOFENSIVO'`, así que pasan el guard sin necesitar reputación.
describe('Slots de compañero: tope real por construcciones propias', () => {
  let saveId: string;
  let hagarId: string;
  let kaelId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 7',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    const hagar = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'hagar-kiugh' } });
    const kael = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'kael-dorn' } });
    hagarId = hagar.id;
    kaelId = kael.id;
    // NpcState ya establecido (mismo atajo que otros describe de este archivo) — así
    // `detectNpcsInScene` los detecta pase lo que pase con `nucleoJugable`/región, igual que si ya
    // se hubieran cruzado antes en la partida.
    await prisma.npcState.create({ data: { saveId, npcId: hagarId, scope: '', condicionFisica: 'ILESO' } });
    await prisma.npcState.create({ data: { saveId, npcId: kaelId, scope: '', condicionFisica: 'ILESO' } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'carisma', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin ninguna construcción propia (0 slots): el LLM propone un compañero pero no se crea', async () => {
    narrateAction.mockResolvedValueOnce({
      narration: 'Hagar Kiugh se une a tu causa.',
      newFacts: [],
      newCompanion: { name: 'Hagar Kiugh', role: 'guerrera', notes: 'x' },
    });
    await doTurn(saveId, "Le pido a 'Hagar Kiugh' que se una a mí.");
    expect(await prisma.companion.count({ where: { saveId } })).toBe(0);
  }, 15_000);

  it('con un campamento propio (1 slot): el mismo tipo de propuesta SÍ se materializa', async () => {
    await giveMaterials(saveId, [
      { name: 'Leña de matorral de cuerno (20)', catalogSlug: 'lena-matorral-cuerno' },
      { name: 'Piedra (10)', catalogSlug: 'piedra' },
      { name: 'Lana de múrgol (5)', catalogSlug: 'lana-murgol' },
    ]);
    classifyAction.mockResolvedValueOnce({
      requiereTirada: false, atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'larga', duracionEstimadaMinutos: 4320,
    });
    narrateAction.mockClear();
    await doTurn(saveId, 'Construyo un campamento base en este lugar.');
    expect(narrateAction).not.toHaveBeenCalled(); // determinista, ver describe de campamento

    narrateAction.mockResolvedValueOnce({
      narration: 'Hagar Kiugh se une a tu causa.',
      newFacts: [],
      newCompanion: { name: 'Hagar Kiugh', role: 'guerrera', notes: 'x' },
    });
    await doTurn(saveId, "Le pido a 'Hagar Kiugh' que se una a mí.");
    expect(await prisma.companion.count({ where: { saveId } })).toBe(1);

    // Con el único slot ya ocupado, un SEGUNDO compañero propuesto (también real, también con
    // temperamento válido) tampoco se materializa — el guard nuevo no sustituye el tope de slots.
    narrateAction.mockResolvedValueOnce({
      narration: 'Kael Dorn se ofrece.',
      newFacts: [],
      newCompanion: { name: 'Kael Dorn', role: 'guerrero', notes: 'x' },
    });
    await doTurn(saveId, "Le pido a 'Kael Dorn' que se una a mí.");
    expect(await prisma.companion.count({ where: { saveId } })).toBe(1);
  }, 20_000);
});

// Cobertura nueva (2026-08-04): punto de guardado — solo descansar en una construcción PROPIA
// activa mueve `lastRestLocationId`; un refugio ajeno sigue curando igual, pero no mueve el respawn.
describe('Punto de guardado: solo construcciones propias', () => {
  let saveId: string;
  let hondonadaId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    hondonadaId = hondonada.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 8',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { ...ATTRS, constitucion: 6 }, // para que restSucceeds cuente de verdad (isValidRestLocationKind)
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
        condicionFisica: 'HERIDO',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'constitucion', dificultad: 8, razon: 'x', banda: 'extendida', duracionEstimadaMinutos: 120,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('descansar en un refugio SIN construcción propia no mueve el punto de guardado', async () => {
    narrateAction.mockClear();
    await doTurn(saveId, 'Descanso aquí un rato para curarme.');
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.lastRestLocationId).toBeNull();
  }, 15_000);

  it('descansar en una construcción propia activa SÍ mueve el punto de guardado', async () => {
    await giveMaterials(saveId, [
      { name: 'Leña de matorral de cuerno (20)', catalogSlug: 'lena-matorral-cuerno' },
      { name: 'Piedra (10)', catalogSlug: 'piedra' },
      { name: 'Lana de múrgol (5)', catalogSlug: 'lana-murgol' },
    ]);
    // El `it` anterior ya descansó en este mismo `saveId` — sin resetear, el cooldown de 3h de
    // ficción (hallazgo 11) bloquearía este segundo descanso, y el test dejaría de probar lo que
    // dice probar (el punto de guardado, no el cooldown en sí — ese tiene su propio describe).
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'HERIDO', lastRestAtMinutes: null } });
    classifyAction.mockResolvedValueOnce({
      requiereTirada: false, atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'larga', duracionEstimadaMinutos: 4320,
    });
    await doTurn(saveId, 'Construyo un campamento base en este lugar.');
    expect(await prisma.building.count({ where: { saveId, recipeKey: 'campamento', status: 'ACTIVO' } })).toBe(1);

    classifyAction.mockResolvedValueOnce({
      requiereTirada: false, atributo: 'constitucion', dificultad: 8, razon: 'x', banda: 'extendida', duracionEstimadaMinutos: 120,
    });
    await doTurn(saveId, 'Descanso en mi campamento un rato para curarme.');
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.lastRestLocationId).toBe(hondonadaId);
  }, 20_000);
});

// Rediseño 2026-09-06 (hallazgo 11 de la sesión de pruebas, decisión explícita de la usuaria):
// Descansar repone un tramo FIJO de energía (+30), YA NO cura condicionFisica en absoluto, y tiene
// cooldown de 3h de tiempo de FICCIÓN — un intento dentro del cooldown se rechaza con narración
// determinista, sin tocar energía ni condición.
describe('Descansar: +30 de energía fijo, NO cura condición física, cooldown de 3h de ficción', () => {
  let saveId: string;
  let pilaresId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    // Los Pilares Rotos: kind 'hito', NUNCA un punto de descanso válido (isValidRestLocationKind)
    // — a propósito, para confirmar que ya da igual: la energía repone lo mismo en cualquier sitio.
    const pilares = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'pilares-rotos' } });
    pilaresId = pilares.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 10',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: pilares.id,
        condicionFisica: 'CONVALECIENTE',
        energia: 10,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'constitucion', dificultad: 8, razon: 'x', banda: 'extendida', duracionEstimadaMinutos: 120,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('descansar en un hito (sin refugio válido) repone +30 de energía fijo y NO cura condición física', async () => {
    await doTurn(saveId, 'Descanso aquí mismo un rato para recuperar fuerzas.');
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).toBe('CONVALECIENTE'); // sin mejora — Descansar ya no cura
    expect(save.energia).toBe(40); // 10 + ENERGY_REST_RESTORE (30)
    expect(save.currentLocationId).toBe(pilaresId); // sigue en el mismo sitio, esto no es respawn
    expect(save.lastRestAtMinutes).not.toBeNull(); // marca de cooldown fijada
    // P84 (QA-27): la marca es la hora en que ACABA el descanso (la del reloj tras el turno).
    const ws = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    expect(save.lastRestAtMinutes).toBe(ws.fictionalMinutes);
    // P85 (QA-27): la narración del resultado lleva la hora en que acaba, no la de inicio.
    const resultado = await prisma.logEntry.findFirstOrThrow({ where: { saveId, channel: 'CHARACTER', isPlayerAction: false, isSystemMessage: false }, orderBy: { createdAt: 'desc' } });
    expect(resultado.timeLabel).toBe(ws.fictionalDateLabel);
  }, 15_000);

  it('un segundo descanso dentro de las 3h de ficción se rechaza — narración determinista, sin tocar energía', async () => {
    const before = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    const res = await doTurn(saveId, 'Descanso otra vez, esperando recuperarme del todo.');
    const body = lastNdjsonLine(res.payload);
    expect(body.narration).toEqual({ narration: expect.stringContaining('no está lo bastante cansado'), newFacts: [] });
    const after = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(after.energia).toBe(before.energia); // sin cambio, el intento no cuenta
    expect(after.lastRestAtMinutes).toBe(before.lastRestAtMinutes); // el cooldown no se reinicia
  }, 15_000);

  it('P74 (QA-27): un descanso de ocho horas que el enfriamiento rechaza no ocupa tiempo', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: 'Descanso ocho horas' } });
    expect(res.statusCode).toBe(200);
    const { classification } = res.json() as { classification: { banda: string; duracionEstimadaMinutos: number } };
    expect(classification.banda).toBe('instantanea');
    expect(classification.duracionEstimadaMinutos).toBe(0);
  }, 15_000);

  it('P231: «descansando tres días enteros» rechazado por enfriamiento no salta el día ni gasta hambre y sed', async () => {
    const app = await buildApp();
    const action = 'Me quedo descansando tres días enteros';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action } });
    expect(classifyRes.statusCode).toBe(200);
    expect((classifyRes.json() as { duracionMinutos: number }).duracionMinutos).toBe(1);
    const wsAntes = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    const res = await doTurn(saveId, action);
    expect(lastNdjsonLine(res.payload).narration).toEqual({ narration: expect.stringContaining('no está lo bastante cansado'), newFacts: [] });
    const wsDespues = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    // Como cualquier acción rechazada: el minuto de un intento, no los 4320 pedidos.
    expect(wsDespues.fictionalMinutes - wsAntes.fictionalMinutes).toBeLessThanOrEqual(1);
    expect(wsDespues.fictionalDateLabel.split(',')[0]).toBe(wsAntes.fictionalDateLabel.split(',')[0]);
  }, 15_000);
});

// Cobertura nueva (auditoría 2026-08-11, "pruebas por API" + duda directa de la usuaria: "ahora
// mismo al morir no está volviendo a punto anterior, solo revives sin más") — nunca existía un
// test end-to-end que encadenara "acampar en un sitio" → "morir estando en OTRO sitio" → "reaparece
// en el campamento, no donde murió". `lastRestLocationId` ya se comprobaba (arriba), y
// `resolveDeathOutcome`/`whisperText` ya tenían tests unitarios puros (death.test.ts), pero el
// ENGANCHE real entre los dos (`narrateAndPersistTurn`, `params.lastRestLocationId` →
// `finalCurrentLocationId`) nunca se había probado contra la BD real.
describe('Respawn tras morir: vuelve al último campamento, no se queda donde murió', () => {
  let saveId: string;
  let hondonadaId: string;
  let pilaresId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const pilares = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'pilares-rotos' } });
    hondonadaId = hondonada.id;
    pilaresId = pilares.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 9',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { ...ATTRS, fuerza: 15, constitucion: 15 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
        condicionFisica: 'HERIDO',
        dificultad: 'NOVATO', // sin límite de muertes, la Entidad siempre responde
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('acampa en la Hondonada, muere en Los Pilares Rotos, reaparece en la Hondonada (no en Los Pilares)', async () => {
    await giveMaterials(saveId, [
      { name: 'Leña de matorral de cuerno (20)', catalogSlug: 'lena-matorral-cuerno' },
      { name: 'Piedra (10)', catalogSlug: 'piedra' },
      { name: 'Lana de múrgol (5)', catalogSlug: 'lana-murgol' },
    ]);
    classifyAction.mockResolvedValueOnce({
      requiereTirada: false, atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'larga', duracionEstimadaMinutos: 4320,
    });
    await doTurn(saveId, 'Construyo un campamento base en este lugar.');
    expect(await prisma.building.count({ where: { saveId, recipeKey: 'campamento', status: 'ACTIVO' } })).toBe(1);

    classifyAction.mockResolvedValueOnce({
      requiereTirada: false, atributo: 'constitucion', dificultad: 8, razon: 'x', banda: 'extendida', duracionEstimadaMinutos: 120,
    });
    await doTurn(saveId, 'Descanso en mi campamento un rato para curarme.');
    const savedAfterRest = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(savedAfterRest.lastRestLocationId).toBe(hondonadaId);

    // El personaje se aleja del campamento y llega a las puertas de la muerte estando en OTRO
    // sitio — `condicionFisica` a CONVALECIENTE (un escalón antes de MUERTO: `nextCondicionFisica`
    // solo empeora un escalón por turno, incluso en combate) para que un solo turno de combate
    // baste para morir. `pendingCombatNpcSlugs` ya activo a mano (bug real 2026-08-28, ver más
    // abajo): simula que el combate seguía "enganchado" a un agresor justo antes de este turno.
    await prisma.save.update({
      where: { id: saveId },
      data: { currentLocationId: pilaresId, condicionFisica: 'CONVALECIENTE', pendingCombatNpcSlugs: ['aullador-rojo'] },
    });
    classifyAction.mockResolvedValueOnce({
      requiereTirada: true, atributo: 'fuerza', dificultad: 18, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockResolvedValueOnce({
      narration: 'El golpe final acaba con Gorhorn.',
      newFacts: [],
      condicionFisica: 'MUERTO',
      combateIniciado: { npcSlugs: ['aullador-rojo'] },
    });
    await doTurn(saveId, 'Sigo luchando contra todo pronóstico.');

    // Muerte permanente, botón Aceptar/Reintentar (2026-08-31) — el turno que mata ya NO respawnea
    // solo: se detiene en MUERTO + pendingDeathResolution, a la espera del botón.
    const savedAfterDeath = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(savedAfterDeath.condicionFisica).toBe('MUERTO');
    expect(savedAfterDeath.deathCount).toBe(1);
    expect(savedAfterDeath.endedAt).toBeNull(); // NOVATO, sin fin de partida
    expect(savedAfterDeath.pendingDeathResolution).toBe(true);
    // Libro de Sucesos (CR-3): la muerte queda registrada.
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'MUERTE_JUGADOR' } })).toBe(1);
    // Bug real jugando en vivo (ronda de pruebas 2026-08-28): morir no limpiaba
    // `pendingCombatNpcSlugs` — el aviso "COMBATIR/HUIR" contra el agresor seguía apareciendo pese
    // a que el jugador ya no puede seguir jugando. El combate debe cerrarse del todo, aunque el
    // modelo (mockeado aquí igual que jugando en vivo) siga proponiendo `combateIniciado` con el
    // mismo agresor este mismo turno.
    expect(savedAfterDeath.pendingCombatNpcSlugs).toEqual([]);

    // Pulsar Aceptar (POST /saves/:id/death/resolve) — con lastRestLocationId real, reaparece ahí
    // con el resto del progreso intacto, mismo comportamiento que el respawn "blando" de siempre.
    // `buildApp()` (arriba en este archivo) solo registra `turnRoutes` — death/resolve vive en
    // `deathRoutes`, mismo patrón que `buildAppWithDetail` más abajo en este archivo.
    // QA-27 P82: el encuentro forzado que quedó pendiente no sobrevive a la muerte.
    // P157 (QA-27): con la energía baja al morir, se reaparece con la energía llena.
    await prisma.save.update({ where: { id: saveId }, data: { energia: 5, pendingDynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'x', targetName: 'X', quienInicia: 'npc', combateForzado: true } } });
    const deathApp = Fastify();
    await deathApp.register(deathRoutes);
    const resolveRes = await deathApp.inject({ method: 'POST', url: `/saves/${saveId}/death/resolve` });
    expect(resolveRes.statusCode).toBe(200);
    expect(resolveRes.json()).toMatchObject({ restartedTotal: false, respawnLocationId: hondonadaId });

    const savedAfterResolve = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(savedAfterResolve.condicionFisica).toBe('ILESO');
    expect(savedAfterResolve.energia).toBeGreaterThan(5);
    expect(savedAfterResolve.energia).toBe(energiaMaxFor((savedAfterResolve.attributes as { constitucion: number }).constitucion));
    expect(savedAfterResolve.pendingDeathResolution).toBe(false);
    expect(savedAfterResolve.pendingDynamicModeOffer).toBeNull();
    expect([savedAfterResolve.zonaPosX, savedAfterResolve.zonaPosY]).toEqual([75, 75]);
    expect(savedAfterResolve.zonaCaminoPendiente).toBeNull();
    expect(savedAfterResolve.currentLocationId).toBe(hondonadaId); // vuelve al campamento…
    expect(savedAfterResolve.currentLocationId).not.toBe(pilaresId); // …no se queda donde murió
    // Libro de Sucesos (CR-3): el despertar queda registrado.
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'RENACER' } })).toBe(1);
  }, 20_000);
});

// Cobertura nueva (auditoría de deuda técnica AMPLIA 2026-08-04, bug real de condición de carrera
// — mismo patrón exacto ya cerrado hoy para construcción/crafteo): `harvestMatch`
// (turnResolution.ts) se calcula con `prisma`, ANTES de la transacción — dos turnos de despiece
// casi simultáneos sobre el mismo cadáver de fauna podían pasar ambos el chequeo de `saqueado` ya
// obsoleto y duplicar el botín de un solo cuerpo. Arreglado revalidando `saqueado` fresco DENTRO
// de la transacción justo antes de materializar los yields.
describe('Despiece: condición de carrera en turnos concurrentes (auditoría 2026-08-04)', () => {
  let saveId: string;
  let hondonadaId: string;
  let auladorId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    hondonadaId = hondonada.id;
    const aullador = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'aullador-rojo' } });
    auladorId = aullador.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 9',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // Ya derrotado en esta ubicación (mismo `scope` que scopeFor usa para NpcState de fauna) —
    // detectHarvest exige presa previa antes de dar ningún yield.
    await prisma.npcState.create({
      data: { saveId, npcId: aullador.id, scope: hondonada.id, condicionFisica: 'MUERTO' },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 10, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('dos "despiezo al aullador rojo" simultáneos solo dan botín una vez', async () => {
    narrateAction.mockClear();
    const [res1, res2] = await Promise.all([
      doTurn(saveId, 'Despiezo al aullador rojo caído.'),
      doTurn(saveId, 'Despiezo al aullador rojo caído.'),
    ]);

    const items = await prisma.inventoryItem.findMany({ where: { saveId, origin: 'despiece/recolección' } });
    // 3 filas de HarvestYield para aullador-rojo (ver seed) — si la carrera duplicara el botín,
    // saldrían 6 filas en vez de 3.
    expect(items).toHaveLength(3);
    const state = await prisma.npcState.findUniqueOrThrow({
      where: { saveId_npcId_scope: { saveId, npcId: auladorId, scope: hondonadaId } },
    });
    expect(state.saqueado).toBe(true);

    // Con el candado de turno (turnLock.ts, 2026-08-07) el segundo "despiezo" ya ni llega a
    // narrar — 409 seco. El ganador sí consigue el botín de verdad.
    const { ganador } = splitLockWinnerAndLoser([res1, res2]);
    expect((ganador.narration as { narration: string }).narration).toMatch(/consigue:/);
  }, 20_000);
});

// Cobertura nueva (auditoría de deuda técnica AMPLIA 2026-08-04, bug real de condición de carrera
// — mismo patrón exacto ya cerrado hoy para construcción/crafteo/despiece): `npc.saqueado`/
// `npc.lootedItemNames` (turnResolution.ts, bloque `lootMode`) venían de `npcsInScene`, leído con
// `prisma` ANTES de la transacción — dos turnos de "registro el cuerpo" casi simultáneos sobre el
// mismo NPC ya derrotado podían pasar ambos el guard con la misma foto obsoleta y duplicar su
// botín. Arreglado revalidando `NpcState` fresco con `tx` justo antes de decidir qué llevarse.
describe('Saqueo: condición de carrera en turnos concurrentes (auditoría 2026-08-04)', () => {
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const orco = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    npcId = orco.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 10',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // PRINCIPAL → scope siempre '' (scopeFor), ya derrotado antes de que empiece el test.
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'MUERTO' } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('dos "registro el cuerpo" simultáneos solo dan el botín una vez', async () => {
    narrateAction.mockClear();
    const action = "Registro el cuerpo de 'Orco enfurecido'.";
    const [res1, res2] = await Promise.all([doTurn(saveId, action), doTurn(saveId, action)]);

    // 3 objetos de catálogo en el loadout del Orco Enfurecido (Maza orca, Vendaje improvisado orco
    // de las Llanuras, Ración de carne ahumada — "Mapa de las Llanuras" se quitó del loadout el
    // 2026-08-13, ahora solo se entrega como recompensa de misión; "Amuleto de hueso" se quitó el
    // 2026-09-04, rebalanceo del primer combate, ver worldCatalog.ts) — si la carrera duplicara el
    // botín, saldrían 6.
    const items = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(items).toHaveLength(3);
    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId, scope: '' } } });
    expect(state.saqueado).toBe(true);

    // Con el candado de turno (turnLock.ts, 2026-08-07) el segundo "registro el cuerpo" ya ni
    // llega a narrar — 409 seco. El ganador sí se hace con el botín de verdad.
    const { ganador } = splitLockWinnerAndLoser([res1, res2]);
    expect((ganador.narration as { narration: string }).narration).toMatch(/se hace con lo siguiente/);
  }, 20_000);
});

// Cobertura (auditoría de deuda técnica AMPLIA 2026-08-04, bug real de condición de carrera —
// mismo patrón exacto ya cerrado hoy varias veces; REDISEÑADO 2026-08-30 — "Matar" ya no es un
// remate determinista propio, es un ataque normal contra un NPC CONVALECIENTE, resuelto por el
// mismo intercambio de combate de siempre): dos ataques casi simultáneos contra el mismo NPC ya
// CONVALECIENTE no deben restar población dos veces por una sola muerte — el intercambio normal ya
// se resuelve dentro de una transacción con revalidación fresca (mismo motivo por el que el resto
// de acciones deterministas de combate — saqueo, capturar — ya estaban protegidas), así que el
// mismo candado cubre este caso sin necesitar el mecanismo aparte que existía antes.
describe('Matar (CONVALECIENTE): condición de carrera en turnos concurrentes (auditoría 2026-08-04)', () => {
  let saveId: string;
  let npcId: string;
  let worldId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const orco = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    npcId = orco.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 11',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // PRINCIPAL → scope siempre ''. CONVALECIENTE (no MUERTO) — objetivo de "Matar" tras el rediseño.
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'CONVALECIENTE' } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });

    // Higiene de test (bug real encontrado 2026-08-28, ver `tarkor_bug_decapitar_concurrente_falso_2026-08-28`
    // en memoria): `WorldPopulation` es del MUNDO compartido, no de esta `Save` — `decrementPopulationOnDeath`
    // resta 1 de verdad en cada corrida, y `seed-catalog.ts` protege `poblacion` a propósito en un
    // reseed (nunca resetea el valor actual a la semilla). Sin este seteo explícito, decapitaciones
    // acumuladas de sesiones de test anteriores pueden agotar la fila a 0 y el test falla con "0 en
    // vez de 1" — no por una regresión real, sino porque el guard `poblacion: { gt: 0 }`
    // (population.ts) hace un no-op silencioso cuando ya no queda nada que restar. Se fija un valor
    // alto y conocido antes de medir, y se restaura al mismo valor de semilla al cerrar (no al valor
    // que hubiera quedado degradado antes de este fix) — deliberado: perpetuar el número viejo solo
    // pospondría el mismo agotamiento para la próxima sesión de tests.
    await prisma.worldPopulation.updateMany({
      where: { worldId: world.id, targetType: 'RAZA', targetSlug: 'orcos-llanuras', saveId: null },
      data: { poblacion: 600 },
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.worldPopulation.updateMany({
      where: { worldId, targetType: 'RAZA', targetSlug: 'orcos-llanuras', saveId: null },
      data: { poblacion: 600 },
    });
  });

  it('dos ataques simultáneos contra el mismo convaleciente solo restan población una vez', async () => {
    // CR-6 (hito 0.2): la muerte resta de la población de ESTA partida (copia del catálogo, 600).
    await asegurarMundoDePartida(prisma, saveId);
    const before = await prisma.worldPopulation.findFirstOrThrow({
      where: { saveId, targetType: 'RAZA', targetSlug: 'orcos-llanuras' },
    });

    // Math.random()=0.99 garantiza el mejor resultado posible en cualquier tirada — con esto, el
    // ataque conecta y remata al convaleciente de verdad (mismo criterio que el resto del archivo
    // para tests que necesitan un desenlace determinista pese a resolverse por tirada real).
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    narrateAction.mockClear();
    const action = "Golpeo a 'Orco enfurecido' con todas mis fuerzas.";
    await Promise.all([doTurn(saveId, action), doTurn(saveId, action)]);

    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId, scope: '' } } });
    expect(state.condicionFisica).toBe('MUERTO');
    const after = await prisma.worldPopulation.findFirstOrThrow({
      where: { saveId, targetType: 'RAZA', targetSlug: 'orcos-llanuras' },
    });
    // Si la carrera duplicara el efecto, la población bajaría 2, no 1.
    expect(before.poblacion - after.poblacion).toBe(1);
    // CR-6 (hito 0.2): la del mundo (catálogo) no se toca — cada partida tiene su propia población.
    const catalogo = await prisma.worldPopulation.findFirstOrThrow({
      where: { worldId, targetType: 'RAZA', targetSlug: 'orcos-llanuras', saveId: null },
    });
    expect(catalogo.poblacion).toBe(600);
  }, 20_000);
});

// Bug real original (revisión forense de partida real, 2026-08-26, camino YA RETIRADO 2026-08-30):
// "Remato a X" sin comillas dañaba de refilón a otro NPC de la escena por colisión de detectores.
// REDISEÑADO 2026-08-30 — "Matar" ya no tiene texto/detector propio; `handleDecapitarSeleccion`
// (frontend) manda un ataque normal citando al objetivo ENTRE COMILLAS SIMPLES, igual que
// `handleCombatAttack`. Este test se conserva como regresión del mecanismo real que ahora evita el
// mismo problema: `explicitTarget` (comillas) manda sobre el orden de detección, así que un
// bystander presente en la escena nunca puede robarle el golpe al objetivo citado.
describe('Matar (CONVALECIENTE) citando por nombre no debe dañar de refilón a otro NPC presente en la misma escena', () => {
  let saveId: string;
  let orcoId: string;
  let quioId: string;
  let locationId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const orco = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    const quio = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'quio' } });
    orcoId = orco.id;
    quioId = quio.id;
    locationId = hondonada.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 12',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // Orco Enfurecido ya CONVALECIENTE — objetivo de "Matar" tras el rediseño. Quio ya "encontrado
    // antes" (NpcState propio, ver `detectNpcsInScene` § encounteredIds) e ILESO — un bystander
    // cualquiera que solo hace falta que la acción/hechos de sesión mencionen para que entre en
    // escena, igual que le pasó a Quio en la partida real.
    await prisma.npcState.create({ data: { saveId, npcId: orcoId, scope: '', condicionFisica: 'CONVALECIENTE' } });
    await prisma.npcState.create({ data: { saveId, npcId: quioId, scope: locationId, condicionFisica: 'ILESO' } });
    await prisma.$executeRaw`
      INSERT INTO "SessionFact" (id, "saveId", text, embedding, "createdAt")
      VALUES (${crypto.randomUUID()}, ${saveId}, 'Un Quio se desliza por el fango cerca de la hondonada.', NULL, ${new Date()})
    `;
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it("matar a 'Orco enfurecido' citado entre comillas deja a Quio intacto", async () => {
    // Math.random()=0.99 garantiza el mejor resultado posible en CUALQUIER tirada (mismo criterio
    // que el resto de este archivo) — si el bug estuviera de vuelta, el intercambio de refilón
    // contra Quio conectaría siempre, no solo a veces, así que este test no puede colar en falso
    // por una tirada de suerte.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    narrateAction.mockClear();
    // Mismo texto que arma `handleDecapitarSeleccion` (useCombatFlow.ts) tras el rediseño: ataque
    // normal citando al objetivo entre comillas simples, sin ningún verbo especial de remate.
    const res = await doTurn(saveId, "Ataco con todas mis fuerzas, contra 'Orco enfurecido'.");
    expect(res.statusCode).toBe(200);

    const orcoState = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId: orcoId, scope: '' } } });
    expect(orcoState.condicionFisica).toBe('MUERTO');

    const quioState = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId: quioId, scope: locationId } } });
    expect(quioState.condicionFisica).toBe('ILESO');
    expect(quioState.energia).toBeNull();
  }, 20_000);
});

// Bug real jugando en vivo (revisión de partida, 2026-08-23/26, "Ruptidar 'ataca' en combate pese a
// ser INOFENSIVO/'No ataca'"): un NPC con `ataqueNatural: 'No ataca.'` seguía pudiendo conectar un
// golpe real contra la jugadora — nada comprobaba esa declaración explícita del catálogo antes de
// aplicar el resultado del intercambio.
describe('Un NPC INOFENSIVO ("No ataca.") nunca golpea de verdad, aunque tenga un ataque pendiente sembrado', () => {
  let saveId: string;
  let ruptidarId: string;
  let analizarRivalId: string;

  beforeAll(async () => {
    // Dados al máximo — sin el guard, esto garantiza que el golpe pendiente del NPC conecta (ver
    // el mismo criterio ya probado en el bloque "habilidades de utilidad reactivas": una habilidad
    // de respuesta con `rol: 'utilidad'` entra en `resolveIndependentExchange` — el ataque del NPC
    // se evalúa contra SU PROPIA dificultad, sin contraste de estadísticas con la jugadora, así que
    // ni siquiera un Ruptidar mecánicamente débil se libra del golpe por pura diferencia de stats.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const ruptidar = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'ruptidar' } });
    ruptidarId = ruptidar.id;
    expect(ruptidar.ataqueNatural).toMatch(/^No ataca/);
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 13',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    analizarRivalId = (
      await prisma.savedAction.create({
        data: {
          saveId,
          name: 'Analizar rival',
          promptText: 'Estudio a mi enemigo un instante, leyendo su punto débil.',
          category: 'combate',
          effects: ['ANALISIS'],
          rol: 'utilidad',
          preferredAttribute: 'inteligencia',
        },
      })
    ).id;
    await prisma.npcState.create({ data: { saveId, npcId: ruptidarId, scope: hondonada.id, condicionFisica: 'ILESO' } });
    // Simula que ALGÚN camino (emboscada, turno anterior) ya le sembró un ataque pendiente real a
    // Ruptidar — el guard debe protegerte igual, sin depender de que nada más lo evite antes.
    await prisma.save.update({
      where: { id: saveId },
      data: {
        pendingCombatNpcSlugs: ['ruptidar'],
        pendingNpcAttack: {
          npcId: ruptidarId,
          attribute: 'destreza',
          effects: [],
          rol: 'ataque',
          abilityName: 'Ataque base',
          abilityDescription: ruptidar.ataqueNatural,
          energyCost: 5,
          energyRegen: 0,
        },
      },
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el golpe pendiente de Ruptidar nunca conecta, aunque la tirada esté pinchada al máximo y se entre por la rama independiente', async () => {
    const app = await buildApp();
    const action = "Estudio a mi enemigo un instante, leyendo su punto débil 'Ruptidar'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true, savedActionId: analizarRivalId } });
    expect(classifyRes.statusCode).toBe(200);
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, savedActionId: analizarRivalId },
    });
    expect(narrateRes.statusCode).toBe(200);

    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).toBe('ILESO');
  }, 20_000);
});

// Recompensa determinista de misión (docs/mecanicas/19-post-combate-y-recompensas-mision.md, pieza 3) —
// antes Quest.rewardItems era solo texto para el panel, nunca creaba el InventoryItem de verdad.
describe('Decapitar cierra una misión "derrotar a X" con rewardItems y entrega el objeto de verdad', () => {
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const orco = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    npcId = orco.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 17',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'CONVALECIENTE' } });
    await prisma.quest.create({
      data: {
        saveId,
        title: 'Acabar con el Orco Enfurecido (prueba)',
        description: 'x',
        status: 'ACTIVA',
        targetNpcId: npcId,
        rewardXp: 100,
        rewardItems: ['Mapa de las Llanuras (prueba)'],
      },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('la misión se completa, el objeto se crea de verdad y hay un LogEntry anunciando la recompensa', async () => {
    // Math.random()=0.99 garantiza el mejor resultado posible en cualquier tirada (REDISEÑO
    // 2026-08-30: "Matar" ya no es un remate determinista, es un ataque real contra el CONVALECIENTE
    // citado entre comillas simples — necesita conectar de verdad para completar la misión).
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const res = await doTurn(saveId, "Ataco con todas mis fuerzas, contra 'Orco enfurecido'.");

    const quest = await prisma.quest.findFirstOrThrow({ where: { saveId, title: { contains: 'Orco Enfurecido (prueba)' } } });
    expect(quest.status).toBe('COMPLETADA');
    // Libro de Sucesos (CR-3): la misión cerrada y la muerte que la cerró quedan en el Libro.
    const fin = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'MISION_COMPLETADA' }, orderBy: { createdAt: 'desc' } });
    expect(fin.texto).toContain('Orco Enfurecido (prueba)');
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'MUERTE_CAUSADA' } })).toBeGreaterThanOrEqual(1);

    const item = await prisma.inventoryItem.findFirst({ where: { saveId, name: 'Mapa de las Llanuras (prueba)' } });
    expect(item).not.toBeNull();

    const rewardLog = await prisma.logEntry.findFirst({ where: { saveId, text: { contains: 'Mapa de las Llanuras (prueba)' } } });
    expect(rewardLog).not.toBeNull();
    expect(rewardLog!.text).toContain('+100 XP');

    // Bug real jugando en vivo (2026-08-13): la recompensa se persistía bien, pero /turn/narrate
    // nunca avisaba de ella — el jugador solo veía la narración de combate, sin ninguna marca de
    // "misión completada" hasta la siguiente recarga. `questCompletedInfo` cierra ese hueco.
    const done = lastNdjsonLine(res.payload);
    expect(done.questCompletedInfo).toEqual({
      logEntryId: rewardLog!.id,
      text: rewardLog!.text,
      title: 'Acabar con el Orco Enfurecido (prueba)',
      grantedItems: ['Mapa de las Llanuras (prueba)'],
      rewardXp: 100,
    });
    // P32 (QA-27, 2026-10-12): la recompensa llega también como objeto nuevo, sin recargar.
    expect((done.newInventoryItems as { id: string }[]).map((i) => i.id)).toContain(item!.id);

    // Auditoría "revisar partida" 2026-08-13, bug real jugando en vivo: "Misión completada" se
    // leía ANTES que la narración del propio turno que la resolvió (mismo `createdAt` de
    // Postgres, orden de lectura no garantizado) — la fila de recompensa debe ordenar DESPUÉS de
    // la narración principal del turno, no antes, en el mismo orden (`createdAt asc`) que usan
    // `/saves/:id` y `/saves/:id/diario` de verdad.
    const allEntries = await prisma.logEntry.findMany({ where: { saveId }, orderBy: { createdAt: 'asc' } });
    const mainNarrationEntry = allEntries.find((e) => e.channel === 'CHARACTER' && !e.isPlayerAction && e.id !== rewardLog!.id);
    expect(mainNarrationEntry).toBeDefined();
    expect(rewardLog!.createdAt.getTime()).toBeGreaterThan(mainNarrationEntry!.createdAt.getTime());

    // Muerte permanente, "fin de tutorial" (2026-08-31, petición explícita) — matar de verdad al
    // Orco Enfurecido (aquí mismo, `orco-enfurecido-hondonada`) es el primer punto de guardado
    // implícito. Mismo turno que completa la quest, un solo golpe.
    const saveAfterKill = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfterKill.tutorialCompletedAt).not.toBeNull();
  }, 20_000);
});

// Ciclo completo de "dar objeto a NPC" (2026-08-31, mecánica real — cierra el bug documentado en
// docs/registros/revisar-partida-hallazgos.md, 2026-08-28: el cuchillo "entregado" a Gistera Koh seguía en
// el inventario y reapareció en 4 turnos posteriores). Este test cubre justo el escenario que
// entrega.integration.test.ts NO puede probar aislado: que el objeto entregado sobrevive a la
// MUERTE del NPC y sale de verdad en un saqueo real vía /turn/narrate, mismo pipeline
// (applyLootMode) que cualquier otro botín de catálogo.
describe('Entregar objeto a NPC → matarlo → el objeto entregado sale en el saqueo real (2026-08-31)', () => {
  let saveId: string;
  let npcId: string;
  const npcSlug = 'orco-enfurecido-hondonada';

  async function buildAppWithEntrega() {
    const app = Fastify();
    await app.register(entregaRoutes);
    return app;
  }

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
        characterName: 'Gorhorn de prueba (entrega + saqueo)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // ILESO al principio — la entrega solo acepta destinatarios conscientes (ILESO/HERIDO/GRAVE,
    // ver entrega.ts). Se deja CONVALECIENTE justo antes de rematar (dentro del propio test), para
    // que el golpe final con tirada perfecta baste (`oneStepWorseThan` solo empeora un escalón).
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'ILESO' } });
    // Companion real (2026-09-09, fixture desactualizado — bug de LÍNEA BASE ya documentado en
    // memoria tarkor_flake_entrega_derrotado_saqueado_linea_base): `entrega.ts` restringe "Entregar"
    // a solo compañeros de equipo desde 2026-09-06 (petición explícita: "sirve para entregar cosas a
    // los inventarios de los compañeros, no a cualquiera que pase"), pero este fixture solo creaba
    // el `NpcState` directo, sin ningún `Companion.sourceSlug` que lo materializara como compañero
    // real — el guard `isCompanion` (entrega.ts) rechazaba la entrega con 400 desde entonces. Este
    // Companion es puramente el candidato de la entrega; el combate/saqueo posteriores del test
    // siguen operando sobre el `NpcState` real del Orco, sin relación mecánica con este registro.
    await prisma.companion.create({ data: { saveId, name: 'Orco enfurecido', role: 'x', notes: '', tipo: 'NPC', sourceSlug: npcSlug } });
    await prisma.inventoryItem.create({
      data: { saveId, name: 'Amuleto de la suerte', description: 'x', origin: 'inicial' },
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('entregado → derrotado → saqueado: el amuleto aparece en el botín real, no en la lista original de NpcItem', async () => {
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, name: 'Amuleto de la suerte' } });
    const entregaApp = await buildAppWithEntrega();
    const entregaRes = await entregaApp.inject({
      method: 'POST',
      url: `/saves/${saveId}/entregar/${npcSlug}`,
      payload: { itemId: item.id },
    });
    expect(entregaRes.statusCode).toBe(200);
    expect(await prisma.inventoryItem.findUnique({ where: { id: item.id } })).toBeNull();

    // Ya dañado (un turno de combate previo, no simulado aquí) — deja al Orco a un golpe de morir.
    await prisma.npcState.update({
      where: { saveId_npcId_scope: { saveId, npcId, scope: '' } },
      data: { condicionFisica: 'CONVALECIENTE' },
    });

    // Muerte real con tirada perfecta — mismo patrón que "Decapitar cierra una misión..." arriba.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    await doTurn(saveId, "Ataco con todas mis fuerzas, contra 'Orco enfurecido'.");
    const stateAfterKill = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId, scope: '' } } });
    expect(stateAfterKill.condicionFisica).toBe('MUERTO');
    vi.restoreAllMocks();

    // Saqueo real por texto libre, pidiendo explícitamente el objeto entregado (no del catálogo
    // NpcItem del Orco) — si `applyLootMode` no lo viera en `npc.items`, esto no daría nada.
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    const app = await buildApp();
    const action = 'Registro el cuerpo del Orco enfurecido.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true, lootItemNames: ['Amuleto de la suerte'] },
    });
    expect(narrateRes.statusCode).toBe(200);
    const looted = await prisma.inventoryItem.findFirst({ where: { saveId, name: 'Amuleto de la suerte', origin: { contains: 'botín' } } });
    expect(looted).not.toBeNull();
  }, 20_000);
});

// Petición explícita 2026-08-31: "Acabar con el Orco Enfurecido" solo debe completarse con la
// MUERTE real del NPC — antes CONVALECIENTE (perdonar/capturar) también valía. Cobertura del caso
// NEGATIVO (dejarlo Convaleciente no completa nada, la quest sigue ACTIVA) — el caso positivo
// (matarlo sí completa) ya está cubierto arriba en "Decapitar cierra una misión...".
describe('Quest "derrotar a X" ya NO se completa dejando al objetivo CONVALECIENTE (2026-08-31)', () => {
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const orco = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    npcId = orco.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 17b',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // Ya GRAVE (no ILESO/HERIDO) para que un solo golpe con tirada perfecta lo deje CONVALECIENTE,
    // no MUERTO — `nextCondicionForAttack`/`oneStepWorseThan` solo empeora un escalón por golpe
    // (ILESO→HERIDO→GRAVE→CONVALECIENTE→MUERTO).
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'GRAVE' } });
    await prisma.quest.create({
      data: {
        saveId,
        title: 'Acabar con el Orco Enfurecido (prueba 17b)',
        description: 'x',
        status: 'ACTIVA',
        targetNpcId: npcId,
        rewardXp: 100,
        rewardItems: ['Mapa de las Llanuras (prueba 17b)'],
      },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('deja CONVALECIENTE, la quest sigue ACTIVA y no se entrega recompensa', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const res = await doTurn(saveId, "Ataco con todas mis fuerzas, contra 'Orco enfurecido'.");

    const npcState = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId } });
    expect(npcState.condicionFisica).toBe('CONVALECIENTE');

    const quest = await prisma.quest.findFirstOrThrow({ where: { saveId, title: { contains: 'Orco Enfurecido (prueba 17b)' } } });
    expect(quest.status).toBe('ACTIVA');

    const item = await prisma.inventoryItem.findFirst({ where: { saveId, name: 'Mapa de las Llanuras (prueba 17b)' } });
    expect(item).toBeNull();

    const done = lastNdjsonLine(res.payload);
    expect(done.questCompletedInfo).toBeFalsy();
  }, 20_000);
});

// Muerte permanente, reinicio total (2026-08-31, petición explícita: "si no hay punto de guardado
// volvera al inicio de la partida... como que te despiertas de una pesadilla") — sin
// lastRestLocationId NI tutorialCompletedAt, POST /saves/:id/death/resolve debe reiniciar la
// partida entera (mismo cuerpo que /saves/:id/restart), no solo reposicionar.
describe('Muerte permanente sin punto de guardado: reinicio total (2026-08-31)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 18',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
        condicionFisica: 'CONVALECIENTE',
        dificultad: 'NOVATO',
        level: 5,
        xp: 500,
        // Sin lastRestLocationId (null por defecto), sin tutorialCompletedAt (null por defecto) —
        // exactamente el caso "nada real que preservar todavía".
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.inventoryItem.create({
      data: { saveId, name: 'Objeto de prueba antes de reiniciar (99)', description: 'x', origin: 'partida' },
    });
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('el turno de muerte queda pendiente, y resolverlo reinicia la partida entera', async () => {
    classifyAction.mockResolvedValueOnce({
      requiereTirada: true, atributo: 'fuerza', dificultad: 18, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockResolvedValueOnce({
      narration: 'El golpe final acaba con Gorhorn.',
      newFacts: [],
      condicionFisica: 'MUERTO',
      combateIniciado: { npcSlugs: ['aullador-rojo'] },
    });
    await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: ['aullador-rojo'] } });
    await doTurn(saveId, 'Sigo luchando contra todo pronóstico.');

    const savedAfterDeath = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(savedAfterDeath.condicionFisica).toBe('MUERTO');
    expect(savedAfterDeath.pendingDeathResolution).toBe(true);

    const deathApp = Fastify();
    await deathApp.register(deathRoutes);
    const resolveRes = await deathApp.inject({ method: 'POST', url: `/saves/${saveId}/death/resolve` });
    expect(resolveRes.statusCode).toBe(200);
    expect(resolveRes.json()).toMatchObject({ restartedTotal: true });

    const savedAfterResolve = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(savedAfterResolve.condicionFisica).toBe('ILESO');
    expect(savedAfterResolve.pendingDeathResolution).toBe(false);
    expect(savedAfterResolve.level).toBe(1); // reinicio total real, no solo reposición
    expect(savedAfterResolve.xp).toBe(0);
    expect(savedAfterResolve.deathCount).toBe(0);

    const remainingItem = await prisma.inventoryItem.findFirst({ where: { saveId, name: { contains: 'prueba antes de reiniciar' } } });
    expect(remainingItem).toBeNull(); // el inventario de antes de morir no sobrevive

    const introEntry = await prisma.logEntry.findFirst({ where: { saveId, text: { contains: 'pesadilla' } } });
    expect(introEntry).not.toBeNull();
  }, 20_000);
});

// Bug real (2026-08-29, reverificación en vivo tras cerrar combate múltiple): "Decapitar" mataba
// de verdad al NPC, pero si el `useEffect` pasivo del frontend ya había consultado "desollador" al
// entrar a la escena (antes de que hubiera ningún cadáver), esa tirada congelada vacía quedaba
// huérfana para siempre — la invalidación normal (`invalidateRollCacheFor`, ligada a qué
// `sourceSlug` se tocó) nunca dispara sobre una entrada sin ningún slug. Ver
// `invalidateCarcassRollCache` en recolectar.ts.
describe('Decapitar invalida la tirada congelada de Desollar si ya estaba vacía (bug real 2026-08-29)', () => {
  let saveId: string;
  let hondonadaId: string;
  let npcId: string;

  beforeAll(async () => {
    // El GET de Desollar hace su propia tirada de habilidad (gatheringRollFor) sobre los candidatos
    // ya encontrados — sin esto, una tirada mala real (Math.random no mockeado) recorta legítimamente
    // `sources` a vacío y el test se vuelve flaky por una razón ajena al fix bajo prueba.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    hondonadaId = hondonada.id;
    // Aullador Rojo (fauna con HarvestYield real, worldCatalog.ts) — a diferencia del Orco
    // Enfurecido (humanoide, sin ningún yield de desuello asociado), este NPC sí tiene un candidato
    // real que el endpoint de Desollar puede devolver una vez muerto.
    const aullador = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'aullador-rojo' } });
    npcId = aullador.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (caché Desollar)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.npcState.create({ data: { saveId, npcId, scope: hondonadaId, condicionFisica: 'CONVALECIENTE' } });
    // Simula el `useEffect` pasivo consultando "desollador" al entrar a la escena, antes de que el
    // Aullador muriera: sin cadáveres todavía, la tirada se congela vacía.
    await prisma.save.update({
      where: { id: saveId },
      data: { harvestRollCache: { desollador: { locationId: hondonadaId, sources: [] } } },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('tras decapitar, GET /saves/:id/recolectar/desollador ya no sirve la tirada vieja vacía', async () => {
    const res = await doTurn(saveId, "Decapito al 'Aullador Rojo' de un solo golpe.");
    expect(res.statusCode).toBe(200);

    const npcState = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId } });
    expect(npcState.condicionFisica).toBe('MUERTO');

    // `detectNpcsInScene` (usado tanto por el turno como por este GET aislado) reconoce a un NPC
    // en la escena por su nombre citado en la ACCIÓN de este turno o en los `sessionFacts` ya
    // guardados — el mock de Ollama de este archivo narra un texto genérico que no menciona al
    // Aullador, así que sin esto la siguiente consulta aislada no lo "recordaría" (limitación real
    // y preexistente de `detectNpcsInScene`, no relacionada con el fix bajo prueba). En una partida
    // real el LLM sí narra el nombre del enemigo derrotado. Inserción directa (mismo patrón que
    // otros tests de este archivo) para no depender de Ollama solo por el embedding.
    await prisma.$executeRaw`
      INSERT INTO "SessionFact" (id, "saveId", text, embedding, "createdAt")
      VALUES (${crypto.randomUUID()}, ${saveId}, 'El Aullador Rojo yace muerto junto a Gorhorn de prueba (caché Desollar).', NULL, ${new Date()})
    `;

    const app = Fastify();
    await app.register(recolectarRoutes);
    const getRes = await app.inject({ method: 'GET', url: `/saves/${saveId}/recolectar/desollador` });
    expect(getRes.statusCode).toBe(200);
    const body = getRes.json() as { sources: { yields: { sourceSlug: string }[] }[] };
    const slugs = new Set(body.sources.flatMap((cat) => cat.yields.map((y) => y.sourceSlug)));
    expect(slugs.has('aullador-rojo')).toBe(true);
  }, 20_000);
});

// Bug real jugando en vivo (auditoría "revisar partida", 2026-08-15: "he acabado con el orco y no
// ha saltado la narración en amarillo con la recompensa de la misión... y no tengo el mapa") —
// distinto del describe de arriba (ahí el sistema determinista cierra la misión al derrotar al
// objetivo, `completeNpcTargetQuests`). Aquí es el MODELO quien propone el cierre directamente vía
// "questProgress" — ese camino cambiaba `status` a COMPLETADA pero nunca llamaba a
// `grantQuestRewardItems` ni narraba nada.
describe('questProgress: el modelo cierra una misión directamente también concede recompensa y narra', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 19',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.quest.create({
      data: {
        saveId,
        title: 'Misión de prueba questProgress',
        description: 'x',
        status: 'ACTIVA',
        rewardXp: 100,
        rewardItems: ['Mapa de las Llanuras (prueba questProgress)'],
      },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('concede rewardItems/rewardXp de verdad y narra la recompensa, no solo cambia el status', async () => {
    narrateAction.mockResolvedValueOnce({
      narration: 'Gorhorn da la misión por concluida.',
      newFacts: [],
      questProgress: { title: 'Misión de prueba questProgress', status: 'COMPLETADA' },
    });
    const res = await doTurn(saveId, 'Doy la misión por terminada.');

    const quest = await prisma.quest.findFirstOrThrow({ where: { saveId, title: 'Misión de prueba questProgress' } });
    expect(quest.status).toBe('COMPLETADA');

    const item = await prisma.inventoryItem.findFirst({ where: { saveId, name: 'Mapa de las Llanuras (prueba questProgress)' } });
    expect(item).not.toBeNull();

    const rewardLog = await prisma.logEntry.findFirst({ where: { saveId, text: { contains: 'Mapa de las Llanuras (prueba questProgress)' } } });
    expect(rewardLog).not.toBeNull();
    expect(rewardLog!.text).toContain('+100 XP');

    const done = lastNdjsonLine(res.payload);
    expect(done.questCompletedInfo).toEqual({
      logEntryId: rewardLog!.id,
      text: rewardLog!.text,
      title: 'Misión de prueba questProgress',
      grantedItems: ['Mapa de las Llanuras (prueba questProgress)'],
      rewardXp: 100,
    });
  }, 15_000);
});

// Bug real jugando en vivo (2026-08-13, "el efecto del mapa no está funcionando y sale en el
// inventario como objeto sin categorizar... y me deja ponerlo en cualquier ranura de equipo"):
// `grantQuestRewardItems` creaba la InventoryItem con solo nombre/descripción genérica, sin
// `catalogSlug` — sin ese enlace, MapaPanel.tsx (efecto `reveal-map-llanuras`) nunca lo encontraba
// y `isCompatibleWithSlot` (frontend) trataba el objeto como "narrativo suelto sin catálogo",
// permisivo por diseño para ESE caso — dejándolo equipar en cualquier ranura. Usa el nombre EXACTO
// del catálogo real ("Mapa de las Llanuras", sin sufijo de prueba) a propósito, para que el lookup
// por nombre contra ItemCatalog encuentre la fila real.
describe('La recompensa de misión enlaza con ItemCatalog cuando el nombre coincide (2026-08-13)', () => {
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const orco = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    npcId = orco.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 18',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'CONVALECIENTE' } });
    await prisma.quest.create({
      data: {
        saveId,
        title: 'Acabar con el Orco Enfurecido (prueba 2)',
        description: 'x',
        status: 'ACTIVA',
        targetNpcId: npcId,
        rewardItems: ['Mapa de las Llanuras'],
      },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el objeto concedido lleva el catalogSlug real, no un objeto sin categorizar', async () => {
    // Math.random()=0.99 garantiza el mejor resultado posible (REDISEÑO 2026-08-30 — ver el
    // describe hermano de arriba para el mismo motivo).
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await doTurn(saveId, "Ataco con todas mis fuerzas, contra 'Orco enfurecido'.");

    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, name: 'Mapa de las Llanuras' } });
    expect(item.catalogSlug).toBe('mapa-de-las-llanuras');
  }, 20_000);
});

// docs/mecanicas/19-post-combate-y-recompensas-mision.md pieza 2 (2026-08-13) — recuperación de CONVALECIENTE
// a las 6h de ficción y desaparición de un cadáver a las 48h. `applyCondicionTimeouts` se dispara
// dentro de CUALQUIER turno resuelto (mismo punto que avanza `fictionalMinutes`), así que un turno
// cualquiera basta para comprobarlo — no hace falta que la acción tenga nada que ver con el NPC.
describe('Recuperación de CONVALECIENTE tras 6h de ficción (docs/19 pieza 2)', () => {
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const orco = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    npcId = orco.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 18',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    // fictionalMinutes por defecto (480) - condicionFisicaSinceMinutes (0) = 8h > umbral de 6h —
    // cualquier turno, sin importar cuánto avance el reloj él solo, ya cruza el umbral.
    await prisma.worldState.create({ data: { saveId } });
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'CONVALECIENTE', condicionFisicaSinceMinutes: 0 } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un turno cualquiera revierte la condición a HERIDO', async () => {
    await doTurn(saveId, 'Exploro la zona con cuidado.');
    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId, scope: '' } } });
    expect(state.condicionFisica).toBe('HERIDO');
  }, 20_000);
});

describe('Desaparición de un cadáver tras 48h de ficción (docs/19 pieza 2)', () => {
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const orco = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    npcId = orco.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 19',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    // fictionalMinutes explícito bien por encima de 48h (2880 min) desde condicionFisicaSinceMinutes.
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 4000 } });
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'MUERTO', condicionFisicaSinceMinutes: 0, saqueado: true } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un turno cualquiera borra el NpcState del cadáver', async () => {
    await doTurn(saveId, 'Exploro la zona con cuidado.');
    const state = await prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId, npcId, scope: '' } } });
    expect(state).toBeNull();
  }, 20_000);
});

// Auditoría 2026-08-14 (bug real jugando en vivo, reinicio de partida: "Brazalete trenzado del
// Clan Maktor"/"Pañuelo de luto Serhu"/"Tótem de clan roto" aparecieron ya en el PRIMERÍSIMO
// "Exploro la zona", en La Hondonada del Eco, sin relación real con dónde cayó el Clan Maktor).
// `harvestSourceHomeLocationSlug` (worldCatalog.ts) liga estas fuentes a una Location EXACTA.
// Reescrito 2026-08-25 (retirada la habilidad de descubrimiento de texto libre — ver comentario de
// cabecera en discovery.ts): la misma garantía de candado por Location ahora se prueba contra la
// habilidad general "Recoger" (`pasivoCandidatesFor`, recolectar.ts) — sin roll ni aleatoriedad
// (a diferencia del viejo `selectDiscoveries`), así que una sola llamada por caso basta, nunca
// hace falta repetir para "tener suerte" de que algo salga.
describe('"Recoger": objetos narrativos "PASIVO" ligados a su Location exacta (auditoría 2026-08-14, reescrito 2026-08-25)', () => {
  const MAKTOR_ITEMS = ['Tablilla quemada', 'Tótem de clan roto'];
  // La fuente 'ofrendas-tumulos-honor' (Los Túmulos del Honor) ya no existe (pasada de objetos
  // narrativos sin uso, 2026-09-02): 'Hueso marcado de primera cacería' eliminado por no aportar
  // nada ("no tiene valor mantenerlo"), y 'Pañuelo de luto Serhu' reemplazado por "Mochila
  // Curtida" (cosmético crafteable real, sin drop pasivo) — Los Túmulos del Honor se quedan sin
  // ningún loot propio.

  async function saveAt(locationSlug: string, name: string) {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: locationSlug } });
    const save = await prisma.save.create({
      data: {
        userId, worldId: world.id, characterName: name, characterArchetype: 'guerrero', characterOrigin: 'Clan Maktor',
        characterMotivation: 'x', attributes: ATTRS, portraitInitial: 'G', currentLocationId: location.id,
      },
    });
    await prisma.worldState.create({ data: { saveId: save.id } });
    return save.id;
  }

  async function recogerSourcesFor(saveId: string): Promise<string[]> {
    const app = Fastify();
    await app.register(recolectarRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/recolectar/recolector-general` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { sources: { yields: { itemName: string }[] }[] };
    return body.sources.flatMap((cat) => cat.yields.map((y) => y.itemName));
  }

  it('en La Hondonada del Eco, Recoger nunca ofrece objetos ligados a Restos de Maktor', async () => {
    const saveId = await saveAt('hondonada-del-eco', 'Gorhorn de prueba (recoger hondonada)');
    const names = await recogerSourcesFor(saveId);
    expect(names.filter((n) => MAKTOR_ITEMS.includes(n))).toEqual([]);
    await prisma.save.delete({ where: { id: saveId } });
  }, 20_000);

  it('en Los Restos de Maktor, Recoger SÍ ofrece los objetos de Maktor', async () => {
    const saveId = await saveAt('restos-de-maktor', 'Gorhorn de prueba (recoger restos maktor)');
    const names = await recogerSourcesFor(saveId);
    expect(MAKTOR_ITEMS.every((n) => names.includes(n))).toBe(true);
    await prisma.save.delete({ where: { id: saveId } });
  }, 20_000);

  it('en Los Túmulos del Honor, Recoger nunca ofrece objetos de Maktor (sin loot propio desde 2026-09-02)', async () => {
    const saveId = await saveAt('tumulos-del-honor', 'Gorhorn de prueba (recoger tumulos)');
    const names = await recogerSourcesFor(saveId);
    expect(names.filter((n) => MAKTOR_ITEMS.includes(n))).toEqual([]);
    await prisma.save.delete({ where: { id: saveId } });
  }, 20_000);
});

// Crafteo: narración determinista, no la prosa del modelo (auditoría 2026-08-14, petición
// explícita repetida: "la habilidad de crafteo debe ser determinista no narrada") — el RESULTADO
// (qué se crea, qué se consume) ya era determinista desde 2026-07-22, pero el TEXTO que veía la
// jugadora seguía siendo lo que devolviera el mock/LLM de narrador.js. Ahora se sustituye siempre,
// mismo criterio que ya usan loot/harvest.
// Crafteo con espera real (rediseño 2026-08-20, petición explícita: "no habíamos quedado que los
// crafteos eran deterministas?... quiero tener para esta parte algo similar a los viajes, que
// salga que estás crafteando y que lleve un tiempo real con la opción a cancelarlo") — el resultado
// sigue siendo determinista (nunca lo decide el modelo), pero ya NO se resuelve en la misma
// respuesta de /turn/classify: crea un CharacterTransit (mismo mecanismo que un viaje largo) con
// `busyUntil` a `craftDurationSecondsFor(recipe)` segundos reales vista — aquí Vendaje improvisado
// es tier 1 → 5s. Mismo patrón de test ya establecido para viaje en este archivo (líneas de arriba,
// "el viaje se trunca..."): crear vía /turn/classify, comprobar el CharacterTransit directamente,
// adelantar `busyUntil` al pasado y llamar a resolveDueTransits() en vez de esperar de verdad.
describe('Crafteo con espera real (2026-08-20): transit con busyUntil, resolución diferida y frase determinista', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (crafteo con espera real)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('craftear NO resuelve al instante: crea un CharacterTransit con busyUntil ~5s vista (tier 1), sin consumir/crear nada todavía', async () => {
    await giveMaterials(saveId, [{ name: 'Manojo de salvia del polvo', catalogSlug: 'manojo-salvia-polvo' }]);

    const app = await buildApp();
    const before = Date.now();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId, action: 'Ato un vendaje con mi manojo de salvia del polvo.', enCombate: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { transit?: { busyUntil: string } };
    expect(body.transit).toBeDefined();

    const transit = await prisma.characterTransit.findUniqueOrThrow({ where: { saveId } });
    const msVista = new Date(transit.busyUntil).getTime() - before;
    expect(msVista).toBeGreaterThan(0);
    expect(msVista).toBeLessThanOrEqual(6_000); // tier 1 → 5s, con margen corto para el propio test

    // Nada aplicado todavía — ni consumido el ingrediente ni creado el resultado.
    const inventory = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(inventory.some((i) => i.name === 'Vendaje improvisado')).toBe(false);
    expect(inventory.some((i) => i.name.startsWith('Manojo de salvia del polvo'))).toBe(true);
  });

  it('al resolverse el tránsito, la narración es la frase determinista (no la del modelo) y consume/crea de verdad', async () => {
    // El tránsito ya existe (test anterior, mismo saveId) — se adelanta busyUntil al pasado para
    // que resolveDueTransits() lo recoja de inmediato, sin esperar los segundos reales de verdad.
    await prisma.characterTransit.update({ where: { saveId }, data: { busyUntil: new Date(Date.now() - 1000) } });
    await resolveDueTransits();

    const transitAfter = await prisma.characterTransit.findUnique({ where: { saveId } });
    expect(transitAfter).toBeNull(); // resuelto y borrado

    // `take: 3`, no solo la última (bug real al escribir este test: el ascenso de nivel de oficio
    // que dispara `awardProfessionXp` añade su PROPIA entrada de "desbloquea la habilidad de
    // oficio..." justo después de la de crafteo, así que la última entrada no siempre es la del
    // crafteo en sí).
    const entries = await prisma.logEntry.findMany({ where: { saveId }, orderBy: { createdAt: 'desc' }, take: 3 });
    const craftEntry = entries.find((e) => e.text.includes('craftea:'));
    // Prefijo exacto, no texto completo (adorno de ramas deterministas, 2026-08-22): tras la frase
    // mecánica fija se añade una de varias frases de color elegidas al azar (turnResolution.ts §
    // CRAFT_FLAVOR/pickFlavor) — el prefijo es lo único que de verdad importa comprobar aquí.
    expect(craftEntry?.text).toMatch(/^Gorhorn de prueba \(crafteo con espera real\) craftea: Vendaje improvisado\. /);
    expect(craftEntry?.text).not.toContain('El golpe conecta'); // no es el texto del mock del LLM

    const inventory = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(inventory.some((i) => i.name === 'Vendaje improvisado')).toBe(true);
    expect(inventory.some((i) => i.name.startsWith('Manojo de salvia del polvo'))).toBe(false); // ingrediente consumido
  }, 20_000);

  it('cancelar mientras todavía falta tiempo real deshace el intento — sin crear ni consumir nada (a diferencia de un viaje, aquí SÍ hay ventana real para cancelar)', async () => {
    await giveMaterials(saveId, [{ name: 'Manojo de salvia del polvo', catalogSlug: 'manojo-salvia-polvo' }]);
    // Recuento ANTES, no presencia a secas (mismo saveId que el test anterior — ya hay un Vendaje
    // improvisado de verdad en el inventario desde entonces; lo que importa es que cancelar no
    // añada uno MÁS ni consuma este nuevo manojo de salvia).
    const vendajesAntes = (await prisma.inventoryItem.findMany({ where: { saveId } })).filter((i) => i.name === 'Vendaje improvisado').length;

    const app = await buildApp();
    const classifyRes = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId, action: 'Ato un vendaje con mi manojo de salvia del polvo.', enCombate: false },
    });
    expect(classifyRes.statusCode).toBe(200);
    expect(await prisma.characterTransit.findUnique({ where: { saveId } })).not.toBeNull();

    const cancelRes = await app.inject({ method: 'POST', url: `/saves/${saveId}/transit/cancel` });
    expect(cancelRes.statusCode).toBe(204);
    expect(await prisma.characterTransit.findUnique({ where: { saveId } })).toBeNull();

    const inventory = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(inventory.filter((i) => i.name === 'Vendaje improvisado').length).toBe(vendajesAntes); // ninguno nuevo
    expect(inventory.some((i) => i.name.startsWith('Manojo de salvia del polvo'))).toBe(true); // sin consumir
  });
});

// Pieza 6 (2026-09-03, "mundo determinista, el narrador solo narra" — petición explícita de la
// usuaria): fuera de combate, una intención real de crafteo/construcción (verbo+sustantivo de una
// receta real) que no se puede lanzar (sin materiales) debe devolver un mensaje determinista fijo,
// nunca caer al narrador libre a inventar un resultado no persistido.
describe('Mundo determinista (Pieza 6): crafteo/construcción/viaje/recolección sin poder lanzarse, fuera de combate, bloquea con mensaje determinista', () => {
  let saveId: string;
  let locationId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    locationId = hondonada.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (Pieza 6, sin materiales)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: locationId,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('crafteo sin el ingrediente real: bloquea con mensaje determinista, sin llamar al narrador ni crear CharacterTransit', async () => {
    narrateAction.mockClear();
    const app = await buildApp();
    const action = 'Ato un vendaje con mi manojo de salvia del polvo.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    expect(classifyRes.statusCode).toBe(200);
    const body = classifyRes.json() as { blocked?: { narration: string } };

    expect(narrateAction).not.toHaveBeenCalled();
    expect(await prisma.characterTransit.findUnique({ where: { saveId } })).toBeNull();
    expect(typeof body.blocked?.narration).toBe('string');
    expect(body.blocked!.narration.length).toBeGreaterThan(0);
  });

  it('construcción sin materiales: bloquea con mensaje determinista, sin llamar al narrador ni crear Building', async () => {
    narrateAction.mockClear();
    const app = await buildApp();
    const action = 'Construyo un campamento base en este lugar.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    expect(classifyRes.statusCode).toBe(200);
    const body = classifyRes.json() as { blocked?: { narration: string } };

    expect(narrateAction).not.toHaveBeenCalled();
    expect(await prisma.building.count({ where: { saveId } })).toBe(0);
    expect(typeof body.blocked?.narration).toBe('string');
    expect(body.blocked!.narration.length).toBeGreaterThan(0);
  });

  it('viaje declarado hacia un destino inventado: bloquea con mensaje determinista, sin mover Save.currentLocationId', async () => {
    narrateAction.mockClear();
    const app = await buildApp();
    const action = 'Me dirijo hacia la Torre de Cristal, dejando atrás la hondonada.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    expect(classifyRes.statusCode).toBe(200);
    const body = classifyRes.json() as { blocked?: { narration: string } };

    expect(narrateAction).not.toHaveBeenCalled();
    expect(typeof body.blocked?.narration).toBe('string');
    expect(body.blocked!.narration.length).toBeGreaterThan(0);
    const savedRow = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(savedRow.currentLocationId).toBe(locationId);
  });

  it('viaje declarado con dirección cardinal suelta (sin nombre propio de lugar): NO bloquea — cae al narrador libre como hoy', async () => {
    narrateAction.mockClear();
    narrateAction.mockResolvedValueOnce({ narration: 'Gorhorn camina un rato hacia el norte, atento al terreno.', newFacts: [] });
    const app = await buildApp();
    const action = 'Camino hacia el norte, atento al terreno.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    expect(classifyRes.statusCode).toBe(200);
    const body = classifyRes.json() as { blocked?: { narration: string }; classification?: unknown };
    expect(body.blocked).toBeUndefined();
  });

  it('recolección de terreno por texto libre (verbo+fuente real de TALA): bloquea con mensaje determinista + harvestSuggestion (botón al mapa de la zona), sin crear ningún InventoryItem', async () => {
    narrateAction.mockClear();
    const app = await buildApp();
    const action = 'Talo el matorral de cuerno para sacar leña.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    expect(classifyRes.statusCode).toBe(200);
    const body = classifyRes.json() as {
      blocked?: { narration: string; harvestSuggestion?: { sourceName: string } };
    };

    expect(narrateAction).not.toHaveBeenCalled();
    expect(typeof body.blocked?.narration).toBe('string');
    expect(body.blocked!.narration.length).toBeGreaterThan(0);
    expect(body.blocked!.harvestSuggestion).toEqual({ sourceName: expect.stringMatching(/matorral/i) });
    const items = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(items).toEqual([]);
  });

  it('recolección de terreno DENTRO de combate: NO bloquea — mismo criterio que crafteo/construcción, ninguna acción en combate es un intento real de recolectar', async () => {
    narrateAction.mockClear();
    narrateAction.mockResolvedValueOnce({ narration: 'Gorhorn talla un golpe con el hacha.', newFacts: [] });
    const app = await buildApp();
    const action = 'Talo el matorral de cuerno para sacar leña.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    expect(classifyRes.statusCode).toBe(200);
    const body = classifyRes.json() as { blocked?: { narration: string } };
    expect(body.blocked).toBeUndefined();
  });
});

// Auditoría "revisar partida" (2026-08-30) — primer caso real de `resultCantidad > 1`: fundir
// Garras de Kirelon Arenoso da 2 Lingotes de Yerreo de un solo crafteo, no 1. Confirma que el
// InventoryItem resultante lleva el sufijo "(2)" (mismo formato que el resto de apilables),
// nunca dos filas separadas.
describe('Crafteo con resultCantidad > 1 (2026-08-30): fundir Garras de Kirelon da 2 Lingotes de Yerreo de golpe', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const campamento = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'campamento-serhu' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (garras de Kirelon)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: campamento.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    await giveMaterials(saveId, [{ name: 'Garras de Kirelon Arenoso', catalogSlug: 'garras-kirelon' }]);
  });

  afterAll(async () => {
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
    await prisma.worldState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('produce "Lingote de Yerreo (2)" en una sola fila, consumiendo las garras', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId, action: 'Fundo mis garras de Kirelon en la fragua del campamento.', enCombate: false },
    });
    await prisma.characterTransit.update({ where: { saveId }, data: { busyUntil: new Date(Date.now() - 1000) } });
    await resolveDueTransits();

    const inventory = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(inventory.some((i) => i.name === 'Lingote de Yerreo (2)')).toBe(true);
    expect(inventory.some((i) => i.name.startsWith('Garras de Kirelon Arenoso'))).toBe(false); // ingrediente consumido
  }, 20_000);
});

// Bug real jugando en vivo (2026-08-04, "ronda larga de pruebas" — el propio combate contra el
// Orco Enfurecido en la Hondonada del Eco redirigió el golpe a Gistera Koh, un PNJ nunca hostil,
// en cuanto el segundo turno de ataque dejó de citar su nombre entre comillas). Confirmado en
// Postgres real: Gistera Koh (npc.id índice 12) ordena ANTES que el Orco Enfurecido (índice 17)
// en `prisma.npc.findMany` — sin `pendingCombatNpcSlugs`, `candidateAttackTarget` caía a
// `npcsInScene[0]` (Gistera) en vez de a con quién ya estaba luchando.
describe('Objetivo de ataque en combate ya iniciado: un ataque sin comillas no se lo roba un PNJ solo mencionado de pasada (bug real 2026-08-04)', () => {
  let saveId: string;
  let orcoId: string;
  let gisteraId: string;

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const orco = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    const gistera = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'gistera-koh' } });
    orcoId = orco.id;
    gisteraId = gistera.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 13',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un ataque de seguimiento sin comillas sigue golpeando al enemigo ya enfrentado, no a Gistera Koh', async () => {
    // Turno 1: ataque explícito (con comillas) contra el Orco Enfurecido — establece
    // Save.pendingCombatNpcSlugs = ['orco-enfurecido-hondonada'].
    await doTurn(saveId, "Cargo contra 'Orco enfurecido' y lo golpeo con todas mis fuerzas.");
    const saveAfterFirst = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfterFirst.pendingCombatNpcSlugs).toEqual(['orco-enfurecido-hondonada']);
    const orcoStateAfterFirst = await prisma.npcState.findFirst({ where: { saveId, npcId: orcoId } });
    expect(orcoStateAfterFirst?.condicionFisica).toBe('HERIDO'); // golpes_mutuos con Math.random pinchado al máximo

    // Turno 2: SIN comillas, mencionando de pasada a Gistera Koh (mismo patrón que un hecho de
    // sesión de trasfondo la habría colado en escena) — antes del fix, esto redirigía el ataque
    // entero a ella en vez de seguir golpeando al enemigo ya enfrentado.
    await doTurn(saveId, 'Sigo golpeando con fuerza al orco enfurecido, sin dejar de pensar en si Gistera seguirá con vida.');

    const orcoStateAfterSecond = await prisma.npcState.findFirst({ where: { saveId, npcId: orcoId } });
    expect(orcoStateAfterSecond?.condicionFisica).toBe('GRAVE'); // un escalón peor, recibió el segundo golpe

    const gisteraState = await prisma.npcState.findFirst({ where: { saveId, npcId: gisteraId } });
    expect(gisteraState).toBeNull(); // nunca fue objetivo, nunca se le creó estado de combate
  }, 20_000);
});

// Bug real jugando en vivo (2026-08-29, reproducido con Playwright): mismo síntoma exacto que el
// bug de 2026-08-04 de arriba (golpe redirigido a Gistera Koh), pero en el PRIMER golpe de un
// encuentro nuevo, no en un ataque de seguimiento. El jugador citó "Kirelon Arenoso" con comillas
// DOBLES (formato que el composer de texto libre permite escribir a mano, pero que `explicitTarget`
// no reconoce — solo comillas simples, el único formato real que genera el mecanismo de citar por
// nombre). Sin `explicitTarget` ni `ongoingCombatTarget` (no hay combate previo), y con Gistera Koh
// presentándose en la MISMA narración de este turno, el fallback caía en ella — pacífica por
// diseño, nunca debería recibir un golpe mecánico sin que el jugador la citara de verdad.
describe('Objetivo de ataque en el PRIMER golpe de un encuentro nuevo: comillas dobles (no reconocidas) no deben redirigir el golpe a un PNJ pacífico presente (bug real 2026-08-29)', () => {
  let saveId: string;
  let orcoId: string;
  let gisteraId: string;

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const orco = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    const gistera = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'gistera-koh' } });
    orcoId = orco.id;
    gisteraId = gistera.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (comillas dobles)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un ataque con comillas dobles (no reconocidas como cita) golpea al Orco Enfurecido, nunca a Gistera Koh', async () => {
    // Comillas dobles a propósito — mismo texto real enviado en la sesión de pruebas que reprodujo
    // el bug, mencionando también a Gistera Koh de pasada (mismo mecanismo que la haría aparecer
    // "en escena" vía sessionFacts/narración libre, sin que `explicitTarget` la resuelva a ella).
    await doTurn(
      saveId,
      'Ataco a "Orco enfurecido" con mi hacha, sin previo aviso, para matarlo, mientras Gistera Koh grita pidiendo ayuda a mis espaldas.',
    );

    const orcoState = await prisma.npcState.findFirst({ where: { saveId, npcId: orcoId } });
    expect(orcoState?.condicionFisica).toBe('HERIDO'); // recibió el golpe real, Math.random pinchado al máximo

    const gisteraState = await prisma.npcState.findFirst({ where: { saveId, npcId: gisteraId } });
    expect(gisteraState).toBeNull(); // nunca fue objetivo del golpe mecánico
  }, 20_000);
});

// Bug real jugando en vivo (2026-08-07, auditoría "revisa la partida" en directo): con un enemigo
// ya MUERTO/saqueado hace turnos todavía detectable en escena (su alias sigue matcheando hechos de
// sesión antiguos), un "Ataco a X" sin comillas contra una fauna NUEVA en la misma escena caía a
// `npcsInScene[0]` (el cadáver) — `combateActivo` bloquea correctamente pelear contra un MUERTO,
// pero el resultado neto era CERO intercambio mecánico contra NADIE, mientras la narración seguía
// describiendo un golpe real contra la fauna (sin NpcState creado, sin nada saqueable/despiezable
// después). El fallback ahora prefiere un NPC vivo en escena antes que caer al primero sin más.
describe('Objetivo de ataque en escena nueva: un cadáver que sigue detectable no bloquea el combate contra fauna nueva (bug real 2026-08-07)', () => {
  let saveId: string;
  let orcoId: string;
  let corretolvasId: string;

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const orco = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    const corretolvas = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'corretolvas' } });
    orcoId = orco.id;
    corretolvasId = corretolvas.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 20',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // El Orco Enfurecido ya resuelto de un combate anterior — MUERTO, ya saqueado del todo (mismo
    // estado exacto que dejó la partida real de Gorhorn tras "Decapitar").
    await prisma.npcState.create({
      data: { saveId, npcId: orcoId, scope: '', condicionFisica: 'MUERTO', saqueado: true, lootedItemNames: ['Maza orca'] },
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un ataque de encuentro nuevo sin comillas golpea a la fauna viva, no al cadáver ya resuelto', async () => {
    // Mencionar "el orco enfurecido" de pasada (mismo patrón que un hecho de sesión de trasfondo lo
    // habría colado en escena) es justo lo que antes del fix hacía que `npcsInScene[0]` fuera el
    // cadáver — la corretolva es la única realmente viva en esta escena.
    await doTurn(
      saveId,
      'Ataco a la corretolva con mi hacha, recordando de pasada al orco enfurecido que ya dejé atrás.',
    );

    const corretolvasState = await prisma.npcState.findFirst({ where: { saveId, npcId: corretolvasId } });
    expect(corretolvasState).not.toBeNull(); // hubo intercambio mecánico real contra ella
    expect(corretolvasState?.condicionFisica).not.toBe('ILESO');

    // El cadáver sigue exactamente igual — nunca fue tocado por este turno.
    const orcoState = await prisma.npcState.findFirst({ where: { saveId, npcId: orcoId } });
    expect(orcoState?.condicionFisica).toBe('MUERTO');
    expect(orcoState?.saqueado).toBe(true);
  }, 20_000);
});

// Caza en grupo (2026-08-13, petición explícita: "el jugador primero debe marcar contra cuantos
// quiere combatir... el cálculo determinista puede darse que salgan menos o más... y que el
// narrador no prometa nada que no se realice por acción"). Dados pinchados al máximo (mismo
// criterio que el resto de este archivo) para garantizar el golpe. En vez de subir la escalera
// entera de condicionFisica turno a turno (lento e innecesario para lo que se quiere probar
// aquí), se adelanta a mano a GRAVE antes de cada golpe decisivo — mismo criterio que otros tests
// de este archivo que adelantan `busyUntil`/estado a mano para no esperar de más.
describe('Caza en grupo: el individuo actual "resucita" a ILESO mientras queden más del grupo, y el corpsesLooted real permite despiece parcial', () => {
  let saveId: string;
  let corretolvasId: string;
  let hondonadaId: string;

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const corretolvas = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'corretolvas' } });
    corretolvasId = corretolvas.id;
    hondonadaId = hondonada.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (caza en grupo)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // Mismo estado que dejaría cazar.ts al confirmar un grupo de 2 avistados: ILESO, grupo de 2,
    // ninguno caído todavía.
    await prisma.npcState.create({
      data: { saveId, npcId: corretolvasId, scope: hondonadaId, condicionFisica: 'GRAVE', groupSize: 2, groupDefeated: 0, corpsesLooted: 0 },
    });
    // Herramienta requerida por oficio (2026-08-17) — este personaje de prueba no se llama
    // 'Gorhorn' exacto, así que no hereda su cuchillo de hielo sílice de serie (arma Y herramienta
    // de desollador); sin él, el despiece de más abajo se bloquearía por falta de herramienta.
    await giveMaterials(saveId, [{ name: 'Cuchillo de hielo sílice', catalogSlug: 'cuchillo-hielo-silice' }]);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('cae el primer individuo del grupo: el NpcState "resucita" a ILESO, groupDefeated sube a 1 — el combate NO termina', async () => {
    const res = await doTurn(saveId, "Ataco a 'Corretolvas' con todas mis fuerzas.");
    expect(res.statusCode).toBe(200);

    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId: corretolvasId, scope: hondonadaId } } });
    expect(state.condicionFisica).toBe('ILESO'); // "resucitó" para el siguiente individuo
    expect(state.groupDefeated).toBe(1);
    expect(state.groupSize).toBe(2);

    // El combate sigue de verdad — el NPC sigue en pendingCombatNpcSlugs para el siguiente turno.
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toContain('corretolvas');
    // P64 (code-review): el siguiente del grupo sí tira iniciativa (no se le da el turno gratis).
    expect((lastNdjsonLine(res.payload) as { nextInitiativeRoll?: unknown }).nextInitiativeRoll).toBeTruthy();
  }, 20_000);

  it('con un cadáver real ya caído (groupDefeated=1), el despiece SÍ da algo aunque el individuo actual siga ILESO', async () => {
    const app = Fastify();
    await app.register(recolectarRoutes);
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/recolectar/confirmar`,
      // 'racion-carne' es el itemSlug real de un HarvestYield CAZA de 'corretolvas' (worldCatalog.ts).
      payload: { selections: [{ sourceSlug: 'corretolvas', itemSlug: 'racion-carne', cantidad: 1 }] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[] };
    expect(body.items.length).toBeGreaterThan(0);

    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId: corretolvasId, scope: hondonadaId } } });
    expect(state.corpsesLooted).toBe(1); // consumió el único cadáver real disponible
  }, 20_000);

  it('cae el ÚLTIMO individuo del grupo: el NpcState se queda en CONVALECIENTE/MUERTO de verdad — el grupo entero está resuelto', async () => {
    // Adelanta a mano el individuo ACTUAL (ya "resucitado" a ILESO) hasta GRAVE, para que el
    // siguiente golpe decisivo (dados al máximo) lo deje CONVALECIENTE — el último del grupo.
    await prisma.npcState.update({
      where: { saveId_npcId_scope: { saveId, npcId: corretolvasId, scope: hondonadaId } },
      data: { condicionFisica: 'GRAVE' },
    });
    // Fuerza que ESTE turno resuelva "jugador ataca, NPC se defiende" (auditoría 2026-08-14, gate
    // de golpes_mutuos: sin esto, un `pendingNpcAttack` heredado del intercambio anterior podía
    // resolver este turno como CASO DEFENSA en su lugar — el jugador defendiéndose con una
    // habilidad sin `effect:'ATAQUE'`, que ya no cuenta como golpe propio contra el NPC, correcto
    // tras el fix, pero no lo que este test necesita comprobar).
    await prisma.save.update({ where: { id: saveId }, data: { pendingNpcAttack: Prisma.JsonNull } });

    const res = await doTurn(saveId, "Ataco a 'Corretolvas' con todas mis fuerzas.");
    expect(res.statusCode).toBe(200);

    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId: corretolvasId, scope: hondonadaId } } });
    expect(state.condicionFisica).toBe('CONVALECIENTE'); // NO resucita: era el último
    expect(state.groupDefeated).toBe(2);
  }, 20_000);
});

// Grupo 3 § Mundo determinista, Capa 4 (2026-08-25): al RESOLVERSE un CombatEncounter real (motor
// de Combate múltiple), se reutiliza el pipeline de saqueo/desuello CLÁSICO tal cual — decisión
// explícita tras valorarlo con la usuaria ("mismo mecanismo", "saquear al final del combate"), en
// vez de un mecanismo nuevo. Este test cubre exactamente lo que turnResolution.ts materializa al
// terminar: NpcState.groupSize/groupDefeated para el grupo (antes vivía solo en
// CombatParticipant.condicionFisicaGrupo), y que el solitario (ya con NpcState real y correcto,
// escrito por el propio motor durante el combate) también entra en el resumen — y que, tras eso,
// el GET clásico de Desollar (sin pasar por ningún botón, ahora pasivo) ya los encuentra solo.
describe('Saqueo/desuello de CombatEncounter: se materializa en NpcState real al resolverse (Grupo 3 § Mundo determinista, Capa 4)', () => {
  let saveId: string;
  let hondonadaId: string;
  let corretolvasId: string;
  let auladorId: string;
  let encounterId: string;

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // garantiza que el golpe final de la jugadora conecte
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const worldId = world.id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    hondonadaId = hondonada.id;
    const corretolvas = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'corretolvas' } });
    corretolvasId = corretolvas.id;
    const aullador = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'aullador-rojo' } });
    auladorId = aullador.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (saqueo CombatEncounter)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await giveMaterials(saveId, [{ name: 'Cuchillo de hielo sílice', catalogSlug: 'cuchillo-hielo-silice' }]);

    // Encuentro real: la jugadora contra 3 Corretolvas de grupo (esGrupo) + 1 Aullador Rojo
    // solitario, mismo `iniciarCombatEncounter` real que dispara cazar.ts hoy.
    const { encounterId: eid } = await prisma.$transaction((tx) =>
      iniciarCombatEncounter(tx, saveId, [
        { bando: 'JUGADOR', tipo: 'JUGADOR', destreza: ATTRS.destreza, inteligencia: ATTRS.inteligencia },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: corretolvasId, npcScope: hondonadaId, destreza: 8, inteligencia: 4, esGrupo: true },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: corretolvasId, npcScope: hondonadaId, destreza: 8, inteligencia: 4, esGrupo: true },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: corretolvasId, npcScope: hondonadaId, destreza: 8, inteligencia: 4, esGrupo: true },
        { bando: 'ENEMIGO', tipo: 'NPC', npcId: auladorId, npcScope: hondonadaId, destreza: 10, inteligencia: 6 },
      ]),
    );
    encounterId = eid;

    // Adelanta a mano (mismo criterio que "Caza en grupo" arriba): 2 de los 3 Corretolvas ya
    // MUERTOS y el Aullador solitario ya MUERTO de verdad en su NpcState real — deja SOLO un
    // Corretolvas con vida para que el turno real de la jugadora decida el final del encuentro.
    const participantes = await prisma.combatParticipant.findMany({ where: { encounterId } });
    const corretolvasParticipantes = participantes.filter((p) => p.npcId === corretolvasId);
    await prisma.combatParticipant.update({ where: { id: corretolvasParticipantes[0].id }, data: { condicionFisicaGrupo: 'MUERTO' } });
    await prisma.combatParticipant.update({ where: { id: corretolvasParticipantes[1].id }, data: { condicionFisicaGrupo: 'MUERTO' } });
    // El último con vida se deja en GRAVE (no ILESO): un solo golpe, aunque sea decisivo, no baja
    // a un combatiente sano directo a CONVALECIENTE/MUERTO — mismo criterio que "Caza en grupo"
    // arriba, que necesita el mismo ajuste manual para el golpe de gracia.
    const ultimoConVida = corretolvasParticipantes[2].id;
    await prisma.combatParticipant.update({ where: { id: ultimoConVida }, data: { condicionFisicaGrupo: 'GRAVE' } });
    await prisma.npcState.create({ data: { saveId, npcId: auladorId, scope: hondonadaId, condicionFisica: 'MUERTO' } });

    // Objetivo del ataque de la jugadora: el último Corretolvas con vida (mismo criterio de
    // targeting por nombre citado que usa turnResolution.ts en modo CombatEncounter).
    await prisma.combatParticipant.updateMany({ where: { encounterId, tipo: 'JUGADOR' }, data: { objetivoActualId: ultimoConVida } });

    // Bug real (2026-08-29, reverificación en vivo): simula el `useEffect` pasivo del frontend
    // consultando "desollador" AL ENTRAR a la escena, antes de que el combate matara a nadie —
    // sin cadáveres todavía, la tirada se congela vacía. Sin el fix de `invalidateCarcassRollCache`
    // (turnResolution.ts), esta entrada vacía queda huérfana para siempre: la invalidación normal
    // de recolección solo dispara si algún `sourceSlug` de la tirada congelada coincide con lo
    // tocado, y una tirada vacía no tiene ningún slug que pueda coincidir nunca.
    await prisma.save.update({
      where: { id: saveId },
      data: { harvestRollCache: { desollador: { locationId: hondonadaId, sources: [] } } },
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.combatEncounter.deleteMany({ where: { saveId } });
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el turno que remata al último Corretolvas resuelve el encuentro, materializa NpcState.groupSize/groupDefeated y avisa en combatEncounterLootSummary', async () => {
    const res = await doTurn(saveId, "Ataco a 'Corretolvas' con todas mis fuerzas.");
    expect(res.statusCode).toBe(200);
    const body = lastNdjsonLine(res.payload);
    expect(body.combatEncounterLootSummary).not.toBeNull();
    const bySlug = new Map((body.combatEncounterLootSummary as { slug: string; cantidad: number }[]).map((c) => [c.slug, c.cantidad]));
    expect(bySlug.get('corretolvas')).toBe(3);
    expect(bySlug.get('aullador-rojo')).toBe(1);

    const encounter = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encounterId } });
    expect(encounter.estado).toBe('RESUELTO');

    // Materializado real (antes solo vivía en CombatParticipant.condicionFisicaGrupo) — mismos
    // campos que ya usa el saqueo/desuello clásico (carcassCandidatesFor, recolectar.ts).
    const corretolvasState = await prisma.npcState.findUniqueOrThrow({
      where: { saveId_npcId_scope: { saveId, npcId: corretolvasId, scope: hondonadaId } },
    });
    expect(corretolvasState.groupSize).toBe(3);
    expect(corretolvasState.groupDefeated).toBe(3);
    expect(corretolvasState.corpsesLooted).toBe(0);
  }, 30_000);

  it('el saqueo/desuello clásico (GET /saves/:id/recolectar/desollador) ya encuentra a los caídos sin pasar por ningún botón', async () => {
    const app = Fastify();
    await app.register(recolectarRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/recolectar/desollador` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { sources: { yields: { sourceSlug: string }[] }[] };
    const slugs = new Set(body.sources.flatMap((cat) => cat.yields.map((y) => y.sourceSlug)));
    expect(slugs.has('corretolvas')).toBe(true);
    expect(slugs.has('aullador-rojo')).toBe(true);
  }, 20_000);
});

// Bug real jugando en vivo (2026-08-04, "ronda larga de pruebas"): en un turno de descanso
// (`enCombate: false`, sin ningún verbo hostil) el LLM propuso igualmente `combateIniciado` contra
// Gistera Koh (temperamento CAUTELOSO, nunca hostil) solo porque un hecho de sesión la menciona de
// pasada — `combatSlugsFromModel` se fiaba de la propuesta libre del modelo sin mirar temperamento.
describe('combatSlugsFromModel no se fía de una propuesta de combate del LLM contra un PNJ pacífico (bug real 2026-08-04)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 14',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'voluntad', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un descanso fuera de combate no abre combate aunque el LLM proponga a un PNJ pacífico en combateIniciado', async () => {
    narrateAction.mockResolvedValueOnce({
      narration: 'Gorhorn descansa un momento, pensando en si Gistera seguirá con vida.',
      newFacts: [],
      combateIniciado: { npcSlugs: ['gistera-koh'] },
    });
    const app = await buildApp();
    const action = 'Descanso un momento, pensando en Gistera.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: false },
    });

    expect(lastNdjsonLine(narrateRes.payload).combateIniciado).toBeNull();
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual([]);
    const gisteraState = await prisma.npcState.findFirst({ where: { saveId } });
    expect(gisteraState).toBeNull(); // nunca se le creó estado, nunca entró en combate
  }, 20_000);
});

// Bug real jugando en vivo (2026-08-20): el jugador aceptó ayudar a Gistera Koh eligiendo una
// sugerencia totalmente pacífica ("Ofrezco mi ayuda, aunque no entienda completamente su
// urgencia") — sin `combateIniciado` del modelo, sin ningún verbo hostil en la acción — pero el
// turno abrió combate igual. `allNpcsInSceneArePacificos` solo contaba AMIGABLE/INOFENSIVO como
// "no pudo haber sido él" — Gistera es CAUTELOSO (por definición de catálogo, "depende de la
// acción del jugador", nunca inicia nada por su cuenta), así que quedaba fuera de esa lista pese a
// no ser hostil, y bastaba con que el modelo devolviera un `condicionFisica` de bajada en su JSON
// (aunque la narración fuera cortés) para forzar combate vía `shouldForceCombat`.
describe('shouldForceCombat no abre combate contra un PNJ CAUTELOSO por una bajada de condición ambigua del modelo (bug real 2026-08-20)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (CAUTELOSO no fuerza combate)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // Mismo atajo que el test de arriba (línea ~1081) para que Gistera Koh cuente como "en
    // escena" (CAUTELOSO) sin tener que pasar por todo su gancho de presentación de fase-1.
    await prisma.$executeRaw`
      INSERT INTO "SessionFact" (id, "saveId", text, embedding, "createdAt")
      VALUES (${crypto.randomUUID()}, ${saveId}, 'Gistera Koh, una orca expulsada del Clan Serhu, pidió ayuda.', NULL, ${new Date()})
    `;
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'voluntad', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('ofrecer ayuda de forma pacífica no abre combate aunque el modelo devuelva una bajada de condición ambigua', async () => {
    narrateAction.mockResolvedValueOnce({
      narration: 'Gorhorn asume un aire serio y se acerca a la figura orca, preguntando en tono cortés pero firme qué es lo que ocurre.',
      newFacts: [],
      condicionFisica: 'HERIDO', // bajada respecto al ILESO por defecto — justo lo ambiguo del bug real
    });
    const app = await buildApp();
    const action = 'Ofrezco mi ayuda, aunque no entienda completamente su urgencia.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: false },
    });

    expect(lastNdjsonLine(narrateRes.payload).combateIniciado).toBeNull();
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual([]);
  }, 20_000);
});

// Petición explícita de la usuaria (2026-08-20, jugando en vivo): "el tema de que el Orco
// Enfurecido aunque lo busque como 'perseguidor' no aparezca" — la escena de Gistera Koh lo
// mantiene a propósito sin nombrar, así que `detectNpcsInScene` (solo compara contra name/aliases
// reales de catálogo) nunca lo detectaba si el jugador buscaba con vocabulario de "perseguidor" en
// vez de su nombre real. Ver el bloque nuevo en `turnResolution.ts` (justo después de
// `travelInterruptionNpcId`) para la inyección determinista acotada a esta misión.
describe('el "perseguidor" de Gistera Koh se detecta en escena sin nombrarlo, mientras la misión sigue activa (bug real 2026-08-20)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (perseguidor sin nombrar)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // La propia misión (creada al aceptar ayudar a Gistera Koh, fase 3 de turnResolution.ts) es la
    // única señal que gatea la inyección — no hace falta reproducir todo el gancho de presentación.
    await prisma.quest.create({
      data: { saveId, title: 'Acabar con el Orco Enfurecido', description: 'Derrotar al guerrero que persigue a Gistera Koh.', status: 'ACTIVA' },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  // Limpieza real de partidas huérfanas (2026-08-26, hallazgo jugando: ~95 "Gorhorn de prueba"
  // acumuladas en la partida REAL de la usuaria — este entorno comparte Postgres con su partida en
  // vivo, arquitectura local-first). Causa raíz: los 2 tests de abajo creaban su propia Save extra
  // y la borraban con una línea SUELTA al final del cuerpo del test — si cualquier `expect` de
  // arriba fallaba (`revisar-partida-hallazgos.md` documenta que este archivo lleva semanas
  // fallando de forma intermitente contra Postgres real), esa línea de borrado nunca se ejecutaba,
  // dejando la fila huérfana para siempre. `afterEach` SÍ se ejecuta aunque el test falle — mismo
  // criterio que ya usa `afterAll` de arriba para la Save compartida del describe.
  let extraSaveId: string | null = null;
  afterEach(async () => {
    if (extraSaveId) {
      await prisma.save.delete({ where: { id: extraSaveId } });
      extraSaveId = null;
    }
  });

  it('buscar al "perseguidor" (sin nombrarlo) lo detecta en escena y abre combate, igual que si se nombrara "Orco enfurecido"', async () => {
    narrateAction.mockResolvedValueOnce({
      narration: 'Gorhorn inspecciona atentamente la hondonada, escrutando cada sombra y sonido.',
      newFacts: [],
    });
    const app = await buildApp();
    const action = 'Reviso los alrededores buscando al perseguidor.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: false },
    });

    // AGRESIVO de catálogo — una vez detectado en escena, `shouldForceCombat` abre combate contra
    // él solo, sin depender del verbo del jugador (mismo criterio que cualquier otro NPC agresivo
    // ya detectado por nombre real, ver turnResolution.ts).
    const { combateIniciado } = lastNdjsonLine(narrateRes.payload) as { combateIniciado: { npcs: { slug: string }[] } | null };
    expect(combateIniciado?.npcs.map((n) => n.slug)).toEqual(['orco-enfurecido-hondonada']);
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual(['orco-enfurecido-hondonada']);

    // Bug real jugando en vivo (2026-08-20, encontrado justo tras confirmar que el combate se
    // abría): el combate se abría de verdad, pero la narración libre (mockeada arriba, "sigue
    // buscando") nunca explicaba contra quién — el reveal determinista tiene que garantizarlo,
    // sin depender de que el modelo lo narre por su cuenta.
    const { narration } = lastNdjsonLine(narrateRes.payload) as { narration: { narration: string } };
    expect(narration.narration).toContain('Orco Enfurecido');
  }, 20_000);

  it('una mención de pasada sin intención real de buscar/atacar NO lo detecta ni abre combate ("me contó que fue perseguida")', async () => {
    const save2 = await prisma.save.create({
      data: {
        userId: (await getDefaultUserId()),
        worldId: (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id,
        characterName: 'Gorhorn de prueba (mención pasajera)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: (await prisma.location.findFirstOrThrow({ where: { slug: 'hondonada-del-eco' } })).id,
      },
    });
    extraSaveId = save2.id;
    await prisma.worldState.create({ data: { saveId: save2.id } });
    await prisma.quest.create({
      data: { saveId: save2.id, title: 'Acabar con el Orco Enfurecido', description: 'x', status: 'ACTIVA' },
    });
    narrateAction.mockResolvedValueOnce({
      narration: 'Gorhorn recuerda cómo Gistera Koh llegó sin aliento, perseguida y asustada.',
      newFacts: [],
    });
    const app = await buildApp();
    const action = 'Pienso en lo perseguida que llegó Gistera ayer.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId: save2.id, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId: save2.id, action, classification, roll, enCombate: false },
    });

    expect(lastNdjsonLine(narrateRes.payload).combateIniciado).toBeNull();
    const save2After = await prisma.save.findUniqueOrThrow({ where: { id: save2.id } });
    expect(save2After.pendingCombatNpcSlugs).toEqual([]);
  }, 20_000);

  it('bug propio encontrado minutos después del fix anterior (2026-08-20): "persigue" (verbo en presente, raíz "persig-") también se detecta, no solo "perseguidor" (sustantivo, raíz "persegu-")', async () => {
    const save3 = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(),
        worldId: (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id,
        characterName: 'Gorhorn de prueba (verbo persigue)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: (await prisma.location.findFirstOrThrow({ where: { slug: 'hondonada-del-eco' } })).id,
      },
    });
    extraSaveId = save3.id;
    await prisma.worldState.create({ data: { saveId: save3.id } });
    await prisma.quest.create({
      data: { saveId: save3.id, title: 'Acabar con el Orco Enfurecido', description: 'x', status: 'ACTIVA' },
    });
    narrateAction.mockResolvedValueOnce({
      narration: 'Gorhorn busca con atención, siguiendo cualquier rastro.',
      newFacts: [],
    });
    const app = await buildApp();
    const action = 'Busco a quien me persigue.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId: save3.id, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId: save3.id, action, classification, roll, enCombate: false },
    });

    const { combateIniciado } = lastNdjsonLine(narrateRes.payload) as { combateIniciado: { npcs: { slug: string }[] } | null };
    expect(combateIniciado?.npcs.map((n) => n.slug)).toEqual(['orco-enfurecido-hondonada']);
  }, 20_000);
});

// Investigación del hallazgo colateral anotado en checklist-pruebas-juego.md (Prueba 3, sin
// investigar hasta ahora): "iniciar combate por texto libre normal contra fauna no 'localizada' en
// sessionFacts no siempre engancha combateIniciado". `detectNpcsInScene` (npcScene.ts) construye su
// `haystack` como `[action, ...sessionFacts].join('\n')` — en teoría no exige NINGUNA localización
// previa (a diferencia de `GET /saves/:id/cazar`, que sí filtra por `detectHarvestSourcesInScene`),
// así que el escenario sospechoso real es: fauna agresiva mencionada SOLO en un `sessionFact` de un
// turno anterior (nunca en la ACCIÓN de este turno, nunca con NpcState propio, sin quest que la
// respalde) — justo el caso que ninguno de los tests de arriba cubre (todos nombran al NPC directo
// en `action`, o son el Orco Enfurecido, que es PRINCIPAL + tiene quest, dos vías de "candidato
// plausible" que fauna genérica no tiene). Usa Kirelon Arenoso (AGRESIVO, PLANTILLA, sin quest,
// `faunaMomentoDelDia: 'noche'`) para cubrir ese filtro nuevo (2026-09-02) en el mismo test.
describe('Combate contra fauna mencionada solo en sessionFacts, nunca en la acción del turno actual (investigación 2026-09-03)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (fauna solo en sessionFacts)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    // fictionalMinutes en banda nocturna (22:00 = 22*60) — kirelon-arenoso solo es candidato de
    // noche (faunaMomentoDelDia, worldCatalog.ts).
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 22 * 60 } });
    // Simula que un turno ANTERIOR ya narró/mencionó al Kirelon (sessionFact real, ventana rodante
    // de worldFacts.ts) — SIN crear ningún NpcState para él, SIN quest que lo respalde: el único
    // camino de "candidato plausible" es homeLocationSlug === región actual (detectNpcsInScene).
    await appendSessionFacts(saveId, [], [
      'Un Kirelon Arenoso emergió brevemente de la arena antes de volver a enterrarse, vigilante.',
    ]);
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('atacar sin nombrar al Kirelon por su nombre real, apoyándose solo en el sessionFact previo, SÍ abre combate contra él', async () => {
    narrateAction.mockResolvedValueOnce({
      narration: 'Gorhorn se lanza hacia la sombra que vio moverse en la arena, hacha en alto.',
      newFacts: [],
    });
    const app = await buildApp();
    const action = 'Ataco a la criatura que vi enterrarse en la arena hace un momento.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: false },
    });

    const { combateIniciado } = lastNdjsonLine(narrateRes.payload) as { combateIniciado: { npcs: { slug: string }[] } | null };
    expect(combateIniciado?.npcs.map((n) => n.slug)).toEqual(['kirelon-arenoso']);
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual(['kirelon-arenoso']);
  }, 20_000);
});

// Cobertura nueva (ronda de pruebas 2026-08-04, hallazgos 7/7b/7c: la narración libre describía
// éxito completo — "la carne seca y fría, las pieles finas y suaves" — con tirada fallida y sin
// crear ningún InventoryItem, y en otro turno hasta alucinó un "agarre" de un orco ya muerto y
// saqueado varios turnos antes). Igual que saqueo/construcción, despiece ahora se narra a mano —
// nunca llama a Ollama — así que no hay narración libre que pueda desviarse del resultado real.
describe('Despiece/recolección determinista: la narración nunca miente sobre el resultado (bug real 2026-08-04)', () => {
  let saveId: string;
  let hondonadaId: string;
  let auladorId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    hondonadaId = hondonada.id;
    const aullador = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'aullador-rojo' } });
    auladorId = aullador.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 15',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('presa herida pero NO derrotada todavía: narra que no hay nada que despiezar, sin llamar a Ollama ni crear ítems', async () => {
    await prisma.npcState.create({
      data: { saveId, npcId: auladorId, scope: hondonadaId, condicionFisica: 'HERIDO' },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    const app = await buildApp();
    // Turno de relleno (mismo motivo que en 'newQuestInfo' de arriba): esquivar el gancho de
    // fase-1 de Gistera Koh en la acción #1 de la partida, que añadiría texto ajeno a lo que se
    // comprueba aquí.
    const filler = 'Miro alrededor con calma';
    const fillerClassify = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: filler, enCombate: true } });
    const fillerParsed = fillerClassify.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: filler, classification: fillerParsed.classification, roll: fillerParsed.roll, enCombate: true },
    });

    narrateAction.mockClear();
    const action = 'Despiezo al aullador rojo caído.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });

    expect(narrateAction).not.toHaveBeenCalled();
    const body = lastNdjsonLine(narrateRes.payload);
    expect(body.narration).toEqual({ narration: expect.stringContaining('no hay ningún cadáver'), newFacts: [] });
    const items = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(items).toEqual([]);
  }, 20_000);

  it('tirada de despiece fallida sobre un recurso renovable: narra el fracaso, sin llamar a Ollama ni crear ítems', async () => {
    classifyAction.mockResolvedValue({
      // Dificultad inalcanzable (máximo teórico: 20 de tirada + 5 de destreza/2 = 25) — la tirada
      // falla siempre, sin depender de pinchar Math.random.
      requiereTirada: true, atributo: 'destreza', dificultad: 100, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockClear();
    const app = await buildApp();
    const action = 'Talo el matorral de cuerno para conseguir leña.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    expect(roll.success).toBe(false);
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });

    expect(narrateAction).not.toHaveBeenCalled();
    const body = lastNdjsonLine(narrateRes.payload);
    expect(body.narration).toEqual({ narration: expect.stringContaining('no logra sacar nada de provecho'), newFacts: [] });
    const items = await prisma.inventoryItem.findMany({ where: { saveId, origin: 'despiece/recolección' } });
    expect(items).toEqual([]);
  }, 20_000);

  it('tirada de despiece exitosa sobre un recurso renovable: narra lo conseguido de verdad, sin llamar a Ollama', async () => {
    classifyAction.mockResolvedValue({
      requiereTirada: true, atributo: 'destreza', dificultad: 1, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockClear();
    const app = await buildApp();
    const action = 'Talo el matorral de cuerno para conseguir leña.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    expect(roll.success).toBe(true);
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });

    expect(narrateAction).not.toHaveBeenCalled();
    const body = lastNdjsonLine(narrateRes.payload);
    expect(body.narration).toEqual({ narration: expect.stringContaining('Leña de matorral de cuerno'), newFacts: [] });
    const items = await prisma.inventoryItem.findMany({ where: { saveId, origin: 'despiece/recolección' } });
    expect(items).toHaveLength(1);
  }, 20_000);
});

// Cobertura nueva (ronda de pruebas 2026-08-04, hallazgo 9: el jugador derrotó y saqueó al Orco
// Enfurecido por su cuenta, y DESPUÉS aceptó la ayuda de Gistera Koh contra ese mismo orco — la
// misión se creaba igual como ACTIVA apuntando a un NPC ya resuelto. Como nunca vuelve a producirse
// ni un ataque (está muerto) ni un saqueo (ya `saqueado`), ninguno de los dos caminos que cierran la
// misión llegaba a dispararse — quedaba ACTIVA para siempre, sin recompensa posible).
describe('Misión de Gistera Koh: NPC objetivo ya resuelto no deja la misión atascada (bug real 2026-08-04, hallazgo 9)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const orco = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 16',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
        // Reconectado al sistema de posición en Zona (auditoría de pruebas en vivo, 2026-09-16) —
        // ver el describe hermano 'newQuestInfo' para el mismo comentario completo.
        zonaPosX: 220,
        zonaPosY: 500,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // PRINCIPAL → scope siempre '' (scopeFor) — ya derrotado y saqueado ANTES de que exista la
    // misión, mismo escenario real de la partida jugada.
    await prisma.npcState.create({ data: { saveId, npcId: orco.id, scope: '', condicionFisica: 'MUERTO', saqueado: true } });
    // REDISEÑO 2026-08-30 — sin sembrar la SessionFact de presentación a mano: el botón se ofrece
    // en el turno de PRESENTACIÓN real (`gisteraSePresentaEsteTurno`, exige `!gisteraYaPresentada`
    // — sembrarla aquí lo bloquearía de raíz). Ver el describe hermano 'newQuestInfo: notificación
    // de misión aceptada' para el mismo patrón.
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'voluntad', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('la misión nace ya COMPLETADA, con el XP de recompensa concedido en el acto', async () => {
    // Bug real 2026-08-28 ("misión se salta los botones") — este camino ya no crea la Quest
    // directamente en `/turn/narrate`, solo la ofrece (`newQuestOfferInfo`). El caso "ya resuelto
    // antes de aceptar" (bug real 2026-08-04, hallazgo 9) ahora se aplica en
    // `POST /saves/:id/quests/aceptar`, que es quien materializa la Quest de verdad.
    const app = await buildApp();
    await app.register(questsRoutes);
    // Turno de relleno (a propósito, mismo motivo que el describe hermano): la ACCIÓN Nº1 dispara
    // el gancho de fase-1 de Gistera Koh y la trae a `npcsInScene` para el turno siguiente.
    const filler = 'Miro alrededor con calma';
    const fillerClassify = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: filler, enCombate: true } });
    const fillerParsed = fillerClassify.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: filler, classification: fillerParsed.classification, roll: fillerParsed.roll, enCombate: true },
    });

    // `detectsDialogueIntent` exige un signo de pregunta/exclamación o un verbo de diálogo.
    const action = '¿Quién eres?';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });
    const offer = lastNdjsonLine(narrateRes.payload).newQuestOfferInfo as { title: string; description: string };
    expect(offer.title).toBe('Acabar con el Orco Enfurecido');

    const acceptRes = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/quests/aceptar`,
      payload: { title: offer.title, description: offer.description },
    });
    expect(acceptRes.statusCode).toBe(200);

    const quest = await prisma.quest.findFirstOrThrow({ where: { saveId, title: { contains: 'Orco Enfurecido' } } });
    expect(quest.status).toBe('COMPLETADA');
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.xp).toBeGreaterThanOrEqual(100);

    // docs/mecanicas/19-post-combate-y-recompensas-mision.md, pieza 3 (2026-08-13): el mapa ya no está en el
    // loadout del orco (no se saquea) — solo esta rama ("ya resuelto antes de aceptar") puede
    // concederlo, así que es la única cobertura real de que no se pierda en este camino concreto.
    const mapa = await prisma.inventoryItem.findFirst({ where: { saveId, name: 'Mapa de las Llanuras' } });
    expect(mapa).not.toBeNull();
    // QA-54: la respuesta trae el mapa entre los objetos nuevos, con su efecto, para que el mapa
    // del mundo lo vea sin recargar (P32).
    const nuevos = (acceptRes.json() as { newInventoryItems: { id: string; effectKey: string | null }[] }).newInventoryItems;
    expect(nuevos.find((i) => i.id === mapa!.id)?.effectKey).toBe('reveal-map-llanuras');
  }, 30_000);
});

// Cobertura nueva (ronda de pruebas 2026-08-04, hallazgo 10: al rechazar el Ayuntamiento por
// carisma insuficiente, el gate mecánico funcionaba bien — nada se construía —, pero el modelo
// seguía grabando un `newFact` afirmando que la construcción SÍ se estaba levantando, un hecho de
// sesión PERMANENTE que turnos futuros habrían "recordado" como cierto pese a no haber pasado
// nunca).
describe('Construcción rechazada: no se graba un newFact falso de que sí se completó (bug real 2026-08-04, hallazgo 10)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 17',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        // Sin materiales ni carisma suficiente para el Ayuntamiento (no se dan de propósito) —
        // `buildRecipeCheck.met` es false y `buildMode` nunca llega a activarse.
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'carisma', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el newFact que afirma que la construcción se completó se descarta, aunque el modelo lo proponga', async () => {
    const app = await buildApp();
    // Turno de relleno (mismo motivo que en 'newQuestInfo'/'Construcción determinista' de arriba):
    // esquivar el gancho de fase-1 de Gistera Koh en la acción #1 de la partida.
    const filler = 'Miro alrededor con calma';
    const fillerClassify = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: filler, enCombate: true } });
    const fillerParsed = fillerClassify.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: filler, classification: fillerParsed.classification, roll: fillerParsed.roll, enCombate: true },
    });

    narrateAction.mockResolvedValueOnce({
      narration: 'El trabajo es lento pero gradual. Gorhorn termina de levantar el ayuntamiento, satisfecho con el resultado.',
      newFacts: ['Gorhorn está fundando un pequeño ayuntamiento en la Hondonada del Eco.'],
    });
    const action = 'Construyo un ayuntamiento aquí mismo.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });

    // El turno de relleno (acción #1 de la partida) sí dispara el gancho de Gistera Koh, que
    // añade su propio SessionFact legítimo — lo que importa aquí es que NINGÚN hecho afirme la
    // construcción fallida como si se hubiera completado de verdad.
    const facts = await prisma.sessionFact.findMany({ where: { saveId } });
    expect(facts.some((f) => f.text.includes('ayuntamiento'))).toBe(false);
    const buildings = await prisma.building.findMany({ where: { saveId } });
    expect(buildings).toEqual([]);

    // Bug real (auditoría de código 2026-08-25): antes de este fix, la PROSA que ve la jugadora
    // seguía siendo la del modelo ("termina de levantar el ayuntamiento") pese a que newFacts/
    // newBuilding ya se limpiaban por debajo — ahora también se sustituye por una frase honesta.
    const body = lastNdjsonLine(res.payload) as { narration: { narration: string } };
    expect(body.narration.narration).not.toContain('termina de levantar');
    expect(body.narration.narration).toContain('no tiene lo necesario');
  }, 20_000);
});

describe('Movimiento vago con 2+ salidas: no se persiste una llegada falsa aunque el LLM insista tras 3 intentos (bug real jugando en vivo, 2026-08-06)', () => {
  let saveId: string;
  let locationId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    // La Hondonada del Eco tiene 2 salidas reales (Pozo de Cauce Viejo, Pilares Rotos) — el mismo
    // nodo donde se encontró el bug jugando: `resolveTravel` no puede auto-elegir con 2+ opciones,
    // así que un "avanzo" sin destino nombrado nunca resuelve `travel`, y `hasFalseTravelClaim`
    // (narrador.ts) es la única red que impide que la narración dé la llegada por hecha.
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    locationId = location.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 19',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('narra el cruce sin resolver destino y descarta narration/newFacts si el LLM da la llegada por hecha, sin mover a Save.currentLocationId', async () => {
    const app = await buildApp();
    // Turno de relleno (mismo motivo que en 'newQuestInfo'/'Construcción rechazada' de arriba):
    // esquivar el gancho de fase-1 de Gistera Koh en la acción #1 de la partida.
    const filler = 'Miro alrededor con calma';
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'corta', duracionEstimadaMinutos: 20,
    });
    const fillerClassify = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: filler, enCombate: true } });
    const fillerParsed = fillerClassify.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: filler, classification: fillerParsed.classification, roll: fillerParsed.roll, enCombate: true },
    });

    // Reproduce exactamente el caso real jugando en vivo (2026-08-06): incluso agotando los 3
    // intentos (el mock aquí solo hace falta una vez, `hasFalseTravelClaim` corrige el resultado
    // final sin importar cuál de los 3 lo generó).
    narrateAction.mockResolvedValueOnce({
      narration: 'Gorhorn se arrastra lentamente hacia los Pilares Rotos, cada paso una lucha contra su propia debilidad.',
      newFacts: ['Gorhorn ha dejado la Hondonada del Eco y avanza hacia los Pilares Rotos.'],
    });
    const action = 'Avanzo, dejando atrás la Hondonada.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: false },
    });

    // La corrección determinista SÍ puede nombrar ambos destinos (para preguntar cuál elige, igual
    // que ya le pide el aviso de turnResolution.ts al modelo) — lo que no puede es dar la llegada
    // por hecha. `hasFalseTravelClaim` es la misma comprobación real que ya decide esto en
    // producción: si el texto final YA no la dispara, la corrección hizo su trabajo.
    const done = lastNdjsonLine(narrateRes.payload) as { narration: { narration: string; newFacts: string[] } };
    expect(hasFalseTravelClaim(done.narration, ['El Pozo de Cauce Viejo', 'Pilares Rotos'])).toBe(false);
    expect(done.narration.newFacts).toEqual([]);

    const facts = await prisma.sessionFact.findMany({ where: { saveId } });
    expect(facts.some((f) => f.text.includes('Pilares Rotos'))).toBe(false);

    const savedRow = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(savedRow.currentLocationId).toBe(locationId);
  }, 20_000);
});

// Cobertura nueva (auditoría 2026-08-11, "pruebas por API"): complementario al bloque de arriba —
// aquí el jugador nombra una dirección que NO matchea ningún alias real ("hacia el norte"), así
// que `travel` sale null sin que haya nada ambiguo que preguntar (a diferencia del caso de 2+
// salidas de arriba). `hasFalsePhantomTravel` es la única red que impide que la narración describa
// de todos modos que el personaje abandona la ubicación actual.
describe('Destino inventado sin alias real ("hacia el norte"): no se persiste una salida falsa (bug real jugando por API, 2026-08-11)', () => {
  let saveId: string;
  let locationId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    locationId = location.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 20',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('descarta una narración que da la salida por hecha ("sale de la hondonada"), sin mover Save.currentLocationId', async () => {
    const app = await buildApp();
    const filler = 'Miro alrededor con calma';
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'corta', duracionEstimadaMinutos: 20,
    });
    const fillerClassify = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: filler, enCombate: true } });
    const fillerParsed = fillerClassify.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: filler, classification: fillerParsed.classification, roll: fillerParsed.roll, enCombate: true },
    });

    // Reproduce el hallazgo real: "el norte" no es alias de ninguna Location real, así que
    // `resolveTravel` no encuentra nada que resolver (`travel: null`), pero la narración de todos
    // modos describe una salida ya completada. Nombra el sitio con su alias real de catálogo
    // ("la hondonada del eco", worldCatalog.ts — el único que existe hoy, sin forma corta) para
    // que el test refleje lo que el detector puede ver de verdad contra datos reales.
    narrateAction.mockResolvedValueOnce({
      narration: 'Gorhorn sale de la Hondonada del Eco, caminando firme hacia el norte, alejándose del orco.',
      newFacts: [],
    });
    const action = 'Salgo de la hondonada y camino hacia el norte, alejándome del orco.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    expect(classification.travel).toBeFalsy();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: false },
    });

    const done = lastNdjsonLine(narrateRes.payload) as { narration: { narration: string; newFacts: string[] } };
    expect(hasFalsePhantomTravel(done.narration, ['La Hondonada del Eco', 'la hondonada del eco'])).toBe(false);

    const savedRow = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(savedRow.currentLocationId).toBe(locationId);
  }, 20_000);
});

/// Eventos de viaje interactivos (2026-08-05) — cadena de 3 ubicaciones PROPIA de este test
/// (origen → intermedia → destino), desconectada del grafo real de Llanuras. `pickTravelInterruption`
/// va mockeado (ver cabecera del archivo) para no depender de qué NPCs itinerantes/población real
/// tenga el catálogo — este bloque verifica el ENGANCHE (turn.ts → CharacterTransit → worldTick →
/// turnResolution → combate forzado), no la selección en sí (ya cubierta en
/// travelInterruption.test.ts). `busyUntil` adelantado a mano (en vez de esperar la compresión
/// real de tiempo) para que `resolveDueTransits()` lo recoja al momento, sin sleeps.
describe('Viaje largo interrumpido a mitad de camino (integración real, solo LLM mockeado)', () => {
  beforeAll(() => tieneMontura.mockResolvedValue(true));
  afterAll(() => tieneMontura.mockResolvedValue(false));
  let saveId: string;
  let worldId: string;
  let originId: string;
  let midId: string;
  let destId: string;
  let interruptionNpcId: string;
  let interruptionNpcSlug: string;
  // P3.2 (2026-08-28, "retomar viaje truncado"): el último test de este bloque deja que
  // `startEagerTransitResolution` (el mismo mecanismo real de producción, disparado dentro de
  // turnResolution.ts) resuelva el tránsito de reanudación por su cuenta — su `busyUntil` real
  // depende de `env.travelSegundosMaximos` (espera de VIAJE por tramos, 2026-08-31 — ya no de
  // `fictionMinutesPerRealMinute`/`transitMaxRealMinutes`, que solo gobiernan acciones sin
  // desplazamiento). Se topa aquí solo para este describe, restaurado siempre en `afterAll`.
  const originalTravelSegundosMaximos = env.travelSegundosMaximos;

  beforeAll(async () => {
    // Tope bajo (5s reales) solo para este describe — el tránsito de reanudación (P3.2) real de
    // 67 min de ficción / 1 tramo tardaría hasta el tope normal de producción (5 min) si no se
    // topara aquí.
    env.travelSegundosMaximos = 5;
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;

    const origin = await prisma.location.create({
      data: { worldId, slug: 'test-interrupcion-origen', name: 'Zona de Prueba Origen', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['zona de prueba origen'] },
    });
    const mid = await prisma.location.create({
      data: { worldId, slug: 'test-interrupcion-intermedia', name: 'Zona de Prueba Intermedia', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['zona de prueba intermedia'] },
    });
    const dest = await prisma.location.create({
      data: { worldId, slug: 'test-interrupcion-destino', name: 'Zona de Prueba Destino', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['zona de prueba destino'] },
    });
    originId = origin.id;
    midId = mid.id;
    destId = dest.id;

    await prisma.locationLink.create({ data: { fromId: originId, toId: midId, minutosBase: 100, terreno: 'llano' } });
    await prisma.locationLink.create({ data: { fromId: midId, toId: destId, minutosBase: 100, terreno: 'llano' } });

    const npc = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PLANTILLA',
        slug: 'test-interrupcion-agresor',
        name: 'Agresor de prueba',
        aliases: ['agresor de prueba'],
        role: 'Bandido itinerante',
        level: 1,
        attributes: { fuerza: 8, destreza: 8, constitucion: 8, inteligencia: 4, voluntad: 4, carisma: 2, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null, // itinerante, aunque aquí no importa: la selección va mockeada
        temperamento: 'AGRESIVO',
      },
    });
    interruptionNpcId = npc.id;
    interruptionNpcSlug = npc.slug;

    // Mock determinista: SIEMPRE interrumpe en el primer nodo intermedio (índice 1 de pathIds),
    // usando la misma matemática real de truncado que travelInterruption.ts (minutosConDestreza/
    // bandaForMinutos reales, sin mockear) — solo el CANDIDATO elegido es fijo.
    pickTravelInterruptionMock.mockImplementation(
      async (_worldId: string, travel: TravelResolution, _probability: number, attributes: AttributeBlock): Promise<TravelInterruption | null> => {
        const segments = travel.segments.slice(0, 1);
        const baseMinutos = segments.reduce((sum, s) => sum + s.minutosBase, 0);
        const minutos = minutosConDestreza(baseMinutos, attributes);
        return {
          travel: {
            toLocationId: travel.pathIds[1],
            toLocationName: travel.pathNames[1],
            pathIds: travel.pathIds.slice(0, 2),
            path: travel.path.slice(0, 2),
            pathNames: travel.pathNames.slice(0, 2),
            segments,
            baseMinutos,
            minutos,
            banda: bandaForMinutos(minutos),
          },
          npcId: interruptionNpcId,
          npcSlug: interruptionNpcSlug,
          npcName: 'Agresor de prueba',
        };
      },
    );

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (interrupción)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'Recuperar el honor de los Maktor',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: originId,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    env.travelSegundosMaximos = originalTravelSegundosMaximos;
    pickTravelInterruptionMock.mockReset();
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.npc.delete({ where: { id: interruptionNpcId } });
    await prisma.locationLink.deleteMany({ where: { OR: [{ fromId: originId }, { fromId: midId }] } });
    await prisma.location.deleteMany({ where: { id: { in: [originId, midId, destId] } } });
  });

  // P164 (usuaria, 2026-10-17): la lista de «Viajar» (varias zonas de una vez) es cosa de una montura.
  it('sin montura, un viaje elegido de varios tramos no sale', async () => {
    tieneMontura.mockResolvedValueOnce(false);
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: 'Viajo hacia la zona de prueba destino', enCombate: false, viajeElegido: true } });
    expect(res.json().blocked.narration).toMatch(/^A pie, de una zona a otra se va por sus caminos/);
  });

  it('el viaje se trunca en la ubicación intermedia, con el agresor ya asignado en el tránsito, y guarda el destino original para retomarlo', async () => {
    const app = await buildApp();
    const classifyRes = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId, action: 'Viajo hacia la zona de prueba destino', enCombate: false, viajeElegido: true },
    });
    expect(classifyRes.statusCode).toBe(200);
    const body = classifyRes.json();
    // Truncado: el destino del tránsito es la ubicación INTERMEDIA, no la pedida por el jugador.
    expect(body.travel.toLocationId).toBe(midId);
    expect(body.transit).toBeDefined();

    const transit = await prisma.characterTransit.findUniqueOrThrow({ where: { saveId } });
    const zoneContext = transit.zoneContext as { travel: { toLocationId: string }; travelInterruptionNpcId: string | null };
    expect(zoneContext.travel.toLocationId).toBe(midId);
    expect(zoneContext.travelInterruptionNpcId).toBe(interruptionNpcId);

    // P3.2 (ronda de correcciones 2026-08-28): el destino ORIGINAL pedido por el jugador (destId,
    // no midId) se persiste ya en este momento, para poder retomar el viaje solo al resolver.
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingTravelResumeDestinationId).toBe(destId);
  });

  it('al resolverse el tránsito, el personaje llega a la ubicación intermedia y el combate se fuerza SIN que el mock del LLM mencione al agresor', async () => {
    // El tránsito ya existe (creado en el test anterior, mismo saveId) — se adelanta `busyUntil`
    // al pasado para que resolveDueTransits() lo recoja de inmediato, sin esperar la compresión
    // real de tiempo (minutos/fictionMinutesPerRealMinute).
    await prisma.characterTransit.update({ where: { saveId }, data: { busyUntil: new Date(Date.now() - 1000) } });

    await resolveDueTransits();

    const transitAfter = await prisma.characterTransit.findUnique({ where: { saveId } });
    expect(transitAfter).toBeNull(); // resuelto y borrado

    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.currentLocationId).toBe(midId); // NO llegó al destino pedido, se quedó en la intermedia
    expect(save.pendingCombatNpcSlugs).toContain(interruptionNpcSlug);
    // Franja 1b (2026-09-08) — un candidato AGRESIVO nunca debe ofrecer Interactuar (charla
    // tranquila incoherente con que ya te esté atacando): el filtro de temperamento vive en
    // turnResolution.ts, no en `pickTravelInterruption` (que no distingue temperamento al elegir).
    expect(save.pendingDynamicModeOffer).toBeNull();

    // La prueba real de que el combate forzado ya no depende de que el Narrador acierte el
    // nombre: el mock del LLM (narrateAction, cabecera del archivo) devuelve SIEMPRE el mismo
    // texto genérico fijo ("El golpe conecta.", newFacts: []), sin mencionar jamás a "Agresor de
    // prueba" en su salida — y aun así `pendingCombatNpcSlugs` (arriba) confirma que el combate
    // se forzó de verdad contra ese NPC concreto. (El CONTEXTO que se le envía al mock sí incluye
    // su ficha completa — así debe ser, el Narrador necesita saber quién está en escena; lo que
    // no debe pasar, y no pasa, es que el motor dependa de que el modelo ACIERTE ese nombre por
    // su cuenta en la narración que devuelve, algo que este mock nunca hace por construcción.)
  }, 20_000);

  it('P3.2 (2026-08-28): resuelto el combate sin dejar rastro pendiente, el siguiente turno retoma solo el viaje hacia el destino original', async () => {
    // Resuelve el combate forzado del test anterior sin pasar por un intercambio real — mismo
    // atajo que otros tests de este archivo usan para simular "el combate ya se cerró de una
    // forma u otra" (huida, derrota del agresor, clemencia...): lo único que le importa a esta
    // pieza es que `pendingCombatNpcSlugs` quede vacío antes del turno siguiente.
    await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [] } });
    // Turno instantáneo normal, sin ataque ni viaje — mismo `classifyAction` tabulado que el resto
    // del archivo usa para acciones libres fuera de combate/viaje.
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });

    const app = await buildApp();
    const classifyRes = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId, action: 'Recupero el aliento y miro alrededor.', enCombate: false },
    });
    expect(classifyRes.statusCode).toBe(200);
    const { classification, roll } = classifyRes.json();

    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: 'Recupero el aliento y miro alrededor.', classification, roll, enCombate: false },
    });
    expect(narrateRes.statusCode).toBe(200);
    const done = lastNdjsonLine(narrateRes.payload);
    expect(done.travelResumed).toMatchObject({ toLocationName: 'Zona de Prueba Destino' });

    // El destino truncado se limpia — no debe volver a dispararse en turnos futuros.
    const saveAfterTurn = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfterTurn.pendingTravelResumeDestinationId).toBeNull();

    // El tránsito nuevo hacia el destino ORIGINAL (destId) ya existe. La propia reanudación (P3.2,
    // turnResolution.ts) ya dispara `startEagerTransitResolution` fire-and-forget, igual que
    // turn.ts hace con cualquier viaje sin evento — mismo mecanismo real de producción, no
    // simulado. Esa resolución retiene su commit hasta `busyUntil` (minutos reales, ver
    // TRANSIT_MAX_REAL_MINUTES) antes de escribir `currentLocationId` — se sondea en vez de asumir
    // que ya terminó, evitando la carrera de intentar resolverla dos veces a la vez con un
    // `resolveDueTransits()` manual (que solo vería `claimTurnInFlight` ya tomado y no haría nada).
    await prisma.characterTransit.findUniqueOrThrow({ where: { saveId } });
    const deadline = Date.now() + 15_000;
    let saveAfterResume = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    while (saveAfterResume.currentLocationId !== destId && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
      saveAfterResume = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    }
    expect(saveAfterResume.currentLocationId).toBe(destId);
  }, 20_000);
});

/// Franja 1b (2026-09-08, "Interactuar" motor unificado de eventos de escena) — mismo enganche que
/// el describe anterior, pero con un candidato de interrupción PACÍFICO (CAUTELOSO): confirma que
/// en vez del viejo aviso ámbar sin continuación, ahora se arma `pendingDynamicModeOffer` con ese
/// candidato — y que un candidato AGRESIVO (describe anterior) sigue yendo a combate como siempre,
/// SIN ninguna oferta de Interactuar (`pickTravelInterruption` no filtra por temperamento, así que
/// el filtro tiene que vivir en turnResolution.ts, no en la selección del candidato).
describe('Viaje largo interrumpido con candidato PACÍFICO: ofrece Interactuar en vez del aviso mudo de antes', () => {
  beforeAll(() => tieneMontura.mockResolvedValue(true));
  afterAll(() => tieneMontura.mockResolvedValue(false));
  let saveId: string;
  let worldId: string;
  let originId: string;
  let midId: string;
  let destId: string;
  let interruptionNpcId: string;
  let interruptionNpcSlug: string;
  const originalTravelSegundosMaximos = env.travelSegundosMaximos;

  beforeAll(async () => {
    env.travelSegundosMaximos = 5;
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;

    const origin = await prisma.location.create({
      data: { worldId, slug: 'test-interrupcion-pacifica-origen', name: 'Zona de Prueba Pacífica Origen', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['zona de prueba pacifica origen'] },
    });
    const mid = await prisma.location.create({
      data: { worldId, slug: 'test-interrupcion-pacifica-intermedia', name: 'Zona de Prueba Pacífica Intermedia', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['zona de prueba pacifica intermedia'] },
    });
    const dest = await prisma.location.create({
      data: { worldId, slug: 'test-interrupcion-pacifica-destino', name: 'Zona de Prueba Pacífica Destino', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['zona de prueba pacifica destino'] },
    });
    originId = origin.id;
    midId = mid.id;
    destId = dest.id;

    await prisma.locationLink.create({ data: { fromId: originId, toId: midId, minutosBase: 100, terreno: 'llano' } });
    await prisma.locationLink.create({ data: { fromId: midId, toId: destId, minutosBase: 100, terreno: 'llano' } });

    const npc = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PLANTILLA',
        slug: 'test-interrupcion-pacifica-viajero',
        name: 'Viajero de prueba',
        aliases: ['viajero de prueba'],
        role: 'Mercader itinerante',
        level: 1,
        attributes: { fuerza: 6, destreza: 6, constitucion: 6, inteligencia: 6, voluntad: 6, carisma: 6, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: null,
        temperamento: 'CAUTELOSO',
      },
    });
    interruptionNpcId = npc.id;
    interruptionNpcSlug = npc.slug;

    pickTravelInterruptionMock.mockImplementation(
      async (_worldId: string, travel: TravelResolution, _probability: number, attributes: AttributeBlock): Promise<TravelInterruption | null> => {
        const segments = travel.segments.slice(0, 1);
        const baseMinutos = segments.reduce((sum, s) => sum + s.minutosBase, 0);
        const minutos = minutosConDestreza(baseMinutos, attributes);
        return {
          travel: {
            toLocationId: travel.pathIds[1],
            toLocationName: travel.pathNames[1],
            pathIds: travel.pathIds.slice(0, 2),
            path: travel.path.slice(0, 2),
            pathNames: travel.pathNames.slice(0, 2),
            segments,
            baseMinutos,
            minutos,
            banda: bandaForMinutos(minutos),
          },
          npcId: interruptionNpcId,
          npcSlug: interruptionNpcSlug,
          npcName: 'Viajero de prueba',
        };
      },
    );

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (interrupción pacífica)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'Recuperar el honor de los Maktor',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: originId,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    env.travelSegundosMaximos = originalTravelSegundosMaximos;
    pickTravelInterruptionMock.mockReset();
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.npc.delete({ where: { id: interruptionNpcId } });
    await prisma.locationLink.deleteMany({ where: { OR: [{ fromId: originId }, { fromId: midId }] } });
    await prisma.location.deleteMany({ where: { id: { in: [originId, midId, destId] } } });
  });

  it('al resolverse el tránsito, NO fuerza combate y arma pendingDynamicModeOffer con el candidato pacífico', async () => {
    const classifyRes = await (await buildApp()).inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId, action: 'Viajo hacia la zona de prueba pacífica destino', enCombate: false, viajeElegido: true },
    });
    expect(classifyRes.statusCode).toBe(200);

    await prisma.characterTransit.update({ where: { saveId }, data: { busyUntil: new Date(Date.now() - 1000) } });
    await resolveDueTransits();

    // Diferencia real frente al describe anterior (candidato AGRESIVO): sin combate que bloquee el
    // turno, el motor retoma solo el viaje truncado de inmediato (`pendingTravelResumeDestinationId`,
    // mismo mecanismo P3.2 que el describe anterior verifica turno a turno) — así que el estado
    // intermedio (parado en `midId`, con la oferta ya armada) hay que leerlo ANTES de que ese
    // segundo tránsito fire-and-forget también se resuelva, no después.
    const deadline = Date.now() + 15_000;
    let save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    while (save.pendingDynamicModeOffer === null && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
      save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    }
    // La diferencia real frente al describe anterior (candidato AGRESIVO): ningún combate forzado.
    expect(save.pendingCombatNpcSlugs).toEqual([]);
    expect(save.pendingDynamicModeOffer).toMatchObject({
      tipo: 'FAUNA',
      targetSlug: interruptionNpcSlug,
      targetName: 'Viajero de prueba',
    });
    // QA-27 P47: el aviso de la interrupción dice quién sale al paso.
    const aviso = await prisma.logEntry.findFirst({ where: { saveId, travelInterrupted: true } });
    expect(aviso?.text).toContain('te sale al paso');
    expect(aviso?.text).toContain('Viajero de prueba');
  }, 20_000);
});

// Hallazgo 38 (revisar-partida-hallazgos.md 2026-09-07) — `discoveredLocationSlug` debe viajar en
// el turno que resuelve la PRIMERA visita real al destino, para que el frontend pueda forzar el
// banner de la Location con prioridad sobre cualquier mención del texto. Banda 'corta'
// (minutosBase ≤60) a propósito: se resuelve en el mismo turno, sin CharacterTransit de por medio.
describe('discoveredLocationSlug viaja en el turno de primera llegada real (hallazgo 38, 2026-09-07)', () => {
  let saveId: string;
  let worldId: string;
  let originId: string;
  let destId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const origin = await prisma.location.create({
      data: { worldId, slug: 'test-descubrimiento-origen', name: 'Zona de Prueba Origen Descubrimiento', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['zona de prueba origen descubrimiento'] },
    });
    const dest = await prisma.location.create({
      data: { worldId, slug: 'test-descubrimiento-destino', name: 'Zona de Prueba Destino Descubrimiento', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['zona de prueba destino descubrimiento'] },
    });
    originId = origin.id;
    destId = dest.id;
    await prisma.locationLink.create({ data: { fromId: originId, toId: destId, minutosBase: 10, terreno: 'llano' } });

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (descubrimiento)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: originId,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.locationLink.deleteMany({ where: { fromId: originId } });
    await prisma.location.deleteMany({ where: { id: { in: [originId, destId] } } });
  });

  it('primer viaje al destino: discoveredLocationSlug trae el slug real del destino', async () => {
    const app = await buildApp();
    const action = 'Viajo hacia la zona de prueba destino descubrimiento';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false, viajeElegido: true } });
    expect(classifyRes.statusCode).toBe(200);
    const { classification, roll, travel } = classifyRes.json();
    expect(travel?.toLocationId).toBe(destId);

    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, travel, enCombate: false },
    });
    expect(narrateRes.statusCode).toBe(200);
    const body = lastNdjsonLine(narrateRes.payload) as unknown as { discoveredLocationSlug: string | null };
    expect(body.discoveredLocationSlug).toBe('test-descubrimiento-destino');
  }, 15_000);

  // P164 (QA-27, usuaria 2026-10-14): a pie, escribir «Viajo hacia…» ya no salta de zona; se va por las
  // salidas del mapa de zona (o eligiéndolo en «Viajar»). Saltar de zona sin pasar por las de en medio,
  // con montura (CR-57).
  it('escrito a pie, el viaje no cambia de zona y lo dice', async () => {
    const app = await buildApp();
    const antes = (await prisma.save.findUniqueOrThrow({ where: { id: saveId }, select: { currentLocationId: true } })).currentLocationId;
    // Hacia la zona en la que no está (el test anterior puede haberle dejado en el destino).
    const hacia = antes === destId ? 'origen' : 'destino';
    const res = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: `Viajo hacia la zona de prueba ${hacia} descubrimiento`, enCombate: false } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.blocked.narration).toMatch(/^A pie, de una zona a otra se va por sus caminos: abre el mapa de zona y sal por el que lleva hacia /);
    expect(body.travel).toBeUndefined();
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId }, select: { currentLocationId: true } })).currentLocationId).toBe(antes);
  });

  it('segunda vez en el mismo destino (ya visitado): discoveredLocationSlug es null', async () => {
    const app = await buildApp();
    const backRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: 'Viajo hacia la zona de prueba origen descubrimiento', enCombate: false, viajeElegido: true } });
    const backBody = backRes.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: 'Viajo hacia la zona de prueba origen descubrimiento', classification: backBody.classification, roll: backBody.roll, travel: backBody.travel, enCombate: false },
    });

    const action = 'Viajo hacia la zona de prueba destino descubrimiento';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false, viajeElegido: true } });
    const { classification, roll, travel } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, travel, enCombate: false },
    });
    const body = lastNdjsonLine(narrateRes.payload) as unknown as { discoveredLocationSlug: string | null };
    expect(body.discoveredLocationSlug).toBeNull();
  }, 15_000);
});

// Espera de viaje precalculada (2026-08-13, petición explícita: "el prompt se lanza ya en medio
// de la espera... dejandolo calculado... a no ser que entre un evento"). Prueba el MECANISMO
// (startEagerTransitResolution/notBefore) directamente, sin pasar por turn.ts: el suelo real de
// `busyUntil` en turn.ts nunca baja de 1 minuto real (Math.max(1, ...) en minutosReales), así que
// probar esto de punta a punta por HTTP haría el test minutos más lento sin aportar nada — el
// enganche turn.ts → startEagerTransitResolution en sí (que SÍ depende de esa fórmula) no se
// prueba aquí, solo el propio mecanismo de retener el commit hasta `notBefore`.
describe('Espera de viaje precalculada: notBefore retiene el commit sin retener el cómputo (2026-08-13)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (espera precalculada)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('no comete nada en BD antes de notBefore, y comete justo después — sin doble resolución con resolveDueTransits', async () => {
    const transit = await prisma.characterTransit.create({
      data: {
        saveId,
        activity: 'Descanso un buen rato para recuperar fuerzas.',
        busyUntil: new Date(Date.now() + 10 * 60_000), // lejos a propósito: notBefore manda, no esto
        zoneContext: {
          action: 'Descanso un buen rato para recuperar fuerzas.',
          classification: { requiereTirada: false, atributo: 'constitucion', dificultad: 8, razon: 'x', banda: 'extendida', duracionEstimadaMinutos: 240 },
          roll: undefined,
          travel: null,
        } as object,
      },
    });

    const notBefore = new Date(Date.now() + 300);
    const resolution = startEagerTransitResolution(transit.id, notBefore);

    // A mitad de la espera: reclamada (narrationClaimedAt puesto), pero NADA comprometido todavía.
    await new Promise((r) => setTimeout(r, 120));
    const midway = await prisma.characterTransit.findUnique({ where: { id: transit.id } });
    expect(midway).not.toBeNull();
    expect(midway!.narrationClaimedAt).not.toBeNull();

    // Un barrido de resolveDueTransits() a mitad de la espera NO debe tocar esta fila (ya
    // reclamada) — si lo hiciera, sería una doble resolución real.
    await prisma.characterTransit.update({ where: { id: transit.id }, data: { busyUntil: new Date(Date.now() - 1000) } });
    await resolveDueTransits();
    const afterSweep = await prisma.characterTransit.findUnique({ where: { id: transit.id } });
    expect(afterSweep).not.toBeNull(); // sigue viva: el barrido la ignoró por narrationClaimedAt

    await resolution;

    const afterCommit = await prisma.characterTransit.findUnique({ where: { id: transit.id } });
    expect(afterCommit).toBeNull(); // ya comprometido y borrado

    const logEntry = await prisma.logEntry.findFirst({ where: { saveId, channel: 'CHARACTER', isPlayerAction: false }, orderBy: { createdAt: 'desc' } });
    expect(logEntry?.text).toBe('El golpe conecta.'); // texto fijo del mock de narrateAction
  }, 10_000);
});

// Panel "Curar" con varios objetos/usos a la vez (petición explícita, 2026-08-18) — camino
// EXPLÍCITO nuevo (`healItemUses`), en paralelo al de texto libre de siempre (`detectMedicalItemUse`,
// ya cubierto en otros tests/unitarios). El orden importa de verdad para curaUnPaso (ver
// applySequentialHeals.test en death.test.ts) — este test usa el mismo par exacto (objeto débil,
// tope HERIDO, seguido del fuerte, tope ILESO) para comprobarlo end-to-end contra Postgres real.
describe('Curar: varios objetos a la vez con healItemUses (2026-08-18)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (curar)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
        condicionFisica: 'CONVALECIENTE',
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await giveMaterials(saveId, [
      { name: 'Agua hervida de liquen', catalogSlug: 'agua-hervida-liquen' }, // débil, tope HERIDO
      { name: 'Cataplasma de salvia del polvo', catalogSlug: 'cataplasma-salvia-polvo' }, // fuerte, tope ILESO
    ]);
    // Turno de relleno (bug real destapado por el fix de determinismo de Curar, 2026-08-22): el
    // encuentro guionizado de Gistera Koh (turnResolution.ts § gisteraKoh) se dispara en el
    // PRIMER turno de cualquier partida, siempre, sin depender de la acción — antes quedaba
    // silenciosamente borrado en turnos de Curar porque el override viejo pisaba `narration.narration`
    // DESPUÉS de este añadido; ahora que Curar ya no llama a narrateAction ni se pisa nada, ese
    // mismo encuentro sí sobrevive (correcto, mismo comportamiento que loot/build/craft siempre
    // tuvieron) — así que este test necesita que el turno de Curar NO sea el primero de la partida
    // para poder comprobar solo su propia narración, sin acoplarla a un hook no relacionado.
    await prisma.logEntry.create({
      data: { saveId, channel: 'CHARACTER', text: 'Gorhorn de prueba (curar) llega a la hondonada.', isPlayerAction: true, timeLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('débil primero, fuerte después: CONVALECIENTE → HERIDO (nunca ILESO), narración determinista, las dos unidades consumidas', async () => {
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'voluntad', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    const agua = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, catalogSlug: 'agua-hervida-liquen' } });
    const cataplasma = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, catalogSlug: 'cataplasma-salvia-polvo' } });

    // Encuentro ambiental (25% de probabilidad, turnResolution.ts:2538) fijado a "nunca" — desde
    // que Curar se volvió determinista de verdad (2026-08-22), su texto ya NO se pisa después por
    // el override viejo, así que un encuentro ambiental real (antes silenciosamente descartado por
    // ese mismo override, efecto colateral no intencionado) ahora sí sobreviviría al log — no es lo
    // que este test comprueba, se fija el dado para que la narración quede solo con la plantilla.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    narrateAction.mockClear();
    const app = await buildApp();
    const action = 'Reviso mi inventario y me curo con lo que llevo encima.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: {
        saveId,
        action,
        classification,
        roll,
        enCombate: false,
        healItemUses: [
          { itemId: agua.id, quantity: 1 },
          { itemId: cataplasma.id, quantity: 1 },
        ],
      },
    });
    expect(narrateRes.statusCode).toBe(200);
    // Determinista de verdad (bug real, petición explícita 2026-08-22: "la habilidad genérica de
    // curar debería ser determinista no narrada") — antes SÍ se llamaba a narrateAction (Ollama)
    // para este turno y su respuesta se tiraba a la basura, pisada por la plantilla de abajo.
    expect(narrateAction).not.toHaveBeenCalled();

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.condicionFisica).toBe('HERIDO');

    // Las dos eran unidad única (sin sufijo de cantidad) — las dos filas desaparecen del todo.
    const inventoryAfter = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(inventoryAfter).toHaveLength(0);

    const logEntry = await prisma.logEntry.findFirst({ where: { saveId, channel: 'CHARACTER', isPlayerAction: false }, orderBy: { createdAt: 'desc' } });
    // "Agua hervida de liquen" también restaura energía (curaEnergia:30 en el catálogo) — la
    // narración determinista lo menciona además de la condición resultante. Prefijo exacto, no
    // texto completo (adorno de ramas deterministas, 2026-08-22): tras la frase mecánica fija se
    // añade una de varias frases de color elegidas al azar (turnResolution.ts § HEAL_FLAVOR/
    // pickFlavor).
    expect(logEntry?.text).toMatch(
      /^Gorhorn de prueba \(curar\) se cura con Agua hervida de liquen, Cataplasma de salvia del polvo — pasa a estar herido y recupera energía\. /,
    );
  });
});

// Habilidad "Comer/Beber" (2026-09-04, rediseñada por el hallazgo 13, revisar-partida-hallazgos.md
// 2026-09-06, "el consumo de agua pasa a depender de un ítem odre") — mismo patrón EXACTO que
// "Curar": camino explícito (`hambreSedItemUses`), determinista (nunca llama a narrateAction),
// consume el item real usado y persiste el nuevo lastAteAtMinutes/lastDrankAtMinutes. El viejo
// booleano `beberAgua` (fijo, sin ítem, repone Sed al 100% en cualquier sitio) se retiró — ahora
// Sed sube por `curaAgua` de ítems reales, igual que Hambre por `curaHambre`, y el odre de agua
// lleno (`curaAgua: 100`) es el único que repone al 100% de un tirón.
describe('Comer/Beber: consumo real de comida y bebida por ítem (hallazgo 13, 2026-09-06)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (comer)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
        // Muy por debajo de 100% para que la ganancia real sea observable sin llegar al tope.
        lastAteAtMinutes: 0,
        lastDrankAtMinutes: 0,
        // Rediseño 2026-09-06 (hallazgo 11) — muy por debajo del tope real (energiaMaxFor(12)=86)
        // para que la ganancia de curaEnergia al comer sea observable sin quedar tapada por el
        // recorte al máximo.
        energia: 20,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 1000 } });
    await giveMaterials(saveId, [
      { name: 'Ración de viaje', catalogSlug: 'racion-viaje' },
      { name: 'Odre de agua lleno', catalogSlug: 'odre-agua-lleno' },
    ]);
    // Mismo turno de relleno que el describe de Curar (evita acoplar este test al encuentro
    // guionizado de Gistera Koh, que se dispara siempre en el primer turno de cualquier partida).
    await prisma.logEntry.create({
      data: { saveId, channel: 'CHARACTER', text: 'Gorhorn de prueba (comer) llega a la hondonada.', isPlayerAction: true, timeLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('come una ración real y bebe del odre lleno en el mismo turno: sube Hambre/Sed, consume/devuelve items reales, narración determinista', async () => {
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'voluntad', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    narrateAction.mockClear();
    const racion = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, catalogSlug: 'racion-viaje' } });
    const odreLleno = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, catalogSlug: 'odre-agua-lleno' } });

    const app = await buildApp();
    const action = 'Como y bebo algo antes de seguir.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: {
        saveId,
        action,
        classification,
        roll,
        enCombate: false,
        hambreSedItemUses: [
          { itemId: racion.id, quantity: 1 },
          { itemId: odreLleno.id, quantity: 1 },
        ],
      },
    });
    expect(narrateRes.statusCode).toBe(200);
    const body = lastNdjsonLine(narrateRes.payload) as { hambre: number; sed: number };
    expect(narrateAction).not.toHaveBeenCalled();
    // Ración de viaje: curaHambre 28, desde 0% (lastAteAtMinutes:0, fictionalMinutes:1000, muy por
    // encima de 4 tramos de 12h → 0% real de partida) sube por encima de 0 sin llegar a saciar del
    // todo. Odre lleno: curaAgua 100, repone al 100% de un tirón.
    expect(body.hambre).toBeGreaterThan(0);
    expect(body.sed).toBe(100);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    const worldStateAfter = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    // El odre lleno repone al 100% de un tirón: el nuevo lastDrankAtMinutes queda exactamente en
    // el minuto de ficción de ESTE turno (ver lastAtMinutesForGanancia/fictionalMinutesParaComerBeber).
    expect(saveAfter.lastDrankAtMinutes).toBe(worldStateAfter.fictionalMinutes);
    expect(saveAfter.lastAteAtMinutes).not.toBe(0);
    // Rediseño 2026-09-06 (hallazgo 11) — Comer/Beber ahora también repone energía real de
    // catálogo (racion-viaje: curaEnergia 20), no solo Hambre/Sed. Energía inicial 20 + 20 = 40,
    // muy por debajo del tope real (energiaMaxFor(12)=86) — la ganancia es genuina, no un recorte.
    expect(saveAfter.energia).toBe(40);

    // Hallazgo 13 — la ración (unidad única) desaparece del todo, pero el odre lleno se sustituye
    // por el odre VACÍO (emptyContainerCatalogSlug), no desaparece sin más.
    const inventoryAfter = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(inventoryAfter).toHaveLength(1);
    expect(inventoryAfter[0].catalogSlug).toBe('odre-agua');
    expect(inventoryAfter[0].name).toBe('Odre de agua');

    const logEntry = await prisma.logEntry.findFirst({ where: { saveId, channel: 'CHARACTER', isPlayerAction: false }, orderBy: { createdAt: 'desc' } });
    expect(logEntry?.text).toMatch(/^Gorhorn de prueba \(comer\) usa Ración de viaje, Odre de agua lleno\. /);
  });
});

// QA-27 P39 (2026-10-12): en un punto de agua real (los manaderos) se bebe sin odre, hasta saciarse,
// con narración determinista y sin tocar el inventario.
describe('Beber de la fuente sin odre (QA-27 P39)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const manaderos = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'manaderos', saveId: null } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (fuente)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: manaderos.id,
        lastAteAtMinutes: 0,
        lastDrankAtMinutes: 0,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 1000 } });
    await prisma.logEntry.create({
      data: { saveId, channel: 'CHARACTER', text: 'Gorhorn de prueba (fuente) llega a los manaderos.', isPlayerAction: true, timeLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('bebe del manantial sin llevar nada: Sed al 100 % y narración determinista', async () => {
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'voluntad', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    narrateAction.mockClear();

    const app = await buildApp();
    const action = 'Bebo agua del manantial hasta saciarme.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: false },
    });
    expect(narrateRes.statusCode).toBe(200);
    const body = lastNdjsonLine(narrateRes.payload) as { sed: number };
    expect(narrateAction).not.toHaveBeenCalled();
    expect(body.sed).toBe(100);
    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    const worldStateAfter = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    expect(saveAfter.lastDrankAtMinutes).toBe(worldStateAfter.fictionalMinutes);
    const logEntry = await prisma.logEntry.findFirst({ where: { saveId, channel: 'CHARACTER', isPlayerAction: false }, orderBy: { createdAt: 'desc' } });
    expect(logEntry?.text).toMatch(/^Gorhorn de prueba \(fuente\) se agacha junto al agua y bebe hasta saciarse\. /);
  });
});

// Petición explícita de la usuaria (2026-08-21, jugando en vivo): "la primera vez que se abre el
// combate y al recargar la página se está perdiendo el mensaje de la iniciativa y la tirada de los
// dados" — mismo bug gemelo que `combatExchange`/`npcAbilityUsed` (LogEntry, 2026-08-13/14): la
// tirada de iniciativa para el próximo intercambio se calculaba pero solo viajaba en la respuesta
// HTTP del turno, nunca se guardaba.
describe('LogEntry.initiativeRoll sobrevive a una recarga tras un intercambio de combate (bug real 2026-08-21)', () => {
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    // Mismo criterio que el describe de arriba: dados pinchados al máximo para que cualquier
    // intercambio resuelva de verdad (golpes_mutuos), garantizando que se calcule la iniciativa
    // del próximo intercambio.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    npcId = npc.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (iniciativa persistida)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el intercambio de combate persiste initiativeRoll en el LogEntry, no solo en la respuesta HTTP del turno', async () => {
    const app = await buildApp();
    const action = "Descargo un golpe directo con todo el peso de mi arma detrás 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll, enCombate: true } });
    expect(narrateRes.statusCode).toBe(200);

    const state = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    // Confirma que de verdad hubo un intercambio mecánico real este turno (no solo narración) —
    // sin esto, `initiativeRoll` estaría null por diseño (no hay "próximo intercambio" que decidir).
    expect(state).not.toBeNull();

    const logEntry = await prisma.logEntry.findFirst({ where: { saveId, channel: 'CHARACTER', combate: true }, orderBy: { createdAt: 'desc' } });
    // Enriquecido (2026-09-04, centralización de todas las tiradas del juego) — antes
    // {ganador, jugadorTirada, npcTirada} (números planos); ahora cada lado es un
    // ExchangeSideResult completo (roll/malus/attributeBonus/etc.), ver combatExchange.ts § rollInitiative.
    expect(logEntry?.initiativeRoll).toMatchObject({
      ganador: expect.stringMatching(/^(jugador|npc)$/),
      jugador: { roll: expect.any(Number), result: expect.any(Number) },
      npc: { roll: expect.any(Number), result: expect.any(Number) },
    });
  }, 15_000);

  // Bug real jugando en vivo (2026-09-04, captura real: el Orco Enfurecido ya GRAVE seguía
  // mostrando el malus de HERIDO, -2, en vez del de GRAVE, -5, en la tirada de iniciativa del
  // siguiente intercambio) — `resolveCombatExchangePhase` (turnResolution.ts) usaba la condición
  // física de ANTES de este mismo golpe (parámetros de entrada) al calcular
  // `rollInitiative`/`rollAttributeCheck`, en vez de la condición YA actualizada por el golpe que
  // acaba de resolverse en este intercambio.
  it('el malus de condición física en initiativeRoll refleja el golpe de ESTE intercambio, no la condición de antes de recibirlo (bug real 2026-09-04)', async () => {
    const app = await buildApp();
    const action = "Descargo un golpe directo con todo el peso de mi arma detrás 'Orco enfurecido'.";

    let npcMalusEnIniciativa: number | undefined;
    for (let turno = 0; turno < 4; turno++) {
      const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
      const { classification, roll } = classifyRes.json();
      const narrateRes = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll, enCombate: true } });
      expect(narrateRes.statusCode).toBe(200);

      const state = await prisma.npcState.findFirst({ where: { saveId, npcId } });
      if (state?.condicionFisica === 'GRAVE') {
        const logEntry = await prisma.logEntry.findFirst({ where: { saveId, channel: 'CHARACTER', combate: true }, orderBy: { createdAt: 'desc' } });
        const initiativeRoll = logEntry?.initiativeRoll as { npc: { malus?: number } } | null;
        npcMalusEnIniciativa = initiativeRoll?.npc.malus;
        break;
      }
    }

    // GRAVE resta 5 (CONDICION_MALUS, death.ts) — no 2 (el de HERIDO, la condición de ANTES de
    // este mismo golpe). Si el fix se rompe, este assert vuelve a fallar con `2`.
    expect(npcMalusEnIniciativa).toBe(5);
  }, 15_000);
});

// Petición explícita de la usuaria (2026-08-22, "¿entonces el primer turno siempre empiezo
// atacando yo?"): confirmado que sí, hasta ahora — sin `pendingNpcAttack` previo el primer
// intercambio de cualquier combate nuevo entraba SIEMPRE por el CASO ATAQUE del jugador, aunque
// `ambushHint` (narrador.ts) hubiera narrado "el NPC te sorprende a ti" en el turno de apertura
// (con `enCombate:false` todavía, sin ningún efecto mecánico real). Ahora un `gradoExito:'fallo'`
// en ESE turno siembra un `pendingNpcAttack` de verdad, para que el primer intercambio dentro del
// panel llegue como defensa a ciegas — coherente con lo que la narración ya decía.
describe('Emboscada real del turno de apertura: fallo siembra pendingNpcAttack (petición explícita, 2026-08-22)', () => {
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    // Peor tirada posible siempre (roll=1) — garantiza gradoExito:'fallo' en el turno de apertura
    // sea cual sea el atributo/dificultad tabulados para un ataque directo.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    npcId = npc.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (emboscada real)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('turno de apertura con fallo → pendingNpcAttack real; el siguiente intercambio llega como defensa a ciegas, no como ataque propio', async () => {
    const app = await buildApp();

    // Turno A: abre combate, todavía enCombate:false — fuera de combate la tabla solo salta
    // classifyAction/Ollama para intención HOSTIL declarada (detectsHostileSearchIntent), no para
    // un verbo de ataque directo (detectsAttackIntent, solo válido con enCombate:true ya puesto —
    // ver turn.ts § tabulatedTarget, línea ~247).
    const openingAction = "Voy a luchar contra 'Orco enfurecido'.";
    const classifyOpen = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: openingAction, enCombate: false } });
    const { classification: classificationOpen, roll: rollOpen } = classifyOpen.json();
    expect(rollOpen.gradoExito).toBe('fallo');
    const narrateOpen = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: openingAction, classification: classificationOpen, roll: rollOpen, enCombate: false },
    });
    expect(narrateOpen.statusCode).toBe(200);
    expect(lastNdjsonLine(narrateOpen.payload).esperandoDefensaJugador).toBe(true);

    const saveAfterOpening = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfterOpening.pendingNpcAttack).toMatchObject({ npcId });
    // El turno de apertura no toca condición ni HP — solo decide QUIÉN actúa primero después.
    expect(await prisma.npcState.findFirst({ where: { saveId, npcId } })).toBeNull();

    // Bug real jugando en vivo (2026-08-28, confirmado por la usuaria): el bloque de texto de
    // iniciativa no salía en la ronda de apertura de combate, solo en las siguientes — causa raíz
    // era que este camino nunca calculaba `nextInitiativeRoll` (solo sembraba `pendingNpcAttack`),
    // así que el `LogEntry` de apertura quedaba sin `initiativeRoll` que mostrar. Confirma que el
    // fix lo calcula también aquí, con la misma forma que cualquier otro intercambio real.
    const openingLogEntry = await prisma.logEntry.findFirst({ where: { saveId, channel: 'CHARACTER' }, orderBy: { createdAt: 'desc' } });
    expect(openingLogEntry?.initiativeRoll).toMatchObject({
      ganador: expect.stringMatching(/^(jugador|npc)$/),
      jugador: { roll: expect.any(Number), result: expect.any(Number) },
      npc: { roll: expect.any(Number), result: expect.any(Number) },
    });

    // Turno B: ya dentro del panel, enCombate:true — cualquier acción del jugador aquí es su
    // defensa a ciegas contra el ataque ya decidido, no su propio golpe.
    classifyAction.mockResolvedValueOnce({
      requiereTirada: true,
      atributo: 'destreza',
      dificultad: 15,
      razon: 'x',
      banda: 'instantanea',
      duracionEstimadaMinutos: 0,
    });
    // Cita expresa del NPC (mismo criterio que el resto de este archivo, p.ej. el describe de
    // "iniciativa persistida" arriba) — no depende de que la detección de escena arrastre sola al
    // orco de un turno a otro, que es un mecanismo aparte no relacionado con lo que este test
    // comprueba.
    const defenseAction = "Me cubro con el escudo frente a 'Orco enfurecido'.";
    const classifyDefense = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: defenseAction, enCombate: true } });
    const { classification: classificationDefense, roll: rollDefense } = classifyDefense.json();
    const narrateDefense = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: defenseAction, classification: classificationDefense, roll: rollDefense, enCombate: true },
    });
    expect(narrateDefense.statusCode).toBe(200);
    expect((lastNdjsonLine(narrateDefense.payload).combatExchangeDisplay as { atacanteEsJugador?: boolean } | null)?.atacanteEsJugador).toBe(false);
  }, 20_000);
});

// Hallazgo 14 (revisar-partida-hallazgos.md 2026-09-06, "la primera tirada de iniciativa de un
// combate debe ser tirada del jugador vs tirada del enemigo, no una comparación contra una
// dificultad fija") — hasta este fix, un ataque de apertura CON ÉXITO garantizaba la iniciativa
// al jugador sin ninguna tirada real (sin pendingNpcAttack sembrado, el intercambio siguiente
// caía directo en CASO ATAQUE). Este test cubre justo el caso que faltaba: apertura con ÉXITO
// donde el NPC gana la tirada de iniciativa real — el intercambio siguiente debe entrar en CASO
// DEFENSA, no en CASO ATAQUE, pese a que el jugador fue quien "atacó" primero en el texto.
describe('Apertura con éxito: el NPC puede ganar la iniciativa real (hallazgo 14, 2026-09-07)', () => {
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    npcId = npc.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (apertura NPC gana iniciativa)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('turno de apertura con éxito pero el NPC gana rollInitiative → pendingNpcAttack real; el siguiente intercambio llega como defensa a ciegas', async () => {
    // Mejor tirada posible para el ataque de apertura (roll=20) — garantiza gradoExito distinto de
    // 'fallo' contra la dificultad fija por nivel del atajo tabulado, sea cual sea el atributo.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const app = await buildApp();

    const openingAction = "Voy a luchar contra 'Orco enfurecido'.";
    const classifyOpen = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: openingAction, enCombate: false } });
    const { classification: classificationOpen, roll: rollOpen } = classifyOpen.json();
    expect(rollOpen.gradoExito).not.toBe('fallo');

    // rollInitiative (combatExchange.ts) llama rollAttributeCheck del jugador PRIMERO, del NPC
    // DESPUÉS — roll bajo para el jugador (destreza 10, ATTRS) y roll alto para el Orco
    // (destreza 4, worldCatalog.ts) fuerza al NPC a ganar el contraste pese a su atributo menor.
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.99);
    const narrateOpen = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: openingAction, classification: classificationOpen, roll: rollOpen, enCombate: false },
    });
    expect(narrateOpen.statusCode).toBe(200);
    expect(lastNdjsonLine(narrateOpen.payload).esperandoDefensaJugador).toBe(true);

    const saveAfterOpening = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfterOpening.pendingNpcAttack).toMatchObject({ npcId });
    // El turno de apertura no toca condición ni HP — solo decide QUIÉN actúa primero después.
    expect(await prisma.npcState.findFirst({ where: { saveId, npcId } })).toBeNull();

    const openingLogEntry = await prisma.logEntry.findFirst({ where: { saveId, channel: 'CHARACTER' }, orderBy: { createdAt: 'desc' } });
    expect(openingLogEntry?.initiativeRoll).toMatchObject({
      ganador: 'npc',
      jugador: { roll: expect.any(Number), result: expect.any(Number) },
      npc: { roll: expect.any(Number), result: expect.any(Number) },
    });

    // Turno B: ya dentro del panel, enCombate:true — el jugador se defiende a ciegas del ataque ya
    // decidido, no ejecuta su propio golpe, pese a haber sido él quien "atacó" en el texto de apertura.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    classifyAction.mockResolvedValueOnce({
      requiereTirada: true,
      atributo: 'destreza',
      dificultad: 15,
      razon: 'x',
      banda: 'instantanea',
      duracionEstimadaMinutos: 0,
    });
    const defenseAction = "Me cubro con el escudo frente a 'Orco enfurecido'.";
    const classifyDefense = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: defenseAction, enCombate: true } });
    const { classification: classificationDefense, roll: rollDefense } = classifyDefense.json();
    const narrateDefense = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: defenseAction, classification: classificationDefense, roll: rollDefense, enCombate: true },
    });
    expect(narrateDefense.statusCode).toBe(200);
    expect((lastNdjsonLine(narrateDefense.payload).combatExchangeDisplay as { atacanteEsJugador?: boolean } | null)?.atacanteEsJugador).toBe(false);
  }, 20_000);

  it('turno de apertura con éxito y el JUGADOR gana rollInitiative → sin pendingNpcAttack, CASO ATAQUE de siempre', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const app = await buildApp();

    const openingAction = "Ataco sin dudarlo a 'Orco enfurecido'.";
    const classifyOpen = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: openingAction, enCombate: false } });
    const { classification: classificationOpen, roll: rollOpen } = classifyOpen.json();
    expect(rollOpen.gradoExito).not.toBe('fallo');

    // Roll alto para el jugador, roll bajo para el NPC — el jugador (destreza 10) gana con
    // margen sobre el Orco (destreza 4) sin depender de empate.
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0);
    const narrateOpen = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: openingAction, classification: classificationOpen, roll: rollOpen, enCombate: false },
    });
    expect(narrateOpen.statusCode).toBe(200);
    // Sin pendingNpcAttack sembrado — el turno de apertura no bloquea al jugador con una defensa
    // a ciegas, sigue pudiendo atacar directamente en el siguiente turno.
    const saveAfterOpening = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfterOpening.pendingNpcAttack).toBeNull();

    const openingLogEntry = await prisma.logEntry.findFirst({ where: { saveId, channel: 'CHARACTER' }, orderBy: { createdAt: 'desc' } });
    expect(openingLogEntry?.initiativeRoll).toMatchObject({ ganador: 'jugador' });
  }, 20_000);
});

// Hallazgo 17 (revisar-partida-hallazgos.md 2026-09-07, "la narración indica que Gorhorn huye del
// combate, pero el combate se abre igualmente" — caso real del Ruptidar, INOFENSIVO): un ataque de
// APERTURA que FALLA contra fauna no agresiva (INOFENSIVO/CAUTELOSO) no debe abrir el panel de
// combate — la presa escapa de verdad. Si el ataque ACIERTA, sigue abriendo combate con normalidad.
describe('Ataque de apertura fallido contra fauna no agresiva no abre combate (hallazgo 17, 2026-09-07)', () => {
  let saveId: string;
  let ruptidarId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const ruptidar = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'ruptidar' } });
    ruptidarId = ruptidar.id;
    expect(ruptidar.temperamento).toBe('INOFENSIVO');
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (hallazgo 17)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('ataque de apertura que FALLA contra el Ruptidar (INOFENSIVO) no abre combate — la presa escapa', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId: ruptidarId } });
    const worldId = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).worldId;
    const hondonadaId = (await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } })).id;
    await prisma.npcState.create({ data: { saveId, npcId: ruptidarId, scope: hondonadaId, condicionFisica: 'ILESO' } });
    // `detectsAttackIntent` (ataque directo) no tiene atajo tabulado fuera de combate en
    // turn.ts (ese solo cubre detectsHostileSearchIntent) — cae a classifyAction, mockeada aquí
    // para simular lo que el LLM real haría ante un ataque directo. `dificultad` propuesta aquí
    // se SOBREESCRIBE por `utilityDifficultyFor` (hallazgo 12, turn.ts) al haber un NPC en
    // escena — con el Ruptidar (suma de atributos muy baja) sale igualmente muy baja (6, Fácil).
    // `atributo:'magia'` (ATTRS del jugador de prueba: magia 4, la más baja) fuerza que incluso
    // esa dificultad mínima falle con la peor tirada posible: result = roll(1) + floor(4/2) = 3 < 6.
    // `mockReset` + `mockResolvedValueOnce` — `classifyAction` es un `vi.fn()` de módulo
    // (`vi.restoreAllMocks()` no lo resetea) que puede llegar con implementaciones/colas
    // residuales de describes anteriores del mismo archivo; se limpia explícitamente aquí para
    // no depender del orden global de ejecución de la suite.
    classifyAction.mockReset();
    classifyAction.mockResolvedValueOnce({
      requiereTirada: true, atributo: 'magia', dificultad: 15, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    // Peor tirada posible (roll=1) — garantiza gradoExito:'fallo' vía rollCheck (turn.ts).
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const app = await buildApp();

    const openingAction = "Golpeo con mi hacha a 'Ruptidar'.";
    const classifyOpen = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: openingAction, enCombate: false } });
    const { classification: classificationOpen, roll: rollOpen } = classifyOpen.json();
    expect(rollOpen.gradoExito).toBe('fallo');

    const narrateOpen = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: openingAction, classification: classificationOpen, roll: rollOpen, enCombate: false },
    });
    expect(narrateOpen.statusCode).toBe(200);
    // Ni combateIniciado ni esperandoDefensaJugador — la presa escapa, sin panel de combate.
    const body = lastNdjsonLine(narrateOpen.payload) as { combateIniciado: { npcs: { slug: string }[] } | null; esperandoDefensaJugador: boolean };
    expect(body.combateIniciado).toBeNull();
    expect(body.esperandoDefensaJugador).toBe(false);

    const saveAfterOpening = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfterOpening.pendingNpcAttack).toBeNull();
    expect((saveAfterOpening.pendingCombatNpcSlugs as string[] | null) ?? []).not.toContain('ruptidar');
  }, 20_000);

  it('ataque de apertura que ACIERTA contra el Ruptidar (INOFENSIVO) SÍ abre combate con normalidad', async () => {
    await prisma.npcState.deleteMany({ where: { saveId, npcId: ruptidarId } });
    const worldId = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).worldId;
    const hondonadaId = (await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } })).id;
    await prisma.npcState.create({ data: { saveId, npcId: ruptidarId, scope: hondonadaId, condicionFisica: 'ILESO' } });
    await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [] } });
    classifyAction.mockReset();
    classifyAction.mockResolvedValueOnce({
      requiereTirada: true, atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    // Mejor tirada posible (roll=20) — garantiza gradoExito distinto de 'fallo'.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const app = await buildApp();

    const openingAction = "Golpeo con mi hacha a 'Ruptidar'.";
    const classifyOpen = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: openingAction, enCombate: false } });
    const { classification: classificationOpen, roll: rollOpen } = classifyOpen.json();
    expect(rollOpen.gradoExito).not.toBe('fallo');

    const narrateOpen = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: openingAction, classification: classificationOpen, roll: rollOpen, enCombate: false },
    });
    expect(narrateOpen.statusCode).toBe(200);
    // Fauna inofensiva SÍ es cazable si el ataque conecta — combate se abre con normalidad.
    const body = lastNdjsonLine(narrateOpen.payload) as { combateIniciado: { npcs: { slug: string }[] } | null };
    expect(body.combateIniciado?.npcs?.some((n) => n.slug === 'ruptidar')).toBe(true);
  }, 20_000);
});

// Bug real jugando en vivo (2026-08-28/29): recargar la página mientras el enemigo tiene la
// iniciativa ("elige a ciegas cómo defenderte") rompía la resolución del turno — el jugador veía
// el panel de ATAQUE en vez de DEFENSA tras F5, elegía con el catálogo equivocado (atributo de
// ataque en vez de defensa) y perdía el intercambio contra la Destreza real del NPC. Causa raíz:
// `Save.pendingNpcAttack` ya persistía bien, pero `GET /saves/:id` nunca lo exponía, así que el
// frontend no podía rehidratar `combatAwaitingDefense` tras una recarga. Ver
// docs/registros/checklist-pruebas-juego.md § 1 para el diagnóstico completo.
describe('GET /saves/:id expone esperandoDefensaJugador (fix del bug de recarga en defensa a ciegas, 2026-08-29)', () => {
  let saveId: string;
  let npcId: string;

  // `buildApp()` (arriba en este archivo) solo registra `turnRoutes` — `GET /saves/:id` vive en
  // `detailRoutes`, que aquí hace falta también para simular la recarga real de página.
  async function buildAppWithDetail() {
    const app = Fastify();
    await app.register(turnRoutes);
    await app.register(detailRoutes);
    return app;
  }

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    npcId = npc.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (esperandoDefensaJugador en GET)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin pendingNpcAttack, GET /saves/:id devuelve esperandoDefensaJugador:false', async () => {
    const app = await buildAppWithDetail();
    const getRes = await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().esperandoDefensaJugador).toBe(false);
  });

  it('tras sembrar pendingNpcAttack, GET /saves/:id devuelve esperandoDefensaJugador:true — no solo la respuesta directa del turno', async () => {
    const app = await buildAppWithDetail();

    // Mismo turno de apertura que el describe anterior — un fallo del jugador siembra
    // `pendingNpcAttack` real en Postgres, simulando "el enemigo tiene la iniciativa".
    const openingAction = "Voy a luchar contra 'Orco enfurecido'.";
    const classifyOpen = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: openingAction, enCombate: false } });
    const { classification: classificationOpen, roll: rollOpen } = classifyOpen.json();
    const narrateOpen = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: openingAction, classification: classificationOpen, roll: rollOpen, enCombate: false },
    });
    expect(narrateOpen.statusCode).toBe(200);

    const saveAfterOpening = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfterOpening.pendingNpcAttack).toMatchObject({ npcId });

    // Esto es lo que reproduce el bug: NO seguimos la respuesta directa del turno — simulamos una
    // recarga de página pidiendo el estado de la partida desde cero, tal como hace `syncFromSave`.
    const getRes = await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().esperandoDefensaJugador).toBe(true);
  }, 15_000);
});

// Combate "fantasma" tras huir/viajar (BUG REAL confirmado 2 veces en vivo, mitigado parcialmente
// 2026-08-28, causa exacta sin aislar hasta ahora — ver docs/registros/checklist-pruebas-juego.md).
// Investigación 2026-08-29: `detectNpcsInScene` (npcScene.ts) trata a un NPC "ya establecido en
// esta partida" (tiene `NpcState` propio) como candidato SIEMPRE, sin importar la región actual
// (`encounteredIds.has(npc.id)` gana sobre el filtro geográfico) — comportamiento INTENCIONAL, ya
// cubierto por su propio test explícito ("un NPC ya establecido... sigue siendo candidato aunque
// cambie de región", npcScene.test.ts). Combinado con el matching fuzzy de alias (mismo mecanismo
// que ya causó el bug histórico "res" dentro de "presas"/"interesante", Levenshtein 2), un NPC
// agresivo (`effectiveTemperamento`, sin ningún estado de "se calmó tras huir" para fauna sin
// facción) puede volver a colarse en `npcsInSceneVivos` y disparar `shouldForceCombat` de nuevo
// en CUALQUIER región, con solo que la acción del turno o los `sessionFacts` recientes contengan
// una palabra parecida a su nombre/alias — reproducido aquí de forma aislada y determinista.
describe('Combate "fantasma": un NPC agresivo puede volver a forzar combate tras huir Y cambiar de región (investigación 2026-08-29)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const otraRegion = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'trepaderes-humededos' } });
    expect(otraRegion.region).not.toBe(hondonada.region);

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (combate fantasma)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });

    // Ya se conoció a Kirelon Arenoso antes en esta partida (NpcState real) — mismo estado que
    // deja un encuentro/huida anterior, sin condición física especial (vivo, de paso).
    const kirelon = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'kirelon-arenoso' } });
    await prisma.npcState.create({ data: { saveId, npcId: kirelon.id, scope: hondonada.id, condicionFisica: 'ILESO' } });

    // Huyó con éxito: sin combate pendiente, y YA viajó a una región completamente distinta.
    await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [], currentLocationId: otraRegion.id } });

    // Lo que el LLM real narraría tras una huida exitosa — mencionar al agresor por nombre es
    // natural en la narración de cierre ("consigues escapar de X"), y ese hecho queda en
    // `sessionFacts` para turnos futuros (`appendSessionFacts`, ventana rodante MAX_FACTS=10).
    await prisma.$executeRaw`
      INSERT INTO "SessionFact" (id, "saveId", text, embedding, "createdAt")
      VALUES (${crypto.randomUUID()}, ${saveId}, 'Gorhorn logra escapar de Kirelon Arenoso en La Hondonada del Eco, dejándolo atrás.', NULL, ${new Date()})
    `;

    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('una acción neutral en OTRA región, sin nombrar al NPC, no debería reabrir combate contra él solo por matching fuzzy de alias', async () => {
    const app = await buildApp();
    // "presas" matchea por Levenshtein-2 con el alias "kirelon" tan poco como con "brasas" en el
    // bug histórico — el objetivo real de este turno es descansar/explorar, sin ninguna intención
    // hostil ni mención real a Kirelon.
    const classifyRes = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId, action: 'Busco un buen sitio para descansar y curar mis heridas.', enCombate: false },
    });
    const { classification, roll } = classifyRes.json();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action: 'Busco un buen sitio para descansar y curar mis heridas.', classification, roll, enCombate: false },
    });
    expect(res.statusCode).toBe(200);
    const body = lastNdjsonLine(res.payload);
    expect(body.combateIniciado).toBeNull();
  }, 20_000);
});

describe('Turno "fantasma": conexión cortada a media narración (bug real jugando en vivo, prueba con Playwright, 2026-08-27)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (turno fantasma)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'Recuperar el honor de los Maktor',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('si reply.raw.write() lanza como al escribir en un socket ya cerrado, el turno se persiste igual (backend/src/routes/turn.ts, writeLine sin try/catch propio — bug real jugando en vivo: cerrar el navegador a media narración dejó 2 turnos sin resolver nunca, solo con la acción del jugador registrada)', async () => {
    const app = await buildApp();
    // Parchea `reply.raw.write` para lanzar en su primera llamada, exactamente donde `writeLine`
    // (turn.ts) escribiría el primer evento NDJSON ('chunk') — reproduce sin sockets TCP reales lo
    // que EPIPE/ECONNRESET haría si el cliente ya cortó la conexión mientras el turno narraba.
    app.addHook('onRequest', async (request, reply) => {
      if (request.url !== '/turn/narrate') return;
      const originalWrite = reply.raw.write.bind(reply.raw);
      let thrown = false;
      reply.raw.write = ((...args: Parameters<typeof originalWrite>) => {
        if (!thrown) {
          thrown = true;
          throw new Error('write EPIPE (simulado — socket ya cerrado por el cliente)');
        }
        return originalWrite(...args);
      }) as typeof reply.raw.write;
    });

    const action = 'Miro a mi alrededor.';

    classifyAction.mockResolvedValueOnce({
      requiereTirada: false,
      atributo: null,
      dificultad: null,
      razon: 'x',
      banda: 'corta',
      duracionEstimadaMinutos: 10,
    });
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();

    narrateAction.mockImplementationOnce(async (ctx: { onNarrationChunk?: (d: string) => void }) => {
      ctx.onNarrationChunk?.('Algo se mueve entre las dunas.');
      return { narration: 'Algo se mueve entre las dunas.', newFacts: [] };
    });

    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: false },
    });

    // El turno DEBE persistirse en characterLog aunque el streaming al cliente falle — el
    // resultado ya está decidido (Ollama respondió, la mecánica ya se resolvió), lo único que
    // falla es AVISAR a un cliente que ya no está escuchando. Si esta aserción falla, confirma el
    // bug: el turno queda "fantasma" — la acción del jugador queda registrada pero la narración de
    // resultado nunca llega a guardarse, y el jugador tiene que reintentar con otra acción distinta
    // para que el juego vuelva a avanzar.
    const lastEntry = await prisma.logEntry.findFirst({
      where: { saveId, channel: 'CHARACTER', isPlayerAction: false },
      orderBy: { createdAt: 'desc' },
    });
    expect(lastEntry?.text).toContain('Algo se mueve entre las dunas.');

    void narrateRes; // el código de estado de esta respuesta concreta no es lo que se está probando aquí
  }, 20_000);
});

// Bug real de integridad de estado (auditoría 2026-09-01, jugando en vivo — "nuente" enganchado en
// pendingCombatNpcSlugs sin haber sido nunca CombatParticipant de ningún CombatEncounter): el
// último fallback de `forcedCombatSlugs` (turnResolution.ts, cuando `explicitTarget` está vacío Y
// `agresivoSlugsInScene` está vacío) usaba `npcsInSceneVivos` SIN filtrar — cualquier NPC
// AMIGABLE/INOFENSIVO/CAUTELOSO presente en la misma escena que un agresor real (o que disparó
// `shouldForceCombat` por otra vía, como una bajada de condición) se arrastraba al array de
// combate junto con él, huérfano para siempre en cuanto el CombatEncounter real solo enganchaba al
// agresor de verdad. Fix: `npcsInSceneHostilesCandidatos` filtra por temperamento efectivo antes
// de usarse como fallback.
describe('pendingCombatNpcSlugs no arrastra a un NPC pacífico "de paso" cuando se fuerza combate contra otro (bug real 2026-09-01)', () => {
  let saveId: string;
  let orcoId: string;
  let torgashId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (fallback no arrastra pacífico)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    const orco = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    // Slug corregido 2026-09-02 (dato huérfano encontrado y limpiado en esta misma sesión, ver
    // memoria "restos huérfanos por renombrado de slug"): `slug: 'torgash'` era una fila
    // duplicada, ya retirada de worldCatalog.ts, que quedó viva en Postgres desde que el NPC se
    // renombró a `torgash-ketg` — este test dependía por accidente de ese dato no versionado en
    // vez del catálogo fuente real. `torgash-ketg` (Torgash Ketg - Kort'ikar Clan Serhu) es el
    // NPC real y vigente.
    const torgash = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'torgash-ketg' } });
    orcoId = orco.id;
    torgashId = torgash.id;
    // Mismo atajo que "Slots de compañero" más arriba: NpcState con scope '' hace que
    // `detectNpcsInScene` los detecte siempre, sin depender de que el texto de la acción los
    // mencione por alias — así el escenario es determinista, no depende del fuzzy-matching
    // concreto que causó el bug real ("cuenta"~"nuente"). `saveId` propio de este describe, sin
    // relación con los demás tests del archivo que también usan a Orco Enfurecido.
    await prisma.npcState.create({ data: { saveId, npcId: orcoId, scope: '', condicionFisica: 'ILESO' } });
    await prisma.npcState.create({ data: { saveId, npcId: torgashId, scope: '', condicionFisica: 'ILESO' } });
    classifyAction.mockResolvedValue({
      requiereTirada: true, atributo: 'fuerza', dificultad: 12, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un ataque sin nombrar a nadie entre comillas solo engancha al agresivo real, nunca al CAUTELOSO de paso', async () => {
    narrateAction.mockResolvedValueOnce({
      narration: 'Gorhorn ataca a ciegas contra la amenaza más cercana.',
      newFacts: [],
    });
    const app = await buildApp();
    // Sin comillas (sin explicitTarget, así que no se cita a nadie en concreto — fuerza el camino
    // del fallback) pero nombrando a ambos SIN comillas (detectNpcsInScene exige que
    // matchNpcAliases los encuentre en el texto, aunque ya tengan NpcState) — mismo patrón que la
    // narración real del bug ("Un Canizor Aullador Rojo se acerca...", los dos nombrados a la vez
    // en prosa, sin que el jugador cite a ninguno entre comillas). agresivoSlugsInScene SÍ detecta
    // al Orco Enfurecido (temperamento AGRESIVO real de catálogo).
    const action = 'Ataco sin dudarlo, con el hacha en alto, mientras el Orco Enfurecido y Torgash Ketg me observan.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: false },
    });
    expect(narrateRes.statusCode).toBe(200);

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingCombatNpcSlugs).toEqual(['orco-enfurecido-hondonada']);
    expect(saveAfter.pendingCombatNpcSlugs).not.toContain('torgash-ketg');
  }, 15_000);
});

// Consolidación (auditoría 2026-09-01, "EXPULSAR estructuralmente inalcanzable, no existe ningún
// escudo en el mundo"): confirma el flujo real completo desde el turno del jugador — con
// "Escudo de torre goirntes" ya sembrado en el catálogo (worldCatalog.ts) y equipado de verdad, el
// guard `detectsUnequippedWeaponClaim` (playerActionValidation.ts, invocado desde turn.ts) ya no
// bloquea una acción que nombra "escudo" — antes de este ítem, CUALQUIER jugador que lo nombrara
// era rechazado con "Gorhorn baja la vista a sus manos... no lo que acaba de nombrar", sin importar
// su clase/nivel, porque ningún ítem tipoArma:'ESCUDO' existía para equipar. El mecanismo EXPULSAR
// en sí (materializar expulsadoPorRondas en combate) ya tiene cobertura de integración completa en
// combateMultipleOrquestacion.integration.test.ts — este test cubre solo el hueco real que faltaba:
// el guard de coherencia de arma del turno normal (fuera de combate múltiple).
describe('EXPULSAR: el guard de arma no bloquea una acción que nombra "escudo" con un escudo real equipado', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (escudo real)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.inventoryItem.create({ data: { saveId, name: 'Hacha de guerra rota', description: 'x', slot: 'ARMA_PRINCIPAL' } });
    await prisma.inventoryItem.create({ data: { saveId, name: 'Escudo de torre goirntes', description: 'x', slot: 'ARMA_SECUNDARIA' } });
    classifyAction.mockResolvedValue({
      requiereTirada: true, atributo: 'constitucion', dificultad: 12, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockResolvedValue({ narration: 'Narración de prueba.', newFacts: [] });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('una acción que nombra "escudo" con el escudo real equipado llega a narrarse, sin el rechazo de arma incoherente', async () => {
    const app = await buildApp();
    const action = 'Cargo mi escudo con todo mi peso y golpeo, buscando apartar a mi rival del combate.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: false },
    });
    expect(narrateRes.statusCode).toBe(200);
    const done = lastNdjsonLine(narrateRes.payload);
    // Si el guard hubiera disparado, `blocked.narration` contendría "baja la vista a sus manos" —
    // confirmamos justo lo contrario: el turno llega a narrarse con normalidad.
    expect(done.blocked).toBeUndefined();
  }, 15_000);
});

// Hallazgo real jugando en vivo (2026-09-15): "Intento capturar al Orco Enfurecido convaleciente,
// atándolo" se narró con éxito ("le ata las muñecas con un trozo de cuero curado") sin cuerdas
// reales en el inventario — el botón dedicado "Capturar en la zona" (companeros.ts) sí las exige.
// `detectsBindingWithoutRopesClaim` (playerActionValidation.ts, invocado desde turn.ts) cierra ese
// hueco: bloquea determinista ANTES de llegar a narrar, sin gastar generación.
describe('Atar/inmovilizar sin cuerdas: el guard determinista bloquea ANTES de narrar', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (atar sin cuerdas)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    classifyAction.mockResolvedValue({
      requiereTirada: true, atributo: 'destreza', dificultad: 6, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockResolvedValue({ narration: 'Narración de prueba.', newFacts: [] });
  });

  afterAll(async () => {
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin cuerdas en el inventario: bloquea determinista en /turn/classify, nunca llega a narrateAction', async () => {
    narrateAction.mockClear();
    const app = await buildApp();
    const action = 'Ato al Orco Enfurecido caído, atándolo con fuerza para que no escape.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    expect(classifyRes.statusCode).toBe(200);
    const body = classifyRes.json();
    expect(body.blocked).toBeDefined();
    expect(body.blocked.narration).toMatch(/cuerda|atar|inmoviliz|ato\b/i);
    expect(narrateAction).not.toHaveBeenCalled();

    const logEntries = await prisma.logEntry.findMany({ where: { saveId }, orderBy: { createdAt: 'asc' } });
    expect(logEntries.some((e) => e.text === action)).toBe(true);
    expect(logEntries.some((e) => e.text === body.blocked.narration)).toBe(true);
  }, 15_000);

  it('CON cuerdas reales en el inventario: el guard no dispara, /turn/classify devuelve classification normal', async () => {
    await prisma.inventoryItem.create({ data: { saveId, name: 'Cuerdas', description: 'x', catalogSlug: 'cuerdas' } });
    const app = await buildApp();
    const action = 'Ato al Orco Enfurecido caído, atándolo con fuerza para que no escape.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    expect(classifyRes.statusCode).toBe(200);
    const body = classifyRes.json();
    expect(body.blocked).toBeUndefined();
    expect(body.classification).toBeDefined();
  }, 15_000);
});

// Bug real jugando en vivo (2026-09-03, sesión de juego con Playwright): mencionar/atacar a un
// NPC/fauna real de catálogo que NO está en la escena actual dispara `absentSceneNpcClaim`
// (`resolveBlockedTurn`, turn.ts) — su mensaje genérico ("¿Ruptidar? Aquí no hay nadie con ese
// nombre, que yo vea...") menciona el nombre real por catálogo, pero ese camino corto nunca
// llamaba a `recordEntityDiscoveries`, a diferencia del flujo normal de turno. La fauna con la que
// el jugador acababa de interactuar directamente se quedaba bloqueada para siempre en la
// Enciclopedia.
describe('resolveBlockedTurn registra descubrimientos (auditoría "sesión de juego" 2026-09-03)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    // Ubicación real SIN Ruptidar sembrado en escena — el guard exige que exista en catálogo pero
    // no esté presente aquí para disparar.
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (blocked discovery)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 12, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un turno bloqueado por absentSceneNpcClaim SÍ desbloquea la fauna mencionada en la Enciclopedia', async () => {
    const app = await buildApp();
    // "Kirelon Arenoso" (`faunaMomentoDelDia['kirelon-arenoso'] === 'noche'`) real de catálogo,
    // pero excluido de la escena por hora de mundo — con `worldState` recién creado (mañana por
    // defecto), condición exacta que exige `detectsAbsentSceneNpcClaim`. Mismo caso real de la
    // sesión de juego que motivó este hallazgo.
    const action = "Ataco a 'Kirelon Arenoso' con mi hacha, sin darle tiempo a reaccionar.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    expect(classifyRes.statusCode).toBe(200);
    const body = classifyRes.json();
    // `ABSENT_NPC_LINES` (playerActionValidation.ts) es un pool aleatorio de 5 frases — solo 3 de
    // las 5 interpolan el nombre en el texto, las otras 2 son genéricas ("alguien que no está").
    // Lo que importa aquí es que el turno se bloqueó de verdad (no una frase concreta al azar).
    expect(typeof body.blocked?.narration).toBe('string');

    const discovered = await prisma.discoveredEntity.findUnique({
      where: { saveId_entityType_entitySlug: { saveId, entityType: 'fauna', entitySlug: 'kirelon-arenoso' } },
    });
    expect(discovered).not.toBeNull();
  }, 15_000);
});

// Bug real jugando en vivo (2026-09-03, mismo hallazgo de arriba): incluso en el flujo NORMAL de
// turno (sin bloquear), el desbloqueo dependía por completo de que el LLM mencionara el alias real
// por casualidad en su narración — el motor ya conoce con certeza `npcAttackTarget` ese turno,
// pero antes esa certeza nunca se usaba para garantizar el descubrimiento.
describe('recordEntityDiscoveries usa npcAttackTarget de forma determinista (auditoría "sesión de juego" 2026-09-03)', () => {
  let saveId: string;
  let ruptidarId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const ruptidar = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'ruptidar' } });
    ruptidarId = ruptidar.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (npcAttackTarget discovery)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.npcState.create({ data: { saveId, npcId: ruptidarId, scope: location.id, condicionFisica: 'ILESO' } });
    classifyAction.mockResolvedValue({
      requiereTirada: true, atributo: 'fuerza', dificultad: 12, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    // Narración deliberadamente GENÉRICA — sin mencionar "Ruptidar" en ningún sitio del texto, para
    // aislar que el desbloqueo venga del `npcAttackTarget` determinista, no de un match de texto.
    narrateAction.mockResolvedValue({ narration: 'La presa esquiva el primer golpe y retrocede, gruñendo bajo, sin dejarse alcanzar.', newFacts: [] });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('atacar a Ruptidar por nombre desbloquea su ficha aunque la narración nunca lo nombre', async () => {
    const res = await doTurn(saveId, "Ataco a 'Ruptidar' con mi hacha, sin darle tiempo a reaccionar.");
    expect(res.statusCode).toBe(200);
    const done = lastNdjsonLine(res.payload);
    expect(done.blocked).toBeUndefined();
    expect(done.narration).not.toContain('Ruptidar');

    // 'npc' y no 'fauna' — Ruptidar no tiene ningún HarvestYield propio (no es despiezable), así
    // que `recordEntityDiscoveries` lo clasifica por su rama genérica de NPC, no por `faunaSlugs`.
    const discovered = await prisma.discoveredEntity.findUnique({
      where: { saveId_entityType_entitySlug: { saveId, entityType: 'npc', entitySlug: 'ruptidar' } },
    });
    expect(discovered).not.toBeNull();
  }, 15_000);
});

// Bug real jugando en vivo (2026-09-03, "atacar resuelto sin combate real"): "Me acerco despacio a
// la boca de cueva y ataco sin dudarlo a lo que sea que me observa desde dentro" se resolvió con
// una tirada de Destreza/aproximación genérica — sin NPC/fauna matcheado en escena, el motor no
// tiene ningún candidato al que abrir combate, y la amenaza desaparecía del relato sin explicación.
// Fix: cuando hay intención de ataque explícita (`detectsAttackIntent`) sin ningún NPC en escena,
// la sugerencia ambiental de encuentro (antes 25% de probabilidad, opcional para el modelo) se
// fuerza siempre y deja de sonar a sugerencia libre — instruye al narrador a revelar el nombre real
// de un candidato de la región, sin resolver el combate todavía (eso lo hace el turno siguiente,
// ya con el nombre conocido, por el camino normal de `detectNpcsInScene`).
describe('Ataque explícito sin objetivo identificado fuerza el reveal narrativo (auditoría "sesión de juego" 2026-09-03)', () => {
  let saveId: string;

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // determinista: siempre el primer candidato ponderado
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (reveal ambiental forzado)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    classifyAction.mockResolvedValue({
      requiereTirada: true, atributo: 'destreza', dificultad: 12, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockClear();
    narrateAction.mockResolvedValue({ narration: 'Narración de prueba.', newFacts: [] });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un ataque a algo sin nombre fuerza la sugerencia de reveal (no opcional) con un candidato real de la región', async () => {
    const app = await buildApp();
    const action = 'Me acerco despacio a la boca de cueva y ataco sin dudarlo a lo que sea que me observa desde dentro.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: false },
    });
    expect(narrateRes.statusCode).toBe(200);

    const narrateCallArgs = narrateAction.mock.calls.at(-1)?.[0] as { worldFacts?: string[] };
    const hint = narrateCallArgs.worldFacts?.find((f) => f.includes('ACABA DE ATACAR ALGO QUE TODAVÍA NO TIENE NOMBRE'));
    expect(hint).toBeDefined();
    expect(hint).toContain('REVELACIÓN');
    // Aullador Rojo: candidato determinista real con `orderBy: { slug: 'asc' }` (fix 2026-09-09,
    // ver turnResolution.ts) + `Math.random` mockeado a 0 — `pickAmbientEncounterCandidate` con
    // roll=0 devuelve siempre el PRIMER candidato con weight>0 de la lista, sin importar su peso
    // real (solo importa el peso con Math.random() real de producción). Entre los itinerantes reales
    // con WorldPopulation > 0 en Las Llanuras del Viento Rojo, "aullador-rojo" es el primero en
    // orden alfabético de slug, sin restricción de faunaMomentoDelDia.
    //
    // Antes se esperaba "Múrgol" (bug de test real, corregido esta misma sesión): la query no tenía
    // `orderBy`, así que dependía de un orden implícito de Postgres nunca garantizado — funcionó
    // "por casualidad" hasta que una fila `Npc` huérfana (`orco-rezagado`, residuo de un rename de
    // catálogo nunca limpiado en Postgres) alteró el orden real de la tabla y rompió la expectativa.
    expect(hint).toContain('Aullador Rojo');
  }, 15_000);
});

// Bug real jugando en vivo (2026-09-04: "me resta la reputación antes de matarlo... si elijo
// matar tiene que esperar a que resuelva el combate antes de restarlo, en el turno final") — la
// reputación se restaba en el golpe que dejaba CONVALECIENTE, no en la decisión final. Ver el test
// hermano ya actualizado en "Misión de apertura..." (arriba, factionRepChange null al llegar
// CONVALECIENTE) — este cubre el otro lado: rematar SÍ debe restar de verdad.
describe('Reputación de facción solo en la decisión final (rematar a MUERTO), no al dejar CONVALECIENTE (bug real 2026-09-04)', () => {
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // golpes claros siempre, mismo criterio que el describe de apertura
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const worldId = world.id;
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'orco-enfurecido-hondonada' } });
    npcId = npc.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (remate)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
        pendingCombatNpcSlugs: ['orco-enfurecido-hondonada'],
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // PRINCIPAL → scope "" (mismo criterio que scopeFor, npcScene.ts) — CONVALECIENTE ya resuelto
    // a mano, sin pasar por el motor: solo interesa probar el REMATE, no cómo se llega ahí (ya
    // cubierto por el describe de apertura).
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'CONVALECIENTE' } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('rematar un CONVALECIENTE hasta MUERTO SÍ resta reputación de su facción (FACTION_REP_ATTACK_DELTA)', async () => {
    const app = await buildApp();
    const action = "Descargo el golpe final sobre 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });
    expect(narrateRes.statusCode).toBe(200);

    const stateAfter = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(stateAfter?.condicionFisica).toBe('MUERTO');

    const body = lastNdjsonLine(narrateRes.payload) as unknown as { factionRepChange: { faction: string; delta: number; newValue: number } | null };
    expect(body.factionRepChange).toEqual({ faction: 'Clan Serhu', delta: -150, newValue: 2350 });
    const worldStateAfter = await prisma.worldState.findUniqueOrThrow({ where: { saveId } });
    expect((worldStateAfter.factionsStatus as Record<string, number>)['Clan Serhu']).toBe(2350);
  }, 15_000);
});

// Hallazgo 18 (revisar-partida-hallazgos.md 2026-09-07): rematar a un NPC ya CONVALECIENTE con un
// golpe normal (no una habilidad LETAL, ese caso ya tenía su propio hint) no daba al Narrador
// ninguna instrucción de que ese golpe concreto acaba con la vida del rival — `hitSeverityHint`
// devuelve vacío para CONVALECIENTE/MUERTO, así que sin este hint solo quedaba el texto genérico
// de `OUTCOME_NARRATION_HINT` ("narra el golpe"). Mismo escenario/siembra que el describe de
// arriba (CONVALECIENTE a mano, ataque tabulado dentro de combate), pero aquí se verifica el
// CONTENIDO del hint que llega al Narrador (`worldFacts`), no el estado mecánico ya cubierto ahí.
describe('Remate a un NPC ya CONVALECIENTE se narra explícitamente como golpe final (hallazgo 18, 2026-09-07)', () => {
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // golpe claro siempre
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const worldId = world.id;
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'orco-enfurecido-hondonada' } });
    npcId = npc.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (remate hallazgo 18)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
        pendingCombatNpcSlugs: ['orco-enfurecido-hondonada'],
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'CONVALECIENTE' } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('un golpe normal (sin LETAL) que remata a un CONVALECIENTE hasta MUERTO incluye el hint de REMATE en el contexto del Narrador', async () => {
    narrateAction.mockClear();
    const app = await buildApp();
    const action = "Descargo el golpe final sobre 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });
    expect(narrateRes.statusCode).toBe(200);

    const stateAfter = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(stateAfter?.condicionFisica).toBe('MUERTO');

    const narrateCallArgs = narrateAction.mock.calls.at(-1)?.[0] as { worldFacts?: string[] };
    const hint = narrateCallArgs.worldFacts?.find((f) => f.includes('REMATE — YA RESUELTO'));
    expect(hint).toContain('Orco enfurecido');
    expect(hint).toContain('golpe final');
    expect(hint).not.toContain('EFECTO DE HABILIDAD'); // no es el camino LETAL, es el gemelo nuevo
  }, 15_000);
});

// Bug real (2026-09-08, reproducido en vivo con Playwright, causa raíz confirmada leyendo
// resolveCombatSlugsAndPersist): un golpe que remata a MUERTO en el mismo turno persistía el NPC
// recién muerto en Save.pendingCombatNpcSlugs (necesario para que ESE turno muestre su condición
// fresca en combateIniciado) — pero nada en un turno futuro lo volvía a filtrar. Un jugador que,
// tras rematar, nunca manda otra acción de texto libre normal contra ese mismo NPC (p.ej. intenta
// "Cazar" de nuevo, POST /cazar/confirmar, que solo LEE este campo para bloquear con 409/400 "ya
// hay combate en curso" sin limpiarlo nunca) queda en un callejón sin salida: el frontend tampoco
// muestra el aviso "Combatir" (el guard de detail.ts ya excluye correctamente al MUERTO de
// combateIniciado), así que no hay ningún botón que lo resuelva.
describe('pendingCombatNpcSlugs no queda sucio tras un golpe que remata en el mismo turno (bug real 2026-09-08)', () => {
  let saveId: string;
  let npcId: string;

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // golpe claro siempre
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const worldId = world.id;
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId, slug: 'orco-enfurecido-hondonada' } });
    npcId = npc.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (pendingCombatNpcSlugs remate)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
        pendingCombatNpcSlugs: ['orco-enfurecido-hondonada'],
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'CONVALECIENTE' } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el turno que remata queda con pendingCombatNpcSlugs vacío, no con el NPC recién muerto', async () => {
    const app = await buildApp();
    const action = "Descargo el golpe final sobre 'Orco enfurecido'.";
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });
    expect(narrateRes.statusCode).toBe(200);

    const stateAfter = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(stateAfter?.condicionFisica).toBe('MUERTO');

    // El display de ESTE turno (combateIniciado en la respuesta directa) SÍ debe seguir trayendo
    // al NPC con su condición fresca — solo lo PERSISTIDO en Save debe quedar limpio.
    const body = lastNdjsonLine(narrateRes.payload) as unknown as {
      combateIniciado: { npcs: { slug: string; condicionFisica: string }[] } | null;
    };
    expect(body.combateIniciado?.npcs.find((n) => n.slug === 'orco-enfurecido-hondonada')?.condicionFisica).toBe('MUERTO');

    const saveAfter = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfter.pendingCombatNpcSlugs).toEqual([]);
  }, 15_000);
});

// Bug real, sesión autónoma de pruebas con Playwright (2026-09-04): Gistera Koh es `PRINCIPAL`
// (npcScene.ts § `candidateNpcs`, cualquier PRINCIPAL es candidato en CUALQUIER ubicación del
// mundo) — sin restricción propia, su gancho guionizado de huida se disparó dentro de Karot Veku,
// el campamento fortificado del Clan Serhu del que ella dice estar escapando. Petición explícita
// de la usuaria: debe aparecer nada más Gorhorn se mueva por La Hondonada del Eco, como de las
// primeras cosas que ve al empezar el juego — nunca en otra ubicación mientras siga sin
// presentarse del todo.
describe('Gistera Koh solo aparece en La Hondonada del Eco mientras sigue sin presentarse (bug real 2026-09-04)', () => {
  it('en Karot Veku (otra ubicación real), el primer turno NO dispara el gancho de Gistera Koh', async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const karotVeku = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'campamento-serhu' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (Gistera fuera de sitio)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: karotVeku.id,
      },
    });
    try {
      await prisma.worldState.create({ data: { saveId: save.id } });
      // `mockClear` (no solo `mockResolvedValue`) — un `mockResolvedValueOnce` sobrante de un test
      // ANTERIOR de este mismo archivo (que no llegó a consumirse, p.ej. porque ese test falló
      // antes de llamar a narrateAction) quedaría en cola y respondería a ESTE test con el
      // resultado de otro test completamente distinto, dando un falso positivo/negativo aquí.
      narrateAction.mockClear();
      narrateAction.mockImplementation(async (ctx: { onNarrationChunk?: (d: string) => void }) => {
        ctx.onNarrationChunk?.('Gorhorn explora la zona con calma.');
        return { narration: 'Gorhorn explora la zona con calma.', newFacts: [] };
      });
      classifyAction.mockResolvedValue({
        requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
      });
      const app = await buildApp();
      const action = 'Exploro la zona';
      const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId: save.id, action, enCombate: false } });
      const { classification, roll } = classifyRes.json();
      const narrateRes = await app.inject({
        method: 'POST',
        url: '/turn/narrate',
        payload: { saveId: save.id, action, classification, roll, enCombate: false },
      });
      expect(narrateRes.statusCode).toBe(200);

      const facts = await prisma.sessionFact.findMany({ where: { saveId: save.id } });
      expect(facts.some((f) => f.text.includes('sin nombre revelado todavía'))).toBe(false);
      expect(facts.some((f) => f.text.includes('Gistera Koh'))).toBe(false);
    } finally {
      narrateAction.mockReset();
      narrateAction.mockImplementation(async (ctx: { onNarrationChunk?: (d: string) => void }) => {
        ctx.onNarrationChunk?.('El golpe conecta.');
        return { narration: 'El golpe conecta.', newFacts: [] };
      });
      await prisma.save.delete({ where: { id: save.id } });
    }
  }, 15_000);

  it('en La Hondonada del Eco, en la celda de su ZonePoint real, dispara el gancho', async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (Gistera en su sitio)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
        // Reconectado al sistema de posición en Zona (auditoría de pruebas en vivo, 2026-09-16) —
        // ver el describe 'newQuestInfo' más arriba para el comentario completo del bug/fix.
        zonaPosX: 220,
        zonaPosY: 500,
      },
    });
    try {
      await prisma.worldState.create({ data: { saveId: save.id } });
      classifyAction.mockResolvedValue({
        requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
      });
      const app = await buildApp();
      const action = 'Exploro la zona';
      const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId: save.id, action, enCombate: false } });
      const { classification, roll } = classifyRes.json();
      const narrateRes = await app.inject({
        method: 'POST',
        url: '/turn/narrate',
        payload: { saveId: save.id, action, classification, roll, enCombate: false },
      });
      expect(narrateRes.statusCode).toBe(200);

      const facts = await prisma.sessionFact.findMany({ where: { saveId: save.id } });
      expect(facts.some((f) => f.text.includes('sin nombre revelado todavía'))).toBe(true);
    } finally {
      await prisma.save.delete({ where: { id: save.id } });
    }
  }, 15_000);

  // Fase G del 0.1 (hallazgo G22): su ZonePoint sigue activo tras presentarse y marcharse — la
  // llegada «sin nombre» se volvía a pegar a cualquier turno junto a él (construir el ayuntamiento).
  it('en la celda de su ZonePoint pero con su misión ya aceptada (ya se marchó), el gancho NO se dispara', async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (Gistera ya marchada)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
        zonaPosX: 220,
        zonaPosY: 500,
      },
    });
    try {
      await prisma.worldState.create({ data: { saveId: save.id } });
      await prisma.quest.create({ data: { saveId: save.id, title: 'Acabar con el Orco Enfurecido', description: 'x', status: 'ACTIVA' } });
      classifyAction.mockResolvedValue({
        requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
      });
      const app = await buildApp();
      const action = 'Exploro la zona';
      const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId: save.id, action, enCombate: false } });
      const { classification, roll } = classifyRes.json();
      const narrateRes = await app.inject({
        method: 'POST',
        url: '/turn/narrate',
        payload: { saveId: save.id, action, classification, roll, enCombate: false },
      });
      expect(narrateRes.statusCode).toBe(200);
      expect(narrateRes.body).not.toContain('Una sombra se acerca');

      const facts = await prisma.sessionFact.findMany({ where: { saveId: save.id } });
      expect(facts.some((f) => f.text.includes('sin nombre revelado todavía'))).toBe(false);
    } finally {
      await prisma.save.delete({ where: { id: save.id } });
    }
  }, 15_000);

  // Auditoría de pruebas en vivo (2026-09-16): mismo bug real que motivó reconectar el hook al
  // sistema de Zona — jugando de verdad, la primera acción del jugador no fue diálogo, la fase 1
  // nunca se disparó, y el segundo intento de hablar quedó sin ningún guardarraíl determinista (el
  // modelo le inventó a Gistera Koh una tribu y un aspecto físico falsos). Este test cubre el caso
  // que faltaba: misma Location (Hondonada del Eco), pero lejos del ZonePoint real de Gistera
  // (x:220/y:500, worldCatalog.ts) — el gancho NO debe dispararse solo por estar en la Location
  // correcta, hace falta estar en su celda o una adyacente.
  it('en La Hondonada del Eco, pero lejos de la celda de su ZonePoint: el gancho NO se dispara', async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (Gistera lejos en su misma Location)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
        // Lejos de (220, 500) — celda muy distinta, ni misma ni adyacente (radio de celda 50px).
        zonaPosX: 700,
        zonaPosY: 50,
      },
    });
    try {
      await prisma.worldState.create({ data: { saveId: save.id } });
      classifyAction.mockResolvedValue({
        requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
      });
      const app = await buildApp();
      const action = 'Exploro la zona';
      const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId: save.id, action, enCombate: false } });
      const { classification, roll } = classifyRes.json();
      const narrateRes = await app.inject({
        method: 'POST',
        url: '/turn/narrate',
        payload: { saveId: save.id, action, classification, roll, enCombate: false },
      });
      expect(narrateRes.statusCode).toBe(200);

      const facts = await prisma.sessionFact.findMany({ where: { saveId: save.id } });
      expect(facts.some((f) => f.text.includes('sin nombre revelado todavía'))).toBe(false);
      expect(facts.some((f) => f.text.includes('Gistera Koh'))).toBe(false);
    } finally {
      await prisma.save.delete({ where: { id: save.id } });
    }
  }, 15_000);
});

// Bug real jugando en vivo (sesión autónoma de pruebas con Playwright, 2026-09-04): "Gorhorn asume
// su clase: GUERRERO." (LogEntry determinista, isPlayerAction:false) se pasó al turno SIGUIENTE
// como "TU PROPIA NARRACIÓN DEL TURNO ANTERIOR" — el modelo lo repitió literalmente al inicio de
// la narración de un turno de recolección completamente distinto. Causa raíz: `lastNarration`
// (turnResolution.ts) solo filtraba `isPlayerAction: false`, sin distinguir narración real del
// LLM de un mensaje de sistema construido a mano. Fix: `LogEntry.isSystemMessage` nuevo, marcado
// en los ~10 sitios que crean mensajes deterministas (elegir clase, especialización, recompensa
// de misión, "se pone a ello...", huir, dejar vivir, capturar, respawn/reinicio, turno bloqueado),
// y excluido explícitamente de la query de `lastNarration`.
describe('lastNarrationText excluye mensajes de sistema deterministas (bug real 2026-09-04)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (isSystemMessage)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el LogEntry de "asume su clase" se marca isSystemMessage y nunca llega a narrateAction como lastNarrationText', async () => {
    const app = Fastify();
    await app.register(turnRoutes);
    await app.register(progressionRoutes);

    const claseRes = await app.inject({ method: 'PATCH', url: `/saves/${saveId}/clase`, payload: { clase: 'GUERRERO' } });
    expect(claseRes.statusCode).toBe(200);

    const logEntry = await prisma.logEntry.findFirstOrThrow({ where: { saveId }, orderBy: { createdAt: 'desc' } });
    expect(logEntry.text).toContain('asume su clase: Guerrero.');
    expect(logEntry.isSystemMessage).toBe(true);

    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockClear();
    const action = 'Recojo lo que encuentro por la zona.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll, enCombate: false } });

    expect(narrateAction).toHaveBeenCalledTimes(1);
    const ctxReal = narrateAction.mock.calls[0][0] as { lastNarrationText?: string };
    expect(ctxReal.lastNarrationText).toBeUndefined();
  }, 15_000);
});

/// Franja 3 de "Interactuar" (2026-09-08) — gate de colisión de celda para fauna/NPC agresivo
/// detectado por TEXTO (no interrupción de viaje, que tiene su propia excepción explícita ya
/// probada en el describe "Viaje largo interrumpido..."). Con `Save.zonaPosX/Y` conocido, un
/// agresivo mencionado por texto solo fuerza combate si su `ZonePoint` real está en la MISMA celda
/// que el jugador — lejos, ni siquiera un "ataco a X" explícito lo alcanza.
describe('Franja 3 de "Interactuar": colisión de celda para fauna agresiva detectada por texto', () => {
  let saveId: string;
  let worldId: string;
  let locationId: string;
  let agresivoNpcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;

    const location = await prisma.location.create({
      data: {
        worldId,
        slug: 'test-colision-celda-agresivo',
        name: 'Zona de Prueba Colisión',
        region: 'Zona de Pruebas',
        kind: 'hito',
        description: 'x',
        aliases: ['zona de prueba colision'],
      },
    });
    locationId = location.id;

    const agresivo = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PLANTILLA',
        slug: 'test-colision-agresivo',
        name: 'Bandido de Prueba',
        aliases: ['bandido de prueba'],
        role: 'Bandido de prueba',
        level: 1,
        attributes: { fuerza: 8, destreza: 8, constitucion: 8, inteligencia: 4, voluntad: 4, carisma: 2, magia: 0 },
        bio: 'x',
        personality: 'x',
        homeLocationSlug: 'test-colision-celda-agresivo',
        temperamento: 'AGRESIVO',
      },
    });
    agresivoNpcId = agresivo.id;

    // Sin esta fila, `recalcularZonePointsDeLocation` (llamado en CADA turno, antes del filtro de
    // colisión) calcula población regional 0 para este slug y desactiva el `ZonePoint` recién
    // creado por cada test (`activo: objetivo > 0` → false) antes de que el filtro de Franja 3
    // llegue a verlo — mismo requisito que ya tienen los `ZonePoint` reales de producción.
    await prisma.worldPopulation.create({
      data: {
        worldId,
        targetType: 'FAUNA',
        targetSlug: 'test-colision-agresivo',
        label: 'Bandido de Prueba (test colisión)',
        poblacion: 100,
        poblacionMax: 200,
        distribucion: { 'Zona de Pruebas': 1.0 },
      },
    });

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (colisión de celda)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: locationId,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.npc.delete({ where: { id: agresivoNpcId } });
    await prisma.worldPopulation.deleteMany({ where: { worldId, targetSlug: 'test-colision-agresivo' } });
    await prisma.location.delete({ where: { id: locationId } });
  });

  afterEach(async () => {
    await prisma.zonePoint.deleteMany({ where: { locationId } });
    await prisma.save.update({ where: { id: saveId }, data: { pendingCombatNpcSlugs: [] } });
  });

  it('agresivo mencionado por texto CON ZonePoint en la MISMA celda que el jugador: fuerza combate', async () => {
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 400, y: 300, tipo: 'FAUNA', targetSlug: 'test-colision-agresivo', cantidad: 1, activo: true },
    });
    await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: 400, zonaPosY: 300 } }); // misma celda (8,6)

    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockResolvedValueOnce({ narration: 'Gorhorn mira alrededor.', newFacts: [] });
    const app = await buildApp();
    const action = 'Miro hacia el Bandido de Prueba con cautela.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll, enCombate: false } });

    const { combateIniciado } = lastNdjsonLine(narrateRes.payload) as { combateIniciado: { npcs: { slug: string }[] } | null };
    expect(combateIniciado?.npcs.map((n) => n.slug)).toEqual(['test-colision-agresivo']);
  }, 20_000);

  it('el MISMO agresivo, pero con ZonePoint LEJOS del jugador: NO fuerza combate, ni siquiera con "ataco a"', async () => {
    // ZonePoint a más de una celda de distancia (400,300 vs 700,300 — 6 celdas de diferencia).
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 700, y: 300, tipo: 'FAUNA', targetSlug: 'test-colision-agresivo', cantidad: 1, activo: true },
    });
    await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: 400, zonaPosY: 300 } });

    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockResolvedValueOnce({ narration: 'Gorhorn no ve a nadie cerca.', newFacts: [] });
    const app = await buildApp();
    const action = 'Ataco al Bandido de Prueba.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll, enCombate: false } });

    const { combateIniciado } = lastNdjsonLine(narrateRes.payload) as { combateIniciado: { npcs: { slug: string }[] } | null };
    expect(combateIniciado).toBeNull();
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.pendingCombatNpcSlugs).toEqual([]);
  }, 20_000);

  it('el MISMO agresivo, SIN ZonePoint en absoluto: NO fuerza combate (nunca "encima" sin posición real)', async () => {
    await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: 400, zonaPosY: 300 } });

    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockResolvedValueOnce({ narration: 'Gorhorn no ve a nadie cerca.', newFacts: [] });
    const app = await buildApp();
    const action = 'Ataco al Bandido de Prueba.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll, enCombate: false } });

    const { combateIniciado } = lastNdjsonLine(narrateRes.payload) as { combateIniciado: { npcs: { slug: string }[] } | null };
    expect(combateIniciado).toBeNull();
  }, 20_000);

  it('sin posición conocida del jugador (zonaPosX/Y null): fallback seguro, combate directo como siempre', async () => {
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 700, y: 300, tipo: 'FAUNA', targetSlug: 'test-colision-agresivo', cantidad: 1, activo: true },
    });
    await prisma.save.update({ where: { id: saveId }, data: { zonaPosX: null, zonaPosY: null } });

    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockResolvedValueOnce({ narration: 'Gorhorn se enfrenta al bandido.', newFacts: [] });
    const app = await buildApp();
    const action = 'Ataco al Bandido de Prueba.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll, enCombate: false } });

    const { combateIniciado } = lastNdjsonLine(narrateRes.payload) as { combateIniciado: { npcs: { slug: string }[] } | null };
    expect(combateIniciado?.npcs.map((n) => n.slug)).toEqual(['test-colision-agresivo']);
  }, 20_000);
});

// UX-35 (hito 0.2): el turno no espera al día. La narración se entrega y, después, el mundo de la
// partida avanza los días que el turno haya cruzado.
describe('UX-35 — el avance diario va después de la narración', () => {
  let saveId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Gorhorn de prueba (UX-35)', characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor', characterMotivation: 'x', attributes: ATTRS, portraitInitial: 'G', currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    // Un minuto antes de medianoche del día 0: el turno (≥ 1 minuto) cruza al día 1.
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 1439 } });
    await asegurarMundoDePartida(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('cruzar un día con un turno narrado acaba simulando ese día', async () => {
    classifyAction.mockResolvedValueOnce({
      requiereTirada: false, atributo: 'voluntad', dificultad: 8, razon: 'x', banda: 'corta', duracionEstimadaMinutos: 30,
    });
    narrateAction.mockResolvedValueOnce({ narration: 'Gorhorn se sienta a esperar junto al eco de la hondonada.', newFacts: [] });
    const app = await buildApp();
    const action = 'Me siento a esperar un rato.';
    const { classification, roll } = (await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } })).json();
    const res = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll, enCombate: false } });
    expect(lastNdjsonLine(res.payload).type).toBe('done');
    // La respuesta no esperó al día; el trabajo de fondo de la partida lo simula después.
    await esperarSegundoPlano(saveId);
    expect((await prisma.worldState.findUniqueOrThrow({ where: { saveId }, select: { ultimoDiaSimulado: true } })).ultimoDiaSimulado).toBeGreaterThanOrEqual(1);
    await app.close();
  }, 30_000);
});

// CR-49: atacar por texto a una persona con los suyos cerca abre el combate de varios con todos.
describe('CR-49 — atacar a Torgash en su campamento trae a los suyos', () => {
  let saveId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const interior = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'campamento-serhu-interior' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Gorhorn de prueba (CR-49)', characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor', characterMotivation: 'x', attributes: ATTRS, portraitInitial: 'G', currentLocationId: interior.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 600 } });
    await asegurarMundoDePartida(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el turno que abre combate devuelve varios enemigos con su participante', async () => {
    // Un ataque fallido contra alguien cauteloso no abre combate (por eso el acierto forzado de abajo).
    classifyAction.mockResolvedValueOnce({
      requiereTirada: true, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockResolvedValueOnce({ narration: 'Gorhorn carga contra Torgash Ketg.', newFacts: [], combateIniciado: { npcSlugs: ['torgash-ketg'] } });
    const app = await buildApp();
    // Citado, como lo envía el frontend al elegir objetivo (sin cita, a un cauteloso no se le ataca).
    const action = "Ataco a 'Torgash Ketg' con el hacha.";
    const { classification, roll } = (await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } })).json();
    // La dificultad la pone la clasificación según el nivel de Torgash: se fuerza un acierto.
    const acierto = roll ? { ...roll, success: true, gradoExito: 'claro' } : roll;
    const res = await app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll: acierto, enCombate: false } });
    const { combateIniciado } = lastNdjsonLine(res.payload) as { combateIniciado: { npcs: { slug: string; participantId?: string }[] } | null };
    expect(combateIniciado?.npcs.length ?? 0).toBeGreaterThan(1);
    expect(combateIniciado!.npcs.map((n) => n.slug)).toContain('torgash-ketg');
    expect(combateIniciado!.npcs.every((n) => !!n.participantId)).toBe(true);
    expect(await prisma.combatEncounter.count({ where: { saveId, estado: 'EN_CURSO', jugable: true } })).toBe(1);
    await app.close();
  }, 30_000);
});

// P233 (pruebas 0.3, 2026-10-19): morir en un combate sin haber caído convaleciente EN ESE combate
// (Gorhorn entró ya convaleciente contra el Orco enfurecido) no registraba COMBATE_PERDIDO y la
// muerte no llevaba al NPC que mata: el orco no ganaba «Vencedor de», ni contaba para RIVALIDAD.
describe('P233 — morir en combate sin pasar por Convaleciente en ese combate cuenta como perderlo', () => {
  const saves: string[] = [];

  async function partidaConvaleciente(
    nombre: string,
    opciones: { combateDesde?: Date; sinAccionFuera?: boolean } = {},
  ): Promise<{ saveId: string; npcId: string }> {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'orco-enfurecido-hondonada' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId, worldId: world.id, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'Clan Maktor',
        characterMotivation: 'x', attributes: ATTRS, portraitInitial: 'G', currentLocationId: location.id,
        condicionFisica: 'CONVALECIENTE', dificultad: 'NOVATO', pendingCombatNpcSlugs: ['orco-enfurecido-hondonada'],
        // El combate empezó hace media hora (los sucesos `antes` son de hace una).
        combateDesde: opciones.combateDesde ?? new Date(Date.now() - 1_800_000),
        // El orco ya ha lanzado su golpe: si conecta, mata (un escalón por debajo de CONVALECIENTE).
        pendingNpcAttack: {
          npcId: npc.id, attribute: 'fuerza', effects: ['ATAQUE'], rol: 'ataque', abilityName: 'Ataque base',
          abilityDescription: 'Golpe improvisado.', energyCost: 5, energyRegen: 0,
        },
      },
    });
    saves.push(save.id);
    await prisma.worldState.create({ data: { saveId: save.id } });
    // La última acción de la jugadora fuera de combate (antes P233 marcaba el inicio del combate).
    if (!opciones.sinAccionFuera) await prisma.logEntry.create({ data: { saveId: save.id, channel: 'CHARACTER', text: 'Voy a buscar al orco.', isPlayerAction: true, combate: false, timeLabel: 'x', fictionalMinutes: 420 } });
    return { saveId: save.id, npcId: npc.id };
  }

  async function suceso(saveId: string, tipo: string, minutos: number, actores: { entidadTipo: string; entidadId: string; papel: string }[], antes = false) {
    await prisma.suceso.create({
      data: {
        saveId, tipo, familia: 'JUGADOR', fictionalMinutes: minutos, importancia: 3, origen: 'JUGADOR', datos: {}, texto: tipo,
        // Ya reaccionado: así el título y la rivalidad solo pueden salir de la muerte.
        semilla: 'p233', reaccionesPendientes: false,
        // `antes`: de un combate anterior (antes de `combateDesde`).
        ...(antes ? { createdAt: new Date(Date.now() - 3_600_000) } : {}),
        actores: { create: actores },
      },
    });
  }

  async function morir(saveId: string) {
    classifyAction.mockResolvedValueOnce({ requiereTirada: true, atributo: 'fuerza', dificultad: 18, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0 });
    narrateAction.mockResolvedValueOnce({ narration: 'El orco acaba con Gorhorn.', newFacts: [], condicionFisica: 'MUERTO', combateIniciado: { npcSlugs: ['orco-enfurecido-hondonada'] } });
    // Tiradas altas: el golpe del orco conecta.
    const azar = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      await doTurn(saveId, "Ataco a 'Orco enfurecido' con todas mis fuerzas.");
    } finally {
      azar.mockRestore();
    }
    await esperarSegundoPlano(saveId);
    await procesarReacciones(prisma, saveId);
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).condicionFisica).toBe('MUERTO');
  }

  afterAll(async () => {
    for (const id of saves) await prisma.save.delete({ where: { id } });
  });

  it('registra COMBATE_PERDIDO con el NPC, lo pone en MUERTE_JUGADOR, le da «Vencedor de» y cuenta para RIVALIDAD', async () => {
    const { saveId, npcId } = await partidaConvaleciente('Gorhorn P233');
    const yo = { entidadTipo: 'PERSONAJE', entidadId: saveId };
    const orco = { entidadTipo: 'NPC', entidadId: npcId };
    // Dos enfrentamientos de combates anteriores con el mismo orco; la derrota vieja no cuenta para este.
    await suceso(saveId, 'COMBATE_PERDIDO', 300, [{ ...yo, papel: 'VICTIMA' }, { ...orco, papel: 'AUTOR' }], true);
    await suceso(saveId, 'COMBATE_GANADO', 350, [{ ...yo, papel: 'AUTOR' }, { ...orco, papel: 'VICTIMA' }], true);

    await morir(saveId);

    const perdidos = await prisma.suceso.findMany({ where: { saveId, tipo: 'COMBATE_PERDIDO' }, include: { actores: true }, orderBy: { createdAt: 'asc' } });
    expect(perdidos).toHaveLength(2);
    expect(perdidos[1].actores).toEqual(expect.arrayContaining([expect.objectContaining({ ...orco, papel: 'AUTOR' })]));
    const muerte = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'MUERTE_JUGADOR' }, include: { actores: true } });
    expect(muerte.actores).toEqual(expect.arrayContaining([expect.objectContaining({ ...yo, papel: 'VICTIMA' }), expect.objectContaining({ ...orco, papel: 'AUTOR' })]));
    // SUPERVIVIENTE: el orco sube y lo recuerda con su título de vencedor.
    const estado = await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId, scope: '' } });
    expect(estado.titulo).toBe('Vencedor de Gorhorn P233');
    expect(estado.nivelesGanados).toBeGreaterThanOrEqual(1);
    // Tercer enfrentamiento con el mismo NPC → RIVALIDAD.
    expect(await prisma.hilo.count({ where: { saveId, clave: `RIVALIDAD:${npcId}` } })).toBe(1);
  }, 30_000);

  it('si ya cayó convaleciente en este mismo combate, la muerte no repite COMBATE_PERDIDO', async () => {
    const { saveId, npcId } = await partidaConvaleciente('Gorhorn P233 bis');
    await suceso(saveId, 'COMBATE_PERDIDO', 425, [{ entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'VICTIMA' }, { entidadTipo: 'NPC', entidadId: npcId, papel: 'AUTOR' }]);

    await morir(saveId);

    expect(await prisma.suceso.count({ where: { saveId, tipo: 'COMBATE_PERDIDO' } })).toBe(1);
    const muerte = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'MUERTE_JUGADOR' }, include: { actores: true } });
    expect(muerte.actores).toEqual(expect.arrayContaining([expect.objectContaining({ entidadTipo: 'NPC', entidadId: npcId, papel: 'AUTOR' })]));
  }, 30_000);
  const perdidoContra = (saveId: string, npcId: string) => [
    { entidadTipo: 'PERSONAJE', entidadId: saveId, papel: 'VICTIMA' },
    { entidadTipo: 'NPC', entidadId: npcId, papel: 'AUTOR' },
  ];

  it('una acción bloqueada o soltar un objeto a mitad del combate (combate: false) no repite COMBATE_PERDIDO', async () => {
    const { saveId, npcId } = await partidaConvaleciente('Gorhorn P233 suelta');
    await suceso(saveId, 'COMBATE_PERDIDO', 425, perdidoContra(saveId, npcId));
    // Tras caer convaleciente, una acción que no pasa por el combate: no es un combate nuevo.
    await prisma.logEntry.create({ data: { saveId, channel: 'CHARACTER', text: 'Suelto la espada.', isPlayerAction: true, combate: false, timeLabel: 'x', fictionalMinutes: 426 } });

    await morir(saveId);

    expect(await prisma.suceso.count({ where: { saveId, tipo: 'COMBATE_PERDIDO' } })).toBe(1);
  }, 30_000);

  it('una emboscada justo tras otro combate perdido registra la derrota del segundo', async () => {
    const { saveId, npcId } = await partidaConvaleciente('Gorhorn P233 emboscada');
    // La derrota del primer combate, sin acción fuera de combate entre los dos…
    await suceso(saveId, 'COMBATE_PERDIDO', 425, perdidoContra(saveId, npcId));
    // …y la emboscada empieza el segundo justo después.
    await prisma.save.update({ where: { id: saveId }, data: { combateDesde: new Date() } });

    await morir(saveId);

    expect(await prisma.suceso.count({ where: { saveId, tipo: 'COMBATE_PERDIDO' } })).toBe(2);
  }, 30_000);

  it('en una partida sin acciones fuera de combate, una derrota de otro combate no cuenta para este', async () => {
    const { saveId, npcId } = await partidaConvaleciente('Gorhorn P233 sin acciones', { sinAccionFuera: true });
    await suceso(saveId, 'COMBATE_PERDIDO', 300, perdidoContra(saveId, npcId), true);

    await morir(saveId);

    expect(await prisma.suceso.count({ where: { saveId, tipo: 'COMBATE_PERDIDO' } })).toBe(2);
  }, 30_000);
});
