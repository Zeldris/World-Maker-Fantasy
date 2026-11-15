/// Lógica pura de `rag-eval.ts` (sin BD ni Ollama, para poder probarla).

export const CAUSAS = [null, 'no_recuperado', 'ignorado', 'ausente'] as const;
export type Causa = (typeof CAUSAS)[number];

export interface CasoRag {
  id: string;
  pregunta: string;
  /// Títulos de trozo (`title` de loreChunks.ts) que responden la pregunta.
  esperados: string[];
  /// Región de la ubicación del jugador (como `Location.region`). Opcional: añade ` — <región>` a la
  /// consulta y excluye el lore del continente contrario, como hace el juego.
  region?: string;
  origen?: string;
  /// Por qué falló el caso en la partida de la que sale (`QA-328`): null si no falló o es semilla. Obligatoria.
  causa: Causa;
  /// Si es true y el caso no sale en el top-k, `rag-eval` sale con código 1.
  debe_pasar?: boolean;
  /// Idioma de la pregunta (`es`/`en`) y caso de su pareja en el otro idioma (`QA-331`).
  lang?: Idioma;
  pair_id?: string;
}

export const IDIOMAS = ['es', 'en'] as const;
export type Idioma = (typeof IDIOMAS)[number];

export interface TrozoDevuelto {
  title: string;
  /// En la búsqueda híbrida puede ser null (el orden es el de la fusión).
  distance: number | null;
}

export interface ResultadoCaso {
  caso: CasoRag;
  /// Puesto (1 = primero) del primer trozo esperado, o null si no sale.
  puesto: number | null;
  /// Trozos que devolvió `retrieveLore`, en orden.
  devueltos: TrozoDevuelto[];
  /// Texto exacto que se consultó (pregunta, y ` — <región>` si el caso la trae).
  consulta: string;
  /// Solo con `--narrar` (`QA-359`).
  narracion?: NarracionCaso;
}

/// Lo que añade `rag-eval --narrar` a cada caso (`QA-359`).
export interface NarracionCaso {
  /// Fragmentos que entraron en el prompt, en su orden y ya recortados por el tope de caracteres.
  lore: { titulo: string; texto: string }[];
  poco_anclado: boolean;
  texto: string;
  /// false si la respuesta no era el JSON pedido: `texto` es entonces la respuesta cruda.
  json_valido: boolean;
  modelo: string;
  digest: string | null;
  ms: number;
}

const norm = (s: string) => s.trim().toLowerCase();

export function puestoDelPrimerEsperado(devueltos: string[], esperados: string[]): number | null {
  const buscados = new Set(esperados.map(norm));
  const i = devueltos.findIndex((d) => buscados.has(norm(d)));
  return i >= 0 ? i + 1 : null;
}

export type ParaResumen = Pick<ResultadoCaso, 'puesto'> & { caso: Pick<CasoRag, 'id' | 'debe_pasar'> };

export function resumirCasos<R extends ParaResumen>(resultados: R[], k: number) {
  const n = resultados.length || 1;
  const dentro = resultados.filter((r) => r.puesto !== null && r.puesto <= k);
  const recall = dentro.length / n;
  const mrr = resultados.reduce((acc, r) => acc + (r.puesto !== null && r.puesto <= k ? 1 / r.puesto : 0), 0) / n;
  const fallanObligatorios = resultados.filter((r) => r.caso.debe_pasar && !(r.puesto !== null && r.puesto <= k)).map((r) => r.caso.id);
  return { recall, mrr, fallanObligatorios };
}

