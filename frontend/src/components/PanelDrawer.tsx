import { useEffect, useRef, type ReactNode } from 'react'

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
  /// UX-5 (hito 0.2) — si no es null, el panel está en modo consulta: se lee, pero lo que cambia
  /// datos está deshabilitado con este motivo.
  modoConsulta?: string | null
  /// UX-12 (hito 0.2) — algo importante ha llegado al registro con el cajón abierto: aviso con
  /// botón «Ver» (cierra el cajón para leerlo).
  novedad?: { texto: string; onVer: () => void } | null
  /// BAS-7 (hito 0.2) — se está cerrando: anima la salida (usePresence) y deja de recibir clics.
  saliendo?: boolean
}

/// Panel deslizante genérico por encima de la partida — nunca navega a otra página, así el
/// jugador no pierde de vista los logs/chat de fondo (docs/mecanicas/09-panel-personaje.md § 1).
export function PanelDrawer({ title, subtitle, onClose, children, accent = 'accent', modoConsulta = null, novedad = null, saliendo = false }: PanelDrawerProps) {
  const hairlineClass = accent === 'accent2' ? 'accent2-hairline' : 'accent-hairline'
  const closeHoverClass = accent === 'accent2' ? 'hover:border-accent2-600/60 hover:text-accent2-300' : 'hover:border-accent-600/60 hover:text-accent-300'
  // Foco + scroll al inicio al abrirse (2026-08-31, "revisa bien todos los casos del foco/scroll")
  // — ninguno de los ~8 paneles que renderiza este cajón (personaje/reputación/mapa/enciclopedia/
  // diario/reino...) tenía nada que asegurara arrancar arriba del todo ni que el foco del teclado
  // pasara al panel — se quedaba donde estuviera (normalmente el botón de la barra que lo abrió).
  // El propio contenedor recibe el foco (tabIndex -1: enfocable por código, fuera del tab order
  // normal) en vez de intentar adivinar cuál es "el primer campo" de cada panel distinto.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    scrollRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])
  // P144 (QA-27): todas las hojas con la misma altura; antes un panel corto (Reputación) quedaba
  // pegado abajo mientras los largos llenaban la pantalla, y parecían dos tipos de ventana distintos.
  return (
    <div className={`absolute inset-0 z-20 flex flex-col justify-end ${saliendo ? 'pointer-events-none' : ''}`}>
      <button type="button"
        aria-label="Cerrar"
        onClick={onClose}
        // Bug real (2026-07-22, "el cuadro negro se sigue viendo"): `backdrop-blur` es un filtro
        // que compone por GPU — en hardware antiguo/débil (portátil de 2014, GT 730M con 1GB de
        // VRAM, ver docs/arquitectura/04-decisiones-tecnicas.md) esto es una fuente conocida de artefactos de
        // renderizado donde el desenfoque sale como un bloque sólido negro en vez de difuminar el
        // contenido de debajo. Era el único `backdrop-blur` de toda la app. El oscurecido
        // (`bg-iron-900/75`) por sí solo ya cumple la función de atenuar el fondo.
        className={`${saliendo ? 'animate-overlay-out' : 'animate-overlay-in'} absolute inset-0 bg-iron-900/75`}
      />
      <div className={`plank-panel ${saliendo ? 'animate-drawer-down' : 'animate-drawer-up'} relative z-10 mx-auto flex h-[min(85vh,100%)] min-h-0 w-full max-w-4xl flex-col rounded-t-2xl border-b-0 shadow-[0_-16px_48px_-16px_rgba(0,0,0,0.85)]`}>
        <span className="rivet rivet-tl" />
        <span className="rivet rivet-tr" />
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-iron-700" />
        <div className="relative flex items-center justify-between px-5 pb-3 pt-1.5">
          <div>
            <h2 className="font-serif text-lg tracking-wide text-wood-100">{title}</h2>
            {subtitle && <p className="text-xs text-wood-500">{subtitle}</p>}
          </div>
          <button type="button"
            onClick={onClose}
            className={`rounded-lg border border-iron-700 bg-wood-950/50 px-2.5 py-1 text-xs text-wood-400 transition-colors ${closeHoverClass}`}
          >
            Cerrar ✕
          </button>
          <div className={`absolute inset-x-0 bottom-0 ${hairlineClass}`} />
        </div>
        {novedad && (
          <div role="status" className="animate-entry-in mx-5 mt-3 flex items-center justify-between gap-2 rounded-lg border border-accent-600/60 bg-accent-500/10 px-3 py-1.5 text-2xs text-accent-200">
            <span>
              <span aria-hidden="true">📜 </span>
              {novedad.texto}
            </span>
            <button type="button" onClick={novedad.onVer} className="tactile shrink-0 rounded border border-accent-600/60 px-2 py-0.5 font-semibold uppercase tracking-wide text-accent-300 hover:bg-accent-500/20">
              Ver
            </button>
          </div>
        )}
        {modoConsulta && (
          <p role="status" className="mx-5 mt-3 rounded-lg border border-iron-700 bg-wood-950/60 px-3 py-1.5 text-2xs text-wood-400">
            👁 Solo consulta: {modoConsulta}
          </p>
        )}
        <div ref={scrollRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 outline-none">{children}</div>
      </div>
    </div>
  )
}
