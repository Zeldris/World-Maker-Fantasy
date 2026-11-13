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
}

/// Lo de siempre: el juego no cambia si nadie toca los mandos.
export const CONFIG_RAG_POR_DEFECTO: ConfigRag = {
  tamTrozo: 400,
  solape: 0,
  prefijoConsulta: '',
  prefijoDocumento: '',
  plantilla: '{title}\n{trozo}',
};

const PREFIJOS_NOMIC = { RAG_PREFIJO_CONSULTA: 'search_query: ', RAG_PREFIJO_DOCUMENTO: 'search_document: ' };

const ARGUMENTOS: Record<string, string> = {
  '--tam-trozo': 'RAG_TAM_TROZO',
  '--solape': 'RAG_SOLAPE',
  '--prefijo-consulta': 'RAG_PREFIJO_CONSULTA',
  '--prefijo-documento': 'RAG_PREFIJO_DOCUMENTO',
  '--plantilla': 'RAG_PLANTILLA',
};

/// Pasa los argumentos de los mandos a sus variables de entorno, para que `configRag` los lea igual en los dos scripts.
export function aplicarArgumentosRag(argv: string[], entorno: NodeJS.ProcessEnv = process.env): void {
  argv.forEach((arg, i) => {
    if (arg === '--prefijos-nomic') Object.assign(entorno, PREFIJOS_NOMIC);
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
  };
  if (cfg.solape >= cfg.tamTrozo) throw new Error(`RAG_SOLAPE (${cfg.solape}) tiene que ser menor que RAG_TAM_TROZO (${cfg.tamTrozo})`);
  if (!cfg.plantilla.includes('{trozo}')) throw new Error(`RAG_PLANTILLA tiene que llevar {trozo} (recibida: ${JSON.stringify(cfg.plantilla)})`);
  return cfg;
}

/// Con qué se construyó el índice del lore: se guarda en `World.loreIndice` al reindexar (`QA-330`).
export interface ConfigIndice extends ConfigRag {
  modelo: string;
  fecha?: string;
}

/// Mandos en los que el índice guardado no casa con la corrida (vacío si casan). Sin índice guardado, no hay qué comparar.
export function diferenciasDeIndice(indice: Partial<ConfigIndice>, actual: ConfigIndice): string[] {
  const claves: (keyof ConfigIndice)[] = ['modelo', 'tamTrozo', 'solape', 'prefijoConsulta', 'prefijoDocumento', 'plantilla'];
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
