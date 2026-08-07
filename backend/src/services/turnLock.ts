/// Candado de turno en memoria (auditoría de código completa, 2026-08-07) — mismo patrón exacto
/// que `pendingChapterGenerations` (chapterSummary.ts): un `Set` síncrono, reclamado ANTES de
/// cualquier `await`, para cerrar el hueco de "comprobar-esperar-actuar" sin necesitar ninguna
/// columna nueva ni locking de base de datos.
///
/// Bug real que cierra (hallazgo de auditoría, no reproducido en vivo todavía): `/turn/narrate`
/// lee el `Save` fresco al empezar, pero entre eso y el commit final de la transacción pasan
/// 30-220s de narración por LLM — dos turnos casi simultáneos para la MISMA partida (doble clic
/// antes de que el composer se bloquee, reintento de red, dos pestañas) calculan cada uno su
/// propio estado nuevo (xp, condición física, ubicación...) a partir de la misma foto de partida,
/// y el que hace commit último pisa entero el resultado del otro — pudiendo perder una subida de
/// nivel, revertir una muerte ya persistida, o "resucitar" mecánicamente a un NPC que el otro
/// turno ya mató. Justo el turno de más riesgo (combate) es el que menos protegido estaba: se
/// fuerza a banda "instantánea" y por diseño nunca crea un `CharacterTransit`/`busyUntil` (ese
/// campo significa "ocupado X minutos de tiempo de FICCIÓN", una cosa totalmente distinta de este
/// candado — mezclar los dos conceptos en el mismo campo confundiría ambos).
///
/// En memoria a propósito, no en la base de datos: este backend corre como un único proceso (la
/// Steam Deck), así que no hace falta coordinar entre instancias — y un candado en memoria se
/// autocura solo si el proceso se reinicia a mitad de una narración (un candado persistido en DB
/// necesitaría una caducidad a mano para no dejar una partida atascada para siempre tras un
/// cuelgue).
const saveIdsWithTurnInFlight = new Set<string>();

/// Reclama el turno para `saveId` — `false` si ya hay uno en curso (el caller debe responder 409
/// sin más, nunca seguir adelante). Síncrono y sin ningún `await` de por medio a propósito, para
/// que dos peticiones casi simultáneas no puedan pasar ambas el `has()` antes de que ninguna
/// reclame (mismo criterio que `claimChapterIfDue`).
export function claimTurnInFlight(saveId: string): boolean {
  if (saveIdsWithTurnInFlight.has(saveId)) return false;
  saveIdsWithTurnInFlight.add(saveId);
  return true;
}

/// Libera el candado — el caller debe llamarla exactamente una vez por cada `claimTurnInFlight`
/// que devolvió `true`, tanto si el turno terminó bien como si falló (mismo criterio que
/// `releaseChapterClaim`: sin esto en el camino de error, un turno que revienta a mitad dejaría la
/// partida bloqueada para el resto de la sesión del servidor).
export function releaseTurnInFlight(saveId: string): void {
  saveIdsWithTurnInFlight.delete(saveId);
}
