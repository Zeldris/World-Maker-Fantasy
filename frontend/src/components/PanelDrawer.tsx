import type { ReactNode } from 'react'

interface PanelDrawerProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

/// Panel deslizante genérico por encima de la partida — nunca navega a otra página, así el
/// jugador no pierde de vista los logs/chat de fondo (docs/09-panel-personaje.md § 1).
export function PanelDrawer({ title, subtitle, onClose, children }: PanelDrawerProps) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="animate-overlay-in absolute inset-0 bg-iron-900/75 backdrop-blur-[2px]"
      />
      <div className="plank-panel animate-drawer-up relative z-10 mx-auto flex max-h-[75vh] w-full max-w-3xl flex-col rounded-t-2xl border-b-0 shadow-[0_-16px_48px_-16px_rgba(0,0,0,0.85)]">
        <span className="rivet rivet-tl" />
        <span className="rivet rivet-tr" />
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-iron-700" />
        <div className="relative flex items-center justify-between px-5 pb-3 pt-1.5">
          <div>
            <h2 className="font-serif text-lg tracking-wide text-wood-100">{title}</h2>
            {subtitle && <p className="text-xs text-wood-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-iron-700 bg-wood-950/50 px-2.5 py-1 text-xs text-wood-400 transition-colors hover:border-accent-600/60 hover:text-accent-300"
          >
            Cerrar ✕
          </button>
          <div className="accent-hairline absolute inset-x-0 bottom-0" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
