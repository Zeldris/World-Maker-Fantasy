import type { Attribute, AttributeBlock, EquipSlot, InventoryItemInfo, ProfessionProgressInfo, SecondaryAttributeBlock } from '../../types'
import { EquipoPanel } from './EquipoPanel'
import { EstadisticasPanel } from './EstadisticasPanel'
import { ReputacionPanel } from './ReputacionPanel'
import { ProfesionesPanel } from './ProfesionesPanel'
import { TooltipAnchor } from '../TooltipAnchor'

// Consolidación de "Equipo" en "Personaje" (2026-07-29, petición explícita: "un tab en la
// sección de Equipo que va a pasar a llamarse Personaje... equipo, estadísticas, reputación,
// profesiones") — antes 3 pestañas sueltas del riel izquierdo (Estadísticas, Equipo, Profesiones)
// más la reputación de facción escondida dentro de Reino; ahora un solo tab de nivel superior
// con sub-pestañas propias.
export type PersonajeSubTab = 'equipo' | 'estadisticas' | 'reputacion' | 'profesiones'

const SUB_TABS: { id: PersonajeSubTab; label: string; icon: string }[] = [
  { id: 'equipo', label: 'Equipo', icon: '⚔️' },
  { id: 'estadisticas', label: 'Estadísticas', icon: '📊' },
  { id: 'reputacion', label: 'Reputación', icon: '🤝' },
  { id: 'profesiones', label: 'Profesiones', icon: '🔨' },
]

interface PersonajePanelProps {
  activeSubTab: PersonajeSubTab
  onSubTabChange: (tab: PersonajeSubTab) => void
  /// Rework de combate in-place (2026-07-24): Profesiones no tiene sentido a medio combate — antes
  /// se deshabilitaba como pestaña de nivel superior (GameView.COMBAT_DISABLED_CHARACTER_TABS),
  /// ahora que vive aquí dentro se deshabilita solo esta sub-pestaña, sin tocar las demás.
  combatOpen: boolean

  items: InventoryItemInfo[]
  onSlotClick: (slot: EquipSlot, equipped: InventoryItemInfo | undefined) => void

  attributes: AttributeBlock
  secondaryAttributes: SecondaryAttributeBlock
  level: number
  xp: number
  pendingAttributePoints: number
  onSpendPoint: (attribute: Attribute) => void

  factionsStatus: Record<string, number>

  currentProfession: string | null
  onAdoptProfession: (name: string) => void
  professionProgress: ProfessionProgressInfo[]
}

export function PersonajePanel({
  activeSubTab,
  onSubTabChange,
  combatOpen,
  items,
  onSlotClick,
  attributes,
  secondaryAttributes,
  level,
  xp,
  pendingAttributePoints,
  onSpendPoint,
  factionsStatus,
  currentProfession,
  onAdoptProfession,
  professionProgress,
}: PersonajePanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 border-b border-iron-800 pb-2">
        {SUB_TABS.map((tab) => {
          const disabled = combatOpen && tab.id === 'profesiones'
          return (
            <TooltipAnchor key={tab.id} text={disabled ? `${tab.label} (no disponible en combate)` : tab.label}>
              <button
                onClick={() => !disabled && onSubTabChange(tab.id)}
                disabled={disabled}
                className={`tactile flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  activeSubTab === tab.id
                    ? 'bg-wood-950/70 text-accent-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]'
                    : 'text-wood-400 hover:bg-wood-950/40 hover:text-wood-200'
                }`}
              >
                <span className="text-sm leading-none">{tab.icon}</span>
                {tab.label}
              </button>
            </TooltipAnchor>
          )
        })}
      </div>

      {activeSubTab === 'equipo' && <EquipoPanel items={items} onSlotClick={onSlotClick} />}
      {activeSubTab === 'estadisticas' && (
        <EstadisticasPanel
          attributes={attributes}
          secondaryAttributes={secondaryAttributes}
          level={level}
          xp={xp}
          pendingAttributePoints={pendingAttributePoints}
          onSpendPoint={onSpendPoint}
        />
      )}
      {activeSubTab === 'reputacion' && <ReputacionPanel factionsStatus={factionsStatus} />}
      {activeSubTab === 'profesiones' && (
        <ProfesionesPanel currentProfession={currentProfession} onAdopt={onAdoptProfession} progress={professionProgress} />
      )}
    </div>
  )
}
