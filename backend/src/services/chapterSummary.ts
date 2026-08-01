import { prisma } from '../lib/prisma.js';
import { ollamaGenerate } from '../lib/ollama.js';
import { env } from '../config/env.js';
import { randomPacingDelayMs } from '../config/pacing.js';

/// Memoria de partida por capítulos (docs/01-analisis-producto.md § "Resumen/Memoria de partida",
/// docs/10-niveles-xp-reino.md § 3.2/§ 7): cada N acciones del jugador, el backend (no el modelo)
/// decide crear un `SessionSummary` nuevo y dispara el hito `capitulo` (500 XP, determinista,
/// nunca propuesto por el Narrador) — así el sistema de memoria por capítulos que ya existía en
/// el schema se convierte gratis en el latido de fondo de la progresión.

const TURNS_PER_CHAPTER = 15;

export function shouldCreateChapter(actionsSinceLastSummary: number): boolean {
  return actionsSinceLastSummary >= TURNS_PER_CHAPTER;
}

// Reclamo en memoria (auditoría 2026-07-24, "revisa todo bien bien" — desacoplar esto del turno
// bloqueante): antes `maybeCreateChapterSummary` se esperaba entera dentro del turno, añadiendo
// hasta 90s reales a UN turno de cada 15 solo para generar un resumen que ni siquiera se le
// muestra al jugador en ese momento. Ahora se dispara en segundo plano sin esperar — pero eso abre
// la puerta a que 2-3 turnos seguidos (mientras la generación de fondo todavía no ha escrito el
// `SessionSummary`) vean `actionsSinceLastSummary >= 15` igual de cierto y disparen cada uno su
// propia generación + su propio hito "capitulo" duplicado. Este Set evita eso: una vez reclamado
// un capítulo para un saveId, no se vuelve a reclamar hasta que la generación de fondo termine
// (con éxito o error) y lo libere.
const pendingChapterGenerations = new Set<string>();

/// Comprobación barata (dos consultas indexadas, nunca llama a Ollama): decide si toca capítulo
/// nuevo y, si es así, reclama el turno para él en el acto — el caller debe programar
/// `scheduleChapterSummaryGeneration` inmediatamente si esto devuelve true.
export async function claimChapterIfDue(saveId: string): Promise<boolean> {
  if (pendingChapterGenerations.has(saveId)) return false;

  const lastSummary = await prisma.sessionSummary.findFirst({ where: { saveId }, orderBy: { chapterNumber: 'desc' } });
  const since = lastSummary?.createdAt ?? new Date(0);
  const actionsSinceLastSummary = await prisma.logEntry.count({
    where: { saveId, channel: 'CHARACTER', isPlayerAction: true, createdAt: { gt: since } },
  });
  if (!shouldCreateChapter(actionsSinceLastSummary)) return false;

  pendingChapterGenerations.add(saveId);
  return true;
}

/// Libera un reclamo hecho por `claimChapterIfDue` SIN llegar a programar la generación (auditoría
/// 2026-07-30: si la transacción del turno que reclamó el capítulo acaba fallando/haciendo
/// rollback, `scheduleChapterSummaryGeneration` nunca se llega a disparar — sin esto, el reclamo
/// en memoria se quedaría atascado para siempre, bloqueando el capítulo de esta partida hasta
/// reiniciar el proceso). El caller debe llamarla en el `catch` de esa transacción, nunca además
/// de programar la generación de verdad.
export function releaseChapterClaim(saveId: string): void {
  pendingChapterGenerations.delete(saveId);
}

/// Genera y persiste el resumen de verdad (llamada lenta al Cronista) — SIN await desde el turno
/// que lo dispara (`void scheduleChapterSummaryGeneration(...)`), para que el jugador no espere
/// ni un segundo de más por esto. Nunca lanza fuera de sí misma: cualquier fallo solo se registra
/// y libera el reclamo, listo para reintentarse el turno siguiente (mismo criterio de resiliencia
/// que ya tenía el try/catch original en turnResolution.ts).
export async function scheduleChapterSummaryGeneration(saveId: string, characterName: string): Promise<void> {
  try {
    await generateAndPersistChapterSummary(saveId, characterName);
  } catch (err) {
    console.warn(`[capitulo] generación de resumen en segundo plano falló (saveId=${saveId}):`, err);
  } finally {
    pendingChapterGenerations.delete(saveId);
  }
}

async function generateAndPersistChapterSummary(saveId: string, characterName: string): Promise<void> {
  const lastSummary = await prisma.sessionSummary.findFirst({ where: { saveId }, orderBy: { chapterNumber: 'desc' } });
  const since = lastSummary?.createdAt ?? new Date(0);

  const entries = await prisma.logEntry.findMany({
    where: { saveId, channel: 'CHARACTER', createdAt: { gt: since } },
    orderBy: { createdAt: 'asc' },
  });
  const logText = entries.map((e) => e.text).join('\n');

  // Roadmap 2026-07-19 (crónica por capítulos): antes cada capítulo se resumía en aislado, sin
  // saber qué contaba el anterior — una serie de viñetas sueltas, no una crónica que se hila.
  // Pasarle el resumen previo como continuidad (sin repetirlo, solo para que enlace) es la
  // diferencia entre "resumen de fragmento" y "capítulo siguiente de una misma historia".
  const continuidad = lastSummary
    ? `\n\nCapítulo anterior (para que este conecte con él, no lo repitas): "${lastSummary.summary}"`
    : '';

  // Ritmo de generación en sesión activa (decisión técnica 5, docs/04-decisiones-tecnicas.md § 5):
  // esta llamada al Cronista es justo la "entrada secundaria de un turno" que ese documento
  // describe — nunca la respuesta directa del Narrador — así que se espacia con el retardo
  // aleatorio configurable en vez de disparar el mismo instante que termina de narrar. Auditoría
  // 2026-07-22: `pacing.ts` existía desde esa decisión pero nada lo llamaba todavía.
  await new Promise((resolve) => setTimeout(resolve, randomPacingDelayMs()));

  const { text } = await ollamaGenerate({
    model: env.ollamaModelCronista,
    system:
      'Eres el cronista de un juego de rol. Tu única tarea es condensar un registro de juego en un resumen breve de capítulo, en tercera persona, sin inventar nada que no esté en el registro.',
    prompt: `Registro de ${characterName} en este capítulo:\n${logText}${continuidad}\n\nResume en 2-3 frases lo más importante que ha ocurrido — suficiente para que alguien que vuelve a la partida tras días sin jugar recuerde dónde estaba. Si conecta con el capítulo anterior, que se note (p. ej. "tras aquello..."), sin repetirlo.`,
    timeoutMs: 90_000,
  });

  const chapterNumber = (lastSummary?.chapterNumber ?? 0) + 1;
  await prisma.sessionSummary.create({ data: { saveId, chapterNumber, summary: text.trim() } });
}
