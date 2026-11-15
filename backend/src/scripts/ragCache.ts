import { createHash } from 'node:crypto';
import { loreChunks } from './loreChunks.js';
import { trozosParaIndexar } from './loreTrozos.js';
import { textoDocumento, type ConfigIndice, type ConfigRag } from '../lib/ragConfig.js';

/// Caché del índice y de las consultas de `rag-eval` para correr sin red (`QA-358`, T9 del GVE). Lógica pura, sin
/// BD ni Ollama, para poder probarla. Formato JSONL, una línea por registro y en este orden:
///   {"tipo":"cabecera", modelo, digest, prefijo_consulta, prefijo_documento, texto_embebido, trozo, solapamiento,
///    indice_hash, indice}                    `indice` es `World.loreIndice` entero (de ahí sale `config.index`).
///   {"tipo":"trozo", titulo, texto, region?, vector}   `texto` es el texto EMBEBIDO (el de `hashDelIndice`);
///                                                      `region`, si la hay, es SIEMPRE una lista de las etiquetas de
///                                                      continente del fragmento (`["vaelira"]`, `["berig"]`…).
///   {"tipo":"consulta", texto, vector}       `texto` es exactamente lo que se embebe (`textoConsulta`).

export const CONTINENTES = ['vaelira', 'berig'] as const;

export interface CabeceraCache {
  tipo: 'cabecera';
  modelo: string;
  digest: string | null;
  prefijo_consulta: string;
  prefijo_documento: string;
  texto_embebido: string;
  trozo: number;
  solapamiento: number;
  indice_hash: string;
  indice: Partial<ConfigIndice> | null;
}

export interface TrozoCache {
  tipo: 'trozo';
  titulo: string;
  texto: string;
  region?: string[];
  vector: number[];
}

export interface ConsultaCache {
  tipo: 'consulta';
  texto: string;
  vector: number[];
}

export interface CacheRag {
  cabecera: CabeceraCache;
  trozos: TrozoCache[];
  consultas: ConsultaCache[];
}

const porCodigo = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/// Las filas del índice tal como las deja `reindex-lore`: una por trozo de cada fragmento, con el texto embebido.
/// `region`: etiquetas de continente del fragmento, si tiene.
export function filasDelIndice(cfg: ConfigRag): { titulo: string; texto: string; region?: string[] }[] {
  return loreChunks.flatMap((chunk) => {
    const region = CONTINENTES.filter((c) => chunk.tags.includes(c));
    return trozosParaIndexar(chunk.text, cfg.tamTrozo, cfg.solape).map((trozo) => ({
      titulo: chunk.title,
      texto: textoDocumento(cfg, chunk.title, trozo),
      ...(region.length > 0 ? { region: [...region] } : {}),
    }));
  });
}

/// Orden fijo de la caché: trozos por título (en el orden de la base, `ordenTitulos`; los que no estén, al final por
/// código) y luego por texto; consultas por texto. Es el desempate en memoria: la base ordena `distance, title` con
/// su collation (en_US.utf8), que no es el orden de código de JS.
export function ordenarCache(cache: CacheRag, ordenTitulos: string[]): CacheRag {
  const pos = new Map(ordenTitulos.map((t, i) => [t, i]));
  const p = (t: string) => pos.get(t) ?? ordenTitulos.length;
  return {
    cabecera: cache.cabecera,
    trozos: [...cache.trozos].sort((a, b) => p(a.titulo) - p(b.titulo) || porCodigo(a.titulo, b.titulo) || porCodigo(a.texto, b.texto)),
    consultas: [...cache.consultas].sort((a, b) => porCodigo(a.texto, b.texto)),
  };
}

export function serializarCache(cache: CacheRag): string {
  const lineas = [cache.cabecera, ...cache.trozos, ...cache.consultas].map((r) => JSON.stringify(r));
  return `${lineas.join('\n')}\n`;
}

