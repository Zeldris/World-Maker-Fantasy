/// Espejo de backend/src/services/progression.ts — solo para pintar la barra de progreso sin
/// una llamada extra al backend. La fuente de verdad de la XP/nivel sigue siendo el backend.
const LEVEL_THRESHOLDS: number[] = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000,
  165000, 195000, 225000, 265000, 305000, 355000,
]

export const MAX_LEVEL = LEVEL_THRESHOLDS.length

export function xpForLevel(level: number): number {
  return LEVEL_THRESHOLDS[Math.min(level, MAX_LEVEL) - 1] ?? 0
}

export function xpProgress(level: number, xp: number): { current: number; span: number; next: number | null } {
  const floor = xpForLevel(level)
  if (level >= MAX_LEVEL) return { current: xp - floor, span: 0, next: null }
  const ceiling = xpForLevel(level + 1)
  return { current: xp - floor, span: ceiling - floor, next: ceiling }
}
