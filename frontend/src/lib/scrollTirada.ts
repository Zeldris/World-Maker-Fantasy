/// DAD-5 (hito 0.1, roadmap-front.md H24) — las tiradas en vivo hacían `scrollIntoView` siempre,
/// arrastrando al jugador si estaba leyendo más arriba. Ahora solo se desplaza si la tirada no se ve
/// y el jugador no ha movido el scroll a mano en los últimos `RESPETO_SCROLL_MANUAL_MS`.

export const RESPETO_SCROLL_MANUAL_MS = 4000

let ultimoScrollManual = Number.NEGATIVE_INFINITY
let escuchando = false

const TECLAS_SCROLL = new Set(['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'])

export function marcarScrollManual(ahora = Date.now()) {
  ultimoScrollManual = ahora
}

/// Solo para tests: olvida el último scroll manual.
export function reiniciarScrollManual() {
  ultimoScrollManual = Number.NEGATIVE_INFINITY
}

/// Escucha rueda, arrastre táctil y teclas de desplazamiento en toda la página (una sola vez).
export function escucharScrollManual() {
  if (escuchando || typeof window === 'undefined') return
  escuchando = true
  const marcar = () => marcarScrollManual()
  window.addEventListener('wheel', marcar, { passive: true, capture: true })
  window.addEventListener('touchmove', marcar, { passive: true, capture: true })
  window.addEventListener(
    'keydown',
    (e) => {
      if (TECLAS_SCROLL.has(e.key)) marcar()
    },
    { capture: true },
  )
}

/// ¿Se ve el elemento entero dentro de la ventana y de cada contenedor con scroll que lo recorta?
export function estaALaVista(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  let top = 0
  let bottom = window.innerHeight
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflowY = getComputedStyle(p).overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) {
      const pr = p.getBoundingClientRect()
      top = Math.max(top, pr.top)
      bottom = Math.min(bottom, pr.bottom)
    }
  }
  return r.top >= top && r.bottom <= bottom
}

export function debeDesplazarseATirada(el: HTMLElement, ahora = Date.now()): boolean {
  if (ahora - ultimoScrollManual < RESPETO_SCROLL_MANUAL_MS) return false
  return !estaALaVista(el)
}
