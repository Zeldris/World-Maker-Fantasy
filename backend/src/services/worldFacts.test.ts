import { describe, it, expect } from 'vitest';
import { mergeFacts } from './worldFacts.js';

describe('mergeFacts', () => {
  it('añade hechos nuevos sin tocar los existentes', () => {
    expect(mergeFacts(['Gorhorn va solo'], ['El pozo tiene agua fresca'])).toEqual([
      'Gorhorn va solo',
      'El pozo tiene agua fresca',
    ]);
  });

  it('descarta un hecho casi idéntico a uno ya existente (≥70% palabras compartidas)', () => {
    const existing = ['Gorhorn ve un grupo hostil de orcos cerca del pozo'];
    const result = mergeFacts(existing, ['Gorhorn ve un grupo hostil de oca cerca del pozo']);
    expect(result).toEqual(existing); // el duplicado casi idéntico (typo "oca") se descarta
  });

  it('no descarta hechos genuinamente distintos aunque compartan alguna palabra', () => {
    const existing = ['Gorhorn tiene un tótem de madera'];
    const result = mergeFacts(existing, ['El Cruce de las Cenizas tiene patrullas de la Concordia']);
    expect(result).toHaveLength(2);
  });

  it('recorta a los 10 hechos más recientes', () => {
    const existing = Array.from({ length: 10 }, (_, i) => `hecho antiguo ${i}`);
    const result = mergeFacts(existing, ['hecho nuevo totalmente distinto de los demás']);
    expect(result).toHaveLength(10);
    expect(result[result.length - 1]).toBe('hecho nuevo totalmente distinto de los demás');
    expect(result).not.toContain('hecho antiguo 0'); // el más viejo se recorta
  });
});
