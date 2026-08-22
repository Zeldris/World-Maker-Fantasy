import { describe, it, expect } from 'vitest';
import {
  gradoExitoFor,
  rollGathering,
  gradoForRecurso,
  dificultadForTier,
  cantidadForGrado,
  SUERTE_VENTAJA_UMBRAL,
  type AttributeBlock,
} from './dice.js';

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

const ATTRS: AttributeBlock = { fuerza: 14, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 };

describe('rollGathering', () => {
  it('sin ventaja con Suerte por debajo del umbral: un único d20', () => {
    const result = rollGathering(ATTRS, 'fuerza', 2, SUERTE_VENTAJA_UMBRAL - 1, () => 0.5);
    expect(result.advantage).toBe(false);
    expect(result.rolls).toHaveLength(1);
    expect(result.usedRoll).toBe(11); // floor(0.5*20)+1
    expect(result.result).toBe(11 + Math.floor(14 / 2) + 2); // 20
  });

  it('con ventaja cuando Suerte alcanza el umbral: dos d20, se usa el mayor', () => {
    const rolls = [0.1, 0.9]; // 3 y 19
    let i = 0;
    const result = rollGathering(ATTRS, 'fuerza', 0, SUERTE_VENTAJA_UMBRAL, () => rolls[i++]);
    expect(result.advantage).toBe(true);
    expect(result.rolls).toEqual([3, 19]);
    expect(result.usedRoll).toBe(19);
    expect(result.result).toBe(19 + Math.floor(14 / 2));
  });

  it('bonusOficio se suma al resultado final, no al d20', () => {
    const result = rollGathering(ATTRS, 'fuerza', 3, 0, () => 0);
    expect(result.rolls).toEqual([1]);
    expect(result.result).toBe(1 + Math.floor(14 / 2) + 3);
  });
});

describe('dificultadForTier', () => {
  it('tier ausente se trata como 1 (común), mismo default que requisitos.ts', () => {
    expect(dificultadForTier(undefined)).toBe(11);
    expect(dificultadForTier(null)).toBe(11);
  });

  it('suma el tier real a la base de 10', () => {
    expect(dificultadForTier(4)).toBe(14);
  });
});

describe('gradoForRecurso', () => {
  it('mismos tres tramos que gradoExitoFor (margen +5 = claro)', () => {
    expect(gradoForRecurso(16, 11)).toBe('claro');
    expect(gradoForRecurso(15, 11)).toBe('con_coste');
    expect(gradoForRecurso(11, 11)).toBe('con_coste');
    expect(gradoForRecurso(10, 11)).toBe('fallo');
  });
});

describe('cantidadForGrado', () => {
  it('fallo no da nada', () => {
    expect(cantidadForGrado('fallo', 6)).toBe(0);
  });

  it('con_coste da la mitad redondeada arriba, mínimo 1', () => {
    expect(cantidadForGrado('con_coste', 6)).toBe(3);
    expect(cantidadForGrado('con_coste', 3)).toBe(2);
    expect(cantidadForGrado('con_coste', 1)).toBe(1);
  });

  it('claro da la cantidad máxima completa', () => {
    expect(cantidadForGrado('claro', 6)).toBe(6);
  });
});