/// Errores de forma de los casos (`QA-328`): cada uno con su id o su número de orden. Vacío si están bien.
export function validarCasos(casos: unknown[]): string[] {
  const errores: string[] = [];
  casos.forEach((c, i) => {
    const caso = c as Record<string, unknown>;
    const quien = typeof caso?.id === 'string' && caso.id ? caso.id : `caso ${i + 1}`;
    if (typeof caso?.id !== 'string' || !caso.id) errores.push(`${quien}: falta \`id\``);
    if (typeof caso?.pregunta !== 'string' || !caso.pregunta.trim()) errores.push(`${quien}: falta \`pregunta\``);
    if (!Array.isArray(caso?.esperados) || caso.esperados.length === 0 || !caso.esperados.every((e) => typeof e === 'string'))
      errores.push(`${quien}: \`esperados\` tiene que ser una lista de títulos no vacía`);
    if (!('causa' in (caso ?? {}))) errores.push(`${quien}: falta \`causa\` (null, no_recuperado, ignorado o ausente)`);
    else if (!(CAUSAS as readonly unknown[]).includes(caso.causa))
      errores.push(`${quien}: \`causa\` ${JSON.stringify(caso.causa)} no es null, no_recuperado, ignorado ni ausente`);
    if (!(IDIOMAS as readonly unknown[]).includes(caso?.lang)) errores.push(`${quien}: \`lang\` tiene que ser es o en`);
    if (typeof caso?.pair_id !== 'string' || !caso.pair_id) errores.push(`${quien}: falta \`pair_id\``);
  });
  const vistos = new Set<string>();
  for (const c of casos as { id?: unknown }[]) {
    if (typeof c?.id !== 'string') continue;
    if (vistos.has(c.id)) errores.push(`${c.id}: id repetido`);
    vistos.add(c.id);
  }
  return errores;
}

/// Errores de las parejas de idioma (`QA-331`): cada `pair_id` tiene un caso `es` y uno `en`, con los mismos
/// esperados. Vacío si están bien.
export function validarParejas(casos: Pick<CasoRag, 'id' | 'lang' | 'pair_id' | 'esperados'>[]): string[] {
  const grupos = new Map<string, typeof casos>();
  for (const c of casos) {
    if (typeof c.pair_id !== 'string' || !c.pair_id) continue;
    grupos.set(c.pair_id, [...(grupos.get(c.pair_id) ?? []), c]);
  }
  const errores: string[] = [];
  const clave = (e: string[]) => JSON.stringify([...e].map(norm).sort());
  for (const [pareja, cs] of grupos) {
    const idiomas = cs.map((c) => c.lang).sort().join(',');
    if (idiomas !== 'en,es') {
      errores.push(`pareja ${pareja}: tiene que tener un caso es y uno en (tiene ${idiomas || 'ninguno'}: ${cs.map((c) => c.id).join(', ')})`);
      continue;
    }
    if (clave(cs[0].esperados) !== clave(cs[1].esperados)) errores.push(`pareja ${pareja}: ${cs[0].id} y ${cs[1].id} esperan títulos distintos`);
  }
  return errores;
}

/// Consulta que hace el juego para el caso: la pregunta, y ` — <región>` si la trae (turnResolution.ts).
export function consultaDelCaso(caso: Pick<CasoRag, 'pregunta' | 'region'>): string {
  return caso.region ? `${caso.pregunta} — ${caso.region}` : caso.pregunta;
}

/// Digest de un modelo en la respuesta de `/api/tags` de Ollama, o null si no está (el Ollama simulado no lo da).
/// `nomic-embed-text` casa con `nomic-embed-text:latest`.
export function digestDelModelo(tags: unknown, modelo: string): string | null {
  const conEtiqueta = (n: string) => (n.includes(':') ? n : `${n}:latest`);
  const buscado = conEtiqueta(modelo);
  const modelos = (tags as { models?: { name?: unknown; model?: unknown; digest?: unknown }[] })?.models;
  if (!Array.isArray(modelos)) return null;
  const m = modelos.find((x) => [x.name, x.model].some((n) => typeof n === 'string' && conEtiqueta(n) === buscado));
  return typeof m?.digest === 'string' ? m.digest : null;
}

