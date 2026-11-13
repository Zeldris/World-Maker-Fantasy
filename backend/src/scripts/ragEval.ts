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
  distance: number;
}

export interface ResultadoCaso {
  caso: CasoRag;
  /// Puesto (1 = primero) del primer trozo esperado, o null si no sale.
  puesto: number | null;
  /// Trozos que devolvió `retrieveLore`, en orden.
  devueltos: TrozoDevuelto[];
  /// Texto exacto que se consultó (pregunta, y ` — <región>` si el caso la trae).
  consulta: string;
}

const norm = (s: string) => s.trim().toLowerCase();

export function puestoDelPrimerEsperado(devueltos: string[], esperados: string[]): number | null {
  const buscados = new Set(esperados.map(norm));
  const i = devueltos.findIndex((d) => buscados.has(norm(d)));
  return i >= 0 ? i + 1 : null;
}

export function resumirCasos(resultados: ResultadoCaso[], k: number) {
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

/// Configuración de la corrida que va en `config` de la salida JSON (`QA-329`).
export interface ConfigCorrida {
  embedding_model: string;
  embedding_digest: string | null;
  top_k: number;
  chunk_size: number;
  chunk_overlap: number;
  query_prefix: string;
  document_prefix: string;
  /// Plantilla del texto embebido de cada trozo, con `{title}` y `{trozo}`.
  document_template: string;
  /// Forma de la consulta, según traiga región el caso o no.
  query_template: { sin_region: string; con_region: string };
  /// Si el caso trae región, se excluye el lore del continente contrario.
  region_filter: string;
  /// Configuración con la que se construyó el índice (`QA-330`), o null si no consta.
  index: Record<string, unknown> | null;
  index_matches: boolean | null;
  commit: string | null;
  commit_dirty: boolean | null;
  cases_file: string;
}

/// Salida de `rag-eval --json` (`QA-329`): un solo objeto con la configuración, cada caso y el resumen.
export function salidaJson(config: ConfigCorrida, resultados: ResultadoCaso[], k: number) {
  const resumen = resumirCasos(resultados, k);
  return {
    config,
    cases: resultados.map((r) => ({
      id: r.caso.id,
      lang: r.caso.lang ?? null,
      pair_id: r.caso.pair_id ?? null,
      origen: r.caso.origen ?? null,
      causa: r.caso.causa,
      debe_pasar: r.caso.debe_pasar ?? false,
      esperados: r.caso.esperados,
      query: r.consulta,
      results: r.devueltos.map((d) => ({ title: d.title, distance: d.distance })),
      rank: r.puesto,
      passed: r.puesto !== null && r.puesto <= k,
    })),
    summary: { k, n: resultados.length, recall: resumen.recall, mrr: resumen.mrr, failed_required: resumen.fallanObligatorios },
  };
}
