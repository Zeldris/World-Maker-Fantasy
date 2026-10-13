import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (deuda técnica 2026-07-30, auditoría técnica: "turn.ts... solo tiene cubiertas
/// las validaciones, no el camino real de clasificación — el código más crítico de toda la app").
/// Alcance: el camino TABULADO de combate (roadmap de velocidad, 2026-07-19) — un ataque contra un
/// NPC ya en escena se clasifica por tabla determinista, SIN llamar a Ollama. Se elige este camino
/// (no el genérico vía `classifyAction`) porque es 100% verificable sin mockear un LLM, y porque
/// es justo la optimización de rendimiento más importante de este endpoint: si algún día alguien
/// rompe el atajo (p. ej. cambia una condición y vuelve a caer siempre a `classifyAction`), este
/// test lo detecta por sí solo.
const findUniqueSave = vi.fn();
const findManyNpc = vi.fn();
const findManyNpcState = vi.fn();
const findUniqueLocation = vi.fn();
const findManyLocation = vi.fn();
const findManyQuest = vi.fn();
// Bug real de línea base (2026-09-08, sin relación con el hallazgo que motivó tocar este archivo):
// `playerActionValidation.ts` (ejecutado desde el camino real de /turn/classify) llama a
// `prisma.quest.findFirst` (guard de "Acabar con el Orco Enfurecido" ya activa/cerrada) — este
// mock nunca se actualizó tras añadirse esa llamada, así que CUALQUIER turno que pase por ese
// guard revienta con "prisma.quest.findFirst is not a function", 500 en vez de 200. Confirmado que
// ya fallaba antes de cualquier cambio de esta sesión (worktree del commit limpio anterior).
const findFirstQuest = vi.fn();
const logEntryCreate = vi.fn();
// La fila creada, como la devuelve Prisma (QA-71: la respuesta bloqueada devuelve su entrada guardada).
const logEntryCreada = async ({ data }: { data: Record<string, unknown> }) => ({ id: 'log-1', createdAt: new Date(), ...data });
const classifyAction = vi.fn();
const findFirstCombatEncounter = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    npc: { findMany: (...args: unknown[]) => findManyNpc(...args) },
    npcState: { findMany: (...args: unknown[]) => findManyNpcState(...args) },
    // `detectNpcsInScene` acota el candidato por escena desde 2026-07-30 (ver npcScene.ts) — estas
    // tres consultas nuevas se resuelven vacías/null por defecto en beforeEach, no son lo que este
    // test verifica (eso sigue siendo el atajo tabulado de combate).
    location: {
      findUnique: (...args: unknown[]) => findUniqueLocation(...args),
      findMany: (...args: unknown[]) => findManyLocation(...args),
    },
    quest: {
      findMany: (...args: unknown[]) => findManyQuest(...args),
      findFirst: (...args: unknown[]) => findFirstQuest(...args),
    },
    logEntry: { create: (...args: unknown[]) => logEntryCreate(...args) },
    combatEncounter: { findFirst: (...args: unknown[]) => findFirstCombatEncounter(...args) },
  },
}));

// `importOriginal` (no un reemplazo completo del módulo) — mismo patrón que
// turn.integration.test.ts. Bug real encontrado en esta misma sesión (2026-08-13): un reemplazo
// completo tira también el resto de exports reales de narrador.js (p. ej. `ANACHRONISM_REGEX`,
// que `playerActionValidation.ts` importa) — cualquier import nuevo desde otro módulo se
// convierte en `undefined` en silencio dentro de este archivo de test, sin relación aparente con
// lo que de verdad se está mockeando.
vi.mock('../services/narrador.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/narrador.js')>();
  return {
    ...actual,
    classifyAction: (...args: unknown[]) => classifyAction(...args),
  };
});

vi.mock('../services/worldFacts.js', () => ({ loadSessionFacts: vi.fn(() => Promise.resolve([])) }));

const { turnRoutes } = await import('./turn.js');

