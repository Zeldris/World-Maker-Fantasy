import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { resolveDueTransits, startEagerTransitResolution } from '../workers/worldTick.js';
import { recolectarRoutes } from './saves/recolectar.js';
import { panelsRoutes } from './saves/panels.js';
import { sessionRoutes } from './saves/session.js';
import { minutosConDestreza, bandaForMinutos } from '../services/travel.js';
import type { NarrationResult } from '../services/narrador.js';
import { hasFalseTravelClaim, hasFalsePhantomTravel } from '../services/narrador.js';
import type { TravelResolution } from '../services/travel.js';
import type { TravelInterruption } from '../services/travelInterruption.js';
import type { AttributeBlock } from '../services/dice.js';

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

vi.mock('../services/narrador.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/narrador.js')>();
  return {
    ...actual,
    classifyAction: (...args: unknown[]) => classifyAction(...args),
    narrateAction: (ctx: Parameters<typeof narrateAction>[0]) => narrateAction(ctx),
  };
});

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

const ATTRS = { fuerza: 15, destreza: 10, constitucion: 12, inteligencia: 8, voluntad: 8, carisma: 8, arcano: 4 };

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
      if (state?.condicionFisica === 'CONVALECIENTE') break;
    }

    expect(classifyAction).not.toHaveBeenCalled();

    const finalState = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(finalState?.condicionFisica).toBe('CONVALECIENTE');
    expect(finalState?.saqueado).toBe(false); // nunca se saquea solo por incapacitarlo

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
  // saquear lo que dejaste") — el Orco Enfurecido lleva 2 objetos de catálogo (Maza orca, Amuleto
  // de hueso — "Mapa de las Llanuras" se quitó del loadout el 2026-08-13, ahora solo se entrega
  // como recompensa de misión, ver worldCatalog.ts); saquear solo uno dejando el otro NO debe
  // marcarlo `saqueado`, y una segunda pasada por el resto no debe duplicar el primero.
  it('saqueo parcial: dejar objetos sin marcar no marca `saqueado`, y una segunda pasada no duplica lo ya tomado', async () => {
    // A diferencia del ataque tabulado (test de arriba), "registrar el cuerpo" no tiene atajo
    // tabulado propio en /turn/classify — cae a `classifyAction` (mockeada en todo el archivo,
    // sin valor resuelto en este describe porque el resto de sus tests no la necesitan).
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockClear();
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
    expect(afterFirst?.saqueado).toBe(false); // queda 1 objeto sin tomar
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

    // Segunda pasada — re-selecciona "Maza orca" (ya tomada) + el que faltaba: no debe duplicar
    // la maza, y ahora sí debe quedar completamente saqueado.
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
        lootItemNames: ['Maza orca', 'Amuleto de hueso'],
      },
    });

    const afterSecond = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(afterSecond?.saqueado).toBe(true);
    expect(afterSecond?.lootedItemNames).toEqual(expect.arrayContaining(['Maza orca', 'Amuleto de hueso']));
    const inventoryAfterSecond = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(inventoryAfterSecond.map((i) => i.name).sort()).toEqual(['Amuleto de hueso', 'Maza orca']);
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
});

