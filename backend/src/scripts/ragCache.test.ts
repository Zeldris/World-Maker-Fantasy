import { describe, it, expect } from 'vitest';
import { CONFIG_RAG_POR_DEFECTO, hashDelIndice } from '../lib/ragConfig.js';
import {
  buscarEnMemoria,
  diferenciasDeCabecera,
  distanciaCoseno,
  filasDelIndice,
  fusionarConsultas,
  hashDeCache,
  leerCache,
  ordenarCache,
  serializarCache,
  type CabeceraCache,
  type CacheRag,
  type TrozoCache,
} from './ragCache.js';

const cabecera: CabeceraCache = {
  tipo: 'cabecera',
  modelo: 'm',
  digest: 'd1',
  prefijo_consulta: '',
  prefijo_documento: '',
  texto_embebido: '{title}\n{trozo}',
  trozo: 400,
  solapamiento: 0,
  indice_hash: 'sha256:x',
  indice: { modelo: 'm', tamTrozo: 400 },
};
const trozo = (titulo: string, texto: string, vector: number[], region?: string[]): TrozoCache => ({
  tipo: 'trozo',
  titulo,
  texto,
  ...(region ? { region } : {}),
  vector,
});
const consulta = (texto: string, vector: number[]) => ({ tipo: 'consulta' as const, texto, vector });

/// Referencia del SQL de `retrieveLore`: DISTINCT ON (title) la fila más cercana, sin las de tags excluidos,
/// ORDER BY distance, title (con el orden del título de la base) y LIMIT k.
function referenciaSql(filas: { title: string; vector: number[]; tags: string[] }[], q: number[], k: number, excluir: string[], ordenBase: string[]) {
  const validas = filas.filter((f) => !f.tags.some((t) => excluir.includes(t)));
  const porTitulo = new Map<string, number>();
  for (const f of [...validas].sort((a, b) => a.title.localeCompare(b.title) || distanciaCoseno(a.vector, q) - distanciaCoseno(b.vector, q))) {
    if (!porTitulo.has(f.title)) porTitulo.set(f.title, distanciaCoseno(f.vector, q));
  }
  return [...porTitulo]
    .map(([title, distance]) => ({ title, distance }))
    .sort((a, b) => a.distance - b.distance || ordenBase.indexOf(a.title) - ordenBase.indexOf(b.title))
    .slice(0, k);
}

describe('distanciaCoseno (QA-358)', () => {
  it('0 idéntico, 1 ortogonal, 2 opuesto; recortada a [0, 2]', () => {
    expect(distanciaCoseno([1, 0], [1, 0])).toBe(0);
    expect(distanciaCoseno([1, 0], [0, 1])).toBe(1);
    expect(distanciaCoseno([1, 0], [-1, 0])).toBe(2);
    // dot/sqrt(na*nb) puede pasar de 1 por redondeo: no sale distancia negativa.
    expect(distanciaCoseno([0.1, 0.2, 0.3], [0.1, 0.2, 0.3])).toBeGreaterThanOrEqual(0);
  });
  it('acumula en float32: da lo mismo que redondear cada paso', () => {
    const a = [0.1, 0.7, -0.3];
    const b = [0.9, 0.2, 0.4];
    const f = Math.fround;
    const dot = f(f(f(f(a[0]) * f(b[0])) + f(f(a[1]) * f(b[1]))) + f(f(a[2]) * f(b[2])));
    expect(distanciaCoseno(a, b)).toBe(1 - dot / Math.sqrt(f(f(f(f(a[0]) ** 2) + f(f(a[1]) ** 2)) + f(f(a[2]) ** 2)) * f(f(f(f(b[0]) ** 2) + f(f(b[1]) ** 2)) + f(f(b[2]) ** 2))));
  });
  it('dimensiones distintas, error', () => {
    expect(() => distanciaCoseno([1], [1, 2])).toThrow(/distinta dimensión/);
  });
});

