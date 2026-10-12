import { describe, expect, it } from 'vitest';
import { accionParaCitar, sinComillasSueltas } from './accionCitada.js';

describe('accionCitada (P91, P94 · QA-27)', () => {
  it('quita las comillas que envuelven un nombre, no los apóstrofos', () => {
    expect(sinComillasSueltas("Ataco con un golpe directo, contra 'Guchapo'.")).toBe('Ataco con un golpe directo, contra Guchapo.');
    expect(sinComillasSueltas("Hablo con Vash'grath.")).toBe("Hablo con Vash'grath.");
  });

  it('para citar entre « », sin el punto final', () => {
    expect(accionParaCitar('Viajo hacia El Pozo de Cauce Viejo.')).toBe('Viajo hacia El Pozo de Cauce Viejo');
  });
});
