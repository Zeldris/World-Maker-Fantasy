import { flushSync } from 'react-dom'

/// BAS-7 (hito 0.2): cambios de disposición (plegar un lado, cambiar de pestaña) con la View
/// Transitions API: el navegador funde la vista vieja con la nueva. Solo con «Animaciones:
/// completas» (`data-motion`, CFG-14) y donde el webview la soporte; si no, el cambio es en seco.
export function conTransicion(cambio: () => void): void {
  const doc = typeof document !== 'undefined' ? (document as Document & { startViewTransition?: (cb: () => void) => unknown }) : null
  if (doc?.startViewTransition && doc.documentElement.dataset.motion === 'completas') {
    doc.startViewTransition(() => flushSync(cambio))
    return
  }
  cambio()
}
