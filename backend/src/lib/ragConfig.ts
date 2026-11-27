import { createHash } from 'node:crypto';

/// Configuración del RAG del lore (`QA-329`, `QA-330`): cómo se trocea, qué se embebe y cómo se consulta. La usan
/// `reindex-lore`, `retrieveLore` y `rag-eval`, para que el índice y las consultas salgan de la misma.
///
/// Mandos (`QA-330`), por variable de entorno o por argumento de `reindex-lore` y `rag-eval` (el argumento gana):
///   RAG_TAM_TROZO          --tam-trozo <n>          caracteres por trozo (400)
///   RAG_SOLAPE             --solape <n>             caracteres de frases repetidas del trozo anterior (0)
///   RAG_PREFIJO_CONSULTA   --prefijo-consulta <t>   prefijo de la consulta ('')
///   RAG_PREFIJO_DOCUMENTO  --prefijo-documento <t>  prefijo del texto de cada trozo ('')
///   RAG_PLANTILLA          --plantilla <t>          texto embebido de cada trozo, con {title} y {trozo} ('{title}\n{trozo}')
///                          --prefijos-nomic         los dos prefijos de nomic-embed-text (`search_query: `, `search_document: `)
///   RAG_MODELO             --modelo <nombre>        modelo de Ollama que embebe el lore (`QA-351`, R7; por defecto bge-m3,
///                                                   `QA-361`; nomic-embed-text sigue con --modelo). Solo el lore: los hechos
///                                                   de partida (`SessionFact`, vector(1024)) usan OLLAMA_MODEL_EMBEDDINGS
///                                                   (por defecto bge-m3 también, `QA-523`).
///   RAG_BUSQUEDA           --hibrida                `vector` (por defecto) o `hibrida` (`QA-351`, R5): vector + texto
///                                                   completo sobre cada trozo, fusionadas con RRF (k 60). No cambia el índice.
/// En los textos, `\n` es un salto de línea. El servidor del juego lee las mismas variables: si se reindexa con
/// prefijos, el juego tiene que arrancar con el mismo RAG_PREFIJO_CONSULTA.

export interface ConfigRag {
  /// Caracteres por trozo, cortando por frases (`loreTrozos.ts`).
  tamTrozo: number;
  /// Caracteres de frases del trozo anterior que se repiten al empezar el siguiente (0 = sin solapamiento).
  solape: number;
  /// Prefijo de la consulta al embeber (p. ej. `search_query: ` de nomic-embed-text).
  prefijoConsulta: string;
  /// Prefijo del texto de cada trozo al embeber (p. ej. `search_document: `).
  prefijoDocumento: string;
  /// Plantilla del texto embebido de cada trozo, con `{title}` y `{trozo}`.
  plantilla: string;
  /// Modelo de Ollama que embebe el lore y las consultas al lore (`QA-351`).
  modelo: string;
  /// `vector`, o `hibrida`: vector + texto completo fusionadas con RRF (`QA-351`). Es de la consulta, no del índice.
  busqueda: Busqueda;
}

export const BUSQUEDAS = ['vector', 'hibrida'] as const;
export type Busqueda = (typeof BUSQUEDAS)[number];

/// Constante k de Reciprocal Rank Fusion: cada lista suma 1 / (k + puesto).
export const RRF_K = 60;
/// Configuración de texto completo de Postgres con la que se guarda `LoreChunk.busqueda` y se consulta (el lore está en
/// español; quita sus palabras vacías y reduce a la raíz).
export const CONFIG_TEXTO_COMPLETO = 'spanish';

/// Lo de siempre: el juego no cambia si nadie toca los mandos.
export const CONFIG_RAG_POR_DEFECTO: ConfigRag = {
  tamTrozo: 400,
  solape: 0,
  prefijoConsulta: '',
  prefijoDocumento: '',
  plantilla: '{title}\n{trozo}',
  modelo: 'bge-m3',
  busqueda: 'vector',
};

const PREFIJOS_NOMIC = { RAG_PREFIJO_CONSULTA: 'search_query: ', RAG_PREFIJO_DOCUMENTO: 'search_document: ' };

const ARGUMENTOS: Record<string, string> = {
  '--tam-trozo': 'RAG_TAM_TROZO',
  '--solape': 'RAG_SOLAPE',
  '--prefijo-consulta': 'RAG_PREFIJO_CONSULTA',
  '--prefijo-documento': 'RAG_PREFIJO_DOCUMENTO',
  '--plantilla': 'RAG_PLANTILLA',
  '--modelo': 'RAG_MODELO',
};

/// Pasa los argumentos de los mandos a sus variables de entorno, para que `configRag` los lea igual en los dos scripts.
export function aplicarArgumentosRag(argv: string[], entorno: NodeJS.ProcessEnv = process.env): void {
  argv.forEach((arg, i) => {
    if (arg === '--prefijos-nomic') Object.assign(entorno, PREFIJOS_NOMIC);
    if (arg === '--hibrida') entorno.RAG_BUSQUEDA = 'hibrida';
    const variable = ARGUMENTOS[arg];
    if (!variable) return;
    const valor = argv[i + 1];
    if (valor === undefined) throw new Error(`${arg} necesita un valor`);
    entorno[variable] = valor;
  });
}

const texto = (v: string | undefined, porDefecto: string) => (v === undefined ? porDefecto : v.replaceAll('\\n', '\n'));

