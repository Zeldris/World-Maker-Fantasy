import type { InventoryItemInfo } from '../../types'
import { attributeLabels } from '../../lib/dice'
import { PanelEmptyState } from '../PanelEmptyState'
import { IconCard } from '../IconCard'

interface InventarioPanelProps {
  items: InventoryItemInfo[]
  onUse: (item: InventoryItemInfo) => void
  onDetail: (item: InventoryItemInfo) => void
}

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

  // Equipados primero (petición explícita) — dentro de cada grupo se conserva el orden de llegada.
  const sorted = [...items].sort((a, b) => Number(!!b.slot) - Number(!!a.slot))

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {sorted.map((item) => (
        <IconCard
          key={item.id}
          icon={item.slot ? '⚔️' : '🎒'}
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
