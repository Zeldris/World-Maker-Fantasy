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
