// BAS-3 (hito 0.2, roadmap-front.md) — navegación con flechas/cruceta en rejillas (inventario,
// equipo, habilidades, barra de habilidades). Espacial: la flecha lleva a la celda más cercana en
// esa dirección según su posición en pantalla, así sirve igual para una rejilla regular, una fila
// que se parte en varias o el muñeco de equipo (áreas anatómicas con huecos).

export type TeclaRejilla = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'

const TECLAS = new Set<string>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'])
export const esTeclaRejilla = (tecla: string): tecla is TeclaRejilla => TECLAS.has(tecla)

export interface Caja {
  x: number
  y: number
  w: number
  h: number
}

/// Índice de la celda destino, o el mismo si no hay ninguna en esa dirección (sin dar la vuelta:
/// chocar con el borde se entiende mejor que saltar al otro lado). Inicio/Fin: primera/última.
export function siguienteCelda(indice: number, cajas: Caja[], tecla: TeclaRejilla): number {
  if (cajas.length === 0) return indice
  if (tecla === 'Home') return 0
  if (tecla === 'End') return cajas.length - 1
  const o = cajas[indice]
  const ox = o.x + o.w / 2
  const oy = o.y + o.h / 2
  let mejor = indice
  let mejorCoste = Infinity
  cajas.forEach((c, i) => {
    if (i === indice) return
    const dx = c.x + c.w / 2 - ox
    const dy = c.y + c.h / 2 - oy
    // Avance en la dirección pedida (debe ser positivo) y desvío lateral, que pesa más para que
    // "abajo" prefiera la celda de debajo a una en diagonal más cerca.
    const [avance, desvio] =
      tecla === 'ArrowRight' ? [dx, dy] : tecla === 'ArrowLeft' ? [-dx, dy] : tecla === 'ArrowDown' ? [dy, dx] : [-dy, dx]
    if (avance <= 1) return
    const coste = avance + Math.abs(desvio) * 2
    if (coste < mejorCoste) {
      mejorCoste = coste
      mejor = i
    }
  })
  return mejor
}