async function buildApp() {
  const app = Fastify();
  await app.register(turnRoutes);
  return app;
}

const ATTRS = { fuerza: 15, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

describe('POST /turn/classify — camino tabulado de combate (sin Ollama)', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findManyNpc.mockReset();
    findManyNpcState.mockReset().mockResolvedValue([]);
    findUniqueLocation.mockReset().mockResolvedValue(null);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyQuest.mockReset().mockResolvedValue([]);
    findFirstQuest.mockReset().mockResolvedValue(null);
    logEntryCreate.mockReset().mockImplementation(logEntryCreada);
    classifyAction.mockReset();
  });

  it('un ataque en combate contra un NPC ya en escena se clasifica por tabla, sin llamar a classifyAction', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 3,
      attributes: ATTRS,
      inventoryItems: [],
      condicionFisica: 'ILESO',
      currentLocationId: null,
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana' },
    });
    findManyNpc.mockResolvedValue([
      {
        id: 'npc1',
        aliases: ['orco enfurecido'],
        slug: 'orco-enfurecido',
        name: 'Orco Enfurecido',
        kind: 'PRINCIPAL',
        level: 2,
        role: 'amenaza',
        faction: null,
        personality: 'furioso',
        bio: 'x',
        items: [],
        attributes: ATTRS,
        raza: null,
        clase: null,
        ataqueNatural: 'Zarpazo',
        habilidadesRaciales: [],
        temperamento: 'AGRESIVO',
      },
    ]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId: 'save1', action: 'Ataco al orco enfurecido con todas mis fuerzas.', enCombate: true },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.classification.requiereTirada).toBe(true);
    expect(body.classification.banda).toBe('instantanea');
    expect(body.classification.razon).toMatch(/tabla, sin llamada a Ollama/);
    expect(classifyAction).not.toHaveBeenCalled();
    expect(body.roll).toBeDefined();
  });

  // Regresión (2026-09-08, jugando en vivo: "tirada de iniciativa sin abrir un combate... con
  // dificultad fija en vez de contra la mía" — captura real mostrando "Fácil (6)" en el PRIMER
  // turno que abre un combate nuevo). Mismo escenario que el test de arriba, pero `enCombate:
  // false` — el frontend todavía no sabe que va a entrar en combate en el turno que lo abre. Antes
  // del fix, "Ataco al X" con `enCombate: false` no pasaba ni por `detectsAttackIntent` (solo se
  // evalúa con `enCombate: true`) ni por `detectsHostileSearchIntent` (su regex nunca cubrió
  // "atac..."), así que caía a `classifyAction` (LLM) y se sobreescribía con `utilityDifficultyFor`
  // (escala de SUMA de atributos, pensada para utilidad no reactiva) en vez de la escala real de
  // ataque por nivel (`difficultyHintFor`).
  it('un ataque explícito fuera de combate (enCombate: false) contra un NPC ya en escena también se clasifica por tabla, sin llamar a classifyAction', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 20,
      attributes: ATTRS,
      inventoryItems: [],
      condicionFisica: 'ILESO',
      currentLocationId: null,
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana' },
    });
    findManyNpc.mockResolvedValue([
      {
        id: 'npc1',
        aliases: ['orco enfurecido'],
        slug: 'orco-enfurecido',
        name: 'Orco Enfurecido',
        kind: 'PRINCIPAL',
        level: 2,
        role: 'amenaza',
        faction: null,
        personality: 'furioso',
        bio: 'x',
        items: [],
        attributes: ATTRS,
        raza: null,
        clase: null,
        ataqueNatural: 'Zarpazo',
        habilidadesRaciales: [],
        temperamento: 'AGRESIVO',
      },
    ]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId: 'save1', action: 'Ataco al orco enfurecido con todas mis fuerzas.', enCombate: false },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.classification.requiereTirada).toBe(true);
    expect(body.classification.banda).toBe('instantanea');
    expect(body.classification.razon).toMatch(/tabla, sin llamada a Ollama/);
    expect(classifyAction).not.toHaveBeenCalled();
    // difficultyHintFor(2, 20): diff = 2-20 = -18, diff <= -2 -> "Fácil (12)" (por NIVEL) — nunca
    // "Fácil (6)" (utilityDifficultyFor, por suma de atributos, el bug real observado).
    expect(body.classification.dificultad).toBe(12);
  });

  // Bug real jugando en vivo (2026-08-07, auditoría "revisa la partida" en directo): con un NPC
  // que ya ganó la iniciativa (`Save.pendingNpcAttack`), texto libre de defensa SIN pulsar el
  // botón de Esquivar/Defenderse (sin `savedActionId`) y sin ningún verbo de ataque caía en
  // `classifyAction` (el LLM), que decidió "no hace falta tirada" para una esquiva clarísima —
  // turnResolution.ts descarta el intercambio entero sin `requiereTirada`, dejando el combate
  // congelado sin tirar dados mientras la narración libre igual inventaba un cambio de salud sin
  // respaldo mecánico ninguno.
  it('con un ataque de NPC ya pendiente, texto libre de defensa (sin botón, sin verbo de ataque) se clasifica por tabla igualmente', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 3,
      attributes: ATTRS,
      inventoryItems: [],
      condicionFisica: 'ILESO',
      currentLocationId: null,
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana' },
      pendingNpcAttack: { npcId: 'npc1', effect: null, attribute: 'destreza', energyCost: 15, abilityName: 'Vuelo en Bandada', energyRegen: 0 },
    });
    findManyNpc.mockResolvedValue([
      {
        id: 'npc1',
        aliases: ['corretolva', 'corretolvas'],
        slug: 'corretolvas',
        name: 'Corretolvas',
        kind: 'PLANTILLA',
        level: 1,
        role: 'ave',
        faction: null,
        personality: 'nerviosa',
        bio: 'x',
        items: [],
        attributes: ATTRS,
        raza: null,
        clase: null,
        ataqueNatural: 'Picotea',
        habilidadesRaciales: [],
        temperamento: 'INOFENSIVO',
      },
    ]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      // Texto libre sin ningún verbo de ataque real — antes de este fix, `detectsAttackIntent`
      // daba false y `selectedAbility` era null (sin savedActionId), así que nada forzaba la tabla.
      payload: { saveId: 'save1', action: 'Me aparto del ataque de la corretolva confiando en mis reflejos.', enCombate: true },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.classification.requiereTirada).toBe(true);
    expect(classifyAction).not.toHaveBeenCalled();
  });

  it('una promesa/aceptación verbal ("me ocupo de él") se fuerza a banda instantánea aunque el clasificador devuelva "larga" (bug real, "revisar partida" 2026-07-30)', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 3,
      attributes: ATTRS,
      inventoryItems: [],
      condicionFisica: 'ILESO',
      currentLocationId: null,
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana' },
    });
    findManyNpc.mockResolvedValue([]);
    classifyAction.mockResolvedValue({
      requiereTirada: false,
      atributo: 'voluntad',
      dificultad: 10,
      razon: 'x',
      banda: 'larga',
      duracionEstimadaMinutos: 4320,
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId: 'save1', action: 'Yo me ocupo de él, no te preocupes.', enCombate: false },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.classification.banda).toBe('instantanea');
    expect(body.classification.duracionEstimadaMinutos).toBe(0);
    expect(body.transit).toBeUndefined();
  });
});

