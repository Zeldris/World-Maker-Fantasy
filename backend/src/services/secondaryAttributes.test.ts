import { describe, it, expect } from 'vitest';
import { normalizeSecondaryAttributes, SECONDARY_ATTRIBUTES, EMPTY_SECONDARY_ATTRIBUTES } from './secondaryAttributes.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend").

describe('normalizeSecondaryAttributes', () => {
  it('partidas anteriores a la migración (columna vacía, {}) se leen como todo-cero', () => {
    expect(normalizeSecondaryAttributes({})).toEqual(EMPTY_SECONDARY_ATTRIBUTES);
  });

  it('null/undefined también se leen como todo-cero, nunca revientan', () => {
    expect(normalizeSecondaryAttributes(null)).toEqual(EMPTY_SECONDARY_ATTRIBUTES);
    expect(normalizeSecondaryAttributes(undefined)).toEqual(EMPTY_SECONDARY_ATTRIBUTES);
  });

  it('respeta los valores ya presentes y rellena solo lo que falta', () => {
    const result = normalizeSecondaryAttributes({ honor: 5, moral: 15 });
    expect(result.honor).toBe(5);
    expect(result.moral).toBe(15);
    expect(result.magia).toBe(0);
  });

  it('claves residuales de antes del remodelado 2026-08-22 (sigilo/resistenciaFisica...) se ignoran, no revientan', () => {
    const result = normalizeSecondaryAttributes({ sigilo: 10, honor: 5 } as never);
    expect(result.honor).toBe(5);
    expect(result).not.toHaveProperty('sigilo');
  });

  it('devuelve las 7 claves de SECONDARY_ATTRIBUTES, ninguna de más ni de menos', () => {
    const result = normalizeSecondaryAttributes({});
    expect(Object.keys(result).sort()).toEqual([...SECONDARY_ATTRIBUTES].sort());
  });
});
