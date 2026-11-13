import { describe, it, expect } from 'vitest';
import { aplicarArgumentosRag, CONFIG_RAG_POR_DEFECTO, configRag, diferenciasDeIndice, textoConsulta, textoDocumento } from './ragConfig.js';

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