// Interacción con un NPC ya convaleciente/muerto fuera de combate (docs/19 pieza 2) — atajo
// mecánico legítimo, no una violación: no llama a classifyAction, no persiste ningún LogEntry.
describe('POST /turn/classify — interacción con un NPC ya convaleciente, fuera de combate (docs/19 pieza 2)', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findManyNpc.mockReset().mockResolvedValue([
      {
        id: 'npc1',
        aliases: ['orco enfurecido'],
        slug: 'orco-enfurecido',
        name: 'Orco Enfurecido',
        kind: 'PRINCIPAL',
        level: 2,
        role: 'amenaza',
        faction: null,
        personality: 'furioso',
        bio: 'x',
        items: [],
        attributes: ATTRS,
        raza: null,
        clase: null,
        ataqueNatural: 'Zarpazo',
        habilidadesRaciales: [],
        temperamento: 'AGRESIVO',
      },
    ]);
    findManyNpcState.mockReset().mockResolvedValue([
      { npcId: 'npc1', scope: '', condicionFisica: 'CONVALECIENTE', saqueado: false, energia: null, lootedItemNames: [], analizado: false },
    ]);
    findUniqueLocation.mockReset().mockResolvedValue(null);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyQuest.mockReset().mockResolvedValue([]);
    findFirstQuest.mockReset().mockResolvedValue(null);
    logEntryCreate.mockReset().mockImplementation(logEntryCreada);
    classifyAction.mockReset();
  });

  // RESTRINGIDO A MUERTO (2026-08-30, rediseño de "Matar") — antes nombrar a un CONVALECIENTE
  // fuera de combate cortaba el turno con la ficha (botón Matar = remate determinista). Ahora un
  // convaleciente ya no es terminal: el turno fluye normal por `classifyAction`, sin ficha propia.
  it('nombrar a un NPC convaleciente en escena, fuera de combate, NO dispara la ficha — el turno fluye normal', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 3,
      attributes: ATTRS,
      inventoryItems: [],
      condicionFisica: 'ILESO',
      currentLocationId: null,
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId: 'save1', action: 'Reviso al Orco Enfurecido de cerca.' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.postCombatInteraction).toBeUndefined();
    expect(classifyAction).toHaveBeenCalled();
  });

  it('no dispara si la misma acción ocurre dentro de un combate activo (enCombate: true)', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 3,
      attributes: ATTRS,
      inventoryItems: [],
      condicionFisica: 'ILESO',
      currentLocationId: null,
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId: 'save1', action: 'Reviso al Orco Enfurecido de cerca.', enCombate: true },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.postCombatInteraction).toBeUndefined();
  });
});

