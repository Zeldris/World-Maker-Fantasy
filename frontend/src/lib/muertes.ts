import type { Dificultad } from '../types'

/// Muertes que aguanta cada dificultad (en Novato, sin límite).
export const LIMITE_MUERTES: Record<Exclude<Dificultad, 'NOVATO'>, number> = { MEDIO: 4, AVANZADO: 2 }

/// P119 (QA-27): al caer, el pie solo enseñaba «Aceptar». Qué ha pasado y qué viene.
export function textoTrasCaer(nombre: string | null, deathCount: number, dificultad: Dificultad): string {
  const quien = nombre ?? 'Tu personaje'
  const cuenta = dificultad === 'NOVATO' ? '' : ` (muerte ${deathCount} de ${LIMITE_MUERTES[dificultad]})`
  return `${quien} ha caído${cuenta}. Al aceptar, despierta donde descansó por última vez.`
}
