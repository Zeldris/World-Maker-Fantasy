import type { PanelId, Tab } from './NavTabs'
import { TooltipAnchor } from './TooltipAnchor'

interface SideNavProps {
  tabs: Tab[]
  active: PanelId | null
  onSelect: (id: PanelId) => void
  align: 'left' | 'right'
  /// Bug real (2026-07-22, "el cuadro negro" — confirmado: el propio riel de iconos, no un
  /// backdrop suelto): con un PanelDrawer abierto, este riel queda cubierto por el oscurecido del
  /// cajón (ya no es clicable, tapado por su backdrop a z-20) pero SIGUE pintando su propia
  /// textura oscura (dust-road/iron-band) debajo — la combinación de las dos capas oscuras se ve
  /// como un bloque negro sólido, sin ningún contraste que delate que es un riel de botones. Con
  /// un panel abierto no aporta nada (no se puede pulsar), así que se oculta del todo — se ve el
  /// mismo oscurecido uniforme que el resto del fondo, en vez de un bloque negro con forma de riel.
  dimmed?: boolean
  /// Rework de combate in-place (petición explícita de la usuaria, 2026-07-24): durante combate
  /// solo tienen sentido Estadísticas, Equipo, Habilidades y Enciclopedia — el resto (Inventario,
  /// Profesiones, Mapa, Diario, Misiones, Compañeros, Reino) se deshabilita visualmente, sin
  /// desaparecer del riel (evita que el nav "salte" al entrar/salir de combate).
  disabledIds?: PanelId[]
  /// Mismo mecanismo que `disabledIds`, pero para el motivo "hay una muerte pendiente de resolver"
  /// (2026-09-07) — el tooltip necesita distinguir el motivo real, no decir siempre "en combate"
  /// cuando en realidad el personaje está muerto esperando a Aceptar/Reintentar.
  disabledReason?: 'combate' | 'muerte-pendiente'
}

export function SideNav({ tabs, active, onSelect, align, dimmed, disabledIds, disabledReason }: SideNavProps) {
  return (
    <nav
      // Material distinto por riel (roadmap de rediseño visual, Fable 2026-07-20, Nivel 2):
      // izquierdo = Polvo del Camino ("tu equipo"), derecho = Hierro Grabado ("el mundo") — mismo
      // reparto que ya fija LogPanel (accent/accent2), reforzado ahora por textura.
      className={`${align === 'left' ? 'dust-road' : 'iron-band corner-bracket'} flex w-14 min-h-0 shrink-0 flex-col items-center gap-1 overflow-y-auto rounded-xl py-2 sm:w-16 ${
        align === 'left' ? 'order-first' : 'order-last'
      } ${dimmed ? 'invisible' : ''}`}
    >
      {tabs.map((tab) => {
        const isDisabled = disabledIds?.includes(tab.id) ?? false
        const disabledSuffix = disabledReason === 'muerte-pendiente' ? '(no disponible con una muerte pendiente de resolver)' : '(no disponible en combate)'
        return (
          <TooltipAnchor key={tab.id} text={isDisabled ? `${tab.label} ${disabledSuffix}` : tab.label} className="block w-full">
            <button type="button"
              onClick={() => !isDisabled && onSelect(tab.id)}
              disabled={isDisabled}
              className={`tactile relative flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-2xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
                active === tab.id
                  ? 'bg-wood-950/70 text-accent-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]'
                  : 'text-wood-400 hover:bg-wood-950/40 hover:text-wood-200'
              }`}
            >
              {active === tab.id && (
                <span
                  className={`absolute inset-y-2 w-0.5 rounded-full bg-accent-500 shadow-[0_0_6px_var(--color-accent-500)] ${
                    align === 'left' ? 'left-0' : 'right-0'
                  }`}
                />
              )}
              <span className={`text-base leading-none transition-[filter,opacity] ${active === tab.id ? '' : 'opacity-75 grayscale'}`}>
                {tab.icon}
              </span>
              <span className="leading-none">{tab.label}</span>
            </button>
          </TooltipAnchor>
        )
      })}
    </nav>
  )
}
