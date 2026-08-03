import { prisma } from '../lib/prisma.js';
import { embed, toVectorLiteral } from '../lib/embeddings.js';

/// Mejora de cohesión (2026-07-30, ver SessionFact en schema.prisma): antes `sessionFacts` era
/// una ventana rodante de los últimos 10 hechos (mergeFacts/MAX_FACTS), recortando por pura
/// antigüedad — un hecho de hace 15 turnos que vuelve a importar se perdía para siempre, sin
/// relación con si de verdad seguía siendo relevante. Ahora se almacenan hasta MAX_STORED_FACTS
/// (con su propio embedding, misma infraestructura que el RAG de lore) y `selectRelevantFacts`
/// decide, turno a turno, cuáles de esos se mandan de verdad al Narrador — mezclando los más
/// recientes (continuidad) con los más relevantes para la acción actual (cohesión), sin superar
/// MAX_SENT_FACTS: el prompt no crece frente a antes, solo elige mejor qué mandar.
const MAX_STORED_FACTS = 50;
const MAX_SENT_FACTS = 10;
const RECENCY_GUARANTEED = 3;
// Bajado de 0.7 a 0.65 (auditoría 2026-08-02, "revisar partida" — bug real jugando en vivo): dos
// hechos seguidos del mismo combate, "El Orco Enfurecido ha sido derrotado y ahora está herido,
// ~50/100 de salud" / "El Orco Enfurecido ahora está herido, ~50/100 de salud", tenían 0.69 de
// similitud — justo por debajo del umbral, así que el segundo (una paráfrasis casi idéntica) no se
// descartaba y se colaba duplicado en sessionFacts.
const DUPLICATE_THRESHOLD = 0.65;

function normalize(fact: string): string {
  return fact
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

/// Exportada (2026-07-31, ver `isTooSimilarToLast` en narrador.ts) — mismo criterio de "es
/// básicamente lo mismo" reutilizado para detectar narración repetida casi verbatim de un turno
/// al siguiente, no solo hechos duplicados.
export function similarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(' '));
  const wordsB = new Set(normalize(b).split(' '));
  if (!wordsA.size || !wordsB.size) return 0;
  let shared = 0;
  for (const w of wordsA) if (wordsB.has(w)) shared++;
  return shared / Math.max(wordsA.size, wordsB.size);
}

/// Historial completo (acotado a MAX_STORED_FACTS, orden cronológico) — para quien necesita ver
/// TODO lo establecido recientemente, no solo lo más relevante ahora mismo: el haystack de
/// detección de NPCs en escena (npcScene.ts) y comprobaciones deterministas tipo "¿ya se presentó
/// Gistera Koh?" (turnResolution.ts) necesitan poder encontrar un hecho aunque no sea el más
/// "relevante" semánticamente para la acción de este turno — nunca deben pasar por
/// `selectRelevantFacts`, que es solo para lo que ve el Narrador.
export async function loadSessionFacts(saveId: string): Promise<string[]> {
  const rows = await prisma.sessionFact.findMany({
    where: { saveId },
    orderBy: { createdAt: 'desc' },
    take: MAX_STORED_FACTS,
    select: { text: true },
  });
  return rows.map((r) => r.text).reverse();
}

/// Añade hechos nuevos al historial persistido — descarta los casi idénticos a uno ya existente
/// (mismo criterio de siempre, ver comentario histórico de `mergeFacts` en git) y embebe cada uno
/// para que `selectRelevantFacts` pueda recuperarlo por relevancia más adelante. `existing` se usa
/// solo para el chequeo de duplicados (se muta localmente para que dos hechos nuevos casi
/// idénticos ENTRE SÍ en el mismo turno también se filtren, no solo contra el historial previo) —
/// nunca se reescribe en la base de datos, es un log de solo-inserción.
export async function appendSessionFacts(saveId: string, existing: string[], newFacts: string[]): Promise<void> {
  if (newFacts.length === 0) return;
  const seen = [...existing];
  for (const fact of newFacts) {
    if (seen.some((f) => similarity(f, fact) >= DUPLICATE_THRESHOLD)) continue;
    seen.push(fact);
    const vector = await embed(fact);
    await prisma.$executeRaw`
      INSERT INTO "SessionFact" (id, "saveId", text, embedding, "createdAt")
      VALUES (${crypto.randomUUID()}, ${saveId}, ${fact}, ${toVectorLiteral(vector)}::vector, ${new Date()})
    `;
  }
  await pruneOldFacts(saveId);
}

async function pruneOldFacts(saveId: string): Promise<void> {
  const count = await prisma.sessionFact.count({ where: { saveId } });
  if (count <= MAX_STORED_FACTS) return;
  const stale = await prisma.sessionFact.findMany({
    where: { saveId },
    orderBy: { createdAt: 'asc' },
    take: count - MAX_STORED_FACTS,
    select: { id: true },
  });
  await prisma.sessionFact.deleteMany({ where: { id: { in: stale.map((f) => f.id) } } });
}

/// Selecciona qué hechos de verdad se mandan al Narrador este turno — solo se usa en el punto
/// donde se construye `worldFacts`/`sessionFacts` para `narrateAction` (turnResolution.ts), NUNCA
/// para el haystack de detección de NPCs ni comprobaciones deterministas (ver comentario de
/// `loadSessionFacts`). Si hay MAX_SENT_FACTS o menos en total, no hace falta filtrar nada — ni
/// una consulta ni un embedding de más en la mayoría de partidas cortas/medias, que es
/// precisamente cuando esta mejora no hace falta todavía.
export async function selectRelevantFacts(action: string, saveId: string, sessionFacts: string[]): Promise<string[]> {
  if (sessionFacts.length <= MAX_SENT_FACTS) return sessionFacts;

  // Los `RECENCY_GUARANTEED` más recientes van SIEMPRE primero en la combinación (nunca se
  // recortan) — bug real encontrado probando en vivo (2026-07-30): con `relevant` primero y
  // `recent` al final, un `.slice(0, MAX_SENT_FACTS)` podía descartar la recencia entera si la
  // consulta de relevancia ya llenaba las 10 plazas ella sola.
  const recent = sessionFacts.slice(-RECENCY_GUARANTEED);
  const remainingBudget = MAX_SENT_FACTS - recent.length;
  const vector = await embed(action);
  const rows = await prisma.$queryRaw<{ text: string }[]>`
    SELECT text FROM "SessionFact"
    WHERE "saveId" = ${saveId}
    ORDER BY embedding <=> ${toVectorLiteral(vector)}::vector
    LIMIT ${MAX_SENT_FACTS + RECENCY_GUARANTEED}
  `;
  const relevant = rows.map((r) => r.text).filter((t) => !recent.includes(t)).slice(0, remainingBudget);
  const combined = new Set([...recent, ...relevant]);
  // Orden final: cronológico según `sessionFacts` (no por score de similitud) — para que el
  // Narrador los lea en secuencia natural, no mezclados por relevancia.
  return sessionFacts.filter((f) => combined.has(f));
}
