import { describe, expect, it } from 'vitest';
import { distanciaCoseno, leerListaJson, masCercanas } from './vectores.js';

describe('vectores (SQLite, sin pgvector)', () => {
  it('distancia coseno con la escala de pgvector', () => {
    expect(distanciaCoseno([1, 0], [1, 0])).toBeCloseTo(0);
    expect(distanciaCoseno([1, 0], [0, 1])).toBeCloseTo(1);
    expect(distanciaCoseno([1, 0], [-1, 0])).toBeCloseTo(2);
    expect(distanciaCoseno([2, 0], [1, 0])).toBeCloseTo(0); // no depende de la longitud
    expect(distanciaCoseno([0, 0], [1, 0])).toBe(1);
  });

  it('ordena por cercanía, corta a n y deja al final las filas sin embedding', () => {
    const filas = [
      { text: 'lejos', embedding: JSON.stringify([0, 1]) },
      { text: 'sin', embedding: null },
      { text: 'cerca', embedding: JSON.stringify([1, 0.1]) },
      { text: 'roto', embedding: '{no es json' },
    ];
    const r = masCercanas(filas, [1, 0], 3);
    expect(r.map((f) => f.text)).toEqual(['cerca', 'lejos', 'sin']);
    expect(r[0]).not.toHaveProperty('embedding');
    expect(r[2].distance).toBe(Number.POSITIVE_INFINITY);
  });

  it('lee listas Json que llegan como texto desde $queryRaw', () => {
    expect(leerListaJson('["a","b"]')).toEqual(['a', 'b']);
    expect(leerListaJson(['a'])).toEqual(['a']);
    expect(leerListaJson(null)).toEqual([]);
    expect(leerListaJson('roto')).toEqual([]);
  });
});
