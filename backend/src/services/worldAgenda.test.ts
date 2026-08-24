import { describe, it, expect, vi } from 'vitest';
import { advanceEntry, initialAgenda, parseAgenda, advanceWorldAgenda } from './worldAgenda.js';

const loadSessionFacts = vi.fn();
const appendSessionFacts = vi.fn();
vi.mock('./worldFacts.js', () => ({
  loadSessionFacts: (...args: unknown[]) => loadSessionFacts(...args),
  appendSessionFacts: (...args: unknown[]) => appendSessionFacts(...args),
}));
loadSessionFacts.mockResolvedValue([]);
appendSessionFacts.mockResolvedValue(undefined);

describe('initialAgenda', () => {
  it('siembra un único hito, etapa 0, con el plazo de la primera etapa desde el momento actual', () => {
    const agenda = initialAgenda(480);
    expect(agenda).toHaveLength(1);
    expect(agenda[0]).toMatchObject({ id: 'conflicto-serhu-concordia-vs-helsig-goshg', stage: 0 });
    expect(agenda[0].nextStageAtMinutes).toBe(480 + 7 * 24 * 60);
  });
});

describe('parseAgenda', () => {
  it('null/undefined se leen como lista vacía, nunca como error', () => {
    expect(parseAgenda(null)).toEqual([]);
    expect(parseAgenda(undefined)).toEqual([]);
  });

  it('devuelve la lista tal cual si ya hay datos', () => {
    const raw = [{ id: 'x', title: 't', stage: 1, maxStage: 4, nextStageAtMinutes: 100 }];
    expect(parseAgenda(raw as never)).toEqual(raw);
  });
});

describe('advanceEntry', () => {
  const base = { id: 'conflicto', title: 'Conflicto', stage: 0, maxStage: 4, nextStageAtMinutes: 1000 };

  it('no avanza si el tiempo de ficción todavía no llega al plazo', () => {
    const { entry, stagesCrossed } = advanceEntry(base, 999);
    expect(stagesCrossed).toBe(0);
    expect(entry).toEqual(base);
  });

  it('avanza exactamente 1 etapa al cruzar el plazo, y recalcula el siguiente plazo', () => {
    const { entry, stagesCrossed } = advanceEntry(base, 1000);
    expect(stagesCrossed).toBe(1);
    expect(entry.stage).toBe(1);
    expect(entry.nextStageAtMinutes).toBe(1000 + 7 * 24 * 60);
  });

  it('cruza varias etapas de golpe si el salto de tiempo es grande (viaje largo), nunca se queda atrasada', () => {
    // Cada cruce recalcula el plazo +intervalo desde el plazo anterior — aterrizar justo en
    // "plazo inicial + 2 intervalos" cruza exactamente 3 veces (1000, 1000+I, 1000+2I, las tres
    // <= al valor de aterrizaje).
    const bigJump = 1000 + 7 * 24 * 60 * 2;
    const { entry, stagesCrossed } = advanceEntry(base, bigJump);
    expect(stagesCrossed).toBe(3);
    expect(entry.stage).toBe(3);
  });

  it('nunca supera maxStage, aunque el tiempo siga corriendo', () => {
    const almostMax = { ...base, stage: 3 };
    const farFuture = 1000 + 7 * 24 * 60 * 50;
    const { entry, stagesCrossed } = advanceEntry(almostMax, farFuture);
    expect(entry.stage).toBe(4);
    expect(stagesCrossed).toBe(1);
  });
});

describe('advanceWorldAgenda', () => {
  function makePrisma(states: unknown[]) {
    const worldStateUpdate = vi.fn();
    const worldPopulationUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = { worldState: { update: worldStateUpdate }, worldPopulation: { updateMany: worldPopulationUpdateMany } };
    const $transaction = vi.fn((fn: (tx: unknown) => Promise<void>) => fn(tx));
    const prisma = {
      worldState: { findMany: vi.fn().mockResolvedValue(states) },
      $transaction,
    };
    return { prisma, worldStateUpdate, worldPopulationUpdateMany };
  }

  it('siembra la agenda inicial si está vacía, sin depleciones ni hechos (etapa 0 es silenciosa)', async () => {
    const { prisma, worldStateUpdate, worldPopulationUpdateMany } = makePrisma([
      { id: 'ws1', saveId: 'save1', agenda: [], fictionalMinutes: 480, save: { worldId: 'world1' } },
    ]);
    const result = await advanceWorldAgenda(prisma as never);
    expect(result).toEqual({ statesAdvanced: 1, stagesCrossed: 0 });
    expect(worldStateUpdate).toHaveBeenCalledTimes(1);
    expect(worldPopulationUpdateMany).not.toHaveBeenCalled();
    expect(appendSessionFacts).not.toHaveBeenCalled();
  });

  it('no toca nada si ya hay agenda y ninguna entrada venció todavía', async () => {
    const agenda = [{ id: 'conflicto-serhu-concordia-vs-helsig-goshg', title: 't', stage: 0, maxStage: 4, nextStageAtMinutes: 999999 }];
    const { prisma, worldStateUpdate } = makePrisma([
      { id: 'ws1', saveId: 'save1', agenda, fictionalMinutes: 480, save: { worldId: 'world1' } },
    ]);
    const result = await advanceWorldAgenda(prisma as never);
    expect(result).toEqual({ statesAdvanced: 0, stagesCrossed: 0 });
    expect(worldStateUpdate).not.toHaveBeenCalled();
  });

  it('al cruzar una etapa, deplecia Helsig Y Goshg y añade el hecho narrativo de esa etapa', async () => {
    const agenda = [{ id: 'conflicto-serhu-concordia-vs-helsig-goshg', title: 't', stage: 0, maxStage: 4, nextStageAtMinutes: 500 }];
    const { prisma, worldPopulationUpdateMany } = makePrisma([
      { id: 'ws1', saveId: 'save1', agenda, fictionalMinutes: 500, save: { worldId: 'world1' } },
    ]);
    await advanceWorldAgenda(prisma as never);
    expect(worldPopulationUpdateMany).toHaveBeenCalledWith({
      where: { worldId: 'world1', targetType: 'RAZA', targetSlug: 'orcos-cristal-helado', poblacion: { gte: 20 } },
      data: { poblacion: { decrement: 20 } },
    });
    expect(worldPopulationUpdateMany).toHaveBeenCalledWith({
      where: { worldId: 'world1', targetType: 'RAZA', targetSlug: 'orcos-cienaga', poblacion: { gte: 20 } },
      data: { poblacion: { decrement: 20 } },
    });
    expect(appendSessionFacts).toHaveBeenCalledTimes(1);
    const facts = appendSessionFacts.mock.calls[0]?.[2] as string[];
    expect(facts).toHaveLength(1);
    expect(facts[0]).toContain('Serhu');
  });

  it('solo mira partidas de Gorhorn no terminadas (filtro ya en el where de la query)', async () => {
    const { prisma } = makePrisma([]);
    await advanceWorldAgenda(prisma as never);
    expect(prisma.worldState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { save: { characterName: 'Gorhorn', endedAt: null } } }),
    );
  });
});