/// Configuración de la corrida que va en `config` de la salida JSON (`QA-329`, forma que lee el GVE).
export interface ConfigCorrida {
  modelo: string;
  digest: string | null;
  /// `vector` o `hibrida` (`QA-351`).
  busqueda: string;
  /// Cómo se fusionan las listas en la híbrida (`rrf-60`); null en `vector`.
  fusion: string | null;
  topK: number;
  trozo: number;
  solapamiento: number;
  prefijo_consulta: string;
  prefijo_documento: string;
  /// Plantilla del texto embebido de cada trozo, con `{title}` y `{trozo}`.
  texto_embebido: string;
  /// Forma de la consulta enviada.
  forma_consulta: string;
  /// Si el caso trae región, se excluye el lore del continente contrario.
  region_filter?: string;
  /// Configuración con la que se construyó el índice (`QA-330`), o null si no consta.
  index?: Record<string, unknown> | null;
  index_matches?: boolean | null;
  commit?: string | null;
  commit_dirty?: boolean | null;
  cases_file?: string;
  /// `vivo` (índice de la base) o `congelado` (caché de `--sin-red`, `QA-358`).
  indice?: 'vivo' | 'congelado';
  /// `sha256:<hex>` del archivo de la caché con `--sin-red`; null con la base.
  cache_hash?: string | null;
  /// Solo con `--narrar` (`QA-359`).
  narrador?: ConfigNarrador;
  /// Solo con `--desde`/`--hasta` (`QA-360`): el tramo de casos de esta corrida (`desde` incluido, `hasta` excluido,
  /// base 0) y cuántos casos tiene el archivo. Sin esos mandos la clave no existe. `--juntar` la quita.
  tramo?: Tramo;
}

/// Tramo de una corrida partida en tandas (`QA-360`): casos `[desde, hasta)` de `total`.
export interface Tramo {
  desde: number;
  hasta: number;
  total: number;
}

/// `--desde`/`--hasta` (`QA-360`): los casos con índice en `[desde, hasta)` (base 0) y el tramo para `config.tramo`.
/// `desde` por defecto 0 y `hasta` por defecto el total. Lanza `Error` con el motivo si no valen.
export function cortarTramo<T>(casos: T[], desdeTexto: string | undefined, hastaTexto: string | undefined): { casos: T[]; tramo: Tramo } {
  const total = casos.length;
  const entero = (nombre: string, texto: string): number => {
    if (!/^\d+$/.test(texto.trim())) throw new Error(`${nombre} debe ser un entero mayor o igual que 0 (recibido: ${texto})`);
    return Number(texto);
  };
  const desde = desdeTexto === undefined ? 0 : entero('--desde', desdeTexto);
  const hasta = hastaTexto === undefined ? total : entero('--hasta', hastaTexto);
  if (desde >= total) throw new Error(`--desde ${desde} está fuera del archivo: tiene ${total} casos (índices 0 a ${total - 1})`);
  if (hasta > total) throw new Error(`--hasta ${hasta} pasa del total: el archivo tiene ${total} casos`);
  if (desde >= hasta) throw new Error(`--desde ${desde} tiene que ser menor que --hasta ${hasta}`);
  return { casos: casos.slice(desde, hasta), tramo: { desde, hasta, total } };
}

/// Con qué se generaron las narraciones de `--narrar` (`QA-359`).
export interface ConfigNarrador {
  modelo: string;
  digest: string | null;
  temperatura: number;
  semilla: number;
  /// Tope de caracteres del lore en el prompt: el de `--max-lore-chars` o el de siempre (1400).
  max_lore_chars: number;
  /// `QA-360`: true si se usó `--lore-trozo` / `--lore-al-final`, null si no; `umbral_anclado`, el de `--umbral-anclado` o null.
  lore_trozo?: true | null;
  lore_al_final?: true | null;
  umbral_anclado?: number | null;
}

export const FORMA_CONSULTA = '{pregunta} [— {region}]';

