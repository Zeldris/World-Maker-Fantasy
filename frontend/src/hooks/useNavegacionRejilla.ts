import { useCallback, type KeyboardEvent } from 'react'
import { esTeclaRejilla, siguienteCelda } from '../lib/navegacionRejilla'

/// BAS-3 (hito 0.2) — `onKeyDown` para el contenedor de una rejilla: las flechas (o la cruceta del
/// mando, que el navegador entrega como flechas) mueven el foco entre los elementos marcados con
/// `data-celda` que no estén deshabilitados; Inicio/Fin van a la primera/última.
export function useNavegacionRejilla() {
  return useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (!esTeclaRejilla(e.key)) return
    const celdas = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-celda]:not(:disabled)'))
    const actual = celdas.findIndex((c) => c === document.activeElement || c.contains(document.activeElement))
    if (actual === -1) return
    const cajas = celdas.map((c) => {
      const r = c.getBoundingClientRect()
      return { x: r.left, y: r.top, w: r.width, h: r.height }
    })
    const destino = siguienteCelda(actual, cajas, e.key)
    e.preventDefault()
    if (destino !== actual) celdas[destino].focus()
  }, [])
}
