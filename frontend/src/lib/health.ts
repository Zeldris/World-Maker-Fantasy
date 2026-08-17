import type { CondicionFisica } from '../types'

/// Salud/PV visible (2026-07-19) — espejo exacto de saludForCondicion en el backend (death.ts):
/// se deriva de condicionFisica, nunca se calcula de forma independiente en el frontend, para
/// que nunca pueda desincronizarse del valor real que decide el motor de combate.
const SALUD_POR_CONDICION: Record<CondicionFisica, number> = {
  ILESO: 100,
  HERIDO: 75,
  GRAVE: 50,
  CONVALECIENTE: 25,
  MUERTO: 0,
}

export function saludForCondicion(condicion: CondicionFisica): number {
  return SALUD_POR_CONDICION[condicion]
}

/// Deduplicado (auditoría 2026-07-22): antes definido idéntico en HealthBar.tsx y CombatModal.tsx.
export const CONDICION_LABEL: Record<CondicionFisica, string> = {
  ILESO: 'Ileso',
  HERIDO: 'Herido',
  GRAVE: 'Grave',
  CONVALECIENTE: 'Convaleciente',
  MUERTO: 'Muerto',
}
