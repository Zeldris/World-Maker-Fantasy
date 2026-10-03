import { describe, it, expect, vi } from 'vitest';
// Libro de Sucesos (CR-3): tiene sus propios tests; aquí la transacción simulada no lo lleva.
vi.mock('./cronista/sucesos.js', () => ({ registrarSuceso: vi.fn(async () => 'suceso-1') }));
import { advanceEntry, initialAgenda, parseAgenda, advanceWorldAgenda, regionControlFor, type AgendaEntry } from './worldAgenda.js';

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

describe('regionControlFor', () => {
  const conflictoEn = (stage: number): AgendaEntry[] => [
    { id: 'conflicto-serhu-concordia-vs-helsig-goshg', title: 'x', stage, maxStage: 4, nextStageAtMinutes: 999999 },
  ];

  it('Las Llanuras del Viento Rojo (región del propio agresor) siempre dueño original, aunque el conflicto esté en la etapa final', () => {
    const control = regionControlFor('Las Llanuras del Viento Rojo', conflictoEn(4), 'Clan Serhu');
    expect(control).toEqual({ estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: 'Clan Serhu' });
  });

  it('región sin conflicto sembrado (ej. Meseta del Orden) se queda fija con su dueño original', () => {
    const control = regionControlFor('La Meseta del Orden', conflictoEn(4), 'Concordia de Hierro');
    expect(control).toEqual({ estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: 'Concordia de Hierro' });
  });

  it('región con conflicto sembrado sin ninguna entrada en la agenda (partida antigua) se trata como etapa 0', () => {
    const control = regionControlFor('Cristal Helado', [], 'Clan Helsig');
    expect(control).toEqual({ estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: 'Clan Helsig' });
  });

  it.each([0, 1])('etapa %i: dueño original, sin disputa todavía', (stage) => {
    const control = regionControlFor('Cristal Helado', conflictoEn(stage), 'Clan Helsig');
    expect(control).toEqual({ estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: 'Clan Helsig' });
  });

  it.each([2, 3])('etapa %i: en disputa, agresor identificado, dueño original todavía resiste', (stage) => {
    const control = regionControlFor('Cristal Helado', conflictoEn(stage), 'Clan Helsig');
    expect(control).toEqual({ estado: 'EN_DISPUTA', duenoActual: 'Clan Helsig', agresor: 'Clan Serhu-Concordia de Hierro' });
  });

  it('etapa 4 (maxStage): conquistada por el agresor, el dueño original ya no controla nada', () => {
    const control = regionControlFor('Cristal Helado', conflictoEn(4), 'Clan Helsig');
    expect(control).toEqual({ estado: 'CONQUISTADA', duenoActual: 'Clan Serhu-Concordia de Hierro' });
  });

  it('Ciénaga Troncal (segunda región en conflicto) sigue el mismo cálculo, dueño propio', () => {
    const control = regionControlFor('Ciénaga Troncal', conflictoEn(3), 'Clan Goshg');
    expect(control).toEqual({ estado: 'EN_DISPUTA', duenoActual: 'Clan Goshg', agresor: 'Clan Serhu-Concordia de Hierro' });
  });
});