// Validador de "grounding" de la acción del jugador — anacronismo en el propio texto del
// jugador, el chequeo más barato (regex plano, sin consultas), se resuelve antes que ningún otro.
describe('POST /turn/classify — anacronismo en la acción del jugador (validador de grounding)', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findManyNpc.mockReset().mockResolvedValue([]);
    findManyNpcState.mockReset().mockResolvedValue([]);
    findUniqueLocation.mockReset().mockResolvedValue(null);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyQuest.mockReset().mockResolvedValue([]);
    findFirstQuest.mockReset().mockResolvedValue(null);
    logEntryCreate.mockReset().mockImplementation(logEntryCreada);
    classifyAction.mockReset();
  });

  it('un anacronismo en la propia acción se resuelve sin llamar a classifyAction ni a detectNpcsInScene', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 3,
      attributes: ATTRS,
      inventoryItems: [],
      condicionFisica: 'ILESO',
      currentLocationId: null,
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId: 'save1', action: 'Me monto en mi nave espacial y me voy volando.' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.blocked?.narration).toBe('string');
    expect(classifyAction).not.toHaveBeenCalled();
    expect(findManyNpc).not.toHaveBeenCalled();
  });
});

// Validador de "grounding" de la acción del jugador — tipo de construcción inventado (Fase 2,
// docs/mecanicas/18-validacion-accion-jugador.md), también sin consultas.
describe('POST /turn/classify — tipo de construcción inventado (validador de grounding)', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findManyNpc.mockReset().mockResolvedValue([]);
    findManyNpcState.mockReset().mockResolvedValue([]);
    findUniqueLocation.mockReset().mockResolvedValue(null);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyQuest.mockReset().mockResolvedValue([]);
    findFirstQuest.mockReset().mockResolvedValue(null);
    logEntryCreate.mockReset().mockImplementation(logEntryCreada);
    classifyAction.mockReset();
  });

  it('construir un tipo de edificio sin receta real se resuelve sin llamar a classifyAction', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 3,
      attributes: ATTRS,
      inventoryItems: [],
      condicionFisica: 'ILESO',
      currentLocationId: null,
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId: 'save1', action: 'Construyo una Torre de Cristal.' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.blocked?.narration).toBe('string');
    expect(classifyAction).not.toHaveBeenCalled();
    expect(findManyNpc).not.toHaveBeenCalled();
  });
});

