import { useAjustes } from '../context/useAjustes'

/// CFG-1 (hito 0.2, roadmap-front.md § 2.1) — botón ⚙️ fijo que abre el panel de configuración
/// (en la cabecera de la partida, junto a la fecha, y en la esquina de la pantalla de inicio).
export function BotonAjustes({ className = '' }: { className?: string }) {
  const { abrirPanel } = useAjustes()
  return (
    <button
      type="button"
      onClick={abrirPanel}
      aria-label="Configuración"
      title="Configuración"
      className={`tactile flex h-7 w-7 items-center justify-center rounded-full border border-iron-700 bg-wood-950/60 text-sm text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 ${className}`}
    >
      <span aria-hidden="true">⚙️</span>
    </button>
  )
}
