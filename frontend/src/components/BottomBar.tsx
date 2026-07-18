export type PanelId =
  | 'mapa'
  | 'inventario'
  | 'estadisticas'
  | 'diario'
  | 'misiones'
  | 'companeros'
  | 'reino'
  | 'habilidades'
  | 'profesiones'

interface Tab {
  id: PanelId
  icon: string
  label: string
  /// Pestañas que todavía no tienen datos reales que mostrar — necesitan más persistencia
  /// (docs/09-panel-personaje.md § 4). Siguen siendo pulsables, muestran un aviso en vez de bloquearse.
  comingSoon?: boolean
}

const tabs: Tab[] = [
  { id: 'mapa', icon: '🗺️', label: 'Mapa' },
  { id: 'estadisticas', icon: '📊', label: 'Estadísticas' },
  { id: 'inventario', icon: '🎒', label: 'Inventario' },
  { id: 'diario', icon: '📖', label: 'Diario' },
  { id: 'misiones', icon: '🎯', label: 'Misiones', comingSoon: true },
  { id: 'companeros', icon: '👥', label: 'Compañeros' },
  { id: 'reino', icon: '🏰', label: 'Reino' },
  { id: 'habilidades', icon: '✨', label: 'Habilidades' },
  { id: 'profesiones', icon: '🔨', label: 'Profesiones' },
]

interface BottomBarProps {
  active: PanelId | null
  onSelect: (id: PanelId) => void
}

export function BottomBar({ active, onSelect }: BottomBarProps) {
  return (
    <nav className="iron-band flex items-center justify-around gap-1 border-t border-iron-900 px-2 py-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          title={tab.comingSoon ? `${tab.label} (todavía sin datos reales)` : tab.label}
          className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] transition-colors ${
            active === tab.id
              ? 'bg-wood-950/70 text-accent-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]'
              : tab.comingSoon
                ? 'text-wood-600 hover:text-wood-400'
                : 'text-wood-400 hover:bg-wood-950/40 hover:text-wood-200'
          }`}
        >
          {active === tab.id && (
            <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent-500 shadow-[0_0_6px_var(--color-accent-500)]" />
          )}
          <span className={`text-base leading-none transition-[filter,opacity] ${active === tab.id ? '' : 'opacity-75 grayscale'}`}>
            {tab.icon}
          </span>
          <span className="leading-none">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

export { tabs as bottomBarTabs }