// Validador de "grounding" de la acción del jugador — reclamar recolectar/despiezar una fuente
// real de OTRA región (Fase 2, docs/mecanicas/18-validacion-accion-jugador.md).
describe('POST /turn/classify — flora/fauna de otra región (validador de grounding)', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findManyNpc.mockReset().mockResolvedValue([]);
    findManyNpcState.mockReset().mockResolvedValue([]);
    findUniqueLocation.mockReset().mockResolvedValue(null);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyQuest.mockReset().mockResolvedValue([]);
    findFirstQuest.mockReset().mockResolvedValue(null);
    logEntryCreate.mockReset().mockImplementation(logEntryCreada);
    classifyAction.mockReset();
  });

  it('despiezar una fauna real cuya región conocida no coincide con la actual se resuelve sin llamar a classifyAction', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 3,
      attributes: ATTRS,
      inventoryItems: [],
      condicionFisica: 'ILESO',
      currentLocationId: 'loc1',
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });
    findUniqueLocation.mockResolvedValue({ slug: 'pilares-rotos', region: 'Las Llanuras del Viento Rojo' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId: 'save1', action: 'Despiezo un cornante.' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.blocked?.narration).toBe('string');
    expect(classifyAction).not.toHaveBeenCalled();
  });
});

// Validador de "grounding" de la acción del jugador (Fase 0/1, docs/18-validacion-accion-
// jugador.md) — reclamar un arma que no lleva encima se resuelve aquí mismo, ANTES de
// classifyAction, sin gastar ninguna llamada a IA.
describe('POST /turn/classify — arma que no lleva equipada (validador de grounding)', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findManyNpc.mockReset().mockResolvedValue([]);
    findManyNpcState.mockReset().mockResolvedValue([]);
    findUniqueLocation.mockReset().mockResolvedValue(null);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyQuest.mockReset().mockResolvedValue([]);
    findFirstQuest.mockReset().mockResolvedValue(null);
    logEntryCreate.mockReset().mockImplementation(logEntryCreada);
    classifyAction.mockReset();
  });

  it('reclamar un arma de categoría distinta a la equipada se resuelve sin llamar a classifyAction', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 3,
      attributes: ATTRS,
      inventoryItems: [{ name: 'Maza orca', slot: 'ARMA_PRINCIPAL' }],
      condicionFisica: 'ILESO',
      currentLocationId: null,
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId: 'save1', action: "Uso mi lanza y lo apuñalo." },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.blocked?.narration).toBe('string');
    expect(body.blocked.narration.length).toBeGreaterThan(0);
    expect(body.classification).toBeUndefined();
    expect(classifyAction).not.toHaveBeenCalled();
    expect(logEntryCreate).toHaveBeenCalledTimes(2);
  });

  it('interactuar con una fauna/NPC real de OTRA región (no candidata a esta escena) se resuelve sin llamar a classifyAction', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 3,
      attributes: ATTRS,
      inventoryItems: [{ name: 'Maza orca', slot: 'ARMA_PRINCIPAL' }],
      condicionFisica: 'ILESO',
      currentLocationId: 'loc1',
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });
    findUniqueLocation.mockResolvedValue({ slug: 'pilares-rotos', region: 'Las Llanuras del Viento Rojo' });
    // Fauna real de OTRA región (Ciénaga Troncal), nunca encontrada antes, sin misión que la
    // señale — `detectNpcsInScene` la descarta como candidata (homeLocationSlug de otra región),
    // así que el chequeo de grounding es la ÚNICA vía que la detecta como "existe pero no está aquí".
    findManyNpc.mockResolvedValue([
      {
        id: 'npc-cienaga',
        slug: 'bicho-cienaga',
        name: 'Bicho de Ciénaga',
        aliases: ['bicho de cienaga'],
        kind: 'PLANTILLA',
        homeLocationSlug: 'cienaga-troncal',
        level: 1,
        role: 'fauna',
        faction: null,
        personality: 'x',
        bio: 'x',
        items: [],
        attributes: ATTRS,
        raza: null,
        clase: null,
        ataqueNatural: null,
        habilidadesRaciales: [],
        temperamento: 'INOFENSIVO',
      },
    ]);
    findManyLocation.mockResolvedValue([{ slug: 'cienaga-troncal', region: 'Ciénaga Troncal' }]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId: 'save1', action: 'Ataco a un Bicho de Ciénaga.' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.blocked?.narration).toBe('string');
    expect(body.blocked.narration.length).toBeGreaterThan(0);
    expect(classifyAction).not.toHaveBeenCalled();
  });

  it('con el arma correcta (coincide con lo equipado), sigue el camino normal', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 3,
      attributes: ATTRS,
      inventoryItems: [{ name: 'Maza orca', slot: 'ARMA_PRINCIPAL' }],
      condicionFisica: 'ILESO',
      currentLocationId: null,
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false,
      atributo: 'fuerza',
      dificultad: 10,
      razon: 'x',
      banda: 'instantanea',
      duracionEstimadaMinutos: 0,
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId: 'save1', action: 'Ataco con mi maza.' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.blocked).toBeUndefined();
  });
});