// "Saquear" general (2026-08-17, petición explícita: "que funcione igual que saquear de un
// combate, detectando los npcs muertos/convalecientes de la zona") — el nuevo
// GET /saves/:id/saquear-zona encuentra al orco convaleciente sin que el jugador lo nombre. El
// saqueo en sí se manda con `enCombate: true` (mismo criterio EXACTO que ya usa
// `handleSaquearSeleccion` en combate, incluso cuando el combate ya terminó de verdad — "Registrar/
// Decapitar/Saquear son justo las acciones que la pantalla de combate YA terminado ofrece") — evita
// el atajo de `detectsPostCombatInteraction` (turn.ts, solo para `!enCombate`), que está pensado
// para UN único objetivo citado en texto libre, no para un barrido de varios a la vez. Fixture
// propio (no reutiliza el describe de arriba) para no interferir con su secuencia de saqueo.
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
    // Convaleciente de entrada, sin pasar por un combate real — mismo atajo que usan otros
    // describe de este archivo para dejar el NpcState en el estado exacto que hace falta probar.
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'CONVALECIENTE', saqueado: false } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('GET /saves/:id/saquear-zona encuentra al orco convaleciente, y el saqueo funciona con lootItemNames', async () => {
    const panelsApp = Fastify();
    await panelsApp.register(panelsRoutes);
    const zonaRes = await panelsApp.inject({ method: 'GET', url: `/saves/${saveId}/saquear-zona` });
    expect(zonaRes.statusCode).toBe(200);
    const { candidates } = zonaRes.json() as { candidates: { slug: string; name: string; condicionFisica: string }[] };
    expect(candidates).toHaveLength(1);
    expect(candidates[0].slug).toBe('orco-enfurecido-hondonada');
    expect(candidates[0].condicionFisica).toBe('CONVALECIENTE');

    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    const app = await buildApp();
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
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('Contraataque: si el NPC ataca con daño y la tirada propia tiene éxito, devuelve el golpe además del que ya recibiste', async () => {
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

    // El golpe base del NPC (rol 'ataque' real) sigue llegando — Contraataque nunca lo cancela,
    // solo añade su propio golpe de vuelta.
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).not.toBe('ILESO');
    // Contraataque disparado: el NPC también acusa un golpe.
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
  }, 15_000);

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

    // Efecto ATAQUE: el NPC también acusa un golpe de vuelta (igual que Contraataque arriba).
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
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // Simula que Gistera Koh ya se presentó en un turno anterior (gisteraYaPresentada, ver
    // turnResolution.ts) — sin esto, aceptar ayudar no dispara la misión determinista. Inserción
    // directa (no `appendSessionFacts`) para no depender de Ollama estando arriba solo para
    // embeber un hecho de prueba — el valor del vector no importa para lo que se comprueba aquí
    // (`loadSessionFacts` solo necesita el texto).
    await prisma.$executeRaw`
      INSERT INTO "SessionFact" (id, "saveId", text, embedding, "createdAt")
      VALUES (${crypto.randomUUID()}, ${saveId}, 'Gistera Koh, una orca expulsada del Clan Serhu, pidió ayuda.', NULL, ${new Date()})
    `;
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
  it('al aceptar ayudar, newQuestInfo trae el título y objetivo de la misión recién creada', async () => {
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

    const action = 'Yo me encargo de tu perseguidor';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    const narrateRes = await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });
    const body = lastNdjsonLine(narrateRes.payload);
    expect(body.newQuestInfo).toEqual({
      title: 'Acabar con el Orco Enfurecido',
      objetivo: 'Derrotar al Orco Enfurecido que persigue a Gistera Koh.',
    });
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

// Cobertura nueva (auditoría de deuda técnica AMPLIA 2026-08-04, bug real): `narration.newItem`
// (objeto narrativo libre propuesto por el LLM) era el ÚNICO de los 5 sitios de este archivo que
// crea InventoryItem sin empujar también a `newInventoryItems` — el frontend se veía obligado a
// fiarse de `narration.newItem` a pelo, con un id inventado en el cliente que el backend nunca
// reconoce (rompía "equipar" hasta la siguiente recarga). Ahora también viaja en
// `newInventoryItems`, con el id REAL de la fila creada de verdad.
describe('newInventoryItems: narration.newItem viaja con id real, no solo narration', () => {
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

  it('el objeto propuesto por el LLM llega en newInventoryItems con el id real de la fila creada', async () => {
    narrateAction.mockResolvedValueOnce({
      narration: 'Gorhorn talla un amuleto tosco con el hueso que encontró.',
      newFacts: [],
      newItem: { name: 'Amuleto tosco de hueso', description: 'Tallado a mano, sin adornos.' },
    });
    const res = await doTurn(saveId, 'Tallo un amuleto con este hueso que encontré.');
    const body = lastNdjsonLine(res.payload);

    const row = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, name: 'Amuleto tosco de hueso' } });
    expect(body.newInventoryItems).toEqual([
      expect.objectContaining({ id: row.id, name: 'Amuleto tosco de hueso', slot: null, equipSlot: null }),
    ]);
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

// Cobertura nueva (2026-08-04, docs/17-reglas-construcciones-reino.md): cupo de 1 campamento
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
      { name: 'Mena de hierro (2)', catalogSlug: 'mena-de-hierro' },
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
      { name: 'Mena de hierro (2)', catalogSlug: 'mena-de-hierro' },
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
  // solo 30 piedra + 25 leña crudas; ahora ~75% procesado/25% crudo por categoría. Gorhorn ya
  // empieza con `constructor-orcos-llanuras` (GORHORN_STARTING_PROFESSIONS,
  // startingProfessions.ts), así que el nuevo bloqueo real de oficio no lo afecta aquí.
  it('mejora el Ayuntamiento a mediano IN-PLACE — mismo Building.id, sin duplicar Territory', async () => {
    const before = await prisma.building.findFirstOrThrow({ where: { saveId, recipeKey: 'ayuntamiento' } });
    const territoriesBefore = await prisma.territory.count({ where: { saveId } });
    await giveMaterials(saveId, [
      { name: 'Bloque de piedra tallada (3)', catalogSlug: 'bloque-piedra-tallada' },
      { name: 'Piedra (5)', catalogSlug: 'piedra' },
      { name: 'Lingote de hierro (1)', catalogSlug: 'lingote-de-hierro' },
      { name: 'Mena de hierro (1)', catalogSlug: 'mena-de-hierro' },
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

// Cobertura nueva (2026-08-23, Grupo 3 § Territory.control/population — docs/10-niveles-xp-reino.md
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
    await prisma.kingdomStats.create({ data: { saveId, felicidad: felicidadFija } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'voluntad', dificultad: 15, razon: 'x', banda: 'larga', duracionEstimadaMinutos: 7 * 1440 + 60,
    });
  }

  afterEach(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  // `doTurn` (definido más abajo) fuerza `enCombate: true` en las dos llamadas — un guard real de
  // turn.ts ("acción de combate clasificada como banda larga... forzada a instantánea") colapsa
  // entonces la banda 'larga' mockeada a 'instantanea' cuando la escena trae cualquier NPC (aquí,
  // el gancho de sesión de Hondonada del Eco), rompiendo el salto de 7 días de golpe que necesita
  // este test. "Espero aquí" no es una acción de combate — `enCombate: false` es lo correcto Y
  // evita el guard.
  async function doPassiveTurn(action: string) {
    const app = await buildApp();
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: false } });
    const { classification, roll } = classifyRes.json();
    return app.inject({ method: 'POST', url: '/turn/narrate', payload: { saveId, action, classification, roll, enCombate: false } });
  }

  it('felicidad ≥70 sostenida 7 días consolida el territorio y da 300 XP de Reino', async () => {
    await setUp(70);
    const xpAntes = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).xp;
    narrateAction.mockClear();
    // A diferencia de las construcciones deterministas (Ayuntamiento, más abajo), "esperar" SÍ es
    // una acción narrada por el LLM de verdad (mockeado) — no hay atajo determinista que la evite,
    // así que aquí no se comprueba si `narrateAction` se llamó o no, solo el resultado mecánico
    // real de Territory/KingdomStats tras el salto de 7 días.
    const res = await doPassiveTurn('Espero aquí, dejando pasar los días tranquilamente.');

    const territory = await prisma.territory.findUniqueOrThrow({ where: { id: territoryId } });
    expect(territory.control).toBe('CONSOLIDADO');
    expect(territory.population).toBeGreaterThan(15); // felicidad alta también hace crecer la población

    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.xp - xpAntes).toBe(300);
    expect(lastNdjsonLine(res.payload)).toBeTruthy();
  }, 20_000);

  it('felicidad ≤20 sostenida 7 días pierde el territorio (población a 0) y abandona sus edificios', async () => {
    await setUp(20);
    narrateAction.mockClear();
    await doPassiveTurn('Espero aquí, dejando pasar los días tranquilamente.');

    const territory = await prisma.territory.findUniqueOrThrow({ where: { id: territoryId } });
    expect(territory.control).toBe('PERDIDO');
    expect(territory.population).toBe(0);

    const building = await prisma.building.findUniqueOrThrow({ where: { id: buildingId } });
    expect(building.status).toBe('ABANDONADO');
  }, 20_000);

  it('felicidad neutral (50) no consolida ni rebela — el territorio se queda RECLAMADO', async () => {
    await setUp(50);
    narrateAction.mockClear();
    await doPassiveTurn('Espero aquí, dejando pasar los días tranquilamente.');

    const territory = await prisma.territory.findUniqueOrThrow({ where: { id: territoryId } });
    expect(territory.control).toBe('RECLAMADO');
    expect(territory.population).toBe(15); // ni crece ni decrece en la banda neutral

    const building = await prisma.building.findUniqueOrThrow({ where: { id: buildingId } });
    expect(building.status).toBe('ACTIVO');
  }, 20_000);
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
      { name: 'Mena de hierro (2)', catalogSlug: 'mena-de-hierro' },
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

// Cobertura nueva (2026-08-04): slots de compañero — 0 de base, cada construcción propia ACTIVA
// da los suyos. `newCompanion` del LLM (mockeado aquí, a diferencia del resto del archivo) solo se
// materializa de verdad si hay hueco.
describe('Slots de compañero: tope real por construcciones propias', () => {
  let saveId: string;

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
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'carisma', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin ninguna construcción propia (0 slots): el LLM propone un compañero pero no se crea', async () => {
    narrateAction.mockResolvedValueOnce({
      narration: 'Un viajero se une a tu causa.',
      newFacts: [],
      newCompanion: { name: 'Ulkha', role: 'guerrera', notes: 'x' },
    });
    await doTurn(saveId, 'Le pido a la viajera que se una a mí.');
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
      narration: 'Un viajero se une a tu causa.',
      newFacts: [],
      newCompanion: { name: 'Ulkha', role: 'guerrera', notes: 'x' },
    });
    await doTurn(saveId, 'Le pido a la viajera que se una a mí.');
    expect(await prisma.companion.count({ where: { saveId } })).toBe(1);

    // Con el único slot ya ocupado, un SEGUNDO compañero propuesto tampoco se materializa.
    narrateAction.mockResolvedValueOnce({
      narration: 'Otro viajero se ofrece.',
      newFacts: [],
      newCompanion: { name: 'Torgash hijo', role: 'guerrero', notes: 'x' },
    });
    await doTurn(saveId, 'Le pido a otro viajero que se una a mí.');
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
        attributes: { ...ATTRS, constitucion: 6 }, // HERIDO real al descansar, para que restSucceeds cuente de verdad
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
    await prisma.save.update({ where: { id: saveId }, data: { condicionFisica: 'HERIDO' } });
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

// Cobertura nueva (auditoría 2026-08-11, "pruebas por API": la ficha de Descansar prometía curar
// "sin necesitar volver a un lugar conocido", pero la mecánica real (healCeilingFor/death.ts)
// solo curaba en refugio/asentamiento — aclarado con la usuaria: SÍ cura en cualquier sitio, pero
// un vivac improvisado topa en GRAVE; solo un refugio/asentamiento real llega a HERIDO.
describe('Descansar en cualquier sitio cura, pero topa en GRAVE (solo refugio/asentamiento llega a HERIDO)', () => {
  let saveId: string;
  let pilaresId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    // Los Pilares Rotos: kind 'hito', NUNCA un punto de descanso válido (isValidRestLocationKind).
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

  it('descansar en un hito (sin refugio válido) mejora CONVALECIENTE hasta GRAVE, nunca hasta HERIDO', async () => {
    await doTurn(saveId, 'Descanso aquí mismo un rato para recuperar fuerzas.');
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).toBe('GRAVE');
    expect(save.currentLocationId).toBe(pilaresId); // sigue en el mismo sitio, esto no es respawn
  }, 15_000);

  it('un segundo descanso en el mismo hito ya no mejora nada más (el tope de un vivac improvisado es GRAVE)', async () => {
    await doTurn(saveId, 'Descanso otra vez, esperando recuperarme del todo.');
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).toBe('GRAVE');
  }, 15_000);

  // Bug real jugando en vivo (2026-08-13, "he descansado y la energía no se recuperó" en un vivac
  // fuera de refugio/asentamiento) — hueco de cobertura real: este describe ya probaba el mismo
  // escenario para condicionFisica, nunca para energía. Save propio con energía baja para que el
  // ascenso a la mitad del tope sea observable (ver energy.test.ts para el caso puro).
  it('un vivac en un hito (sin refugio válido) SÍ restaura energía, hasta la mitad del tope', async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba 10b',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: pilaresId,
        energia: 5,
      },
    });
    await prisma.worldState.create({ data: { saveId: save.id } });
    try {
      await doTurn(save.id, 'Descanso aquí mismo un rato para recuperar fuerzas.');
      const updated = await prisma.save.findUniqueOrThrow({ where: { id: save.id } });
      // energiaMaxFor(constitucion=12) = 50 + 12*3 = 86 — mitad = 43.
      expect(updated.energia).toBe(43);
    } finally {
      await prisma.save.delete({ where: { id: save.id } });
    }
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
        condicionFisica: 'HERIDO', // para que restSucceeds cuente al descansar (§ arriba)
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
    // baste para morir.
    await prisma.save.update({
      where: { id: saveId },
      data: { currentLocationId: pilaresId, condicionFisica: 'CONVALECIENTE' },
    });
    classifyAction.mockResolvedValueOnce({
      requiereTirada: true, atributo: 'fuerza', dificultad: 18, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
    narrateAction.mockResolvedValueOnce({
      narration: 'El golpe final acaba con Gorhorn.',
      newFacts: [],
      condicionFisica: 'MUERTO',
    });
    await doTurn(saveId, 'Sigo luchando contra todo pronóstico.');

    const savedAfterDeath = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(savedAfterDeath.condicionFisica).toBe('ILESO'); // respawn siempre revive a salvo
    expect(savedAfterDeath.deathCount).toBe(1);
    expect(savedAfterDeath.endedAt).toBeNull(); // NOVATO, sin fin de partida
    expect(savedAfterDeath.currentLocationId).toBe(hondonadaId); // vuelve al campamento…
    expect(savedAfterDeath.currentLocationId).not.toBe(pilaresId); // …no se queda donde murió
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

    // 2 objetos de catálogo en el loadout del Orco Enfurecido (Maza orca, Amuleto de hueso — "Mapa
    // de las Llanuras" se quitó del loadout el 2026-08-13, ahora solo se entrega como recompensa
    // de misión, ver worldCatalog.ts) — si la carrera duplicara el botín, saldrían 4.
    const items = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(items).toHaveLength(2);
    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId, scope: '' } } });
    expect(state.saqueado).toBe(true);

    // Con el candado de turno (turnLock.ts, 2026-08-07) el segundo "registro el cuerpo" ya ni
    // llega a narrar — 409 seco. El ganador sí se hace con el botín de verdad.
    const { ganador } = splitLockWinnerAndLoser([res1, res2]);
    expect((ganador.narration as { narration: string }).narration).toMatch(/se hace con lo siguiente/);
  }, 20_000);
});

