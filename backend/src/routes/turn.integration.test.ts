import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';

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
const narrateAction = vi.fn(async (ctx: { onNarrationChunk?: (d: string) => void }) => {
  ctx.onNarrationChunk?.('El golpe conecta.');
  return { narration: 'El golpe conecta.', newFacts: [] };
});

vi.mock('../services/narrador.js', () => ({
  classifyAction: (...args: unknown[]) => classifyAction(...args),
  narrateAction: (ctx: Parameters<typeof narrateAction>[0]) => narrateAction(ctx),
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
