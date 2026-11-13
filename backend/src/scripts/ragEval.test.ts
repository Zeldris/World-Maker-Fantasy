import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  consultaDelCaso,
  digestDelModelo,
  puestoDelPrimerEsperado,
  resumirCasos,
  salidaJson,
  validarCasos,
  validarParejas,
  type CasoRag,
  type ConfigCorrida,
} from './ragEval.js';

const caso = (id: string, debe = false): CasoRag => ({ id, pregunta: 'q', esperados: ['A'], causa: null, debe_pasar: debe });

describe('rag-eval', () => {
  it('puesto del primer esperado, sin distinguir mayúsculas; null si no sale', () => {
    expect(puestoDelPrimerEsperado(['x', 'a', 'y'], ['A'])).toBe(2);
    expect(puestoDelPrimerEsperado(['x', 'y'], ['A'])).toBeNull();
  });

  it('recall@k, MRR y los obligatorios que fallan', () => {
    const r = resumirCasos(
      [
        { caso: caso('1', true), puesto: 1, devueltos: [], consulta: '' },
        { caso: caso('2', true), puesto: null, devueltos: [], consulta: '' },
        { caso: caso('3'), puesto: 2, devueltos: [], consulta: '' },
        { caso: caso('4'), puesto: 9, devueltos: [], consulta: '' },
      ],
      5,
    );
    expect(r.recall).toBe(0.5);
    expect(r.mrr).toBeCloseTo((1 + 0 + 0.5 + 0) / 4);
    expect(r.fallanObligatorios).toEqual(['2']);
  });
});

describe('validarCasos (QA-328)', () => {
  const bueno = { id: 'a', pregunta: 'q', esperados: ['T'], causa: null, lang: 'es' as const, pair_id: 'a' };

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

  it('sin `lang` es/en o sin `pair_id` es un error (QA-331)', () => {
    expect(validarCasos([{ ...bueno, lang: 'fr' }, { ...bueno, id: 'b', pair_id: '' }])).toEqual([
      'a: `lang` tiene que ser es o en',
      'b: falta `pair_id`',
    ]);
  });

  it('cada pareja, un caso es y uno en con los mismos esperados (QA-331)', () => {
    const en = { ...bueno, id: 'a-en', lang: 'en' as const };
    expect(validarParejas([bueno, en])).toEqual([]);
    expect(validarParejas([bueno, { ...en, esperados: ['t ', 'X'] }])).toEqual(['pareja a: a y a-en esperan títulos distintos']);
    expect(validarParejas([bueno])).toEqual(['pareja a: tiene que tener un caso es y uno en (tiene es: a)']);
    expect(validarParejas([bueno, { ...bueno, id: 'a2' }])[0]).toMatch(/^pareja a: tiene que tener un caso es y uno en \(tiene es,es/);
  });

  it('los casos del repo pasan el validador', () => {
    const ruta = fileURLToPath(new URL('../../ia/rag-casos.jsonl', import.meta.url));
    const casos = readFileSync(ruta, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    expect(validarCasos(casos)).toEqual([]);
    expect(validarParejas(casos)).toEqual([]);
  });

  it('consulta como el juego: la región va de sufijo', () => {
    expect(consultaDelCaso({ pregunta: '¿Quién?' })).toBe('¿Quién?');
    expect(consultaDelCaso({ pregunta: '¿Quién?', region: 'Nahr' })).toBe('¿Quién? — Nahr');
  });

  it('digest del modelo en /api/tags, con o sin `:latest`; null si no está o no trae digest', () => {
    const tags = { models: [{ name: 'nomic-embed-text:latest', digest: 'abc' }, { name: 'tarkor-narrador' }] };
    expect(digestDelModelo(tags, 'nomic-embed-text')).toBe('abc');
    expect(digestDelModelo(tags, 'nomic-embed-text:latest')).toBe('abc');
    expect(digestDelModelo(tags, 'tarkor-narrador')).toBeNull();
    expect(digestDelModelo(tags, 'otro')).toBeNull();
    expect(digestDelModelo({}, 'nomic-embed-text')).toBeNull();
  });

  it('salida JSON (QA-329): config, cada caso con sus resultados en orden y el resumen', () => {
    const config = { embedding_model: 'nomic-embed-text', top_k: 2, cases_file: 'c.jsonl' } as ConfigCorrida;
    const a: CasoRag = { id: 'a', pregunta: 'q', esperados: ['T'], causa: null, debe_pasar: true, origen: 'A', lang: 'es', pair_id: 'a-en' };
    const b: CasoRag = { id: 'b', pregunta: 'q2', esperados: ['T'], causa: 'ignorado', debe_pasar: true };
    const salida = salidaJson(
      config,
      [
        { caso: a, puesto: 2, consulta: 'q', devueltos: [{ title: 'X', distance: 0.1 }, { title: 'T', distance: 0.2 }] },
        { caso: b, puesto: 3, consulta: 'q2 — R', devueltos: [{ title: 'X', distance: 0.1 }] },
      ],
      2,
    );
    expect(salida.config).toBe(config);
    expect(salida.cases[0]).toEqual({
      id: 'a',
      lang: 'es',
      pair_id: 'a-en',
      origen: 'A',
      causa: null,
      debe_pasar: true,
      esperados: ['T'],
      query: 'q',
      results: [{ title: 'X', distance: 0.1 }, { title: 'T', distance: 0.2 }],
      rank: 2,
      passed: true,
    });
    expect(salida.cases[1]).toMatchObject({ lang: null, pair_id: null, origen: null, causa: 'ignorado', rank: 3, passed: false });
    expect(salida.summary).toEqual({ k: 2, n: 2, recall: 0.5, mrr: 0.25, failed_required: ['b'] });
    expect(JSON.parse(JSON.stringify(salida))).toEqual(salida);
  });
});
