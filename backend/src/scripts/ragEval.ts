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
  });
  const vistos = new Set<string>();
  for (const c of casos as { id?: unknown }[]) {
    if (typeof c?.id !== 'string') continue;
    if (vistos.has(c.id)) errores.push(`${c.id}: id repetido`);
    vistos.add(c.id);
  }
  return errores;
}
