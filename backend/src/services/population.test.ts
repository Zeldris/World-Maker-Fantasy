import { describe, it, expect, vi } from 'vitest';
import {
  populationTargetSlugFor,
  decrementPopulationOnDeath,
  stripRegionArticle,
  UMBRAL_MINIMO_REPRODUCCION,
  syncFactionPopulationToKingdomStats,
} from './population.js';

describe('stripRegionArticle', () => {
  // Bug real jugando en vivo (2026-08-07, "no aparece ningún recurso en la Hondonada"):
  // `WorldPopulation.distribucion` se siembra sin artículo, `Location.region` siempre lo lleva
  // completo — 3 de las 5 regiones reales del mundo lo llevan y quedaban rotas en silencio.
  it.each([
    ['Las Llanuras del Viento Rojo', 'Llanuras del Viento Rojo'],
    ['El Margen Silencioso', 'Margen Silencioso'],
    ['La Meseta del Orden', 'Meseta del Orden'],
    ['Cristal Helado', 'Cristal Helado'],
    ['Ciénaga Troncal', 'Ciénaga Troncal'],
  ])('%s -> %s', (region, expected) => {
    expect(stripRegionArticle(region)).toBe(expected);
  });
});

describe('populationTargetSlugFor', () => {
  it('fauna (raza null) usa el slug del NPC directamente', () => {
    expect(populationTargetSlugFor(null, 'murgol', 'Las Llanuras del Viento Rojo')).toBe('murgol');
    expect(populationTargetSlugFor(null, 'cornante', null)).toBe('cornante');
  });

  it('razas de un solo territorio usan el slug de raza directo', () => {
    expect(populationTargetSlugFor('goirntes', 'algun-npc', 'La Meseta del Orden')).toBe('goirntes');
    expect(populationTargetSlugFor('nabieus', 'otro-npc', null)).toBe('nabieus');
  });

  it('orcos se desambiguan por región activa (3 clanes regionales)', () => {
    expect(populationTargetSlugFor('orcos', 'torgash', 'Las Llanuras del Viento Rojo')).toBe('orcos-llanuras');
    expect(populationTargetSlugFor('orcos', 'algun-npc', 'Cristal Helado')).toBe('orcos-cristal-helado');
    expect(populationTargetSlugFor('orcos', 'algun-npc', 'Ciénaga Troncal')).toBe('orcos-cienaga');
  });

  it('orcos sin región reconocible no devuelve fila (nunca inventa una)', () => {
    expect(populationTargetSlugFor('orcos', 'algun-npc', null)).toBeNull();
    expect(populationTargetSlugFor('orcos', 'algun-npc', 'El Margen Silencioso')).toBeNull();
  });
});

// CR-6 (hito 0.2): partida con su mundo ya clonado — la población que se toca es la suya.
const saveClonada = { findUniqueOrThrow: vi.fn().mockResolvedValue({ worldId: 'world1', worldState: { mundoClonadoEn: new Date() } }) };

