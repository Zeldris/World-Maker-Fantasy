import type { BusyError, EndedGameError, TurnLockedError } from './api'
import type { InventoryItemInfo } from '../types'

/// Bug real (auditoría de código completa, 2026-08-07): crafteo/construcción SÍ borran/reducen
/// filas reales de InventoryItem al consumir materiales, pero el backend solo devolvía lo AÑADIDO
/// (`newInventoryItems`) — el estado local del inventario nunca se enteraba de lo consumido,
/// mostrando materiales ya gastados (fantasma) hasta recargar la partida entera. Aplica los tres
/// deltas de una vez, en el orden correcto: primero quita lo borrado y renombra lo reducido,
/// luego añade lo nuevo (un mismo turno puede crear Y consumir a la vez, p. ej. craftear).
export function applyInventoryDelta(
  prev: InventoryItemInfo[],
  added: InventoryItemInfo[],
  removedIds: string[],
  updated: { id: string; name: string }[],
): InventoryItemInfo[] {
  const updatedById = new Map(updated.map((u) => [u.id, u.name]))
  const reconciled = prev
    .filter((item) => !removedIds.includes(item.id))
    .map((item) => (updatedById.has(item.id) ? { ...item, name: updatedById.get(item.id)! } : item))
  return [...reconciled, ...added]
}

export function isBusyError(err: unknown): err is BusyError {
  return typeof err === 'object' && err !== null && (err as { status?: number }).status === 409 && !('ended' in err)
}

export function isEndedGameError(err: unknown): err is EndedGameError {
  return typeof err === 'object' && err !== null && (err as { ended?: boolean }).ended === true
}

export function isTurnLockedError(err: unknown): err is TurnLockedError {
  return typeof err === 'object' && err !== null && (err as { locked?: boolean }).locked === true
}

/// Cuenta atrás de una acción larga en curso (roadmap 2026-07-20, hallazgo real jugando: sin
/// esto, "vuelve en un rato" no decía nada — ni cuánto quedaba ni cuándo mirar). `busyUntil` ya
/// llega como ISO string; se compara contra un reloj que se actualiza cada segundo (barato, es
/// solo aritmética de fechas, el sondeo real que sí llama al backend sigue siendo el de 30s ya
/// existente). Nunca negativo: si el tick de fondo tarda en confirmar la resolución, se queda en
/// "resolviendo..." en vez de enseñar un contador en números rojos.
export function formatCountdown(busyUntilIso: string, nowMs: number): string {
  const remainingMs = new Date(busyUntilIso).getTime() - nowMs
  if (remainingMs <= 0) return 'resolviendo...'
  const totalMinutes = Math.ceil(remainingMs / 60_000)
  if (totalMinutes < 60) return `~${totalMinutes} min`
  const horas = Math.floor(totalMinutes / 60)
  const minutos = totalMinutes % 60
  return minutos === 0 ? `~${horas}h` : `~${horas}h ${minutos}min`
}

/// Equivalente en tiempo de FICCIÓN de una espera comprimida (petición explícita de la usuaria,
/// 2026-07-30: "que ponga ej: 7 mins de tiempo real 2 dias en Helek" — sin esto, la espera real
/// comprimida no daba ninguna pista de cuánto dura la acción DENTRO del mundo, dejando "¿por qué
/// tarda tanto?" sin respuesta visible). `duracionMinutos` son minutos de ficción, no reales.
export function formatFictionalDuration(duracionMinutos: number): string {
  if (duracionMinutos < 60) return `${Math.round(duracionMinutos)} min`
  if (duracionMinutos < 1440) {
    const horas = duracionMinutos / 60
    return `${Number.isInteger(horas) ? horas : horas.toFixed(1)} h`
  }
  const dias = duracionMinutos / 1440
  return `${Number.isInteger(dias) ? dias : dias.toFixed(1)} días`
}
