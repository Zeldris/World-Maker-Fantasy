import type { Notificacion, TipoNotificacion } from '../lib/notificaciones'

const BORDE: Record<TipoNotificacion, string> = {
  quest: 'border-quest-600/70',
  moss: 'border-moss-600/70',
  danger: 'border-danger-600/70',
  accent: 'border-accent-600/70',
  accent2: 'border-accent2-600/70',
}

/// HUD-6 (hito 0.2) — pila de notificaciones arriba a la derecha. No tapa los modales (va por
/// debajo de las capas) ni roba el foco; cada una se puede cerrar.
export function Notificaciones({ notificaciones, onDescartar }: { notificaciones: Notificacion[]; onDescartar: (id: number) => void }) {
  if (notificaciones.length === 0) return null
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-3 top-20 z-40 flex w-72 flex-col gap-2">
      {notificaciones.map((n) => (
        <div
          key={n.id}
          role="status"
          className={`plank-panel ${n.saliendo ? 'animate-toast-out pointer-events-none' : 'animate-entry-in pointer-events-auto'} flex items-start gap-2 rounded-lg border-l-4 px-3 py-2 text-xs text-wood-100 shadow-lg ${BORDE[n.tipo]}`}
        >
          <span aria-hidden="true">{n.icono}</span>
          <p className="min-w-0 flex-1">
            {n.texto}
            {n.veces > 1 && <span className="ml-1.5 font-mono text-2xs text-wood-400">×{n.veces}</span>}
            {n.enlace && (
              <button
                type="button"
                onClick={() => {
                  n.enlace!.alPulsar()
                  onDescartar(n.id)
                }}
                className="mt-1 block text-2xs text-accent2-300 underline-offset-2 hover:underline"
              >
                {n.enlace.label}
              </button>
            )}
          </p>
          <button type="button" onClick={() => onDescartar(n.id)} aria-label="Cerrar aviso" className="shrink-0 text-wood-500 hover:text-wood-200">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
