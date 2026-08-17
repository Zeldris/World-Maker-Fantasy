import { useState } from 'react'
import type { InventoryItemInfo, CondicionFisica } from '../types'
import { CONDICION_LABEL } from '../lib/health'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'

interface HealSelectionModalProps {
  inventory: InventoryItemInfo[]
  condicionFisica: CondicionFisica
  onSelect: (actionText: string) => void
  onCancel: () => void
}

/// Pop-up de "Curar" (2026-08-17, comentario de startingAbilities.ts: "un panel como el de cazar
/// con los objetos de curación... si ya estás en ileso no te debe dejar usar más objetos") — a
/// diferencia de Cazar (varias presas a la vez), curar es de UN objeto por turno de verdad
/// (`detectMedicalItemUse`, backend/src/services/itemReference.ts, solo aplica el mejor match): el
/// panel deja elegir uno, muestra su efecto real antes de confirmar, y se puede volver a abrir para
/// el siguiente turno si con eso no basta — mismo resultado práctico que un multi-selección, sin
/// inventar un mecanismo de curación por lotes que el motor no tiene.
export function HealSelectionModal({ inventory, condicionFisica, onSelect, onCancel }: HealSelectionModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const curativos = inventory.filter((i) => i.curaHasta || i.curaEnergia)
  const yaIleso = condicionFisica === 'ILESO'

  return (
    <SelectionModalShell
      title="Curar"
      onCancel={onCancel}
      footer={
        !yaIleso &&
        curativos.length > 0 && (
          <button
            onClick={() => {
              const item = curativos.find((i) => i.id === selectedId)
              if (item) onSelect(`Reviso el inventario y me curo con ${item.name}.`)
            }}
            disabled={!selectedId}
            className={confirmButtonClasses('accent')}
          >
            Curarme
          </button>
        )
      }
    >
      {yaIleso ? (
        <p className="text-xs text-wood-500">Ya estás ileso — no hace falta usar nada más.</p>
      ) : curativos.length === 0 ? (
        <p className="text-xs text-wood-500">No llevas ningún objeto curativo encima.</p>
      ) : (
        <div className="space-y-1.5">
          {curativos.map((item) => (
            <label
              key={item.id}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-xs text-wood-300 transition-colors ${
                selectedId === item.id ? 'border-accent-600/60 bg-accent-500/10' : 'border-iron-700'
              }`}
            >
              <input
                type="radio"
                name="curativo"
                checked={selectedId === item.id}
                onChange={() => setSelectedId(item.id)}
                className="mt-0.5 accent-accent-500"
              />
              <span>
                <span className="font-semibold text-wood-100">{item.name}</span>
                <span className="ml-1.5 text-2xs text-wood-500">
                  {item.curaHasta &&
                    `— cura ${item.curaUnPaso ? 'un escalón, hasta ' : 'hasta '}${CONDICION_LABEL[item.curaHasta].toLowerCase()}`}
                  {item.curaEnergia ? ` · +${item.curaEnergia} energía` : ''}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </SelectionModalShell>
  )
}
