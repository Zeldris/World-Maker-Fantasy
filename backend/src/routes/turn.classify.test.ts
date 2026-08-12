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
const logEntryCreate = vi.fn();
const classifyAction = vi.fn();

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
    quest: { findMany: (...args: unknown[]) => findManyQuest(...args) },
    logEntry: { create: (...args: unknown[]) => logEntryCreate(...args) },
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

const ATTRS = { fuerza: 15, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 };

describe('POST /turn/classify — camino tabulado de combate (sin Ollama)', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findManyNpc.mockReset();
    findManyNpcState.mockReset().mockResolvedValue([]);
    findUniqueLocation.mockReset().mockResolvedValue(null);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyQuest.mockReset().mockResolvedValue([]);
    logEntryCreate.mockReset().mockResolvedValue({});
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

// Interacción con un NPC ya incapacitado/muerto fuera de combate (docs/19 pieza 2) — atajo
// mecánico legítimo, no una violación: no llama a classifyAction, no persiste ningún LogEntry.
describe('POST /turn/classify — interacción con un NPC ya incapacitado, fuera de combate (docs/19 pieza 2)', () => {
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
      { npcId: 'npc1', scope: '', condicionFisica: 'INCAPACITADO', saqueado: false, energia: null, lootedItemNames: [], analizado: false },
    ]);
    findUniqueLocation.mockReset().mockResolvedValue(null);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyQuest.mockReset().mockResolvedValue([]);
    logEntryCreate.mockReset().mockResolvedValue({});
    classifyAction.mockReset();
  });

  it('nombrar a un NPC incapacitado en escena, fuera de combate, devuelve la ficha sin llamar a classifyAction ni persistir nada', async () => {
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
      payload: { saveId: 'save1', action: 'Reviso al Orco Enfurecido de cerca.' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.postCombatInteraction).toEqual({
      slug: 'orco-enfurecido',
      name: 'Orco Enfurecido',
      condicionFisica: 'INCAPACITADO',
      saqueado: false,
    });
    expect(classifyAction).not.toHaveBeenCalled();
    expect(logEntryCreate).not.toHaveBeenCalled();
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
    logEntryCreate.mockReset().mockResolvedValue({});
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
// docs/18-validacion-accion-jugador.md), también sin consultas.
describe('POST /turn/classify — tipo de construcción inventado (validador de grounding)', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findManyNpc.mockReset().mockResolvedValue([]);
    findManyNpcState.mockReset().mockResolvedValue([]);
    findUniqueLocation.mockReset().mockResolvedValue(null);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyQuest.mockReset().mockResolvedValue([]);
    logEntryCreate.mockReset().mockResolvedValue({});
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
// real de OTRA región (Fase 2, docs/18-validacion-accion-jugador.md).
describe('POST /turn/classify — flora/fauna de otra región (validador de grounding)', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findManyNpc.mockReset().mockResolvedValue([]);
    findManyNpcState.mockReset().mockResolvedValue([]);
    findUniqueLocation.mockReset().mockResolvedValue(null);
    findManyLocation.mockReset().mockResolvedValue([]);
    findManyQuest.mockReset().mockResolvedValue([]);
    logEntryCreate.mockReset().mockResolvedValue({});
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
    logEntryCreate.mockReset().mockResolvedValue({});
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
