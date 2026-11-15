import { describe, it, expect } from 'vitest';
import { aplicarArgumentosRag, CONFIG_RAG_POR_DEFECTO, configRag, diferenciasDeIndice, fusionRrf, hashDelIndice, textoConsulta, textoDocumento } from './ragConfig.js';

describe('mandos del RAG (QA-330)', () => {
  it('sin variables, la configuración de siempre', () => {
    expect(configRag({})).toEqual(CONFIG_RAG_POR_DEFECTO);
    expect(textoDocumento(configRag({}), 'Título', 'trozo')).toBe('Título\ntrozo');
    expect(textoConsulta(configRag({}), 'pregunta')).toBe('pregunta');
  });

  it('lee las variables RAG_*, con `\\n` como salto de línea', () => {
    const cfg = configRag({ RAG_TAM_TROZO: '250', RAG_SOLAPE: '80', RAG_PREFIJO_DOCUMENTO: 'search_document: ', RAG_PLANTILLA: '{title}\\n\\n{trozo}' });
    expect(cfg).toMatchObject({ tamTrozo: 250, solape: 80, prefijoDocumento: 'search_document: ', plantilla: '{title}\n\n{trozo}' });
    expect(textoDocumento(cfg, 'T', 'x')).toBe('search_document: T\n\nx');
  });

  it('los argumentos pasan a las variables, y --prefijos-nomic pone los dos prefijos', () => {
    const entorno: NodeJS.ProcessEnv = { RAG_TAM_TROZO: '300' };
    aplicarArgumentosRag(['--json', '--tam-trozo', '600', '--solape', '100', '--prefijos-nomic'], entorno);
    expect(configRag(entorno)).toMatchObject({ tamTrozo: 600, solape: 100, prefijoConsulta: 'search_query: ', prefijoDocumento: 'search_document: ' });
    expect(() => aplicarArgumentosRag(['--solape'], {})).toThrow('--solape necesita un valor');
  });

  it('rechaza mandos que no valen, diciendo por qué', () => {
    expect(() => configRag({ RAG_TAM_TROZO: 'mucho' })).toThrow('RAG_TAM_TROZO tiene que ser un entero ≥ 1');
    expect(() => configRag({ RAG_SOLAPE: '-1' })).toThrow('RAG_SOLAPE tiene que ser un entero ≥ 0');
    expect(() => configRag({ RAG_SOLAPE: '400' })).toThrow('tiene que ser menor que RAG_TAM_TROZO');
    expect(() => configRag({ RAG_PLANTILLA: '{title}' })).toThrow('RAG_PLANTILLA tiene que llevar {trozo}');
  });

  it('diferencias entre el índice guardado y la corrida', () => {
    const actual = { ...CONFIG_RAG_POR_DEFECTO, modelo: 'nomic-embed-text' };
    expect(diferenciasDeIndice({ ...actual, fecha: '2026-11-13' }, actual)).toEqual([]);
    expect(diferenciasDeIndice({ ...actual, tamTrozo: 250 }, actual)).toEqual(['tamTrozo: índice 250, corrida 400']);
    expect(diferenciasDeIndice({}, actual)).toHaveLength(6);
  });
});

describe('hashDelIndice (T6 del GVE)', () => {
  const filas = [
    { titulo: 'B', texto: 'B\nuno' },
    { titulo: 'A', texto: 'A\ndos' },
    { titulo: 'A', texto: 'A\ntres' },
  ];
  it('mismo hash con las mismas filas en otro orden; formato sha256:<hex>', () => {
    const h = hashDelIndice('m', filas);
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(hashDelIndice('m', [...filas].reverse())).toBe(h);
  });
  it('cambia si cambia un texto, un título, una fila o el modelo', () => {
    const h = hashDelIndice('m', filas);
    expect(hashDelIndice('m', [{ ...filas[0], texto: 'B\nuno!' }, ...filas.slice(1)])).not.toBe(h);
    expect(hashDelIndice('m', [{ ...filas[0], titulo: 'C' }, ...filas.slice(1)])).not.toBe(h);
    expect(hashDelIndice('m', filas.slice(1))).not.toBe(h);
    expect(hashDelIndice('otro', filas)).not.toBe(h);
  });
  it('no es un mando: diferenciasDeIndice lo ignora', () => {
    const actual = { ...CONFIG_RAG_POR_DEFECTO, modelo: 'm' };
    expect(diferenciasDeIndice({ ...actual, indice_hash: 'sha256:x' }, actual)).toEqual([]);
  });
});

describe('mandos de modelo y búsqueda (QA-351)', () => {
  it('por defecto, nomic-embed-text (o OLLAMA_MODEL_EMBEDDINGS) y búsqueda por vector', () => {
    expect(configRag({})).toMatchObject({ modelo: 'nomic-embed-text', busqueda: 'vector' });
    expect(configRag({ OLLAMA_MODEL_EMBEDDINGS: 'otro' }).modelo).toBe('otro');
  });

  it('--modelo y --hibrida pasan a RAG_MODELO y RAG_BUSQUEDA, y el argumento gana', () => {
    const entorno: NodeJS.ProcessEnv = { OLLAMA_MODEL_EMBEDDINGS: 'nomic-embed-text', RAG_MODELO: 'x' };
    aplicarArgumentosRag(['--json', '--modelo', 'bge-m3', '--hibrida'], entorno);
    expect(configRag(entorno)).toMatchObject({ modelo: 'bge-m3', busqueda: 'hibrida' });
    expect(() => aplicarArgumentosRag(['--modelo'], {})).toThrow('--modelo necesita un valor');
  });

  it('rechaza una búsqueda que no existe', () => {
    expect(() => configRag({ RAG_BUSQUEDA: 'bm25' })).toThrow('RAG_BUSQUEDA tiene que ser vector o hibrida (recibida: bm25)');
  });

  it('el modelo es del índice y la búsqueda no', () => {
    const { busqueda: _b, ...actual } = configRag({ RAG_MODELO: 'bge-m3', RAG_BUSQUEDA: 'hibrida' });
    const { busqueda: _b2, ...base } = CONFIG_RAG_POR_DEFECTO;
    expect(diferenciasDeIndice(base, actual)).toEqual(['modelo: índice "nomic-embed-text", corrida "bge-m3"']);
    expect(diferenciasDeIndice({ ...base, modelo: 'bge-m3' }, actual)).toEqual([]);
  });
});

describe('fusionRrf (QA-351)', () => {
  it('suma 1/(60+puesto) de cada lista y ordena por la suma', () => {
    const r = fusionRrf([['A', 'B', 'C'], ['C', 'D']], 10);
    expect(r.map((x) => x.title)).toEqual(['C', 'A', 'B', 'D']);
    expect(r[0].puntos).toBeCloseTo(1 / 63 + 1 / 61);
    expect(r[1].puntos).toBeCloseTo(1 / 61);
  });

  it('a igual puntuación desempata por título, y corta en topK', () => {
    expect(fusionRrf([['B', 'A'], ['A', 'B']], 10).map((x) => x.title)).toEqual(['A', 'B']);
    expect(fusionRrf([['Z', 'Y', 'X']], 2).map((x) => x.title)).toEqual(['Z', 'Y']);
  });

  it('con una lista vacía, el orden es el de la otra', () => {
    expect(fusionRrf([['B', 'A', 'C'], []], 4).map((x) => x.title)).toEqual(['B', 'A', 'C']);
  });
});
