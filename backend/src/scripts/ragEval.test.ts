import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  consultaDelCaso,
  cortarTramo,
  juntarSalidas,
  digestDelModelo,
  puestoDelPrimerEsperado,
  resumirCasos,
  salidaJson,
  validarCasos,
  validarParejas,
  type CasoRag,
  type ConfigCorrida,
  type ResultadoCaso,
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

  it('salida JSON (QA-329, GVE): forma con claves en español y `puesto` coherente', () => {
    const config = { modelo: 'nomic-embed-text', topK: 2, cases_file: 'c.jsonl' } as ConfigCorrida;
    const a: CasoRag = { id: 'a', pregunta: 'q', esperados: ['T'], causa: null, debe_pasar: true, origen: 'A', lang: 'es', pair_id: 'a' };
    const b: CasoRag = { id: 'b', pregunta: 'q2', region: 'R', esperados: ['T'], causa: 'ignorado', debe_pasar: true };
    const a2: CasoRag = { ...a, id: 'a-en', lang: 'en', pregunta: 'q-en' };
    const salida = salidaJson(
      config,
      'sha256:abc',
      [
        { caso: a, puesto: 2, consulta: 'q', devueltos: [{ title: 'X', distance: 0.1 }, { title: 't', distance: 0.2 }] },
        { caso: a2, puesto: 1, consulta: 'q-en', devueltos: [{ title: 'T', distance: 0.1 }] },
        { caso: b, puesto: null, consulta: 'q2 — R', devueltos: [{ title: 'X', distance: 0.1 }] },
      ],
      2,
    );
    expect(salida.casos.map((c) => [c.id, c.par])).toEqual([['a', 'a-en'], ['a-en', 'a'], ['b', null]]);
    expect(Object.keys(salida)).toEqual(['config', 'indice_hash', 'casos', 'resumen']);
    expect(salida.config).toBe(config);
    expect(salida.indice_hash).toBe('sha256:abc');
    expect(salida.casos[0]).toEqual({
      id: 'a',
      idioma: 'es',
      par: 'a-en',
      pair_id: 'a',
      origen: 'A',
      causa: null,
      debe_pasar: true,
      pregunta: 'q',
      consulta: 'q',
      esperados: ['T'],
      devueltos: [{ titulo: 'X', distancia: 0.1 }, { titulo: 't', distancia: 0.2 }],
      puesto: 2,
      pasa: true,
    });
    expect(salida.casos[2]).toMatchObject({ idioma: null, par: null, origen: null, causa: 'ignorado', pregunta: 'q2', consulta: 'q2 — R', puesto: null, pasa: false });
    for (const c of salida.casos) {
      expect(c.puesto).toBe(puestoDelPrimerEsperado(c.devueltos.map((d) => d.titulo), c.esperados));
    }
    expect(salida.resumen).toEqual({ k: 2, n: 3, recall: 2 / 3, mrr: 0.5, fallan_obligatorios: ['b'] });
    expect(salidaJson(config, null, [], 2).indice_hash).toBeNull();
    expect(JSON.parse(JSON.stringify(salida))).toEqual(salida);
  });

  describe('tandas (QA-360)', () => {
    const lista = ['a', 'b', 'c', 'd', 'e'];

    it('corta [desde, hasta) en base 0, con valores por defecto', () => {
      expect(cortarTramo(lista, '1', '3')).toEqual({ casos: ['b', 'c'], tramo: { desde: 1, hasta: 3, total: 5 } });
      expect(cortarTramo(lista, '3', undefined)).toEqual({ casos: ['d', 'e'], tramo: { desde: 3, hasta: 5, total: 5 } });
      expect(cortarTramo(lista, undefined, '2').casos).toEqual(['a', 'b']);
    });

    it('valida enteros y límites diciendo el motivo', () => {
      expect(() => cortarTramo(lista, 'x', '3')).toThrow('--desde debe ser un entero');
      expect(() => cortarTramo(lista, '1.5', '3')).toThrow('--desde debe ser un entero');
      expect(() => cortarTramo(lista, '-1', '3')).toThrow('--desde debe ser un entero');
      expect(() => cortarTramo(lista, '0', 'y')).toThrow('--hasta debe ser un entero');
      expect(() => cortarTramo(lista, '0', '6')).toThrow('--hasta 6 pasa del total: el archivo tiene 5');
      expect(() => cortarTramo(lista, '5', undefined)).toThrow('--desde 5 está fuera del archivo');
      expect(() => cortarTramo(lista, '3', '3')).toThrow('--desde 3 tiene que ser menor que --hasta 3');
      expect(() => cortarTramo(lista, '4', '2')).toThrow('tiene que ser menor');
    });

    const config = { modelo: 'm', topK: 2, cases_file: 'c.jsonl', commit_dirty: false } as ConfigCorrida;
    const casos: CasoRag[] = [
      { id: 'a', pregunta: 'q', esperados: ['T'], causa: null, debe_pasar: true, lang: 'es', pair_id: 'p' },
      { id: 'b', pregunta: 'q2', esperados: ['T'], causa: null, lang: 'es', pair_id: 'q' },
      { id: 'a-en', pregunta: 'q-en', esperados: ['T'], causa: null, lang: 'en', pair_id: 'p' },
      { id: 'b-en', pregunta: 'q2-en', esperados: ['T'], causa: 'ignorado', debe_pasar: true, lang: 'en', pair_id: 'q' },
    ];
    const res = (c: CasoRag, puesto: number | null): ResultadoCaso => ({
      caso: c,
      puesto,
      consulta: c.pregunta,
      devueltos: puesto === 2 ? [{ title: 'X', distance: 0.1 }, { title: 'T', distance: 0.2 }] : puesto ? [{ title: 'T', distance: 0.1 }] : [{ title: 'X', distance: 0.9 }],
    });
    const todos = [res(casos[0], 1), res(casos[1], 2), res(casos[2], 1), res(casos[3], null)];
    const entera = salidaJson(config, 'sha256:h', todos, 2);
    const parte = (desde: number, hasta: number, extra: Partial<ConfigCorrida> = {}) =>
      JSON.parse(JSON.stringify(salidaJson({ ...config, ...extra, tramo: { desde, hasta, total: 4 } }, 'sha256:h', todos.slice(desde, hasta), 2)));

    it('une tandas (en cualquier orden) en lo que daría la corrida entera, sin tramo', () => {
      const unido = juntarSalidas([parte(2, 4), parte(0, 1), parte(1, 2)]);
      expect(unido).toEqual(JSON.parse(JSON.stringify(entera)));
      expect(Object.keys(unido)).toEqual(Object.keys(entera));
      expect(Object.keys(unido.config)).toEqual(Object.keys(config));
      expect('tramo' in unido.config).toBe(false);
      expect(unido.resumen).toEqual({ k: 2, n: 4, recall: 0.75, mrr: (1 + 0.5 + 1) / 4, fallan_obligatorios: ['b-en'] });
      expect(unido.casos.map((c) => c.par)).toEqual(['a-en', 'b-en', 'a', 'b']);
    });

    it('commit_dirty puede variar entre tandas: vale true si alguna lo tenía', () => {
      expect(juntarSalidas([parte(0, 2), parte(2, 4, { commit_dirty: true })]).config.commit_dirty).toBe(true);
    });

    it('rechaza huecos y solapes', () => {
      expect(() => juntarSalidas([parte(0, 1), parte(2, 4)])).toThrow('hueco: faltan los casos [1, 2) antes de parte 2');
      expect(() => juntarSalidas([parte(1, 4)])).toThrow('hueco: faltan los casos [0, 1) antes de parte 1');
      expect(() => juntarSalidas([parte(0, 3), parte(2, 4)])).toThrow('solape: parte 2 empieza en 2 y el tramo anterior llega hasta 3');
      expect(() => juntarSalidas([parte(0, 2)])).toThrow('hueco: faltan los casos [2, 4) al final');
    });

    it('rechaza config o total distintos', () => {
      expect(() => juntarSalidas([parte(0, 2), parte(2, 4, { modelo: 'otro' })])).toThrow('config distinta entre parte 1 y parte 2: modelo');
      const otroTotal = parte(2, 4);
      otroTotal.config.tramo.total = 5;
      expect(() => juntarSalidas([parte(0, 2), otroTotal])).toThrow('el total de casos es distinto (5 frente a 4');
      const otroHash = parte(2, 4);
      otroHash.indice_hash = 'sha256:z';
      expect(() => juntarSalidas([parte(0, 2), otroHash])).toThrow('indice_hash distinto');
    });

    it('rechaza partes que no son tandas o están incompletas', () => {
      expect(() => juntarSalidas([])).toThrow('al menos una parte');
      expect(() => juntarSalidas([JSON.parse(JSON.stringify(entera))])).toThrow('no trae config.tramo');
      expect(() => juntarSalidas([{}])).toThrow('no es una salida de rag-eval');
      const corta = parte(0, 2);
      corta.casos.pop();
      expect(() => juntarSalidas([corta, parte(2, 4)])).toThrow('trae 1 casos y su tramo [0, 2) pide 2');
    });
  });
});
