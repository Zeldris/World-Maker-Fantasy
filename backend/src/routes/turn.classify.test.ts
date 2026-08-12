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

vi.mock('../services/narrador.js', () => ({
  classifyAction: (...args: unknown[]) => classifyAction(...args),
}));

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
