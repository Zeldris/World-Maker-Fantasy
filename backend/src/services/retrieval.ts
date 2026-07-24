import { prisma } from '../lib/prisma.js';
import { embed, toVectorLiteral } from '../lib/embeddings.js';

export interface RetrievedLore {
  title: string;
  text: string;
  /// Distancia coseno de pgvector (0 = idéntico, ~1 = sin relación, hasta 2 = opuesto).
  distance: number;
}

/// Por debajo de esto consideramos que el fragmento de verdad responde a la consulta. Por
/// encima, es "lo más parecido que había" pero no necesariamente relevante — no calibrado con
/// datos, ajustar si en la práctica deja pasar cosas irrelevantes o descarta cosas útiles.
const RELEVANCE_THRESHOLD = 0.75;

/// RAG del lore de Helek Sirik: embebe la consulta (acción del jugador + resumen del personaje)
/// y recupera los fragmentos semánticamente más cercanos de LoreChunk vía pgvector. El tamaño de
/// lo que se manda a Ollama depende de `topK`, no del tamaño total del lore indexado — así el
/// mundo puede crecer sin que los turnos se vuelvan más lentos.
/// Bajado de 6 a 4 (2026-07-17): con 6 fragmentos, narrar pasaba de ~30-140s a 170-220s+ (y dos
/// veces se colgó del todo) — el prefill de un prompt ~3x más largo cuesta caro en esta CPU.
export async function retrieveLore(
  query: string,
  worldId: string,
  topK = 4,
  excludeTags: string[] = [],
): Promise<RetrievedLore[]> {
  const vector = embed(query);
  const queryLiteral = toVectorLiteral(await vector);

  const rows = await prisma.$queryRaw<{ title: string; text: string; distance: number }[]>`
    SELECT title, text, embedding <=> ${queryLiteral}::vector AS distance
    FROM "LoreChunk"
    WHERE "worldId" = ${worldId}
      AND NOT (tags && ${excludeTags}::text[])
    ORDER BY embedding <=> ${queryLiteral}::vector
    LIMIT ${topK}
  `;

  return rows;
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