export function leerCache(contenido: string, origen = 'caché'): CacheRag {
  const registros = contenido
    .split('\n')
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return JSON.parse(l) as { tipo?: string };
      } catch (err) {
        throw new Error(`${origen}: línea ${i + 1} no es JSON válido (${err instanceof Error ? err.message : err})`);
      }
    });
  const [cabecera, ...resto] = registros;
  if (cabecera?.tipo !== 'cabecera') throw new Error(`${origen}: la primera línea tiene que ser la cabecera`);
  const cache: CacheRag = { cabecera: cabecera as CabeceraCache, trozos: [], consultas: [] };
  resto.forEach((r, i) => {
    if (r.tipo === 'trozo') cache.trozos.push(r as TrozoCache);
    else if (r.tipo === 'consulta') cache.consultas.push(r as ConsultaCache);
    else throw new Error(`${origen}: línea ${i + 2} de tipo desconocido (${JSON.stringify(r.tipo)})`);
  });
  return cache;
}

/// `sha256:<hex>` del contenido del archivo de la caché.
export function hashDeCache(contenido: string): string {
  return `sha256:${createHash('sha256').update(contenido).digest('hex')}`;
}

const CLAVES_CABECERA = ['modelo', 'prefijo_consulta', 'prefijo_documento', 'texto_embebido', 'trozo', 'solapamiento', 'indice_hash'] as const;

/// En qué se distingue la cabecera de una caché ya escrita de la que se quiere escribir (vacío si casan). El digest
/// solo cuenta si los dos lo traen.
export function diferenciasDeCabecera(existente: CabeceraCache, nueva: CabeceraCache): string[] {
  const dif = CLAVES_CABECERA.filter((c) => existente[c] !== nueva[c]).map(
    (c) => `${c}: caché ${JSON.stringify(existente[c])}, corrida ${JSON.stringify(nueva[c])}`,
  );
  if (existente.digest && nueva.digest && existente.digest !== nueva.digest)
    dif.push(`digest: caché ${JSON.stringify(existente.digest)}, corrida ${JSON.stringify(nueva.digest)}`);
  return dif;
}

/// Añade a `base` las consultas de `nuevas` (sin duplicar por texto; si el texto ya estaba, gana la nueva).
export function fusionarConsultas(base: ConsultaCache[], nuevas: ConsultaCache[]): ConsultaCache[] {
  const porTexto = new Map(base.map((c) => [c.texto, c]));
  for (const c of nuevas) porTexto.set(c.texto, c);
  return [...porTexto.values()];
}

/// Distancia coseno imitando a pgvector (`cosine_distance`): componentes en float32, producto y normas acumulados en
/// float32, similitud en double recortada a [-1, 1].
export function distanciaCoseno(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`vectores de distinta dimensión (${a.length} y ${b.length})`);
  const f = Math.fround;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = f(a[i]);
    const y = f(b[i]);
    dot = f(dot + f(x * y));
    na = f(na + f(x * x));
    nb = f(nb + f(y * y));
  }
  const similitud = Math.min(1, Math.max(-1, dot / Math.sqrt(na * nb)));
  return 1 - similitud;
}

/// Como `retrieveLore`: por título, la fila más cercana (las filas con alguna etiqueta de `excluir` no cuentan);
/// orden por distancia y, a igualdad, por la posición del título en la caché; corta en `k`.
export function buscarEnMemoria(
  cache: CacheRag,
  textoDeConsulta: string,
  k: number,
  excluir: string[] = [],
): { title: string; distance: number }[] {
  const consulta = cache.consultas.find((c) => c.texto === textoDeConsulta);
  if (!consulta) throw new Error(`Falta en la caché el vector de la consulta: ${JSON.stringify(textoDeConsulta)}`);
  const mejores = new Map<string, number>();
  for (const t of cache.trozos) {
    if (t.region?.some((r) => excluir.includes(r))) continue;
    const d = distanciaCoseno(t.vector, consulta.vector);
    const previa = mejores.get(t.titulo);
    if (previa === undefined || d < previa) mejores.set(t.titulo, d);
  }
  // `Map` conserva el orden de inserción: el de primera aparición de cada título en la caché.
  return [...mejores]
    .map(([title, distance], pos) => ({ title, distance, pos }))
    .sort((a, b) => a.distance - b.distance || a.pos - b.pos)
    .slice(0, k)
    .map(({ title, distance }) => ({ title, distance }));
}
