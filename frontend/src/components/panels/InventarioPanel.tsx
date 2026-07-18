import type { InventoryItemInfo } from '../../types'

interface InventarioPanelProps {
  items: InventoryItemInfo[]
  onUse: (item: InventoryItemInfo) => void
}

export function InventarioPanel({ items, onUse }: InventarioPanelProps) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-wood-500 italic">
        Todavía no llevas ningún objeto. Lo que consigas o fabriques durante la partida aparecerá aquí.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onUse(item)}
          title="Añadir al mensaje"
          className="w-full rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5 text-left transition-colors hover:border-accent-600/60 hover:bg-accent-500/10"
        >
          <p className="flex items-center gap-2 font-medium text-wood-100">
            <span>🎒</span> {item.name}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-wood-400">{item.description}</p>
        </button>
      ))}
    </div>
  )
}