// Validador de "grounding" de la acción del jugador — Fase 3 acotada a comillas
// (docs/mecanicas/18-validacion-accion-jugador.md): NPC/fauna nombrado ENTRE COMILLAS que no existe en
// absoluto en el catálogo, no solo "existe pero no está en esta escena" (eso ya es la Fase 1,
// arriba).
describe('POST /turn/classify — NPC/fauna inventado citado entre comillas (validador de grounding, Fase 3)', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findManyNpc.mockReset().mockResolvedValue([]);
    findManyNpcState.mockReset().mockResolvedValue([]);
    findUniqueLocation.mockReset().mockResolvedValue(null);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyQuest.mockReset().mockResolvedValue([]);
    findFirstQuest.mockReset().mockResolvedValue(null);
    logEntryCreate.mockReset().mockImplementation(logEntryCreada);
    classifyAction.mockReset();
  });

  it('atacar a un nombre citado entre comillas que no existe en ningún sitio del catálogo se resuelve sin llamar a classifyAction', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 3,
      attributes: ATTRS,
      inventoryItems: [],
      condicionFisica: 'ILESO',
      currentLocationId: null,
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId: 'save1', action: "Ataco a 'el Dragón de Fuego Eterno'." },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.blocked?.narration).toBe('string');
    expect(classifyAction).not.toHaveBeenCalled();
  });

  it('el mismo nombre SIN comillas no dispara (prosa libre legítima), sigue el camino normal', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 3,
      attributes: ATTRS,
      inventoryItems: [],
      condicionFisica: 'ILESO',
      currentLocationId: null,
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });
    classifyAction.mockResolvedValue({
      requiereTirada: false,
      atributo: 'fuerza',
      dificultad: 10,
      razon: 'x',
      banda: 'instantanea',
      duracionEstimadaMinutos: 0,
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId: 'save1', action: 'Ataco al Dragón de Fuego Eterno.' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.blocked).toBeUndefined();
  });
});

