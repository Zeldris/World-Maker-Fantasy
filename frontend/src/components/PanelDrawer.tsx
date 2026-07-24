import type { ReactNode } from 'react'

interface PanelDrawerProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  /// Roadmap de diseño CSS (Fable, 2026-07-20, Nivel 3): el marco del cajón (hairline + botón
  /// Cerrar) refleja de qué riel viene el panel — 'accent' para los de "Tu personaje"
  /// (characterTabs), 'accent2' para los de "El mundo" (worldTabs), mismo lenguaje que ya usa
  /// LogPanel entre sus dos canales. Por defecto 'accent', para no romper ningún uso existente.
  accent?: 'accent' | 'accent2'
}

/// Panel deslizante genérico por encima de la partida — nunca navega a otra página, así el
/// jugador no pierde de vista los logs/chat de fondo (docs/09-panel-personaje.md § 1).
export function PanelDrawer({ title, subtitle, onClose, children, accent = 'accent' }: PanelDrawerProps) {
  const hairlineClass = accent === 'accent2' ? 'accent2-hairline' : 'accent-hairline'
  const closeHoverClass = accent === 'accent2' ? 'hover:border-accent2-600/60 hover:text-accent2-300' : 'hover:border-accent-600/60 hover:text-accent-300'
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <button
        aria-label="Cerrar"
        onClick={onClose}
        // Bug real (2026-07-22, "el cuadro negro se sigue viendo"): `backdrop-blur` es un filtro
        // que compone por GPU — en hardware antiguo/débil (portátil de 2014, GT 730M con 1GB de
        // VRAM, ver docs/04-decisiones-tecnicas.md) esto es una fuente conocida de artefactos de
        // renderizado donde el desenfoque sale como un bloque sólido negro en vez de difuminar el
        // contenido de debajo. Era el único `backdrop-blur` de toda la app. El oscurecido
        // (`bg-iron-900/75`) por sí solo ya cumple la función de atenuar el fondo.
        className="animate-overlay-in absolute inset-0 bg-iron-900/75"
      />
      <div className="plank-panel animate-drawer-up relative z-10 mx-auto flex max-h-[85vh] w-full max-w-4xl flex-col rounded-t-2xl border-b-0 shadow-[0_-16px_48px_-16px_rgba(0,0,0,0.85)]">
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
            className={`rounded-lg border border-iron-700 bg-wood-950/50 px-2.5 py-1 text-xs text-wood-400 transition-colors ${closeHoverClass}`}
          >
            Cerrar ✕
          </button>
          <div className={`absolute inset-x-0 bottom-0 ${hairlineClass}`} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
