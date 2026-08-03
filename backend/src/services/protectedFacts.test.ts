import { describe, it, expect } from 'vitest';
import { protectedFactsFor } from './protectedFacts.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend").

describe('protectedFactsFor', () => {
  it('Gorhorn tiene el hecho protegido de ser el único superviviente conocido del Clan Maktor', () => {
    const result = protectedFactsFor('Gorhorn');
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('ÚNICO superviviente conocido');
  });

  it('otro personaje no tiene ningún hecho protegido todavía', () => {
    expect(protectedFactsFor('Sael Vhorn')).toEqual([]);
  });
});
