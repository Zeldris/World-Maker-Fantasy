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
/// queda con la más cercana de cada título antes de cortar en `topK`. `LoreChunk` no tiene índice vectorial (255 filas
/// en Tarkor, búsqueda de ~8 ms): si se le pone uno, el `DISTINCT ON` impide usarlo y habría que deduplicar fuera.
/// Bajado de 6 a 4 (2026-07-17): con 6 fragmentos, narrar pasaba de ~30-140s a 170-220s+ (y dos
/// veces se colgó del todo) — el prefill de un prompt ~3x más largo cuesta caro en esta CPU.
export async function retrieveLore(
  query: string,
  worldId: string,
  topK = 4,
  excludeTags: string[] = [],
  /// QA-289: textos donde buscar entidades con nombre (la acción y los NPC en escena, sin la región,
  /// que nombraría su propia región en cada turno). Vacío: solo búsqueda semántica.
  entidades: string[] = [],
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

    // QA-289 (P251, P272): los embeddings fallan con nombres propios; el trozo de una entidad que
    // nombran la acción o la escena entra seguro (como las claves de World Info), y el resto por similitud.
    const titulos = !entidades.length ? [] : (
      await withQueryTimeout(
        prisma.$queryRaw<{ title: string }[]>`
          SELECT DISTINCT title FROM "LoreChunk" WHERE "worldId" = ${worldId} AND NOT (tags && ${excludeTags}::text[])
        `,
        15_000,
        'retrieveLore',
      )
    ).map((r) => r.title);
    const directos = titulosPorEntidad(titulos, entidades).slice(0, MAX_DIRECTOS);
    const filasDirectas = directos.length
      ? await withQueryTimeout(
          prisma.$queryRaw<{ title: string; text: string; distance: number }[]>`
            SELECT DISTINCT ON (title) title, text, embedding <=> ${queryLiteral}::vector AS distance
            FROM "LoreChunk"
            WHERE "worldId" = ${worldId} AND title = ANY(${directos}::text[])
            ORDER BY title, embedding <=> ${queryLiteral}::vector
          `,
          15_000,
          'retrieveLore',
        )
      : [];
    // Los directos, primero: `formatLoreForPrompt` corta por el final al pasar de MAX_LORE_CHARS.
    const elegidos = [...filasDirectas, ...rows.filter((r) => !directos.includes(r.title))].slice(0, topK);

    // Registro opt-ai. El «id» de un trozo es su título (único en loreChunks.ts): el id real de
    // LoreChunk es un UUID nuevo en cada `reindex-lore`, así que no sirve para comparar casos.
    registrarLlamada({
      operation: 'retrieval',
      task: 'rag',
      ragQuery: query,
      ragK: topK,
      ragResults: elegidos.map((r) => ({ id: r.title, score: Math.round((1 - r.distance) * 10000) / 10000 })),
      ragEmbedMs: embedMs,
      ragSearchMs: Date.now() - inicioBusqueda,
      durationMs: Date.now() - inicio,
    });

    return elegidos;
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

/// Tope de trozos que entran por nombre: el resto del `topK` sigue siendo semántico.
const MAX_DIRECTOS = 2;

const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9ñ' ]/g, ' ').replace(/\s+/g, ' ').trim();

/// Nombre propio de un título de lore: lo que va antes de « (», « —», «, » o « y ».
const cabeza = (titulo: string) => titulo.split(/ \(| —|, | y /)[0].trim();

/// Nombres propios de dos o más palabras de un texto («Clan Serhu», «Ulkha Ketg»).
const nombresPropios = (texto: string) =>
  [...texto.matchAll(/\p{Lu}[\p{L}']+(?:\s+(?:de|del|la|las|los)?\s*\p{Lu}[\p{L}']+)+/gu)].map((m) => normalizar(m[0]));

/// QA-289: títulos cuya entidad nombra el texto. Primero los que el texto nombra enteros (cabeza de dos o
/// más palabras: «Gorhorn» solo saldría en casi cada turno); detrás, los que son ese nombre con un título
/// delante («Terk'ikar Ulkha Ketg» con «Ulkha Ketg»), nunca un sitio que solo lo lleva («Campamento del Clan Serhu»).
export function titulosPorEntidad(titulos: string[], textos: string[]): string[] {
  const textosN = textos.map(normalizar);
  const nombres = textos.flatMap(nombresPropios);
  const contiene = (t: string, n: string) => ` ${t} `.includes(` ${n} `);
  const rango = (titulo: string) => {
    const c = normalizar(cabeza(titulo));
    const palabras = c.split(' ').length;
    if (palabras < 2) return -1;
    if (textosN.some((t) => contiene(t, c))) return 0;
    return nombres.some((n) => contiene(c, n) && palabras - n.split(' ').length <= 1) ? 1 : -1;
  };
  return titulos
    .map((t) => ({ t, r: rango(t) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r)
    .map((x) => x.t);
}

/// True si ninguno de los fragmentos recuperados es realmente relevante — la acción pregunta
/// por algo que nuestro lore no cubre (p. ej. "busca un lugar seguro para acampar": no tenemos
/// ningún hecho sobre qué hace seguro un sitio concreto). Señal para relajar la regla de "no
/// inventes" en ese turno — hipótesis de la usuaria, 2026-07-18: pedirle al modelo algo concreto
/// y a la vez prohibirle inventar sin darle material real puede ser lo que provocaba el cuelgue
/// reproducible visto en pruebas con esa acción exacta.
/// Mira el más cercano de todos (QA-289: los que entran por nombre van primero sin ser los más cercanos).
export function isWeaklyGrounded(chunks: RetrievedLore[]): boolean {
  return chunks.length === 0 || Math.min(...chunks.map((c) => c.distance)) > RELEVANCE_THRESHOLD;
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