// Cobertura nueva (auditoría de deuda técnica AMPLIA 2026-08-04, bug real de condición de carrera
// — mismo patrón exacto ya cerrado hoy varias veces): `executeTargets` (Decapitar) sale de
// `npcsInScene`, leído con `prisma` ANTES de la transacción — dos "decapito a X" casi simultáneos
// contra el mismo NPC ya CONVALECIENTE podían pasar ambos el filtro con la misma foto obsoleta y
// aplicar la muerte DOS veces: población mundial restada dos veces por una sola baja. Arreglado
// revalidando `NpcState.condicionFisica` fresco con `tx` justo antes de aplicar los efectos.
describe('Decapitar: condición de carrera en turnos concurrentes (auditoría 2026-08-04)', () => {
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
    // PRINCIPAL → scope siempre ''. CONVALECIENTE (no MUERTO) para que `executeTargets` lo recoja.
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'CONVALECIENTE' } });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('dos "decapito al orco" simultáneos solo restan población una vez', async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const before = await prisma.worldPopulation.findUniqueOrThrow({
      where: { worldId_targetType_targetSlug: { worldId: world.id, targetType: 'RAZA', targetSlug: 'orcos-llanuras' } },
    });

    narrateAction.mockClear();
    const action = 'Decapito al Orco Enfurecido de un solo golpe.';
    await Promise.all([doTurn(saveId, action), doTurn(saveId, action)]);

    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId, scope: '' } } });
    expect(state.condicionFisica).toBe('MUERTO');
    const after = await prisma.worldPopulation.findUniqueOrThrow({
      where: { worldId_targetType_targetSlug: { worldId: world.id, targetType: 'RAZA', targetSlug: 'orcos-llanuras' } },
    });
    // Si la carrera duplicara el efecto, la población bajaría 2, no 1.
    expect(before.poblacion - after.poblacion).toBe(1);
  }, 20_000);
});

