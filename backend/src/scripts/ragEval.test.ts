import { describe, it, expect } from 'vitest';
import { puestoDelPrimerEsperado, resumirCasos, type CasoRag } from './ragEval.js';

const caso = (id: string, debe = false): CasoRag => ({ id, pregunta: 'q', esperados: ['A'], debe_pasar: debe });

describe('rag-eval', () => {
  it('puesto del primer esperado, sin distinguir mayúsculas; null si no sale', () => {
    expect(puestoDelPrimerEsperado(['x', 'a', 'y'], ['A'])).toBe(2);
    expect(puestoDelPrimerEsperado(['x', 'y'], ['A'])).toBeNull();
  });

  it('recall@k, MRR y los obligatorios que fallan', () => {
    const r = resumirCasos(
      [
        { caso: caso('1', true), puesto: 1, devueltos: [] },
        { caso: caso('2', true), puesto: null, devueltos: [] },
        { caso: caso('3'), puesto: 2, devueltos: [] },
        { caso: caso('4'), puesto: 9, devueltos: [] },
      ],
      5,
    );
    expect(r.recall).toBe(0.5);
    expect(r.mrr).toBeCloseTo((1 + 0 + 0.5 + 0) / 4);
    expect(r.fallanObligatorios).toEqual(['2']);
  });
});
