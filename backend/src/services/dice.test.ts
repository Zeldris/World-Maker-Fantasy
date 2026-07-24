import { describe, it, expect } from 'vitest';
import { gradoExitoFor } from './dice.js';

describe('gradoExitoFor', () => {
  it('claro cuando el resultado supera la dificultad en 5 o más', () => {
    expect(gradoExitoFor(20, 15)).toBe('claro');
    expect(gradoExitoFor(19, 15)).toBe('con_coste');
  });

  it('con_coste cuando el resultado iguala o supera la dificultad, pero por menos de 5', () => {
    expect(gradoExitoFor(15, 15)).toBe('con_coste');
    expect(gradoExitoFor(18, 15)).toBe('con_coste');
  });

  it('fallo cuando el resultado no llega a la dificultad', () => {
    expect(gradoExitoFor(14, 15)).toBe('fallo');
  });
});
