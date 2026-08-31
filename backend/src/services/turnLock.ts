import { createInFlightClaimSet } from '../lib/inFlightClaimSet.js';

/// Candado de turno en memoria (auditoría de código completa, 2026-08-07) — mismo patrón exacto
/// que `pendingChapterGenerations` (chapterSummary.ts), ahora compartido vía
/// `createInFlightClaimSet` (lib/inFlightClaimSet.ts).
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
/// Steam Deck), así que no hace falta coordinar entre instancias.
///
/// Caducidad automática (2026-08-31, `inFlightClaimSet.ts`): un candado más viejo de 5 minutos
/// (default) se trata como abandonado y `claim()` lo reemplaza — antes solo se autocuraba
/// reiniciando el proceso backend a mano, que es exactamente lo que se estaba reproduciendo
/// sesión tras sesión con turnos que se quedaban colgados sin resolver ni fallar (el candado
/// tomado para siempre por una promesa zombie de `narrateAndPersistTurn`, ver auditoría del mismo
/// día). La tarea zombie de origen sigue corriendo de fondo sin que nada la mate, pero deja de
/// bloquear turnos NUEVOS de la misma partida.
const turnClaims = createInFlightClaimSet<string>();

/// Reclama el turno para `saveId` — `false` si ya hay uno en curso (el caller debe responder 409
/// sin más, nunca seguir adelante).
export function claimTurnInFlight(saveId: string): boolean {
  return turnClaims.claim(saveId);
}

/// Libera el candado — el caller debe llamarla exactamente una vez por cada `claimTurnInFlight`
/// que devolvió `true`, tanto si el turno terminó bien como si falló (sin esto en el camino de
/// error, un turno que revienta a mitad dejaría la partida bloqueada para el resto de la sesión
/// del servidor).
export function releaseTurnInFlight(saveId: string): void {
  turnClaims.release(saveId);
}