// Recompensa determinista de misión (docs/19-post-combate-y-recompensas-mision.md, pieza 3) —
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
    const res = await doTurn(saveId, 'Decapito al Orco Enfurecido de un solo golpe.');

    const quest = await prisma.quest.findFirstOrThrow({ where: { saveId, title: { contains: 'Orco Enfurecido (prueba)' } } });
    expect(quest.status).toBe('COMPLETADA');

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

    // Auditoría "revisar partida" 2026-08-13, bug real jugando en vivo: "Misión completada" se
    // leía ANTES que la narración del propio turno que la resolvió (mismo `createdAt` de
    // Postgres, orden de lectura no garantizado) — la fila de recompensa debe ordenar DESPUÉS de
    // la narración principal del turno, no antes, en el mismo orden (`createdAt asc`) que usan
    // `/saves/:id` y `/saves/:id/diario` de verdad.
    const allEntries = await prisma.logEntry.findMany({ where: { saveId }, orderBy: { createdAt: 'asc' } });
    const mainNarrationEntry = allEntries.find((e) => e.channel === 'CHARACTER' && !e.isPlayerAction && e.id !== rewardLog!.id);
    expect(mainNarrationEntry).toBeDefined();
    expect(rewardLog!.createdAt.getTime()).toBeGreaterThan(mainNarrationEntry!.createdAt.getTime());
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
    await doTurn(saveId, 'Decapito al Orco Enfurecido de un solo golpe.');

    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, name: 'Mapa de las Llanuras' } });
    expect(item.catalogSlug).toBe('mapa-de-las-llanuras');
  }, 20_000);
});

