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
    const result = normalizeSecondaryAttributes({ sigilo: 5, moral: 15 });
    expect(result.sigilo).toBe(5);
    expect(result.moral).toBe(15);
    expect(result.magia).toBe(0);
  });

  it('un `inteligencia` residual en el JSON (partidas anteriores al fix de 2026-08-03) se ignora, no revienta', () => {
    const result = normalizeSecondaryAttributes({ inteligencia: 10, sigilo: 5 } as never);
    expect(result.sigilo).toBe(5);
    expect(result).not.toHaveProperty('inteligencia');
  });

  it('devuelve las 9 claves de SECONDARY_ATTRIBUTES, ninguna de más ni de menos', () => {
    const result = normalizeSecondaryAttributes({});
    expect(Object.keys(result).sort()).toEqual([...SECONDARY_ATTRIBUTES].sort());
  });
});
