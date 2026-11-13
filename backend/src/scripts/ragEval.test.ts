import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { puestoDelPrimerEsperado, resumirCasos, validarCasos, type CasoRag } from './ragEval.js';

const caso = (id: string, debe = false): CasoRag => ({ id, pregunta: 'q', esperados: ['A'], causa: null, debe_pasar: debe });

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

describe('validarCasos (QA-328)', () => {
  const bueno = { id: 'a', pregunta: 'q', esperados: ['T'], causa: null };

  it('un caso sin `causa` o con una causa desconocida es un error, con su id', () => {
    const { causa: _sin, ...sinCausa } = bueno;
    expect(validarCasos([sinCausa])).toEqual(['a: falta `causa` (null, no_recuperado, ignorado o ausente)']);
    expect(validarCasos([{ ...bueno, causa: 'otra' }])[0]).toMatch(/^a: `causa` "otra" no es/);
    expect(validarCasos([bueno, { ...bueno, id: 'b', causa: 'ignorado' }])).toEqual([]);
  });

  it('sin pregunta, sin esperados o con id repetido', () => {
    expect(validarCasos([{ ...bueno, pregunta: ' ' }, { ...bueno, esperados: [] }])).toEqual([
      'a: falta `pregunta`',
      'a: `esperados` tiene que ser una lista de títulos no vacía',
      'a: id repetido',
    ]);
  });

  it('los casos del repo pasan el validador', () => {
    const ruta = fileURLToPath(new URL('../../ia/rag-casos.jsonl', import.meta.url));
    const casos = readFileSync(ruta, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    expect(validarCasos(casos)).toEqual([]);
  });
});