function entero(nombre: string, v: string | undefined, porDefecto: number, minimo: number): number {
  if (v === undefined || v === '') return porDefecto;
  const n = Number(v);
  if (!Number.isInteger(n) || n < minimo) throw new Error(`${nombre} tiene que ser un entero ≥ ${minimo} (recibido: ${v})`);
  return n;
}

/// La configuración vigente: la de por defecto con lo que digan las variables RAG_*. Lanza si un mando no vale.
export function configRag(entorno: NodeJS.ProcessEnv = process.env): ConfigRag {
  const d = CONFIG_RAG_POR_DEFECTO;
  const cfg: ConfigRag = {
    tamTrozo: entero('RAG_TAM_TROZO', entorno.RAG_TAM_TROZO, d.tamTrozo, 1),
    solape: entero('RAG_SOLAPE', entorno.RAG_SOLAPE, d.solape, 0),
    prefijoConsulta: texto(entorno.RAG_PREFIJO_CONSULTA, d.prefijoConsulta),
    prefijoDocumento: texto(entorno.RAG_PREFIJO_DOCUMENTO, d.prefijoDocumento),
    plantilla: texto(entorno.RAG_PLANTILLA, d.plantilla),
    modelo: entorno.RAG_MODELO || d.modelo,
    busqueda: (entorno.RAG_BUSQUEDA || d.busqueda) as Busqueda,
  };
  if (!BUSQUEDAS.includes(cfg.busqueda)) throw new Error(`RAG_BUSQUEDA tiene que ser vector o hibrida (recibida: ${entorno.RAG_BUSQUEDA})`);
  if (cfg.solape >= cfg.tamTrozo) throw new Error(`RAG_SOLAPE (${cfg.solape}) tiene que ser menor que RAG_TAM_TROZO (${cfg.tamTrozo})`);
  if (!cfg.plantilla.includes('{trozo}')) throw new Error(`RAG_PLANTILLA tiene que llevar {trozo} (recibida: ${JSON.stringify(cfg.plantilla)})`);
  return cfg;
}

/// Con qué se construyó el índice del lore: se guarda en `World.loreIndice` al reindexar (`QA-330`). La búsqueda no:
/// es de la consulta.
export interface ConfigIndice extends Omit<ConfigRag, 'busqueda'> {
  fecha?: string;
  /// Configuración de texto completo con la que se llenó `LoreChunk.busqueda` (`QA-351`); sin ella, no hay híbrida.
  texto_completo?: string;
  /// Huella del contenido del índice (`indice_hash`, T6 del GVE): ver `hashDelIndice`. No es un mando: no se compara.
  indice_hash?: string;
}

/// Mandos en los que el índice guardado no casa con la corrida (vacío si casan). Sin índice guardado, no hay qué comparar.
export function diferenciasDeIndice(indice: Partial<ConfigIndice>, actual: Omit<ConfigRag, 'busqueda'>): string[] {
  const claves: (keyof Omit<ConfigRag, 'busqueda'>)[] = ['modelo', 'tamTrozo', 'solape', 'prefijoConsulta', 'prefijoDocumento', 'plantilla'];
  return claves
    .filter((c) => indice[c] !== actual[c])
    .map((c) => `${c}: índice ${JSON.stringify(indice[c] ?? null)}, corrida ${JSON.stringify(actual[c])}`);
}

/// Texto que se embebe para un trozo de un fragmento.
export function textoDocumento(cfg: ConfigRag, title: string, trozo: string): string {
  return cfg.prefijoDocumento + cfg.plantilla.replaceAll('{title}', title).replaceAll('{trozo}', trozo);
}

/// Texto que se embebe para una consulta.
export function textoConsulta(cfg: ConfigRag, consulta: string): string {
  return cfg.prefijoConsulta + consulta;
}

/// Huella del contenido del índice (T6 del GVE): sha256 del modelo y de los pares (título, texto embebido exacto) de
/// cada fila indexada, sin los UUID (cambian en cada reindexado) y en orden estable (título, luego texto).
/// Devuelve `sha256:<hex>`.
export function hashDelIndice(modelo: string, filas: { titulo: string; texto: string }[]): string {
  const orden = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const ordenadas = [...filas].sort((a, b) => orden(a.titulo, b.titulo) || orden(a.texto, b.texto));
  const canonico = JSON.stringify({ modelo, filas: ordenadas.map((f) => [f.titulo, f.texto]) });
  return `sha256:${createHash('sha256').update(canonico).digest('hex')}`;
}

/// Texto de un trozo para la búsqueda de texto completo (`QA-351`): título y trozo, sin prefijo ni plantilla.
export function textoParaBusqueda(title: string, trozo: string): string {
  return `${title}\n${trozo}`;
}

/// Reciprocal Rank Fusion (`QA-351`, R5): cada lista viene ordenada (la mejor primero) y da a cada título
/// 1 / (k + puesto). Devuelve los títulos por puntuación total, desempatando por título (mismo desempate fijo que la
/// búsqueda por vector, `QA-327`), cortados en `topK`.
export function fusionRrf(listas: string[][], topK: number, k = RRF_K): { title: string; puntos: number }[] {
  const puntos = new Map<string, number>();
  for (const lista of listas) lista.forEach((t, i) => puntos.set(t, (puntos.get(t) ?? 0) + 1 / (k + i + 1)));
  return [...puntos]
    .map(([title, p]) => ({ title, puntos: p }))
    .sort((a, b) => b.puntos - a.puntos || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0))
    .slice(0, topK);
}