describe('advanceWorldAgenda', () => {
  function makePrisma(states: unknown[]) {
    const worldStateUpdate = vi.fn();
    const worldPopulationUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const logEntryCreate = vi.fn();
    const tx = {
      worldState: { update: worldStateUpdate },
      worldPopulation: { updateMany: worldPopulationUpdateMany },
      logEntry: { create: logEntryCreate },
    };
    const $transaction = vi.fn((fn: (tx: unknown) => Promise<void>) => fn(tx));
    // Fase D (hito 0.1): la agenda sincroniza las relaciones reales Serhu→Helsig/Goshg.
    const factionRelationFindMany = vi.fn().mockResolvedValue([{ id: 'rel-helsig' }, { id: 'rel-goshg' }]);
    const factionRelationUpdate = vi.fn();
    const prisma = {
      worldState: { findMany: vi.fn().mockResolvedValue(states) },
      factionRelation: { findMany: factionRelationFindMany, update: factionRelationUpdate },
      $transaction,
    };
    return { prisma, worldStateUpdate, worldPopulationUpdateMany, logEntryCreate, factionRelationFindMany, factionRelationUpdate };
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
    const { prisma, worldPopulationUpdateMany, logEntryCreate, factionRelationFindMany, factionRelationUpdate } = makePrisma([
      { id: 'ws1', saveId: 'save1', agenda, fictionalMinutes: 500, fictionalDateLabel: 'Día 8, mañana', save: { worldId: 'world1' } },
    ]);
    await advanceWorldAgenda(prisma as never);
    // Fase D (hito 0.1) — la etapa 1 empuja Serhu→Helsig/Goshg hasta presión 70 (solo las que estén por debajo).
    expect(factionRelationFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ worldId: 'world1', presion: { lt: 70 } }) }));
    expect(factionRelationUpdate).toHaveBeenCalledWith({ where: { id: 'rel-helsig' }, data: { presion: 70, type: typeForPresion(70), stage: 1 } });
    expect(worldPopulationUpdateMany).toHaveBeenCalledWith({
      where: { worldId: 'world1', saveId: null, targetType: 'RAZA', targetSlug: 'orcos-cristal-helado', poblacion: { gte: 20 } },
      data: { poblacion: { decrement: 20 } },
    });
    expect(worldPopulationUpdateMany).toHaveBeenCalledWith({
      where: { worldId: 'world1', saveId: null, targetType: 'RAZA', targetSlug: 'orcos-cienaga', poblacion: { gte: 20 } },
      data: { poblacion: { decrement: 20 } },
    });
    expect(appendSessionFacts).toHaveBeenCalledTimes(1);
    const facts = appendSessionFacts.mock.calls[0]?.[2] as string[];
    expect(facts).toHaveLength(1);
    expect(facts[0]).toContain('Serhu');

    // Canal WORLD (Grupo 3 § Mundo determinista, 2026-08-25) — el mismo hecho, visible en el panel
    // "El mundo", no solo en el contexto invisible del Narrador.
    expect(logEntryCreate).toHaveBeenCalledTimes(1);
    expect(logEntryCreate).toHaveBeenCalledWith({
      data: { saveId: 'save1', channel: 'WORLD', text: expect.stringContaining('Serhu'), timeLabel: 'Día 8, mañana', fictionalMinutes: 500 },
    });
  });

  it('solo mira partidas de Gorhorn no terminadas (filtro ya en el where de la query)', async () => {
    const { prisma } = makePrisma([]);
    await advanceWorldAgenda(prisma as never);
    expect(prisma.worldState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { save: { characterName: 'Gorhorn', endedAt: null } } }),
    );
  });
});

/// Fase D del hito 0.1 — el control de región sale de la relación real; con la presión sembrada no
/// cambia nada de lo que ve la jugadora.
import { presionMinimaDeEtapa, regionControlDesdeStage } from './worldAgenda.js';
import { stageForPresion, typeForPresion } from './factionRelations.js';

describe('Fase D — control de región desde la relación real', () => {
  it('la presión mínima de cada etapa da exactamente esa etapa', () => {
    for (let etapa = 0; etapa <= 4; etapa++) expect(stageForPresion(presionMinimaDeEtapa(etapa))).toBe(etapa);
  });

  it('con la presión sembrada (70, etapa 1) el control es el de siempre: dueño original', () => {
    expect(regionControlDesdeStage('Cristal Helado', stageForPresion(70), 'Clan Helsig')).toEqual({ estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: 'Clan Helsig' });
  });

  it('misma regla que la agenda: 2-3 en disputa, 4 conquistada, y las Llanuras nunca entran en disputa', () => {
    expect(regionControlDesdeStage('Ciénaga Troncal', 2, 'Clan Goshg').estado).toBe('EN_DISPUTA');
    expect(regionControlDesdeStage('Ciénaga Troncal', 4, 'Clan Goshg')).toMatchObject({ estado: 'CONQUISTADA' });
    expect(regionControlDesdeStage('Las Llanuras del Viento Rojo', 4, 'Clan Serhu').estado).toBe('NEUTRAL_O_DUENO_ORIGINAL');
    expect(regionControlDesdeStage('Meseta del Orden', 4, 'Concordia de Hierro').estado).toBe('NEUTRAL_O_DUENO_ORIGINAL');
  });
});

// CR-3 (hito 0.2): lo que apunta el Libro de Sucesos al cruzar cada etapa del conflicto.
import { sucesosDeEtapaConflicto } from './worldAgenda.js';
import { textoDeSuceso, type TipoSuceso, type DatosSuceso } from './cronista/catalogoSucesos.js';

describe('sucesosDeEtapaConflicto', () => {
  const textos = (etapa: number) => sucesosDeEtapaConflicto(etapa).map((s) => textoDeSuceso(s.tipo as TipoSuceso, s.datos as DatosSuceso[TipoSuceso]));

  it('cada etapa 1-4 deja su suceso, con frases bien construidas', () => {
    expect(textos(1)).toEqual(['La relación entre el Clan Serhu y los clanes Helsig y Goshg pasa de escaramuzas sueltas a incursiones organizadas.']);
    expect(textos(2)).toEqual(['El Clan Serhu y la Concordia de Hierro sellan una alianza.']);
    expect(textos(3)).toEqual(['El Clan Helsig pierde parte de sus asentamientos.', 'El Clan Goshg pierde parte de sus asentamientos.']);
    expect(textos(4)).toEqual(['El Clan Serhu, con la Concordia de Hierro, declara la guerra a los clanes Helsig y Goshg.']);
    expect(sucesosDeEtapaConflicto(0)).toEqual([]);
  });
});
