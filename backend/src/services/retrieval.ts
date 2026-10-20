import { prisma } from '../lib/prisma.js';
import { embed, toVectorLiteral } from '../lib/embeddings.js';
import { registrarLlamada } from '../lib/iaRegistro.js';

export interface RetrievedLore {
  title: string;
  text: string;
  /// Distancia coseno de pgvector (0 = idéntico, ~1 = sin relación, hasta 2 = opuesto).
  distance: number;
}

/// Bug real (2026-08-31, auditoría de cuelgues de turno): `prisma.$queryRaw` no tiene ningún
/// timeout propio — un problema de red hacia Postgres/Supabase (típico en Steam Deck con wifi
/// inestable) deja este `await` colgado indefinidamente, sin que ningún AbortController lo corte
/// (Prisma no soporta cancelación nativa de queries raw). Como `retrieveLore` corre dentro de
/// `narrateAndPersistTurn`, una consulta colgada aquí arrastra consigo el candado de `turnLock.ts`
/// entero — mismo síntoma que un cuelgue de Ollama, pero sin pasar por `ollamaQueue.ts` en
/// absoluto. Mismo patrón de `Promise.race` que la cola de Ollama: 15s de margen (una consulta
/// vectorial normal tarda milisegundos en este hardware) — si expira, se trata como "sin lore
/// relevante" en vez de colgar el turno entero.
function withQueryTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${label}: la consulta a Postgres no respondió en ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

/// Por debajo de esto consideramos que el fragmento de verdad responde a la consulta. Por
/// encima, es "lo más parecido que había" pero no necesariamente relevante — no calibrado con
/// datos, ajustar si en la práctica deja pasar cosas irrelevantes o descarta cosas útiles.
const RELEVANCE_THRESHOLD = 0.75;

/// RAG del lore de Helek Sirik: embebe la consulta (acción del jugador + resumen del personaje)
/// y recupera los fragmentos semánticamente más cercanos de LoreChunk vía pgvector. El tamaño de
/// lo que se manda a Ollama depende de `topK`, no del tamaño total del lore indexado — así el
/// mundo puede crecer sin que los turnos se vuelvan más lentos.
/// QA-167: cada fragmento tiene varias filas (una por trozo, con el texto entero; ver loreTrozos.ts), así que se
/// queda con la más cercana de cada título antes de cortar en `topK`.
/// Bajado de 6 a 4 (2026-07-17): con 6 fragmentos, narrar pasaba de ~30-140s a 170-220s+ (y dos
/// veces se colgó del todo) — el prefill de un prompt ~3x más largo cuesta caro en esta CPU.
export async function retrieveLore(
  query: string,
  worldId: string,
  topK = 4,
  excludeTags: string[] = [],
): Promise<RetrievedLore[]> {
  const inicio = Date.now();
  let embedMs: number | undefined;
  let inicioBusqueda: number | undefined;
  try {
    const vector = embed(query);
    const queryLiteral = toVectorLiteral(await vector);
    embedMs = Date.now() - inicio;
    inicioBusqueda = Date.now();

    const rows = await withQueryTimeout(
      prisma.$queryRaw<{ title: string; text: string; distance: number }[]>`
        SELECT title, text, distance FROM (
          SELECT DISTINCT ON (title) title, text, embedding <=> ${queryLiteral}::vector AS distance
          FROM "LoreChunk"
          WHERE "worldId" = ${worldId}
            AND NOT (tags && ${excludeTags}::text[])
          ORDER BY title, embedding <=> ${queryLiteral}::vector
        ) mejores
        ORDER BY distance
        LIMIT ${topK}
      `,
      15_000,
      'retrieveLore',
    );

    // Registro opt-ai. El «id» de un trozo es su título (único en loreChunks.ts): el id real de
    // LoreChunk es un UUID nuevo en cada `reindex-lore`, así que no sirve para comparar casos.
    registrarLlamada({
      operation: 'retrieval',
      task: 'rag',
      ragQuery: query,
      ragK: topK,
      ragResults: rows.map((r) => ({ id: r.title, score: Math.round((1 - r.distance) * 10000) / 10000 })),
      ragEmbedMs: embedMs,
      ragSearchMs: Date.now() - inicioBusqueda,
      durationMs: Date.now() - inicio,
    });

    return rows;
  } catch (err) {
    registrarLlamada({
      operation: 'retrieval',
      task: 'rag',
      ragQuery: query,
      ragK: topK,
      ragEmbedMs: embedMs,
      ragSearchMs: inicioBusqueda === undefined ? undefined : Date.now() - inicioBusqueda,
      durationMs: Date.now() - inicio,
      finishReason: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/// True si ninguno de los fragmentos recuperados es realmente relevante — la acción pregunta
/// por algo que nuestro lore no cubre (p. ej. "busca un lugar seguro para acampar": no tenemos
/// ningún hecho sobre qué hace seguro un sitio concreto). Señal para relajar la regla de "no
/// inventes" en ese turno — hipótesis de la usuaria, 2026-07-18: pedirle al modelo algo concreto
/// y a la vez prohibirle inventar sin darle material real puede ser lo que provocaba el cuelgue
/// reproducible visto en pruebas con esa acción exacta.
export function isWeaklyGrounded(chunks: RetrievedLore[]): boolean {
  return chunks.length === 0 || chunks[0].distance > RELEVANCE_THRESHOLD;
}

/// Tope de caracteres total, independiente de topK — red de seguridad para que el prompt nunca
/// crezca sin control aunque algún fragmento salga muy largo (p. ej. las biografías de personajes).
const MAX_LORE_CHARS = 1400;

export function formatLoreForPrompt(chunks: RetrievedLore[]): string[] {
  const result: string[] = [];
  let total = 0;
  for (const chunk of chunks) {
    const line = `${chunk.title}: ${chunk.text}`;
    if (total + line.length > MAX_LORE_CHARS && result.length > 0) break;
    result.push(line);
    total += line.length;
  }
  return result;
}
