/// Configuración del RAG del lore (`QA-329`, `QA-330`): cómo se trocea, qué se embebe y cómo se consulta. La usan
/// `reindex-lore`, `retrieveLore` y `rag-eval`, para que el índice y las consultas salgan de la misma.

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

export function configRag(): ConfigRag {
  return { ...CONFIG_RAG_POR_DEFECTO };
}

/// Texto que se embebe para un trozo de un fragmento.
export function textoDocumento(cfg: ConfigRag, title: string, trozo: string): string {
  return cfg.prefijoDocumento + cfg.plantilla.replaceAll('{title}', title).replaceAll('{trozo}', trozo);
}

/// Texto que se embebe para una consulta.
export function textoConsulta(cfg: ConfigRag, consulta: string): string {
  return cfg.prefijoConsulta + consulta;
}
