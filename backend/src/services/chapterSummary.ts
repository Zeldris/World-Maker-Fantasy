import { prisma } from '../lib/prisma.js';
import { ollamaGenerate } from '../lib/ollama.js';
import { env } from '../config/env.js';
import { randomPacingDelayMs } from '../config/pacing.js';
import { createInFlightClaimSet } from '../lib/inFlightClaimSet.js';

/// Memoria de partida por capítulos (docs/producto/01-analisis-producto.md § "Resumen/Memoria de partida",
/// docs/mecanicas/10-niveles-xp-reino.md § 3.2/§ 7): cada N acciones del jugador, el backend (no el modelo)
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
// propia generación + su propio hito "capitulo" duplicado. Este candado evita eso: una vez
// reclamado un capítulo para un saveId, no se vuelve a reclamar hasta que la generación de fondo
// termine (con éxito o error) y lo libere. Compartido vía `createInFlightClaimSet`
// (lib/inFlightClaimSet.ts) — mismo patrón exacto que `turnLock.ts`.
const chapterClaims = createInFlightClaimSet<string>();

/// Comprobación barata (dos consultas indexadas, nunca llama a Ollama): decide si toca capítulo
/// nuevo y, si es así, reclama el turno para él en el acto — el caller debe programar
/// `scheduleChapterSummaryGeneration` inmediatamente si esto devuelve true.
export async function claimChapterIfDue(saveId: string): Promise<boolean> {
  // Bug real (auditoría 2026-08-06): el reclamo se hacía DESPUÉS de dos `await` (mismo hueco de
  // carrera "comprobar-esperar-actuar" ya cerrado varias veces en este proyecto para
  // construcción/saqueo/despiece) — dos turnos casi simultáneos para la misma partida (doble
  // envío, o un turno en vivo solapando la resolución diferida de worldTick.ts) pasaban los dos
  // el `has()` de arriba antes de que ninguno reclamara, y los dos acababan disparando su propio
  // hito "capitulo" (500 XP cada uno) y su propio `SessionSummary` con el mismo `chapterNumber`
  // (sin `@@unique` que lo impida en el schema). Reclamar YA, antes de cualquier `await`, cierra
  // el hueco: `claim` es síncrono, así que el segundo turno ve el reclamo del primero sin ceder
  // el control de por medio.
  if (!chapterClaims.claim(saveId)) return false;

  const lastSummary = await prisma.sessionSummary.findFirst({ where: { saveId }, orderBy: { chapterNumber: 'desc' } });
  const since = lastSummary?.createdAt ?? new Date(0);
  const actionsSinceLastSummary = await prisma.logEntry.count({
    // B12 (pruebas 2026-09-28): cada botón de combate contaba como acción y una sola pelea casi
    // completaba un capítulo (500 XP, 5× una misión). Las acciones de combate no cuentan.
    where: { saveId, channel: 'CHARACTER', isPlayerAction: true, combate: false, createdAt: { gt: since } },
  });
  if (!shouldCreateChapter(actionsSinceLastSummary)) {
    // Todavía no toca capítulo — libera el reclamo, el caller nunca va a llamar a
    // scheduleChapterSummaryGeneration/releaseChapterClaim para este `false`.
    chapterClaims.release(saveId);
    return false;
  }

  return true;
}

/// Libera un reclamo hecho por `claimChapterIfDue` SIN llegar a programar la generación (auditoría
/// 2026-07-30: si la transacción del turno que reclamó el capítulo acaba fallando/haciendo
/// rollback, `scheduleChapterSummaryGeneration` nunca se llega a disparar — sin esto, el reclamo
/// en memoria se quedaría atascado para siempre, bloqueando el capítulo de esta partida hasta
/// reiniciar el proceso). El caller debe llamarla en el `catch` de esa transacción, nunca además
/// de programar la generación de verdad.
export function releaseChapterClaim(saveId: string): void {
  chapterClaims.release(saveId);
}

/// Genera y persiste el resumen de verdad (llamada lenta al Cronista) — SIN await desde el turno
/// que lo dispara (`void scheduleChapterSummaryGeneration(...)`), para que el jugador no espere
/// ni un segundo de más por esto. Nunca lanza fuera de sí misma: cualquier fallo solo se registra
/// y libera el reclamo, listo para reintentarse el turno siguiente (mismo criterio de resiliencia
/// que ya tenía el try/catch original en turnResolution.ts).
export async function scheduleChapterSummaryGeneration(saveId: string, characterName: string, fictionalMinutes: number): Promise<void> {
  try {
    await generateAndPersistChapterSummary(saveId, characterName, fictionalMinutes);
  } catch (err) {
    console.warn(`[capitulo] generación de resumen en segundo plano falló (saveId=${saveId}):`, err);
  } finally {
    chapterClaims.release(saveId);
  }
}

async function generateAndPersistChapterSummary(saveId: string, characterName: string, fictionalMinutes: number): Promise<void> {
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

  // Ritmo de generación en sesión activa (decisión técnica 5, docs/arquitectura/04-decisiones-tecnicas.md § 5):
  // esta llamada al Cronista es justo la "entrada secundaria de un turno" que ese documento
  // describe — nunca la respuesta directa del Narrador — así que se espacia con el retardo
  // aleatorio configurable en vez de disparar el mismo instante que termina de narrar. Auditoría
  // 2026-07-22: `pacing.ts` existía desde esa decisión pero nada lo llamaba todavía.
  await new Promise((resolve) => setTimeout(resolve, randomPacingDelayMs()));

  // Bug real jugando en vivo (2026-08-07, auditoría "revisa la partida"): el Capítulo 1 real de
  // Gorhorn salió con `ollamaModelCronista` (1.5B) diciendo que "ataca a Gistera Koh... y logra
  // detenerla antes de que pueda matarle" — invención completa: Gistera es su aliada, nunca lo
  // atacó, ver el registro real en el propio `logText`. Condensar ~15-30 turnos de prosa en 2-3
  // frases sin confundir quién es aliado y quién enemigo es una tarea bastante más exigente que
  // la clasificación estructurada corta para la que sí basta el modelo pequeño (ver comentario en
  // narrador.ts sobre `ollamaModelCronista`) — y a diferencia de esos otros usos, esta llamada ya
  // corre en segundo plano sin que el jugador espere un solo segundo por ella (ver el retardo de
  // ritmo justo arriba), así que no hay ningún coste real en usar el modelo grande del Narrador
  // aquí, solo beneficio en fidelidad.
  const { text } = await ollamaGenerate({
    model: env.ollamaModelNarrador,
    system:
      'Eres el cronista de un juego de rol. Tu única tarea es condensar un registro de juego en un resumen breve de capítulo, en tercera persona, sin inventar nada que no esté en el registro — en particular, nunca confundas quién es aliado y quién es enemigo, ni inventes ningún enfrentamiento que no aparezca explícitamente en el registro.',
    prompt: `Registro de ${characterName} en este capítulo:\n${logText}${continuidad}\n\nResume en 2-3 frases lo más importante que ha ocurrido — suficiente para que alguien que vuelve a la partida tras días sin jugar recuerde dónde estaba. Si conecta con el capítulo anterior, que se note (p. ej. "tras aquello..."), sin repetirlo.`,
    timeoutMs: 90_000,
  });

  const chapterNumber = (lastSummary?.chapterNumber ?? 0) + 1;
  await prisma.sessionSummary.create({ data: { saveId, chapterNumber, summary: text.trim(), fictionalMinutes } });
}
