import { describe, it, expect, vi } from 'vitest';
import {
  populationTargetSlugFor,
  decrementPopulationOnDeath,
  growAllPopulations,
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

describe('decrementPopulationOnDeath', () => {
  // Cobertura reescrita (auditoría 2026-08-06, bug real de condición de carrera): antes esto era
  // `findUnique` + `update` con el valor de `poblacion` capturado en memoria — sin bloqueo, un tick
  // de `growAllPopulations` casi simultáneo sobre la misma fila podía pisar la muerte en silencio.
  // Ahora es un `updateMany` atómico con `{ decrement: 1 }`, guardado por `poblacion: { gt: 0 } }`.
  it('resta 1 a la fila que corresponde de forma atómica, sin leer nada antes', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = { worldPopulation: { updateMany } };
    await decrementPopulationOnDeath(tx as any, 'world1', null, 'murgol', 'Las Llanuras del Viento Rojo');
    expect(updateMany).toHaveBeenCalledWith({
      where: { worldId: 'world1', targetType: 'FAUNA', targetSlug: 'murgol', poblacion: { gt: 0 } },
      data: { poblacion: { decrement: 1 } },
    });
  });

  it('el guard poblacion > 0 evita bajar de 0 sin necesidad de releer nada', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const tx = { worldPopulation: { updateMany } };
    await decrementPopulationOnDeath(tx as any, 'world1', 'orcos', 'torgash', 'Las Llanuras del Viento Rojo');
    expect(updateMany).toHaveBeenCalledWith({
      where: { worldId: 'world1', targetType: 'RAZA', targetSlug: 'orcos-llanuras', poblacion: { gt: 0 } },
      data: { poblacion: { decrement: 1 } },
    });
  });

  it('no hace nada si populationTargetSlugFor no reconoce la región (nunca bloquea el turno)', async () => {
    const updateMany = vi.fn();
    const tx = { worldPopulation: { updateMany } };
    await decrementPopulationOnDeath(tx as any, 'world1', 'orcos', 'algun-npc', null);
    // Región nula para 'orcos' => populationTargetSlugFor devuelve null antes de tocar la DB.
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe('growAllPopulations', () => {
  const DAY_MS = 24 * 60 * 60_000;

  it('no crece por debajo del umbral mínimo de reproducción', async () => {
    const update = vi.fn();
    const prisma = {
      worldPopulation: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'r1', targetType: 'FAUNA', poblacion: UMBRAL_MINIMO_REPRODUCCION - 1, poblacionMax: 1000, updatedAt: new Date(Date.now() - 30 * DAY_MS) },
        ]),
        update,
      },
    };
    const result = await growAllPopulations(prisma as any);
    expect(update).not.toHaveBeenCalled();
    expect(result.updated).toBe(0);
  });

  it('no toca la fila si el crecimiento calculado todavía no cruza 1 individuo entero', async () => {
    const update = vi.fn();
    const prisma = {
      worldPopulation: {
        // FAUNA a 0.02/día: con solo 1 hora transcurrida, el delta es una fracción muy pequeña de 100.
        findMany: vi.fn().mockResolvedValue([{ id: 'r1', targetType: 'FAUNA', poblacion: 100, poblacionMax: 1000, updatedAt: new Date(Date.now() - 60 * 60_000) }]),
        update,
      },
    };
    const result = await growAllPopulations(prisma as any);
    expect(update).not.toHaveBeenCalled();
    expect(result.updated).toBe(0);
  });

  it('crece proporcionalmente a la población actual y al tiempo real transcurrido', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      worldPopulation: {
        // FAUNA, 1000 individuos, 0.02/día, 30 días transcurridos => delta = floor(1000*0.02*30) = 600.
        findMany: vi.fn().mockResolvedValue([{ id: 'r1', targetType: 'FAUNA', poblacion: 1000, poblacionMax: 10_000, updatedAt: new Date(Date.now() - 30 * DAY_MS) }]),
        update,
      },
    };
    const result = await growAllPopulations(prisma as any);
    expect(update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { poblacion: { increment: 600 } } });
    expect(result.updated).toBe(1);
  });

  it('las razas de NPC crecen mucho más despacio que la fauna (tasa categórica distinta)', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      worldPopulation: {
        // RAZA, 1000 individuos, 0.003/día, 30 días => delta = floor(1000*0.003*30) = 90.
        findMany: vi.fn().mockResolvedValue([{ id: 'r1', targetType: 'RAZA', poblacion: 1000, poblacionMax: 10_000, updatedAt: new Date(Date.now() - 30 * DAY_MS) }]),
        update,
      },
    };
    await growAllPopulations(prisma as any);
    expect(update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { poblacion: { increment: 90 } } });
  });

  // Auditoría de elementos desconectados (2026-08-23): `poblacionMax` se sembraba desde el
  // principio pero `growAllPopulations` nunca lo leía — crecimiento sin límite real. Estos dos
  // tests son la regresión de ese fix.
  it('el crecimiento se recorta al llegar al techo de poblacionMax, en vez de superarlo', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      worldPopulation: {
        // FAUNA, delta sin tope = floor(1000*0.02*30) = 600, pero solo caben 50 hasta el techo (1050).
        findMany: vi.fn().mockResolvedValue([{ id: 'r1', targetType: 'FAUNA', poblacion: 1000, poblacionMax: 1050, updatedAt: new Date(Date.now() - 30 * DAY_MS) }]),
        update,
      },
    };
    const result = await growAllPopulations(prisma as any);
    expect(update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { poblacion: { increment: 50 } } });
    expect(result.updated).toBe(1);
  });

  it('no toca la fila si ya está en el techo o por encima (poblacion >= poblacionMax)', async () => {
    const update = vi.fn();
    const prisma = {
      worldPopulation: {
        findMany: vi.fn().mockResolvedValue([{ id: 'r1', targetType: 'FAUNA', poblacion: 1000, poblacionMax: 1000, updatedAt: new Date(Date.now() - 30 * DAY_MS) }]),
        update,
      },
    };
    const result = await growAllPopulations(prisma as any);
    expect(update).not.toHaveBeenCalled();
    expect(result.updated).toBe(0);
  });
});

describe('syncFactionPopulationToKingdomStats', () => {
  // docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.6 (2026-09-21) — puente entre WorldPopulation (FACCION,
  // crece con growAllPopulations) y KingdomStats de la Faction real (§ 4.2, ya generalizado).
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
