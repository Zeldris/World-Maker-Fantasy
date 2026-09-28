/// Similitud de embeddings en JS para SQLite (2026-09-28, instalador de escritorio — ver
/// docs/02-migracion-postgres-a-sqlite.md del repo Instalador-WMF-Tarkor). En Postgres esto lo
/// hace pgvector (`embedding <=> query`); SQLite no tiene esa extensión, así que el embedding se
/// guarda como texto JSON y la distancia se calcula aquí. Escala: decenas de fragmentos de lore por
/// mundo y como mucho `MAX_STORED_FACTS` hechos por partida (worldFacts.ts) — recorrerlos todos
/// cuesta menos de un milisegundo, no hace falta índice.

/// Distancia coseno con la misma escala que el operador `<=>` de pgvector (0 = idéntico,
/// ~1 = sin relación, 2 = opuesto), para que `RELEVANCE_THRESHOLD` de retrieval.ts valga igual.
export function distanciaCoseno(a: number[], b: number[]): number {
  let punto = 0;
  let normaA = 0;
  let normaB = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    punto += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }
  if (normaA === 0 || normaB === 0) return 1;
  return 1 - punto / (Math.sqrt(normaA) * Math.sqrt(normaB));
}

/// Lee un embedding guardado como JSON; `null` si falta o está mal formado (esa fila queda la
/// última, igual que un `NULL` en el `ORDER BY` de pgvector).
export function leerEmbedding(guardado: unknown): number[] | null {
  if (typeof guardado !== 'string') return null;
  try {
    const v: unknown = JSON.parse(guardado);
    return Array.isArray(v) ? (v as number[]) : null;
  } catch {
    return null;
  }
}

/// Las `n` filas más cercanas a `consulta`, ordenadas de más a menos parecida, con su distancia.
export function masCercanas<T extends { embedding: unknown }>(
  filas: T[],
  consulta: number[],
  n: number,
): (Omit<T, 'embedding'> & { distance: number })[] {
  return filas
    .map(({ embedding, ...resto }) => {
      const v = leerEmbedding(embedding);
      return { ...resto, distance: v ? distanciaCoseno(v, consulta) : Number.POSITIVE_INFINITY };
    })
    .sort((x, y) => x.distance - y.distance)
    .slice(0, n);
}

/// Lista guardada en una columna `Json` de SQLite leída con `$queryRaw` (llega como texto).
export function leerListaJson(guardado: unknown): string[] {
  if (Array.isArray(guardado)) return guardado as string[];
  if (typeof guardado !== 'string') return [];
  try {
    const v: unknown = JSON.parse(guardado);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}