describe('decrementPopulationOnDeath', () => {
  // Cobertura reescrita (auditoría 2026-08-06, bug real de condición de carrera): antes esto era
  // `findUnique` + `update` con el valor de `poblacion` capturado en memoria — sin bloqueo, un tick
  // de crecimiento diario casi simultáneo sobre la misma fila podía pisar la muerte en silencio.
  // Ahora es un `updateMany` atómico con `{ decrement: 1 }`, guardado por `poblacion: { gt: 0 } }`.
  it('resta 1 a la fila que corresponde de forma atómica, sin leer nada antes', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    // CR-40 (40e): la muerte de fauna también hace avanzar las misiones de cazar esa especie.
    const quests = vi.fn().mockResolvedValue([]);
    const tx = { worldPopulation: { updateMany }, save: saveClonada, quest: { findMany: quests } };
    await decrementPopulationOnDeath(tx as any, 'save1', null, 'murgol', 'Las Llanuras del Viento Rojo');
    expect(updateMany).toHaveBeenCalledWith({
      where: { saveId: 'save1', targetType: 'FAUNA', targetSlug: 'murgol', poblacion: { gt: 0 } },
      data: { poblacion: { decrement: 1 } },
    });
    expect(quests).toHaveBeenCalledWith({ where: { saveId: 'save1', status: 'ACTIVA', tipoMision: 'CAZAR' } });
  });

  it('el guard poblacion > 0 evita bajar de 0 sin necesidad de releer nada', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const tx = { worldPopulation: { updateMany }, save: saveClonada };
    await decrementPopulationOnDeath(tx as any, 'save1', 'orcos', 'torgash', 'Las Llanuras del Viento Rojo');
    expect(updateMany).toHaveBeenCalledWith({
      where: { saveId: 'save1', targetType: 'RAZA', targetSlug: 'orcos-llanuras', poblacion: { gt: 0 } },
      data: { poblacion: { decrement: 1 } },
    });
  });

  it('no hace nada si populationTargetSlugFor no reconoce la región (nunca bloquea el turno)', async () => {
    const updateMany = vi.fn();
    const tx = { worldPopulation: { updateMany }, save: saveClonada };
    await decrementPopulationOnDeath(tx as any, 'save1', 'orcos', 'algun-npc', null);
    // Región nula para 'orcos' => populationTargetSlugFor devuelve null antes de tocar la DB.
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe('syncFactionPopulationToKingdomStats', () => {
  // docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.6 (2026-09-21) — puente entre WorldPopulation (FACCION,
  // crece con crecerPoblacionDePartida) y KingdomStats de la Faction real (§ 4.2, ya generalizado).
  it('sin filas FACCION, no hace nada', async () => {
    const prisma = { worldPopulation: { findMany: vi.fn().mockResolvedValue([]) }, faction: { findFirst: vi.fn() }, kingdomStats: { findFirst: vi.fn(), update: vi.fn() } };
    const result = await syncFactionPopulationToKingdomStats(prisma as any);
    expect(result.synced).toBe(0);
    expect(prisma.faction.findFirst).not.toHaveBeenCalled();
  });

  it('agrupa las 4 filas de una facción por su prefijo de targetSlug y actualiza su KingdomStats', async () => {
    const findManyPop = vi.fn().mockResolvedValue([
      { targetSlug: 'clan-serhu-poblacion', poblacion: 70 },
      { targetSlug: 'clan-serhu-soldados', poblacion: 500 },
      { targetSlug: 'clan-serhu-trabajadores', poblacion: 150 },
      { targetSlug: 'clan-serhu-visitantes', poblacion: 0 },
    ]);
    const findFirstFaction = vi.fn().mockResolvedValue({ id: 'faction1' });
    const findFirstKingdomStats = vi.fn().mockResolvedValue({ id: 'ks1' });
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      worldPopulation: { findMany: findManyPop },
      faction: { findFirst: findFirstFaction },
      kingdomStats: { findFirst: findFirstKingdomStats, update },
    };
    const result = await syncFactionPopulationToKingdomStats(prisma as any);
    expect(findFirstFaction).toHaveBeenCalledWith({ where: { slug: 'clan-serhu', saveId: null }, select: { id: true } });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'ks1' },
      data: { poblacion: 70, soldados: 500, trabajadores: 150, visitantes: 0 },
    });
    expect(result.synced).toBe(1);
  });

  it('facción sin Faction real de catálogo (desalineado) no bloquea el resto — se salta sin más', async () => {
    const prisma = {
      worldPopulation: { findMany: vi.fn().mockResolvedValue([{ targetSlug: 'clan-fantasma-poblacion', poblacion: 10 }]) },
      faction: { findFirst: vi.fn().mockResolvedValue(null) },
      kingdomStats: { findFirst: vi.fn(), update: vi.fn() },
    };
    const result = await syncFactionPopulationToKingdomStats(prisma as any);
    expect(result.synced).toBe(0);
    expect(prisma.kingdomStats.findFirst).not.toHaveBeenCalled();
  });

  it('facción sin KingdomStats todavía (sin reino fundado) no bloquea el resto — se salta sin más', async () => {
    const prisma = {
      worldPopulation: { findMany: vi.fn().mockResolvedValue([{ targetSlug: 'clan-serhu-poblacion', poblacion: 70 }]) },
      faction: { findFirst: vi.fn().mockResolvedValue({ id: 'faction1' }) },
      kingdomStats: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    };
    const result = await syncFactionPopulationToKingdomStats(prisma as any);
    expect(result.synced).toBe(0);
    expect(prisma.kingdomStats.update).not.toHaveBeenCalled();
  });

  it('una fila FACCION con targetSlug que no sigue el patrón conocido se ignora sin inventar nada', async () => {
    const prisma = {
      worldPopulation: { findMany: vi.fn().mockResolvedValue([{ targetSlug: 'algo-raro', poblacion: 5 }]) },
      faction: { findFirst: vi.fn() },
      kingdomStats: { findFirst: vi.fn(), update: vi.fn() },
    };
    const result = await syncFactionPopulationToKingdomStats(prisma as any);
    expect(result.synced).toBe(0);
    expect(prisma.faction.findFirst).not.toHaveBeenCalled();
  });
});
