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

/// Peor a mejor, de izquierda a derecha en severidad — consolidado aquí (auditoría 2026-08-18,
/// antes duplicado también en HealthBar.tsx) como único punto de verdad del orden, espejo exacto
/// de CONDICION_ORDER en death.ts (backend).
export const CONDICION_ORDER: CondicionFisica[] = ['ILESO', 'HERIDO', 'GRAVE', 'CONVALECIENTE', 'MUERTO']

/// Espejo exacto de healCeilingFor (death.ts, backend) — mismo criterio que saludForCondicion de
/// arriba: nunca se calcula de forma independiente, para que la vista previa del panel "Curar"
/// (2026-08-18) no pueda desincronizarse de lo que el motor real hace al confirmar.
export function healCeilingFor(
  current: CondicionFisica,
  restAttempted: boolean,
  restInValidLocation: boolean,
  medicalCuraHasta: CondicionFisica | null,
  medicalCuraUnPaso = false,
): CondicionFisica {
  const currentIdx = CONDICION_ORDER.indexOf(current)
  let ceiling: CondicionFisica = current
  if (medicalCuraHasta) {
    if (medicalCuraUnPaso) {
      const medicalIdx = CONDICION_ORDER.indexOf(medicalCuraHasta)
      ceiling = CONDICION_ORDER[Math.max(currentIdx - 1, medicalIdx)]
    } else {
      ceiling = medicalCuraHasta
    }
  } else if (restInValidLocation && current !== 'CONVALECIENTE' && current !== 'MUERTO') {
    ceiling = 'HERIDO'
  } else if (restAttempted && current !== 'MUERTO') {
    ceiling = 'GRAVE'
  }
  const ceilingIdx = CONDICION_ORDER.indexOf(ceiling)
  return CONDICION_ORDER[Math.min(currentIdx, ceilingIdx)]
}

/// Espejo exacto de applySequentialHeals (death.ts, backend) — panel "Curar" con varios objetos/
/// usos a la vez (petición explícita, 2026-08-18): pliega healCeilingFor sobre una lista ORDENADA
/// de usos, para la vista previa en vivo mientras se eligen objetos/cantidades. El ORDEN importa
/// de verdad (ver el mismo comentario en death.ts) — el caller decide el orden real de selección.
export function applySequentialHeals(current: CondicionFisica, uses: { curaHasta: CondicionFisica; curaUnPaso: boolean }[]): CondicionFisica {
  let condicion = current
  for (const use of uses) {
    condicion = healCeilingFor(condicion, false, false, use.curaHasta, use.curaUnPaso)
  }
  return condicion
}
