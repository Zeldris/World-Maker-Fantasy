import type { InventoryItemInfo, ItemTipo } from '../../types'
import { statBonusLabels } from '../../lib/dice'
import { ITEM_TIPO_LABEL, ITEM_TIPO_ORDER, itemIcon } from '../../lib/enciclopediaTargets'
import { totalInventoryUnits } from '../../lib/inventoryCapacity'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'
import { IconCard } from '../IconCard'

interface InventarioPanelProps {
  items: InventoryItemInfo[]
  /// Capacidad real de inventario (rediseño de profesiones, 2026-08-07) — base + Fuerza/
  /// Constitución + bonus de cosméticos equipados (ver lib/inventoryCapacity.ts).
  capacity: number
  onUse: (item: InventoryItemInfo) => void
  onDetail: (item: InventoryItemInfo) => void
}

function ItemGrid({ items, onUse, onDetail }: Omit<InventarioPanelProps, 'capacity'>) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <IconCard
          key={item.id}
          // Bug real jugando en vivo (2026-08-07): un objeto equipado mostraba SIEMPRE el mismo
          // icono de espadas cruzadas, sin importar qué fuera de verdad — "Raciones de viaje" o
          // "Tótem Maktor" equipados salían con icono de arma. El badge "E" de abajo ya distingue
          // "equipado" visualmente; el icono debe reflejar el objeto real siempre, tipo o no.
          icon={item.tipo === 'ESPECIAL' ? '✨' : itemIcon(item.category ?? '')}
          name={item.name}
          tooltip={item.effectDescription ?? item.description}
          onUse={() => onUse(item)}
          onDetail={() => onDetail(item)}
          badge={
            <>
              {item.slot && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-moss-600 bg-wood-950 text-2xs font-bold leading-none text-moss-400"
                >
                  E
                </span>
              )}
              {/* Objeto especial (2026-08-03, `tipo: ESPECIAL`) — marca aparte, diferenciada del
                  resto, para no perderlo entre el resto de la mochila; el efecto completo vive en
                  DetailModal.tsx. */}
              {item.tipo === 'ESPECIAL' && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-quest-600 bg-wood-950 text-2xs leading-none text-quest-400"
                >
                  ✨
                </span>
              )}
            </>
          }
          extra={
            <>
              {Object.entries(item.statBonuses ?? {}).map(
                ([attribute, amount]) =>
                  !!amount && (
                    <span key={attribute} className="rounded-full border border-accent-600/50 bg-accent-500/10 px-1.5 py-0.5 font-mono text-2xs text-accent-300">
                      +{amount} {statBonusLabels[attribute] ?? attribute}
                    </span>
                  ),
              )}
              {/* Tier > 1 (sesión de diseño 2026-07-23) — tier 1 es común, no se resalta. */}
              {!!item.tier && item.tier > 1 && (
                <span className="rounded-full border border-accent2-600/50 bg-accent2-500/10 px-1.5 py-0.5 font-mono text-2xs text-accent2-300">
                  Nivel {item.tier}
                </span>
              )}
            </>
          }
        />
      ))}
    </div>
  )
}

// Agrupación por tipo mecánico (2026-07-29, categorización de objetos) — antes este panel no
// agrupaba nada, un grid plano sin distinguir equipables/consumibles/recursos/materiales. Los
// equipados se quedan en su propia sección arriba (petición explícita de siempre, "equipados
// primero") porque cruzan varios tipos a la vez (un arma y una armadura equipadas no deberían
// separarse solo por eso); el resto se agrupa por tipo, igual que ya hace la Enciclopedia.
export function InventarioPanel({ items, capacity, onUse, onDetail }: InventarioPanelProps) {
  // Bug real jugando en vivo (2026-08-08, "podemos tener inventario infinito"): esto contaba
  // filas, no unidades — una pila de 9 piedras aparentaba pesar 1 solo hueco. Ver
  // `totalInventoryUnits` (lib/inventoryCapacity.ts).
  const usedUnits = totalInventoryUnits(items)
  const capacityLabel = (
    <p className={`text-2xs ${usedUnits >= capacity ? 'text-red-400' : 'text-wood-500'}`}>
      Capacidad: {usedUnits}/{capacity} objetos
    </p>
  )

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {capacityLabel}
        <PanelEmptyState
          icon="🎒"
          title="La mochila está vacía"
          hint="Lo que consigas o fabriques durante la partida aparecerá aquí."
        />
      </div>
    )
  }

  const equipped = items.filter((i) => i.slot)
  const unequipped = items.filter((i) => !i.slot)
  const byTipo = new Map<string, InventoryItemInfo[]>()
  for (const item of unequipped) {
    const key = item.tipo ?? 'sin-categorizar'
    const group = byTipo.get(key) ?? []
    group.push(item)
    byTipo.set(key, group)
  }
  const orderedTipos = [
    ...ITEM_TIPO_ORDER.filter((t) => byTipo.has(t)),
    ...(byTipo.has('sin-categorizar') ? ['sin-categorizar'] : []),
  ]

  return (
    <div className="flex flex-col gap-5">
      {capacityLabel}
      {equipped.length > 0 && (
        <PanelSection title="Equipados">
          <ItemGrid items={equipped} onUse={onUse} onDetail={onDetail} />
        </PanelSection>
      )}
      {orderedTipos.map((tipo) => (
        <PanelSection key={tipo} title={tipo === 'sin-categorizar' ? 'Sin categorizar' : ITEM_TIPO_LABEL[tipo as ItemTipo]}>
          <ItemGrid items={byTipo.get(tipo) ?? []} onUse={onUse} onDetail={onDetail} />
        </PanelSection>
      ))}
    </div>
  )
}
