import { describe, it, expect } from 'vitest';
import { carenciasDe, diasDeReserva, inteligenciaDelLider, tocaRevisar, tramoDeInteligencia, INTELIGENCIA_POR_DEFECTO } from './carencias.js';
import { DEFAULT_KINGDOM_STATS, type KingdomStatsBlock } from '../kingdomTick.js';

const stats = (s: Partial<KingdomStatsBlock>): KingdomStatsBlock => ({ ...DEFAULT_KINGDOM_STATS, poblacion: 0, soldados: 0, trabajadores: 0, visitantes: 0, comida: 0, bebida: 0, riqueza: 0, ...s });

describe('carencias (CR-34 34a)', () => {
  it('tramos de Inteligencia como en combate: < 10, 10-19, 20+', () => {
    expect(tramoDeInteligencia(9)).toBe('IMPULSIVO');
    expect(tramoDeInteligencia(10)).toBe('SENSATO');
    expect(tramoDeInteligencia(19)).toBe('SENSATO');
    expect(tramoDeInteligencia(20)).toBe('ESTRATEGA');
  });

  it('Inteligencia del líder: la suya, 10 si no la tiene sembrada, null sin líder', () => {
    expect(inteligenciaDelLider({ attributes: { inteligencia: 16 } })).toBe(16);
    expect(inteligenciaDelLider({ attributes: {} })).toBe(INTELIGENCIA_POR_DEFECTO);
    expect(inteligenciaDelLider(null)).toBeNull();
  });

  it('una reserva que no baja dura siempre; la que baja, reserva / gasto', () => {
    expect(diasDeReserva(0, 0)).toBe(Infinity);
    expect(diasDeReserva(0, 5)).toBe(Infinity);
    expect(diasDeReserva(50, -10)).toBe(5);
    expect(diasDeReserva(-3, -10)).toBe(0);
  });

  it('comida: cuenta lo neto; sin déficit no hay carencia aunque la reserva esté a 0', () => {
    // 100 bocas, 60 trabajadores → +20 al día.
    expect(carenciasDe({ stats: stats({ poblacion: 100, trabajadores: 60 }) })).toEqual([]);
    // 100 bocas, nada producido: 500 de reserva = 5 días → leve; 200 = 2 días → grave.
    expect(carenciasDe({ stats: stats({ poblacion: 100, comida: 500 }) })).toEqual([{ tipo: 'COMIDA', gravedad: 'LEVE' }]);
    expect(carenciasDe({ stats: stats({ poblacion: 100, comida: 200 }) })).toEqual([{ tipo: 'COMIDA', gravedad: 'GRAVE' }]);
    // La producción de sus edificios también cuenta.
    expect(carenciasDe({ stats: stats({ poblacion: 100 }), produccion: { comida: 100, riqueza: 0 } })).toEqual([]);
  });

  it('bebida: solo cuenta si ya es real (economía de supervivencia)', () => {
    const s = stats({ poblacion: 10, trabajadores: 10, bebida: 0 });
    expect(carenciasDe({ stats: s }).some((c) => c.tipo === 'BEBIDA')).toBe(false);
    expect(carenciasDe({ stats: s, bebidaReal: true })).toContainEqual({ tipo: 'BEBIDA', gravedad: 'GRAVE' });
  });

  it('Goirnos: cuando lo que entra no paga los sueldos de los soldados', () => {
    // 500 soldados que comen de 300 trabajadores (+100 comida); riqueza 300 - 500 = -200 al día.
    const s = stats({ soldados: 500, trabajadores: 300, riqueza: 2000 });
    expect(carenciasDe({ stats: s })).toEqual([{ tipo: 'GOIRNOS', gravedad: 'LEVE' }]);
    expect(carenciasDe({ stats: { ...s, riqueza: 0 } })).toEqual([{ tipo: 'GOIRNOS', gravedad: 'GRAVE' }]);
  });

  it('soldados: frente al enemigo más fuerte; grave por debajo de la mitad del umbral', () => {
    const s = stats({ soldados: 100, trabajadores: 100 });
    expect(carenciasDe({ stats: s, enemigos: [{ factionId: 'a', soldados: 150 }] })).toEqual([]);
    expect(carenciasDe({ stats: s, enemigos: [{ factionId: 'a', soldados: 150 }, { factionId: 'b', soldados: 200 }] })).toEqual([{ tipo: 'SOLDADOS', gravedad: 'LEVE', enemigoId: 'b' }]);
    expect(carenciasDe({ stats: s, enemigos: [{ factionId: 'b', soldados: 400 }] })).toEqual([{ tipo: 'SOLDADOS', gravedad: 'GRAVE', enemigoId: 'b' }]);
  });

  it('el impulsivo solo ve lo grave; el estratega ve lo leve antes', () => {
    const leve = { stats: stats({ poblacion: 100, comida: 500 }) }; // 5 días
    expect(carenciasDe(leve, 'IMPULSIVO')).toEqual([]);
    const casi = { stats: stats({ poblacion: 100, comida: 1200 }) }; // 12 días: el sensato no la ve
    expect(carenciasDe(casi, 'SENSATO')).toEqual([]);
    expect(carenciasDe(casi, 'ESTRATEGA')).toEqual([{ tipo: 'COMIDA', gravedad: 'LEVE' }]);
  });

  it('revisa una vez por semana, antes con una carencia grave, nunca dos veces el mismo día', () => {
    const grave = [{ tipo: 'COMIDA' as const, gravedad: 'GRAVE' as const }];
    expect(tocaRevisar(3, null, [])).toBe(true);
    expect(tocaRevisar(10, 5, [])).toBe(false);
    expect(tocaRevisar(12, 5, [])).toBe(true);
    expect(tocaRevisar(6, 5, grave)).toBe(true);
    expect(tocaRevisar(5, 5, grave)).toBe(false);
  });
});
