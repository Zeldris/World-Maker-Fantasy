import { describe, it, expect } from 'vitest';
import { lintRegionMismatch } from './narrationLint.js';

describe('lintRegionMismatch', () => {
  it('detecta cuando la narración menciona otra región (bug real: Ciénaga Troncal narrada estando en Llanuras)', () => {
    const text = 'La oscuridad de la Ciénaga Troncal se cierne sobre el terreno húmedo.';
    expect(lintRegionMismatch(text, 'Las Llanuras del Viento Rojo')).toBe('Ciénaga Troncal');
  });

  it('no dispara cuando la narración menciona la región actual', () => {
    const text = 'Gorhorn camina por las Llanuras del Viento Rojo bajo el sol de la tarde.';
    expect(lintRegionMismatch(text, 'Las Llanuras del Viento Rojo')).toBeNull();
  });

  it('no dispara si no menciona ninguna región nombrada', () => {
    expect(lintRegionMismatch('Gorhorn ataca al enemigo con su hacha.', 'Las Llanuras del Viento Rojo')).toBeNull();
  });
});
