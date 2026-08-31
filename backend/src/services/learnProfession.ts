import { factionRepFor } from './reputation.js';

/// "Aprender oficio de un Maestro" (2026-08-31, "Trabajador de Reino") — cierra el hueco real
/// confirmado en `crafting.ts`/`docs/ampliar-lore-checklist.md`: hoy los oficios solo se siembran
/// al crear personaje, sin ningún mecanismo de aprenderlos en partida. Determinista, sin pasar por
/// Ollama — mismo espíritu que `quests/aceptar` (la narración solo describe lo que este servicio
/// ya decidió).
///
/// Umbral de reputación (petición explícita: "aprender una profesión cuesta 10 goirnos o un
/// trueque igual o superior... con reputación suficiente") — 3500 sobre la escala 0-5000 de
/// `reputation.ts` (2500 = neutro/CAUTELOSO), coherente con exigir de verdad haberse ganado la
/// confianza del Maestro, no solo no ser hostil.
export const REPUTACION_MINIMA_APRENDER_OFICIO = 3500;

/// Coste fijo (petición explícita, 2026-08-31) — igual para cualquier oficio por ahora, sin
/// escalar por tier/rareza del Maestro. Ajustable en vivo si hace falta, mismo criterio que el
/// resto de cifras "a afinar" del proyecto.
export const COSTE_GOIRNOS_APRENDER_OFICIO = 10;

export type MotivoRechazoAprenderOficio =
  | 'reputacion_insuficiente'
  | 'ya_aprendido'
  | 'pago_insuficiente';

export interface AprenderOficioCheck {
  permitido: boolean;
  motivo?: MotivoRechazoAprenderOficio;
}

/// Precondiciones puras — el caller (endpoint) resuelve `factionsStatus`/`ProfessionProgress`/
/// `Save.goirnos` reales contra Postgres y le pasa solo lo necesario aquí, sin acoplar esta función
/// a Prisma (mismo criterio que `healCeilingFor`/`rollOpposed`).
///
/// `yaAprendido` = ya existe una fila `ProfessionProgress` para este `professionId` en esta partida
/// (aprenderlo dos veces no tiene sentido — el jugador ya sabe el oficio, sube de nivel crafteando
/// como siempre). `goirnosDisponibles` cubre tanto pago en Goirnos reales como un trueque ya
/// convertido a su valor equivalente (`economia.ts`) por el caller antes de llamar aquí — esta
/// función no distingue el origen del pago, solo compara el valor.
export function checkAprenderOficio(
  factionsStatus: Record<string, number>,
  faction: string,
  yaAprendido: boolean,
  goirnosDisponibles: number,
): AprenderOficioCheck {
  if (yaAprendido) return { permitido: false, motivo: 'ya_aprendido' };
  const reputacion = factionRepFor(factionsStatus, faction);
  if (reputacion < REPUTACION_MINIMA_APRENDER_OFICIO) {
    return { permitido: false, motivo: 'reputacion_insuficiente' };
  }
  if (goirnosDisponibles < COSTE_GOIRNOS_APRENDER_OFICIO) {
    return { permitido: false, motivo: 'pago_insuficiente' };
  }
  return { permitido: true };
}

/// Clamp defensivo tras cobrar el coste — nunca debería hacer falta en la práctica (el guard de
/// arriba ya impide gastar de más), pero protege contra llamadas fuera de orden. A diferencia de
/// la reputación (0-5000, `reputation.ts`), los Goirnos no tienen tope superior real — solo se
/// protege contra bajar de 0.
export function nextGoirnosTrasCobro(goirnosActuales: number, coste: number): number {
  return Math.max(0, goirnosActuales - coste);
}
