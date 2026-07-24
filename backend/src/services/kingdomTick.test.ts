import { describe, it, expect } from 'vitest';
import { tickKingdomOneDay, tickKingdom, daysCrossed, DEFAULT_KINGDOM_STATS, type KingdomStatsBlock } from './kingdomTick.js';

describe('tickKingdomOneDay', () => {
  it('sin población ni trabajadores, no cambia nada (reino recién fundado)', () => {
    expect(tickKingdomOneDay(DEFAULT_KINGDOM_STATS)).toEqual(DEFAULT_KINGDOM_STATS);
  });

  it('los trabajadores producen comida y riqueza', () => {
    const stats: KingdomStatsBlock = { ...DEFAULT_KINGDOM_STATS, trabajadores: 3 };
    const result = tickKingdomOneDay(stats);
    expect(result.comida).toBe(6);
    expect(result.riqueza).toBe(3);
  });

  it('la población consume comida y bebida', () => {
    const stats: KingdomStatsBlock = { ...DEFAULT_KINGDOM_STATS, poblacion: 5, comida: 10, bebida: 10 };
    const result = tickKingdomOneDay(stats);
    expect(result.comida).toBe(5);
    expect(result.bebida).toBe(5);
  });

  it('déficit de comida o bebida baja la felicidad, y nunca deja recursos negativos', () => {
    const stats: KingdomStatsBlock = { ...DEFAULT_KINGDOM_STATS, poblacion: 10, comida: 2, bebida: 2, felicidad: 50 };
    const result = tickKingdomOneDay(stats);
    expect(result.comida).toBe(0);
    expect(result.bebida).toBe(0);
    expect(result.felicidad).toBe(45);
  });

  it('superávit sube la felicidad, con tope en 100', () => {
    const stats: KingdomStatsBlock = { ...DEFAULT_KINGDOM_STATS, poblacion: 2, trabajadores: 10, comida: 100, bebida: 100, felicidad: 99 };
    const result = tickKingdomOneDay(stats);
    expect(result.felicidad).toBe(100);
  });

  it('los soldados cuestan mantenimiento de riqueza', () => {
    const stats: KingdomStatsBlock = { ...DEFAULT_KINGDOM_STATS, soldados: 3, riqueza: 10 };
    const result = tickKingdomOneDay(stats);
    expect(result.riqueza).toBe(7);
  });
});

describe('tickKingdom', () => {
  it('aplica N días de golpe (viaje largo cruzando varios días)', () => {
    const stats: KingdomStatsBlock = { ...DEFAULT_KINGDOM_STATS, trabajadores: 2 };
    const result = tickKingdom(stats, 3);
    expect(result.comida).toBe(12);
    expect(result.riqueza).toBe(6);
  });
  it('0 días no cambia nada', () => {
    const stats: KingdomStatsBlock = { ...DEFAULT_KINGDOM_STATS, trabajadores: 5 };
    expect(tickKingdom(stats, 0)).toEqual(stats);
  });
});

describe('daysCrossed', () => {
  it('mismo día, 0 días cruzados', () => {
    expect(daysCrossed(480, 900)).toBe(0);
  });
  it('cruza exactamente un día a medianoche ficticia', () => {
    expect(daysCrossed(1400, 1441)).toBe(1);
  });
  it('un viaje largo puede cruzar varios días de golpe', () => {
    expect(daysCrossed(480, 480 + 1440 * 3 + 10)).toBe(3);
  });
});