/// Salida de `rag-eval --json` (`QA-329`, T6 del GVE): un solo objeto con la configuración, la huella del índice
/// (`sha256:<hex>` o null si el índice no la guarda), cada caso y el resumen.
/// Id del caso gemelo (mismo `pair_id`, otro idioma) entre `todos`, o null (`QA-331`).
function idDelGemelo(c: { pair_id?: string | null; lang?: string | null }, todos: { id: string; pair_id?: string | null; lang?: string | null }[]): string | null {
  return (c.pair_id && c.lang && todos.find((o) => o.pair_id === c.pair_id && o.lang && o.lang !== c.lang)?.id) || null;
}

/// `resumen` de la salida JSON: lo calculan igual la corrida entera y `--juntar`.
function resumenJson(resultados: ParaResumen[], k: number) {
  const resumen = resumirCasos(resultados, k);
  return { k, n: resultados.length, recall: resumen.recall, mrr: resumen.mrr, fallan_obligatorios: resumen.fallanObligatorios };
}

export function salidaJson(config: ConfigCorrida, indiceHash: string | null, resultados: ResultadoCaso[], k: number) {
  /// `par`: id del gemelo en el otro idioma (mismo `pair_id`), recíproco; null si no está en la corrida.
  const gemelo = (c: CasoRag): string | null =>
    idDelGemelo(c, resultados.map((o) => o.caso));
  return {
    config,
    indice_hash: indiceHash,
    casos: resultados.map((r) => ({
      id: r.caso.id,
      idioma: r.caso.lang ?? null,
      par: gemelo(r.caso),
      pair_id: r.caso.pair_id ?? null,
      origen: r.caso.origen ?? null,
      causa: r.caso.causa,
      debe_pasar: r.caso.debe_pasar ?? false,
      pregunta: r.caso.pregunta,
      consulta: r.consulta,
      esperados: r.caso.esperados,
      devueltos: r.devueltos.map((d) => ({ titulo: d.title, distancia: d.distance })),
      puesto: puestoDelPrimerEsperado(r.devueltos.map((d) => d.title), r.caso.esperados),
      pasa: r.puesto !== null && r.puesto <= k,
      ...(r.narracion ? { narracion: r.narracion } : {}),
    })),
    resumen: resumenJson(resultados, k),
  };
}

type SalidaJson = ReturnType<typeof salidaJson>;

