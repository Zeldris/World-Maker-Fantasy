import type { InventoryItemInfo, ItemTipo } from '../../types'
import { attributeLabels } from '../../lib/dice'
import { ITEM_TIPO_LABEL, ITEM_TIPO_ORDER, itemIcon } from '../../lib/enciclopediaTargets'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'
import { IconCard } from '../IconCard'

interface InventarioPanelProps {
  items: InventoryItemInfo[]
  onUse: (item: InventoryItemInfo) => void
  onDetail: (item: InventoryItemInfo) => void
}

function ItemGrid({ items, onUse, onDetail }: InventarioPanelProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <IconCard
          key={item.id}
          icon={item.slot ? '⚔️' : itemIcon(item.category ?? '')}
          name={item.name}
          tooltip={item.description}
          onUse={() => onUse(item)}
          onDetail={() => onDetail(item)}
          badge={
            item.slot && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-moss-600 bg-wood-950 text-2xs font-bold leading-none text-moss-400"
              >
                E
              </span>
            )
          }
          extra={
            <>
              {!!item.statBonusAttribute && !!item.statBonusAmount && (
                <span className="rounded-full border border-accent-600/50 bg-accent-500/10 px-1.5 py-0.5 font-mono text-2xs text-accent-300">
                  +{item.statBonusAmount} {attributeLabels[item.statBonusAttribute]}
                </span>
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
export function InventarioPanel({ items, onUse, onDetail }: InventarioPanelProps) {
  if (items.length === 0) {
    return (
      <PanelEmptyState
        icon="🎒"
        title="La mochila está vacía"
        hint="Lo que consigas o fabriques durante la partida aparecerá aquí."
      />
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