// docs/19-post-combate-y-recompensas-mision.md pieza 2 (2026-08-13) — recuperación de CONVALECIENTE
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
// `harvestSourceHomeLocationSlug` (worldCatalog.ts) liga estas fuentes a una Location EXACTA; bug
// real encontrado verificando el fix a mano: el fallback "nunca devuelvas vacío" de
// `selectDiscoveries` (discovery.ts) resucitaba igual los objetos ligados en cualquier otro sitio
// en cuanto TODO el bucket PASIVO quedaba ligado (como pasa hoy: son los únicos 6 yields PASIVO
// del catálogo) — corregido cortando el candado ANTES de calcular el fallback, no dentro de él.
describe('Objetos narrativos "PASIVO" ligados a su Location exacta (auditoría 2026-08-14)', () => {
  const MAKTOR_ITEMS = ['Brazalete trenzado del Clan Maktor', 'Tótem de clan roto', 'Tablilla quemada', 'Juguete de hueso tallado'];
  const OFRENDAS_ITEMS = ['Pañuelo de luto Serhu', 'Hueso marcado de primera cacería'];

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

  beforeAll(() => {
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'corta', duracionEstimadaMinutos: 5,
    });
  });

  it('en La Hondonada del Eco, explorar nunca revela objetos ligados a Restos de Maktor/Túmulos del Honor', async () => {
    const saveId = await saveAt('hondonada-del-eco', 'Gorhorn de prueba (discovery hondonada)');
    const app = await buildApp();
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: 'Exploro la zona', enCombate: false } });
      const { discoveries } = res.json();
      const names = (discoveries ?? []).map((d: { name: string }) => d.name);
      expect(names.filter((n: string) => MAKTOR_ITEMS.includes(n) || OFRENDAS_ITEMS.includes(n))).toEqual([]);
    }
    await prisma.save.delete({ where: { id: saveId } });
  }, 20_000);

  it('en Los Restos de Maktor, explorar SÍ puede revelar los objetos de Maktor', async () => {
    const saveId = await saveAt('restos-de-maktor', 'Gorhorn de prueba (discovery restos maktor)');
    const app = await buildApp();
    const foundNames = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const res = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: 'Exploro la zona', enCombate: false } });
      const { discoveries } = res.json();
      for (const d of discoveries ?? []) foundNames.add(d.name);
    }
    expect([...foundNames].some((n) => MAKTOR_ITEMS.includes(n))).toBe(true);
    expect([...foundNames].some((n) => OFRENDAS_ITEMS.includes(n))).toBe(false);
    await prisma.save.delete({ where: { id: saveId } });
  }, 20_000);

  it('en Los Túmulos del Honor, explorar SÍ puede revelar las ofrendas', async () => {
    const saveId = await saveAt('tumulos-del-honor', 'Gorhorn de prueba (discovery tumulos)');
    const app = await buildApp();
    const foundNames = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const res = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action: 'Exploro la zona', enCombate: false } });
      const { discoveries } = res.json();
      for (const d of discoveries ?? []) foundNames.add(d.name);
    }
    expect([...foundNames].some((n) => OFRENDAS_ITEMS.includes(n))).toBe(true);
    expect([...foundNames].some((n) => MAKTOR_ITEMS.includes(n))).toBe(false);
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
    await app.register(sessionRoutes);
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
    await prisma.save.delete({ where: { id: save2.id } });
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
    await prisma.save.delete({ where: { id: save3.id } });
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
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // PRINCIPAL → scope siempre '' (scopeFor) — ya derrotado y saqueado ANTES de que exista la
    // misión, mismo escenario real de la partida jugada.
    await prisma.npcState.create({ data: { saveId, npcId: orco.id, scope: '', condicionFisica: 'MUERTO', saqueado: true } });
    // Simula que Gistera Koh ya se presentó en un turno anterior (mismo atajo que 'newQuestInfo').
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

  it('la misión nace ya COMPLETADA, con el XP de recompensa concedido en el acto', async () => {
    const app = await buildApp();
    const action = 'Yo me encargo de tu perseguidor';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    await app.inject({
      method: 'POST',
      url: '/turn/narrate',
      payload: { saveId, action, classification, roll, enCombate: true },
    });

    const quest = await prisma.quest.findFirstOrThrow({ where: { saveId, title: { contains: 'Orco Enfurecido' } } });
    expect(quest.status).toBe('COMPLETADA');
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.xp).toBeGreaterThanOrEqual(100);

    // docs/19-post-combate-y-recompensas-mision.md, pieza 3 (2026-08-13): el mapa ya no está en el
    // loadout del orco (no se saquea) — solo esta rama ("ya resuelto antes de aceptar") puede
    // concederlo, así que es la única cobertura real de que no se pierda en este camino concreto.
    const mapa = await prisma.inventoryItem.findFirst({ where: { saveId, name: 'Mapa de las Llanuras' } });
    expect(mapa).not.toBeNull();
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
      narration: 'El trabajo es lento pero gradual.',
      newFacts: ['Gorhorn está fundando un pequeño ayuntamiento en la Hondonada del Eco.'],
    });
    const action = 'Construyo un ayuntamiento aquí mismo.';
    const classifyRes = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId, action, enCombate: true } });
    const { classification, roll } = classifyRes.json();
    await app.inject({
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
  let saveId: string;
  let worldId: string;
  let originId: string;
  let midId: string;
  let destId: string;
  let interruptionNpcId: string;
  let interruptionNpcSlug: string;

  beforeAll(async () => {
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
        attributes: { fuerza: 8, destreza: 8, constitucion: 8, inteligencia: 4, voluntad: 4, carisma: 2, arcano: 0 },
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
    pickTravelInterruptionMock.mockReset();
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.npc.delete({ where: { id: interruptionNpcId } });
    await prisma.locationLink.deleteMany({ where: { OR: [{ fromId: originId }, { fromId: midId }] } });
    await prisma.location.deleteMany({ where: { id: { in: [originId, midId, destId] } } });
  });

  it('el viaje se trunca en la ubicación intermedia, con el agresor ya asignado en el tránsito', async () => {
    const app = await buildApp();
    const classifyRes = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId, action: 'Viajo hacia la zona de prueba destino', enCombate: false },
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

    // La prueba real de que el combate forzado ya no depende de que el Narrador acierte el
    // nombre: el mock del LLM (narrateAction, cabecera del archivo) devuelve SIEMPRE el mismo
    // texto genérico fijo ("El golpe conecta.", newFacts: []), sin mencionar jamás a "Agresor de
    // prueba" en su salida — y aun así `pendingCombatNpcSlugs` (arriba) confirma que el combate
    // se forzó de verdad contra ese NPC concreto. (El CONTEXTO que se le envía al mock sí incluye
    // su ficha completa — así debe ser, el Narrador necesita saber quién está en escena; lo que
    // no debe pasar, y no pasa, es que el motor dependa de que el modelo ACIERTE ese nombre por
    // su cuenta en la narración que devuelve, algo que este mock nunca hace por construcción.)
  }, 20_000);
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
      data: { saveId, channel: 'CHARACTER', text: 'Gorhorn de prueba (curar) llega a la hondonada.', isPlayerAction: true, timeLabel: 'Día 1, mañana' },
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
    expect(logEntry?.initiativeRoll).toMatchObject({ ganador: expect.stringMatching(/^(jugador|npc)$/), jugadorTirada: expect.any(Number), npcTirada: expect.any(Number) });
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
