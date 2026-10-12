import type { Dificultad } from '../types'

/// Muertes que aguanta cada dificultad (en Novato, sin límite).
export const LIMITE_MUERTES: Record<Exclude<Dificultad, 'NOVATO'>, number> = { MEDIO: 4, AVANZADO: 2 }

/// P119 (QA-27): al caer, el pie solo enseñaba «Aceptar». Qué ha pasado y qué viene.
export function textoTrasCaer(nombre: string | null, deathCount: number, dificultad: Dificultad): string {
  const quien = nombre ?? 'Tu personaje'
  const cuenta = dificultad === 'NOVATO' ? '' : ` (muerte ${deathCount} de ${LIMITE_MUERTES[dificultad]})`
  // Lo decide `/death/resolve` al aceptar: donde descansó, si no en su punto de partida (si ya superó la
  // primera prueba) y, sin ninguna de las dos, la partida empieza de nuevo.
  return `${quien} ha caído${cuenta}. Al aceptar, despierta donde descansó por última vez o, si nunca descansó, en su punto de partida. Si además nunca superó su primera prueba, todo habrá sido una pesadilla y empezará de nuevo.`
}
