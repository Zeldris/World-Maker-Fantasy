import { describe, it, expect } from 'vitest';
import { startingSecondaryAttributesFor } from './startingSecondaryAttributes.js';
import { SECONDARY_ATTRIBUTES } from './secondaryAttributes.js';

// Cobertura nueva (auditoría de deuda técnica 2026-08-21). El propio archivo documenta un bug
// real (2026-08-03): este bloque se quedó sembrando una clave vieja ('inteligencia') bajo una
// clave equivocada tras el rediseño de atributos a 7 — verificamos aquí que el bloque sembrado
// tiene EXACTAMENTE las claves de SECONDARY_ATTRIBUTES (secondaryAttributes.ts), ni una vieja de
// más ni ninguna real de menos, para que una futura desincronización de este tipo la detecte un
// test en vez de una partida real.
describe('startingSecondaryAttributesFor', () => {
  it('Gorhorn tiene su bloque "de serie"; otros personajes, null', () => {
    expect(startingSecondaryAttributesFor('Gorhorn')).not.toBeNull();
    expect(startingSecondaryAttributesFor('Otro')).toBeNull();
  });

  it('el bloque de Gorhorn tiene exactamente las claves de SECONDARY_ATTRIBUTES, todas numéricas y no negativas', () => {
    const block = startingSecondaryAttributesFor('Gorhorn')!;
    expect(Object.keys(block).sort()).toEqual([...SECONDARY_ATTRIBUTES].sort());
    for (const attr of SECONDARY_ATTRIBUTES) {
      expect(typeof block[attr]).toBe('number');
      expect(block[attr]).toBeGreaterThanOrEqual(0);
    }
  });
});
