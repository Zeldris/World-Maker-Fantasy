import { describe, it, expect } from 'vitest';
import { diaDeFiccion, diasPendientes, MAX_DIAS_POR_LLAMADA } from './avanceDiario.js';
import { crecimientoEnDias } from './population.js';

describe('avanceDiario (CR-7)', () => {
  it('día de ficción: 0 hasta el minuto 1439, 1 desde el 1440', () => {
    expect(diaDeFiccion(480)).toBe(0);
    expect(diaDeFiccion(1439)).toBe(0);
    expect(diaDeFiccion(1440)).toBe(1);
  });

  it('días pendientes: nunca negativos y con tope por llamada', () => {
    expect(diasPendientes(3, 3)).toBe(0);
    expect(diasPendientes(5, 3)).toBe(0);
    expect(diasPendientes(0, 2)).toBe(2);
    expect(diasPendientes(0, 500)).toBe(MAX_DIAS_POR_LLAMADA);
  });
});

describe('crecimientoEnDias (CR-7)', () => {
  it('compuesto por días a la tasa del tipo (fauna 2 %/día)', () => {
    // 100 · (1,02² − 1) = 4,04 → 4 enteros; con random 0,99 no gana la fracción.
    expect(crecimientoEnDias(100, 1000, 'FAUNA', 2, () => 0.99)).toBe(4);
    // Con random 0 sí la gana.
    expect(crecimientoEnDias(100, 1000, 'FAUNA', 2, () => 0)).toBe(5);
  });

  it('una población pequeña de crecimiento lento puede ganar un individuo por la fracción', () => {
    // 100 · 0,003 = 0,3 al día: sin la fracción nunca crecería día a día.
    expect(crecimientoEnDias(100, 1000, 'RAZA', 1, () => 0.1)).toBe(1);
    expect(crecimientoEnDias(100, 1000, 'RAZA', 1, () => 0.5)).toBe(0);
  });

  it('respeta el techo, el umbral mínimo y los días no positivos', () => {
    expect(crecimientoEnDias(999, 1000, 'FAUNA', 10, () => 0)).toBe(1);
    expect(crecimientoEnDias(3, 1000, 'FAUNA', 10, () => 0)).toBe(0);
    expect(crecimientoEnDias(100, 1000, 'FAUNA', 0, () => 0)).toBe(0);
  });
});