describe('buscarEnMemoria (QA-358)', () => {
  // Orden de la base: "ñu" va antes que "Zorro" con la collation en_US (con el de código, después).
  const ordenBase = ['ñu', 'Zorro', 'alce', 'Búho', 'cabra'];
  const filas = [
    // empate exacto entre títulos: ñu, Zorro y alce a la misma distancia
    { title: 'Zorro', vector: [1, 0], tags: [] as string[] },
    { title: 'ñu', vector: [1, 0], tags: [] },
    { title: 'alce', vector: [1, 0], tags: [] },
    // empate exacto entre filas de un título, y una fila peor
    { title: 'Búho', vector: [0.6, 0.8], tags: ['berig'] },
    { title: 'Búho', vector: [0.6, 0.8], tags: ['berig'] },
    { title: 'Búho', vector: [0, 1], tags: ['berig'] },
    { title: 'cabra', vector: [0.8, 0.6], tags: ['vaelira'] },
  ];
  const cache: CacheRag = ordenarCache(
    {
      cabecera,
      trozos: filas.map((f, i) => trozo(f.title, `${f.title}-${i}`, f.vector, f.tags.length ? f.tags : undefined)),
      consultas: [consulta('q', [1, 0])],
    },
    ordenBase,
  );

  it('mismo orden que el SQL, con empates exactos entre títulos y entre filas, y con exclusión por región', () => {
    for (const excluir of [[], ['berig'], ['vaelira']]) {
      for (const k of [1, 2, 3, 4, 5]) {
        expect(buscarEnMemoria(cache, 'q', k, excluir)).toEqual(referenciaSql(filas, [1, 0], k, excluir, ordenBase));
      }
    }
    // El desempate es el orden de la base (ñu antes que Zorro), no el de código de JS (Zorro antes que ñu).
    expect(buscarEnMemoria(cache, 'q', 3).map((t) => t.title)).toEqual(['ñu', 'Zorro', 'alce']);
    expect(buscarEnMemoria(cache, 'q', 5, ['berig']).map((t) => t.title)).toEqual(['ñu', 'Zorro', 'alce', 'cabra']);
  });

  it('cada título cuenta una vez, con su fila más cercana', () => {
    const r = buscarEnMemoria(cache, 'q', 5);
    expect(r.map((t) => t.title).filter((t) => t === 'Búho')).toHaveLength(1);
    expect(r.find((t) => t.title === 'Búho')!.distance).toBeCloseTo(0.4);
  });

  it('una consulta sin vector falla diciendo su texto exacto', () => {
    expect(() => buscarEnMemoria(cache, 'otra — La Cicatriz', 4)).toThrow('Falta en la caché el vector de la consulta: "otra — La Cicatriz"');
  });
});

describe('caché en archivo (QA-358)', () => {
  const cache = ordenarCache(
    {
      cabecera,
      trozos: [trozo('b', 'b2', [0.5, 0.25]), trozo('a', 'a1', [1, 0.1], ['vaelira']), trozo('b', 'b1', [0, 1])],
      consultas: [consulta('z', [1, 2]), consulta('c', [3, 4])],
    },
    ['b', 'a'],
  );

  it('orden fijo: títulos como la base, luego texto; consultas por texto', () => {
    expect(cache.trozos.map((t) => t.texto)).toEqual(['b1', 'b2', 'a1']);
    expect(cache.consultas.map((c) => c.texto)).toEqual(['c', 'z']);
  });

  it('ida y vuelta, con la cabecera en la primera línea y sin perder precisión', () => {
    const texto = serializarCache(cache);
    expect(JSON.parse(texto.split('\n')[0]).tipo).toBe('cabecera');
    expect(leerCache(texto)).toEqual(cache);
    expect(serializarCache(leerCache(texto))).toBe(texto);
    expect(hashDeCache(texto)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(hashDeCache(texto)).not.toBe(hashDeCache(`${texto}\n`));
  });

  it('sin cabecera o con una línea rota, error claro', () => {
    expect(() => leerCache('{"tipo":"consulta","texto":"q","vector":[1]}\n', 'c.jsonl')).toThrow(/primera línea tiene que ser la cabecera/);
    expect(() => leerCache(`${JSON.stringify(cabecera)}\nno-json\n`, 'c.jsonl')).toThrow(/c\.jsonl: línea 2 no es JSON válido/);
  });

  it('fusión de consultas: añade las nuevas sin duplicar, y gana la nueva si el texto ya estaba', () => {
    const fusion = fusionarConsultas([consulta('a', [1]), consulta('b', [2])], [consulta('b', [9]), consulta('c', [3])]);
    expect(fusion.map((c) => [c.texto, c.vector[0]])).toEqual([['a', 1], ['b', 9], ['c', 3]]);
  });

  it('la cabecera de una caché ya escrita tiene que casar (el digest solo si los dos lo traen)', () => {
    expect(diferenciasDeCabecera(cabecera, { ...cabecera })).toEqual([]);
    expect(diferenciasDeCabecera(cabecera, { ...cabecera, digest: null })).toEqual([]);
    expect(diferenciasDeCabecera(cabecera, { ...cabecera, indice_hash: 'sha256:y', trozo: 300 })).toHaveLength(2);
    expect(diferenciasDeCabecera(cabecera, { ...cabecera, digest: 'd2' })[0]).toMatch(/^digest:/);
  });
});

describe('filasDelIndice (QA-358)', () => {
  it('las filas de la caché dan una huella estable, y llevan la región solo si el fragmento la tiene', () => {
    const filas = filasDelIndice(CONFIG_RAG_POR_DEFECTO);
    expect(filas.length).toBeGreaterThan(0);
    expect(hashDelIndice('m', filas)).toBe(hashDelIndice('m', [...filas].reverse()));
    const conRegion = filas.filter((f) => f.region);
    expect(conRegion.length).toBeGreaterThan(0);
    for (const f of conRegion) expect(f.region!.every((r) => r === 'vaelira' || r === 'berig')).toBe(true);
    expect(filas.some((f) => !f.region)).toBe(true);
  });
});
