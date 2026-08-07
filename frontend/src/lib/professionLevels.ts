// Umbrales de professionProgress.ts (backend) — duplicados aquí a propósito, igual que
// lib/progression.ts ya duplica la tabla de XP de personaje: es una tabla fija, no un cálculo que
// valga la pena pedir al backend solo para dibujar una barra. Extraído de ProfesionesPanel.tsx
// (rediseño de profesiones, 2026-08-07) para que HabilidadesPanel también pueda dibujar barras de
// oficio sin duplicar la tabla una tercera vez.
export const PROFESSION_LEVEL_THRESHOLDS = [0, 50, 150, 350, 700]
export const MAX_PROFESSION_LEVEL = PROFESSION_LEVEL_THRESHOLDS.length

export function professionSpan(nivel: number, xp: number): { current: number; span: number } {
  if (nivel >= MAX_PROFESSION_LEVEL) return { current: xp, span: xp || 1 }
  const base = PROFESSION_LEVEL_THRESHOLDS[nivel - 1] ?? 0
  const next = PROFESSION_LEVEL_THRESHOLDS[nivel] ?? base
  return { current: xp - base, span: next - base }
}