/// Forma estable (claves ordenadas) para comparar configuraciones.
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.entries(v as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([c, x]) => `${JSON.stringify(c)}:${canonico(x)}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'undefined';
}

/// `--juntar` (`QA-360`): une las salidas `--json` de varias corridas por tramos (`--desde`/`--hasta`) en la que habría
/// escrito una corrida entera. Lanza `Error` con el motivo si no se pueden unir.
///
/// Qué tiene que casar y qué se hace con lo que varía por corrida:
/// - `config` tiene que ser idéntico (comparación profunda, sin importar el orden de claves) salvo `tramo`, que se quita,
///   y `commit_dirty`, que puede variar entre tandas (un archivo del árbol cambia mientras corre la siguiente): en la
///   unión vale true si alguna tanda lo tenía, null si ninguna lo sabía. `indice_hash` y `resumen.k` también tienen que casar.
/// - Los tramos, ordenados por `desde`, tienen que tener el mismo `total`, empezar en 0, ser contiguos (sin huecos ni
///   solapes) y acabar en `total`; cada parte trae tantos casos como su tramo.
/// - `casos` se concatenan en orden; `par` se recalcula sobre todos (en un tramo el gemelo puede quedar fuera, y salía
///   null), y `resumen` se recalcula con la misma función que la corrida entera (`resumenJson`).
/// - Lo inherentemente por corrida y que se conserva tal cual por caso: `narracion.ms` (tiempos), igual que la
///   corrida entera tendría el suyo; el JSON unido es idéntico a una corrida entera salvo esos tiempos (y lo que
///   cambie un modelo no determinista, que con temperatura 0 y semilla fija no debería).
export function juntarSalidas(partes: unknown[]): SalidaJson {
  if (partes.length === 0) throw new Error('--juntar necesita al menos una parte');
  const ps = partes.map((p, i) => {
    const o = p as Partial<SalidaJson> | null;
    const quien = `parte ${i + 1}`;
    if (!o || typeof o !== 'object' || !o.config || !Array.isArray(o.casos) || !o.resumen) throw new Error(`${quien}: no es una salida de rag-eval --json (faltan config, casos o resumen)`);
    const t = (o.config as ConfigCorrida).tramo;
    if (!t || ![t.desde, t.hasta, t.total].every((x) => Number.isInteger(x))) throw new Error(`${quien}: la salida no trae config.tramo (¿se corrió sin --desde/--hasta?)`);
    if (o.casos.length !== t.hasta - t.desde) throw new Error(`${quien}: trae ${o.casos.length} casos y su tramo [${t.desde}, ${t.hasta}) pide ${t.hasta - t.desde}`);
    return { quien, o: o as SalidaJson, t };
  });
  ps.sort((a, b) => a.t.desde - b.t.desde);
  const total = ps[0].t.total;
  for (const p of ps) if (p.t.total !== total) throw new Error(`${p.quien}: el total de casos es distinto (${p.t.total} frente a ${total} de ${ps[0].quien})`);
  let siguiente = 0;
  for (const p of ps) {
    if (p.t.desde > siguiente) throw new Error(`hueco: faltan los casos [${siguiente}, ${p.t.desde}) antes de ${p.quien}`);
    if (p.t.desde < siguiente) throw new Error(`solape: ${p.quien} empieza en ${p.t.desde} y el tramo anterior llega hasta ${siguiente}`);
    siguiente = p.t.hasta;
  }
  if (siguiente !== total) throw new Error(`hueco: faltan los casos [${siguiente}, ${total}) al final (el total es ${total})`);

  const sinTramo = (c: ConfigCorrida) => {
    const { tramo: _t, commit_dirty: _d, ...resto } = c;
    return resto;
  };
  const base = ps[0];
  for (const p of ps.slice(1)) {
    const a = sinTramo(base.o.config) as Record<string, unknown>;
    const b = sinTramo(p.o.config) as Record<string, unknown>;
    const claves = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((c) => canonico(a[c]) !== canonico(b[c]));
    if (claves.length > 0) throw new Error(`config distinta entre ${base.quien} y ${p.quien}: ${claves.join(', ')}`);
    if (canonico(p.o.indice_hash) !== canonico(base.o.indice_hash)) throw new Error(`indice_hash distinto entre ${base.quien} y ${p.quien}`);
    if (p.o.resumen.k !== base.o.resumen.k) throw new Error(`k distinto entre ${base.quien} y ${p.quien} (${p.o.resumen.k} frente a ${base.o.resumen.k})`);
  }

  const { tramo: _tramo, ...config } = base.o.config;
  const sucios = ps.map((p) => p.o.config.commit_dirty);
  if ('commit_dirty' in config) config.commit_dirty = sucios.some((d) => d === true) ? true : sucios.every((d) => d === undefined || d === null) ? null : false;

  const crudos = ps.flatMap((p) => p.o.casos);
  const casos = crudos.map((c) => ({ ...c, par: idDelGemelo({ pair_id: c.pair_id, lang: c.idioma }, crudos.map((o) => ({ id: o.id, pair_id: o.pair_id, lang: o.idioma }))) }));
  return {
    config,
    indice_hash: base.o.indice_hash,
    casos,
    resumen: resumenJson(casos.map((c) => ({ caso: { id: c.id, debe_pasar: c.debe_pasar }, puesto: c.puesto })), base.o.resumen.k),
  };
}