// Validador de "grounding" de la acción del jugador — Fase 3 acotada a comillas: flora/mineral
// citado entre comillas que no existe en absoluto en `harvestSourceAliases`, no solo "existe pero
// en otra región" (eso ya es la Fase 2, arriba).
describe('POST /turn/classify — flora/mineral inventado citado entre comillas (validador de grounding, Fase 3)', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findManyNpc.mockReset().mockResolvedValue([]);
    findManyNpcState.mockReset().mockResolvedValue([]);
    findUniqueLocation.mockReset().mockResolvedValue(null);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyQuest.mockReset().mockResolvedValue([]);
    findFirstQuest.mockReset().mockResolvedValue(null);
    logEntryCreate.mockReset().mockImplementation(logEntryCreada);
    classifyAction.mockReset();
  });

  it('recolectar un nombre citado entre comillas que no existe en ningún catálogo se resuelve sin llamar a classifyAction', async () => {
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      level: 3,
      attributes: ATTRS,
      inventoryItems: [],
      condicionFisica: 'ILESO',
      currentLocationId: null,
      endedAt: null,
      characterTransit: null,
      worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/turn/classify',
      payload: { saveId: 'save1', action: "Recolecto 'flor de cristal lunar'." },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.blocked?.narration).toBe('string');
    expect(classifyAction).not.toHaveBeenCalled();
  });
});

// Fase G del 0.1 (hallazgo G10): el estado de fauna es por especie y lugar — tras matar a un
// Gesgurio, la caza de OTRO desde la zona abría la ficha del muerto en vez del combate.
describe('POST /turn/classify — ficha del muerto frente a una caza nueva de la misma especie (G10)', () => {
  const SAVE = {
    id: 'save1', worldId: 'world1', level: 3, attributes: ATTRS, inventoryItems: [], condicionFisica: 'ILESO',
    currentLocationId: null, endedAt: null, characterTransit: null, worldState: { fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
  };
  beforeEach(() => {
    findUniqueSave.mockReset().mockResolvedValue(SAVE);
    findManyNpc.mockReset().mockResolvedValue([
      {
        id: 'npc1', aliases: ['gesgurio'], slug: 'gesgurio', name: 'Gesgurio', kind: 'PRINCIPAL', level: 1, role: 'fauna', faction: null,
        personality: 'x', bio: 'x', items: [], attributes: ATTRS, raza: null, clase: null, ataqueNatural: 'Mordisco', habilidadesRaciales: [], temperamento: 'CAUTELOSO',
      },
    ]);
    findManyNpcState.mockReset().mockResolvedValue([
      { npcId: 'npc1', scope: '', condicionFisica: 'MUERTO', saqueado: true, energia: null, lootedItemNames: [], analizado: false },
    ]);
    findUniqueLocation.mockReset().mockResolvedValue(null);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyQuest.mockReset().mockResolvedValue([]);
    findFirstQuest.mockReset().mockResolvedValue(null);
    logEntryCreate.mockReset().mockImplementation(logEntryCreada);
    findFirstCombatEncounter.mockReset().mockResolvedValue(null);
    classifyAction.mockReset().mockResolvedValue({
      requiereTirada: false, atributo: 'fuerza', dificultad: 8, razon: 'x', banda: 'instantanea', duracionEstimadaMinutos: 0,
    });
  });

  async function clasificar(action: string) {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/turn/classify', payload: { saveId: 'save1', action } });
    expect(res.statusCode).toBe(200);
    return res.json();
  }

  it('nombrar al muerto fuera de combate sigue abriendo su ficha', async () => {
    expect((await clasificar('Registro al Gesgurio caído.')).postCombatInteraction?.slug).toBe('gesgurio');
  });

  it('el texto de la caza de la zona no abre la ficha del muerto', async () => {
    expect((await clasificar("Salgo a cazar y ataco a 'Gesgurio'.")).postCombatInteraction).toBeUndefined();
  });

  it('con un combate de grupo ya en curso tampoco', async () => {
    findFirstCombatEncounter.mockResolvedValue({ id: 'enc1' } as never);
    expect((await clasificar('Registro al Gesgurio caído.')).postCombatInteraction).toBeUndefined();
  });
});
