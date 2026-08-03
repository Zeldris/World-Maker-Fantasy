import { describe, it, expect, vi } from 'vitest';
import { populationTargetSlugFor, decrementPopulationOnDeath, growAllPopulations, UMBRAL_MINIMO_REPRODUCCION } from './population.js';

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
  it('resta 1 a la fila que corresponde, sin bajar de 0', async () => {
    const update = vi.fn().mockResolvedValue({});
    const tx = {
      worldPopulation: {
        findUnique: vi.fn().mockResolvedValue({ id: 'row1', poblacion: 5 }),
        update,
      },
    };
    await decrementPopulationOnDeath(tx as any, 'world1', null, 'murgol', 'Las Llanuras del Viento Rojo');
    expect(tx.worldPopulation.findUnique).toHaveBeenCalledWith({
      where: { worldId_targetType_targetSlug: { worldId: 'world1', targetType: 'FAUNA', targetSlug: 'murgol' } },
    });
    expect(update).toHaveBeenCalledWith({ where: { id: 'row1' }, data: { poblacion: 4 } });
  });

  it('no baja de 0 aunque ya estuviera muy cerca', async () => {
    const update = vi.fn().mockResolvedValue({});
    const tx = {
      worldPopulation: {
        findUnique: vi.fn().mockResolvedValue({ id: 'row1', poblacion: 0 }),
        update,
      },
    };
    await decrementPopulationOnDeath(tx as any, 'world1', 'orcos', 'torgash', 'Las Llanuras del Viento Rojo');
    expect(update).not.toHaveBeenCalled();
  });

  it('no hace nada si no encuentra una fila que corresponda (nunca bloquea el turno)', async () => {
    const update = vi.fn();
    const findUnique = vi.fn().mockResolvedValue(null);
    const tx = { worldPopulation: { findUnique, update } };
    await decrementPopulationOnDeath(tx as any, 'world1', 'orcos', 'algun-npc', null);
    // Región nula para 'orcos' => populationTargetSlugFor devuelve null antes de tocar la DB.
    expect(findUnique).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('growAllPopulations', () => {
  const DAY_MS = 24 * 60 * 60_000;

  it('no crece por debajo del umbral mínimo de reproducción', async () => {
    const update = vi.fn();
    const prisma = {
      worldPopulation: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'r1', targetType: 'FAUNA', poblacion: UMBRAL_MINIMO_REPRODUCCION - 1, updatedAt: new Date(Date.now() - 30 * DAY_MS) },
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
        findMany: vi.fn().mockResolvedValue([{ id: 'r1', targetType: 'FAUNA', poblacion: 100, updatedAt: new Date(Date.now() - 60 * 60_000) }]),
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
        findMany: vi.fn().mockResolvedValue([{ id: 'r1', targetType: 'FAUNA', poblacion: 1000, updatedAt: new Date(Date.now() - 30 * DAY_MS) }]),
        update,
      },
    };
    const result = await growAllPopulations(prisma as any);
    expect(update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { poblacion: 1600 } });
    expect(result.updated).toBe(1);
  });

  it('las razas de NPC crecen mucho más despacio que la fauna (tasa categórica distinta)', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      worldPopulation: {
        // RAZA, 1000 individuos, 0.003/día, 30 días => delta = floor(1000*0.003*30) = 90.
        findMany: vi.fn().mockResolvedValue([{ id: 'r1', targetType: 'RAZA', poblacion: 1000, updatedAt: new Date(Date.now() - 30 * DAY_MS) }]),
        update,
      },
    };
    await growAllPopulations(prisma as any);
    expect(update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { poblacion: 1090 } });
  });
});
