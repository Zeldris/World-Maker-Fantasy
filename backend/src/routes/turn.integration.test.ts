import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { resolveDueTransits } from '../workers/worldTick.js';
import { minutosConDestreza, bandaForMinutos } from '../services/travel.js';
import type { NarrationResult } from '../services/narrador.js';
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

vi.mock('../services/narrador.js', () => ({
  classifyAction: (...args: unknown[]) => classifyAction(...args),
  narrateAction: (ctx: Parameters<typeof narrateAction>[0]) => narrateAction(ctx),
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
  return app;
}

/// `/turn/narrate` transmite NDJSON (una línea por evento: chunk/reset/done) — el resultado real
/// del turno va en la última línea (`type: 'done'`), nunca en un único JSON parseable de un tirón.
function lastNdjsonLine(payload: string): Record<string, unknown> {
  const lines = payload.trim().split('\n');
  return JSON.parse(lines[lines.length - 1]);
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

  it('atacar repetidamente reduce la condición física del NPC hasta INCAPACITADO, sin llamar a Ollama (camino tabulado)', async () => {
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
      if (state?.condicionFisica === 'INCAPACITADO') break;
    }

    expect(classifyAction).not.toHaveBeenCalled();

    const finalState = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(finalState?.condicionFisica).toBe('INCAPACITADO');
    expect(finalState?.saqueado).toBe(false); // nunca se saquea solo por incapacitarlo

    // `golpes_mutuos` (ambos lados conectan con dados pinchados al máximo) — el jugador también
    // debería haber acumulado daño real, nunca quedar en ILESO tras varios golpes recibidos.
    const save = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(save.condicionFisica).not.toBe('ILESO');
  }, 30_000);

  it('el `/turn/narrate` de después de incapacitar no vuelve a bajar la condición ni permite un segundo saqueo automático', async () => {
    const app = await buildApp();
    const stateBefore = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(stateBefore?.condicionFisica).toBe('INCAPACITADO');

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
    expect(stateAfter?.condicionFisica).toBe('INCAPACITADO'); // nunca "mejora" ni cambia por saquear
  }, 15_000);

  // Cobertura nueva (2026-07-31, petición explícita: "si no saqueas todo el botón sigue para poder
  // saquear lo que dejaste") — el Orco Enfurecido lleva 3 objetos de catálogo (Maza orca, Amuleto
  // de hueso, Mapa de las Llanuras, ver worldCatalog.ts); saquear solo uno dejando los otros dos
  // NO debe marcarlo `saqueado`, y una segunda pasada por el resto no debe duplicar el primero.
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
        lootItemNames: ['Maza orca', 'Amuleto de hueso', 'Mapa de las Llanuras'],
      },
    });

    const afterSecond = await prisma.npcState.findFirst({ where: { saveId, npcId } });
    expect(afterSecond?.saqueado).toBe(true);
    expect(afterSecond?.lootedItemNames).toEqual(expect.arrayContaining(['Maza orca', 'Amuleto de hueso', 'Mapa de las Llanuras']));
    const inventoryAfterSecond = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(inventoryAfterSecond.map((i) => i.name).sort()).toEqual(['Amuleto de hueso', 'Mapa de las Llanuras', 'Maza orca']);
    // Ya saqueado del todo — no hay nada pendiente, `pendingCombatNpcSlugs` vuelve a quedar vacío.
    const saveAfterFullLoot = await prisma.save.findUniqueOrThrow({ where: { id: saveId } });
    expect(saveAfterFullLoot.pendingCombatNpcSlugs).toEqual([]);
  }, 30_000);

  // Cobertura nueva (2026-08-01, "revisa bien en todos los sitios que pendingCombatNpcSlugs se
  // actualiza bien al acabar un combate" — tras el bug real "el orco que metí volvió a aparecer"):
  // `agresivoSlugsInScene`/`shouldForceCombat` (turnResolution.ts) no miraban `condicionFisica` —
  // un NPC ya MUERTO seguía contando como amenaza (su temperamento de catálogo no cambia al
  // morir) si volvía a matchear en escena vía un hecho de sesión, aunque la acción del turno no
  // tuviera nada que ver con él. Decapita al orco (ya INCAPACITADO+saqueado de las dos pruebas de
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
    // Materiales EXACTOS que pide CAMPAMENTO_RECIPE (construction.ts): 20 madera, 10 piedra, 5
    // piel — catalogSlugs reales de worldCatalog.ts, cada uno con su categoría correcta.
    await prisma.inventoryItem.createMany({
      data: [
        { saveId, name: 'Leña de matorral de cuerno (20)', description: 'x', catalogSlug: 'lena-matorral-cuerno', origin: 'partida' },
        { saveId, name: 'Piedra (10)', description: 'x', catalogSlug: 'piedra', origin: 'partida' },
        { saveId, name: 'Lana de múrgol (5)', description: 'x', catalogSlug: 'lana-murgol', origin: 'partida' },
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
    expect(body.narration).toEqual({ narration: expect.stringContaining('campamento'), newFacts: [] });

    const building = await prisma.building.findFirstOrThrow({ where: { saveId } });
    expect(building.recipeKey).toBe('campamento');
    expect(building.locationId).toBe(locationId);
    expect(building.status).toBe('ACTIVO');
    expect(building.name).toBe('un campamento base');

    // Los 3 materiales se consumieron EXACTOS (20/10/5, sin remanente) — no debe quedar nada.
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
});

const ATTRS_CARISMATICO = { ...ATTRS, carisma: 14 };

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
    await giveMaterials(saveId, [
      { name: 'Piedra (15)', catalogSlug: 'piedra' },
      { name: 'Leña de matorral de cuerno (10)', catalogSlug: 'lena-matorral-cuerno' },
    ]);
    narrateAction.mockClear();
    const res = await doTurn(saveId, 'Construyo un ayuntamiento aquí mismo.');
    expect(narrateAction).not.toHaveBeenCalled();
    const body = lastNdjsonLine(res.payload);
    // 'Gorhorn de prueba 6' !== 'Gorhorn' exacto — nombre sugerido null, editable.
    expect(body.newKingdomFounded).toEqual({
      title: 'un pequeño ayuntamiento',
      region: 'Las Llanuras del Viento Rojo',
      outcome: 'PACIFICA',
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
      { name: 'Piedra (15)', catalogSlug: 'piedra' },
      { name: 'Leña de matorral de cuerno (10)', catalogSlug: 'lena-matorral-cuerno' },
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

  it('mejora el Ayuntamiento a mediano IN-PLACE — mismo Building.id, sin duplicar Territory', async () => {
    const before = await prisma.building.findFirstOrThrow({ where: { saveId, recipeKey: 'ayuntamiento' } });
    const territoriesBefore = await prisma.territory.count({ where: { saveId } });
    await giveMaterials(saveId, [
      { name: 'Piedra (30)', catalogSlug: 'piedra' },
      { name: 'Leña de matorral de cuerno (25)', catalogSlug: 'lena-matorral-cuerno' },
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
      { name: 'Piedra (15)', catalogSlug: 'piedra' },
      { name: 'Leña de matorral de cuerno (10)', catalogSlug: 'lena-matorral-cuerno' },
    ]);
    narrateAction.mockClear();
    const [resA, resB] = await Promise.all([
      doTurn(saveId, 'Construyo un ayuntamiento aquí mismo.'),
      doTurn(saveId, 'Construyo un ayuntamiento aquí mismo.'),
    ]);

    expect(await prisma.building.count({ where: { saveId, recipeKey: 'ayuntamiento' } })).toBe(1);
    expect(await prisma.territory.count({ where: { saveId } })).toBe(1);
    // Bug real (auditoría 2026-08-04, cierre): el texto sintético "termina de construir X" se
    // decide y se transmite ANTES de saber si la transacción va a ganar la carrera — sin corregir
    // el `narration.narration` final, el turno perdedor podía persistir/devolver una narración que
    // afirma un éxito que la DB no respalda. Exactamente un turno dice "termina de construir" y el
    // otro admite que ya no tenía los materiales.
    const narrations = [resA, resB].map((r) => (lastNdjsonLine(r.payload).narration as { narration: string }).narration);
    expect(narrations.filter((n) => n.includes('termina de construir'))).toHaveLength(1);
    expect(narrations.filter((n) => n.includes('ya no dispone de lo necesario'))).toHaveLength(1);
    // Los materiales se consumieron una sola vez — ninguna fila de piedra/leña suelta ni
    // duplicada (la segunda pasada, si llega a intentarlo, ve `planRecipeConsumption` devolver
    // null contra el inventario ya vacío y se salta la construcción entera).
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
    await Promise.all([
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
    await Promise.all([doTurn(saveId, action), doTurn(saveId, action)]);

    // 3 objetos de catálogo en el loadout del Orco Enfurecido (Maza orca, Amuleto de hueso, Mapa
    // de las Llanuras, ver worldCatalog.ts) — si la carrera duplicara el botín, saldrían 6.
    const items = await prisma.inventoryItem.findMany({ where: { saveId } });
    expect(items).toHaveLength(3);
    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId, scope: '' } } });
    expect(state.saqueado).toBe(true);
  }, 20_000);
});

// Cobertura nueva (auditoría de deuda técnica AMPLIA 2026-08-04, bug real de condición de carrera
// — mismo patrón exacto ya cerrado hoy varias veces): `executeTargets` (Decapitar) sale de
// `npcsInScene`, leído con `prisma` ANTES de la transacción — dos "decapito a X" casi simultáneos
// contra el mismo NPC ya INCAPACITADO podían pasar ambos el filtro con la misma foto obsoleta y
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
    // PRINCIPAL → scope siempre ''. INCAPACITADO (no MUERTO) para que `executeTargets` lo recoja.
    await prisma.npcState.create({ data: { saveId, npcId, scope: '', condicionFisica: 'INCAPACITADO' } });
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

    // La prueba real de que ya no depende de que el Narrador narre el nombre: el mock del LLM
    // (narrateAction, arriba del archivo) nunca menciona "Agresor de prueba" en ningún momento,
    // y aun así el combate se forzó de verdad contra ese NPC concreto.
    const narrateCalls = narrateAction.mock.calls;
    const anyCallMentionsAgresor = narrateCalls.some((call) => JSON.stringify(call).includes('Agresor de prueba'));
    expect(anyCallMentionsAgresor).toBe(false);
  }, 20_000);
});
