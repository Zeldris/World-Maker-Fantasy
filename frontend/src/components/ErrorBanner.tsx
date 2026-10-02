/// UX-24 (hito 0.1, roadmap-front-ux.md H23) — aviso común para una acción que ha fallado contra el
/// backend: qué no se pudo hacer, el motivo si el backend lo dio, *Reintentar* y cerrar. Antes varias
/// acciones (Reino, Descansar en el campamento) usaban `try/finally` sin `catch` y fallaban sin que
/// se viera nada. Se usa junto a `useErrorConReintento` (hooks/useErrorConReintento.ts).
export interface FalloAccion {
  mensaje: string
  detalle?: string
  reintentar?: () => void
}

interface ErrorBannerProps {
  fallo: FalloAccion | null
  onCerrar: () => void
}

export function ErrorBanner({ fallo, onCerrar }: ErrorBannerProps) {
  if (!fallo) return null
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger-600/50 bg-danger-500/10 px-3 py-2 text-xs">
      <span aria-hidden="true">⚠️</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-danger-300">{fallo.mensaje}</p>
        {fallo.detalle && <p className="mt-0.5 text-2xs text-wood-400">{fallo.detalle}</p>}
      </div>
      {fallo.reintentar && (
        <button
          type="button"
          onClick={() => {
            const reintentar = fallo.reintentar!
            onCerrar()
            reintentar()
          }}
          className="tactile shrink-0 rounded-md border border-danger-500/60 px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.08em] text-danger-300 hover:bg-danger-500/20"
        >
          Reintentar
        </button>
      )}
      <button type="button" onClick={onCerrar} aria-label="Cerrar aviso" className="shrink-0 text-wood-500 hover:text-wood-200">
        ✕
      </button>
    </div>
  )
}
