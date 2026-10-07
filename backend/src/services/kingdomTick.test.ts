import { describe, it, expect } from 'vitest';
import {
  tickKingdomOneDay,
  tickKingdom,
  daysCrossed,
  tickFactionProduction,
  hambrunaNueva,
  produccionDeFaccion,
  escalonCocinaDe,
  SIN_SUMINISTROS,
  DEFAULT_KINGDOM_STATS,
  FELICIDAD_ALTA_UMBRAL,
  FELICIDAD_BAJA_UMBRAL,
  type KingdomStatsBlock,
} from './kingdomTick.js';

describe('tickKingdomOneDay', () => {
  it('sin población ni trabajadores, no cambia nada (reino recién fundado)', () => {
    expect(tickKingdomOneDay(DEFAULT_KINGDOM_STATS)).toEqual(DEFAULT_KINGDOM_STATS);
  });

  it('los trabajadores producen riqueza; la comida sale de sus tareas (CR-61), no de su número', () => {
    const stats: KingdomStatsBlock = { ...DEFAULT_KINGDOM_STATS, trabajadores: 3 };
    expect(tickKingdomOneDay(stats).comida).toBe(0);
    expect(tickKingdomOneDay(stats).riqueza).toBe(3);
    expect(tickKingdomOneDay(stats, { ...SIN_SUMINISTROS, comidaDia: 7 }).comida).toBe(7);
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

  // Rachas de felicidad (2026-08-23, Grupo 3 § Territory.control) — alimentan directamente si un
  // territorio se consolida o cae en rebelión, ver turnResolution.ts.
  describe('rachas diasFelicidadAlta/diasFelicidadBaja', () => {
    it('felicidad ya en banda alta suma un día más a la racha', () => {
      const stats: KingdomStatsBlock = { ...DEFAULT_KINGDOM_STATS, felicidad: FELICIDAD_ALTA_UMBRAL, diasFelicidadAlta: 3 };
      expect(tickKingdomOneDay(stats).diasFelicidadAlta).toBe(4);
    });

    it('felicidad ya en banda baja suma un día más a la racha', () => {
      const stats: KingdomStatsBlock = { ...DEFAULT_KINGDOM_STATS, poblacion: 10, felicidad: FELICIDAD_BAJA_UMBRAL, comida: 0, bebida: 0, diasFelicidadBaja: 2 };
      expect(tickKingdomOneDay(stats).diasFelicidadBaja).toBe(3);
    });

    it('salir de la banda alta rompe la racha (sin premio parcial)', () => {
      // población consume sin producción, la felicidad baja de 70 a 65 — sale de la banda alta.
      const stats: KingdomStatsBlock = { ...DEFAULT_KINGDOM_STATS, poblacion: 1, comida: 0, bebida: 100, felicidad: FELICIDAD_ALTA_UMBRAL, diasFelicidadAlta: 5 };
      const result = tickKingdomOneDay(stats);
      expect(result.felicidad).toBeLessThan(FELICIDAD_ALTA_UMBRAL);
      expect(result.diasFelicidadAlta).toBe(0);
    });

    it('las dos rachas nunca suben a la vez (bandas mutuamente excluyentes)', () => {
      const result = tickKingdomOneDay({ ...DEFAULT_KINGDOM_STATS, felicidad: 50 });
      expect(result.diasFelicidadAlta).toBe(0);
      expect(result.diasFelicidadBaja).toBe(0);
    });
  });
});

describe('tickKingdom', () => {
  it('aplica N días de golpe (viaje largo cruzando varios días)', () => {
    const stats: KingdomStatsBlock = { ...DEFAULT_KINGDOM_STATS, trabajadores: 2 };
    const result = tickKingdom(stats, 3, 1, { ...SIN_SUMINISTROS, comidaDia: 4 });
    expect(result.comida).toBe(12);
    expect(result.riqueza).toBe(6);
  });
  it('la comida con decimales se arrastra de un día al siguiente (CR-61)', () => {
    expect(tickKingdom({ ...DEFAULT_KINGDOM_STATS }, 4, 1, { ...SIN_SUMINISTROS, comidaDia: 2.5 }).comida).toBe(10);
  });
  it('0 días no cambia nada', () => {
    const stats: KingdomStatsBlock = { ...DEFAULT_KINGDOM_STATS, trabajadores: 5 };
    expect(tickKingdom(stats, 0, 1)).toEqual(stats);
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

describe('tickFactionProduction (docs/rpgtarkor/sistemas-reino/edificios-de-oficio.md § 4/§ 7, 2026-09-28)', () => {
  it('sin edificios, no produce nada', () => {
    expect(tickFactionProduction([])).toEqual({ comida: 0, riqueza: 0 });
  });

  it('una Cocina ya no da comida fija (la ganan sus cocineros, CR-61); el resto de oficios suman riqueza', () => {
    expect(tickFactionProduction([{ recipeKey: 'cocina-serhu', status: 'ACTIVO' }])).toEqual({ comida: 0, riqueza: 0 });
    expect(tickFactionProduction([{ recipeKey: 'herreria-serhu', status: 'ACTIVO' }])).toEqual({ comida: 0, riqueza: 2 });
  });

  it('el salón (*-sedsar) no produce nada — no es un edificio de oficio', () => {
    expect(tickFactionProduction([{ recipeKey: 'ketg-sedsar', status: 'ACTIVO' }])).toEqual({ comida: 0, riqueza: 0 });
  });

  it('un edificio EN_CONSTRUCCION o sin recipeKey no produce', () => {
    expect(tickFactionProduction([{ recipeKey: 'herreria-serhu', status: 'EN_CONSTRUCCION' }])).toEqual({ comida: 0, riqueza: 0 });
    expect(tickFactionProduction([{ recipeKey: null, status: 'ACTIVO' }])).toEqual({ comida: 0, riqueza: 0 });
  });

  it('agrega varios edificios ACTIVOS a la vez', () => {
    const buildings = [
      { recipeKey: 'ketg-sedsar', status: 'ACTIVO' },
      { recipeKey: 'cocina-serhu', status: 'ACTIVO' },
      { recipeKey: 'herreria-serhu', status: 'ACTIVO' },
      { recipeKey: 'curtiduria-serhu', status: 'ACTIVO' },
      { recipeKey: 'herboristeria-serhu', status: 'EN_CONSTRUCCION' },
    ];
    expect(tickFactionProduction(buildings)).toEqual({ comida: 0, riqueza: 4 });
  });
});

// CR-12 (12c, hito 0.2) — la cuenta de días seguidos de hambre y cuándo toca una HAMBRUNA.
describe('hambre', () => {
  it('un día con déficit de comida suma a la racha; uno sin déficit la rompe', () => {
    const hambrientos: KingdomStatsBlock = { ...DEFAULT_KINGDOM_STATS, poblacion: 10, comida: 0, bebida: 100, diasHambre: 2 };
    expect(tickKingdomOneDay(hambrientos).diasHambre).toBe(3);
    expect(tickKingdomOneDay({ ...hambrientos, comida: 100 }).diasHambre).toBe(0);
  });

  it('hambruna al llegar a 3 días seguidos y cada 3 más, como mucho una por llamada', () => {
    expect(hambrunaNueva(2, 3, 1)).toBe(true);
    expect(hambrunaNueva(3, 4, 1)).toBe(false);
    expect(hambrunaNueva(5, 6, 1)).toBe(true);
    expect(hambrunaNueva(0, 2, 2)).toBe(false);
    // Un viaje de 10 días con hambre todo el rato: una sola.
    expect(hambrunaNueva(0, 10, 10)).toBe(true);
    // La racha se rompió en medio y la nueva aún no llega a 3.
    expect(hambrunaNueva(2, 2, 5)).toBe(false);
    // Se rompió y la nueva ya llega a 3: cuenta desde cero.
    expect(hambrunaNueva(2, 3, 5)).toBe(true);
  });
});

describe('produccionDeFaccion (CR-61)', () => {
  it('suma la comida de las tareas de sus trabajadores a la de sus edificios', () => {
    // Orcos, 100 trabajadores, sin Cocina: 45 cazadores × 2,5 + 55 recolectores × 2 (otoño) = 222.
    expect(produccionDeFaccion([{ recipeKey: 'herreria-serhu', status: 'ACTIVO' }], 'orcos', { trabajadores: 100, comida: 0 })).toEqual({ comida: 222, riqueza: 2 });
  });
  it('con Cocina, sus cocineros ganan según el escalón', () => {
    const sin = produccionDeFaccion([], 'nabieus', { trabajadores: 50, comida: 500 }).comida;
    const con = produccionDeFaccion([{ recipeKey: 'cocina-obrador', status: 'ACTIVO' }], 'nabieus', { trabajadores: 50, comida: 500 }).comida;
    expect(con).toBeGreaterThan(sin);
    expect(escalonCocinaDe([{ recipeKey: 'cocina-obrador', status: 'ACTIVO' }, { recipeKey: 'cocina', status: 'ACTIVO' }])).toBe(2);
    expect(escalonCocinaDe([{ recipeKey: 'cocina', status: 'ACTIVO', tier: 3 }])).toBe(3); // la del Reino, mejorada en su fila
    expect(escalonCocinaDe([])).toBe(0);
  });
});
