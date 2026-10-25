import type { IntensidadAsaltos } from './api'

/// P257: lo que hace cada nivel de «Intensidad de los asaltos» (CR-67, `decisionAsalto.ts`): cuánta ventaja
/// quieren los atacantes sobre tu defensa antes de salir, cada cuánto se refuerzan y cuánto les tienta tu botín.
/// Ninguno quita los asaltos.
const AYUDA: Record<IntensidadAsaltos, string> = {
  CONTENIDA: 'Contenida: bandidos y enemigos esperan a ser casi el doble de fuertes que tu defensa, refuerzan su campamento cada 4 días y tu botín les tienta menos. Atacan menos a menudo.',
  NORMAL: 'Normal: atacan cuando son bastante más fuertes que tu defensa (un 50 % más), refuerzan su campamento cada 3 días y tu botín les tienta lo normal.',
  DURA: 'Dura: se atreven con poca ventaja sobre tu defensa (un 20 % más), refuerzan su campamento cada 2 días y tu botín les tienta más. Atacan más a menudo.',
}

export function ayudaIntensidadAsaltos(v: IntensidadAsaltos | undefined): string {
  return `${v ? AYUDA[v] : AYUDA.NORMAL} Nunca dejan de atacar del todo.`
}
