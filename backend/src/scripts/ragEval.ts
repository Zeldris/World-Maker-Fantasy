/// Lógica pura de `rag-eval.ts` (sin BD ni Ollama, para poder probarla).

export interface CasoRag {
  id: string;
  pregunta: string;
  /// Títulos de trozo (`title` de loreChunks.ts) que responden la pregunta.
  esperados: string[];
  /// Región de la ubicación del jugador (como `Location.region`). Opcional: añade ` — <región>` a la
  /// consulta y excluye el lore del continente contrario, como hace el juego.
  region?: string;
  origen?: string;
  causa?: string | null;
  /// Si es true y el caso no sale en el top-k, `rag-eval` sale con código 1.
  debe_pasar?: boolean;
}

export interface ResultadoCaso {
  caso: CasoRag;
  /// Puesto (1 = primero) del primer trozo esperado, o null si no sale.
  puesto: number | null;
  devueltos: string[];
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
