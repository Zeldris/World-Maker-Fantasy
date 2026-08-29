import type { Attribute, AttributeBlock, CondicionFisica, EquipSlot, InventoryItemInfo, SecondaryAttributeBlock } from '../../types'
import { EquipoPanel } from './EquipoPanel'
import { EstadisticasPanel } from './EstadisticasPanel'

// Consolidación de "Equipo" en "Personaje" (2026-07-29, petición explícita: "un tab en la
// sección de Equipo que va a pasar a llamarse Personaje... equipo, estadísticas, reputación,
// profesiones") — antes 3 pestañas sueltas del riel izquierdo (Estadísticas, Equipo, Profesiones)
// más la reputación de facción escondida dentro de Reino; ahora un solo tab de nivel superior
// con sub-pestañas propias.
//
// Rediseño de profesiones (2026-08-07): la sub-pestaña "Profesiones" desaparece de aquí — quedaba
// redundante en cuanto Habilidades > Profesiones pasó a mostrar lo mismo (barras) y bastante más
// (recetas por nivel, enlace a Enciclopedia). El botón "Adoptar" que vivía aquí no enganchaba con
// ninguna mecánica real, así que tampoco se lleva a ningún sitio nuevo.
//
// "Reputación" sale de aquí (checklist frontend 2026-08-27, B.13) — pasa a pestaña propia del riel
// "El mundo" (NavTabs.ts): conceptualmente es del eje mundo/facciones, no del personaje.
export type PersonajeSubTab = 'equipo' | 'estadisticas'

const SUB_TABS: { id: PersonajeSubTab; label: string; icon: string }[] = [
  { id: 'equipo', label: 'Equipo', icon: '⚔️' },
  { id: 'estadisticas', label: 'Estadísticas', icon: '📊' },
]

interface PersonajePanelProps {
  activeSubTab: PersonajeSubTab
  onSubTabChange: (tab: PersonajeSubTab) => void

  characterArchetype: string | null
  characterOrigin: string | null

  items: InventoryItemInfo[]
  onSlotClick: (slot: EquipSlot, equipped: InventoryItemInfo | undefined) => void

  attributes: AttributeBlock
  attributeBonuses: Partial<AttributeBlock>
  secondaryAttributes: SecondaryAttributeBlock
  level: number
  xp: number
  pendingAttributePoints: number
  onSpendPoint: (attribute: Attribute) => void
  condicionFisica: CondicionFisica
  energia: number
  energiaMax: number
  hambre: number
  sed: number
}

export function PersonajePanel({
  activeSubTab,
  onSubTabChange,
  characterArchetype,
  characterOrigin,
  items,
  onSlotClick,
  attributes,
  attributeBonuses,
  secondaryAttributes,
  level,
  xp,
  pendingAttributePoints,
  onSpendPoint,
  condicionFisica,
  energia,
  energiaMax,
  hambre,
  sed,
}: PersonajePanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 border-b border-iron-800 pb-2">
        {SUB_TABS.map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => onSubTabChange(tab.id)}
            className={`tactile flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              activeSubTab === tab.id
                ? 'bg-wood-950/70 text-accent-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]'
                : 'text-wood-400 hover:bg-wood-950/40 hover:text-wood-200'
            }`}
          >
            <span className="text-sm leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'equipo' && <EquipoPanel items={items} onSlotClick={onSlotClick} />}
      {activeSubTab === 'estadisticas' && (
        <EstadisticasPanel
          characterArchetype={characterArchetype}
          characterOrigin={characterOrigin}
          attributes={attributes}
          attributeBonuses={attributeBonuses}
          secondaryAttributes={secondaryAttributes}
          level={level}
          xp={xp}
          pendingAttributePoints={pendingAttributePoints}
          onSpendPoint={onSpendPoint}
          condicionFisica={condicionFisica}
          energia={energia}
          energiaMax={energiaMax}
          hambre={hambre}
          sed={sed}
        />
      )}
    </div>
  )
}
