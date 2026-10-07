import { describe, it, expect } from 'vitest';
import { pendingFactionDays, pendingWeeks, tickFactionOneDay, productRecipesForOficio, pickDailyProduct, cabeEnStock, TOPE_STOCK_FACCION_POR_SLUG, MAX_DIAS_CATCHUP_FACCION } from './factionEconomy.js';
import { DEFAULT_KINGDOM_STATS } from './kingdomTick.js';

describe('factionEconomy — funciones puras (Fase 4, H-6/H-2/H-4)', () => {
  it('pendingFactionDays: sin línea base = 0; cuenta días cruzados; acota el catch-up', () => {
    expect(pendingFactionDays(null, 10)).toBe(0);
    expect(pendingFactionDays(10, 10)).toBe(0);
    expect(pendingFactionDays(10, 13)).toBe(3);
    expect(pendingFactionDays(20, 10)).toBe(0);
    expect(pendingFactionDays(0, 9999)).toBe(MAX_DIAS_CATCHUP_FACCION);
  });

  it('pendingWeeks cuenta semanas de ficción completas cruzadas', () => {
    expect(pendingWeeks(null, 30)).toBe(0);
    expect(pendingWeeks(2, 14)).toBe(0); // 14/7 = 2
    expect(pendingWeeks(2, 21)).toBe(1);
    expect(pendingWeeks(2, 35)).toBe(3);
  });

  it('tickFactionOneDay: suma producción de edificios, consume por bocas y su fuente le da agua de sobra', () => {
    const base = { ...DEFAULT_KINGDOM_STATS, poblacion: 10, trabajadores: 2, soldados: 1, comida: 20, riqueza: 5 };
    const r = tickFactionOneDay(base, { comida: 7, riqueza: 2 });
    // comida: 20 + 7 de sus tareas (CR-61: ya no hay comida pasiva por trabajador) - 11 bocas = 16; riqueza: 5 + 2 + 2*1 = 9 (CR-54: los soldados cobran por semana);
    // bebida: la fuente da 11 * 1,1 = 13 y beben 11 (CR-54, Q17).
    expect(r.comida).toBe(16);
    expect(r.riqueza).toBe(9);
    expect(r.bebida).toBe(2);
    expect(r.felicidad).toBeGreaterThanOrEqual(50);
  });

  it('tickFactionOneDay: sin comida suficiente baja la felicidad y la comida se queda en 0', () => {
    const r = tickFactionOneDay({ ...DEFAULT_KINGDOM_STATS, poblacion: 50, comida: 0 }, { comida: 0, riqueza: 0 });
    expect(r.comida).toBe(0);
    expect(r.felicidad).toBe(45);
  });

  it('productRecipesForOficio: oficio exacto, o familia si no tiene recetas propias; nunca extracción', () => {
    const herrero = productRecipesForOficio('herrero-orcos-llanuras');
    expect(herrero.length).toBeGreaterThan(0);
    expect(herrero.every((r) => r.oficio === 'herrero-orcos-llanuras' && r.resultCatalogSlug && r.ingredients.length > 0)).toBe(true);
    const cristal = productRecipesForOficio('herrero-orcos-cristal');
    expect(cristal.map((r) => r.key)).toEqual(herrero.map((r) => r.key));
    expect(productRecipesForOficio('minero-cristal')).toEqual([]);
  });

  it('pickDailyProduct rota determinista por día', () => {
    const recetas = productRecipesForOficio('cocinero-orcos-llanuras');
    expect(pickDailyProduct([], 3)).toBeNull();
    expect(pickDailyProduct(recetas, 0)).toBe(recetas[0]);
    expect(pickDailyProduct(recetas, recetas.length + 1)).toBe(recetas[1]);
  });

  it('cabeEnStock respeta el tope', () => {
    expect(cabeEnStock(TOPE_STOCK_FACCION_POR_SLUG - 1)).toBe(true);
    expect(cabeEnStock(TOPE_STOCK_FACCION_POR_SLUG)).toBe(false);
  });
});
