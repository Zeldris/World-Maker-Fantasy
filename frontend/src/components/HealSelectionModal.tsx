import { useState } from 'react'
import type { InventoryItemInfo, CondicionFisica } from '../types'
import { CONDICION_LABEL, applySequentialHeals } from '../lib/health'
import { quantityOf, baseNameOf } from '../lib/gameViewHelpers'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'

interface HealSelectionModalProps {
  inventory: InventoryItemInfo[]
  condicionFisica: CondicionFisica
  onConfirm: (actionText: string, healItemUses: { itemId: string; quantity: number }[]) => void
  onCancel: () => void
}

// Verde ILESO/HERIDO, ámbar GRAVE, rojo CONVALECIENTE/MUERTO — mismo criterio de color que
// BAR_COLOR (HealthBar.tsx), adaptado a texto plano en vez de degradado de barra.
const CONDICION_TEXT_COLOR: Record<CondicionFisica, string> = {
  ILESO: 'text-moss-400',
  HERIDO: 'text-moss-400',
  GRAVE: 'text-cost-400',
  CONVALECIENTE: 'text-danger-400',
  MUERTO: 'text-danger-400',
}

/// Pop-up de "Curar" (2026-08-17, comentario de startingAbilities.ts: "un panel como el de cazar
/// con los objetos de curación... si ya estás en ileso no te debe dejar usar más objetos").
///
/// Rediseño con varios objetos/usos a la vez (petición explícita, 2026-08-18: "imagínate que
/// tengo más de una medicina del mismo tipo y me quiero curar dos veces... debería haber para
/// elegir la cantidad y ver según voy eligiendo qué efecto tendría") — cada objeto tiene un
/// stepper de cantidad (tope real: lo que se lleva encima, `quantityOf`); `selectionOrder` recuerda
/// en qué orden se marcó cada objeto por PRIMERA vez (las N unidades de uno mismo viajan juntas en
/// esa posición) porque el orden SÍ cambia el resultado real para objetos `curaUnPaso` (ver
/// `applySequentialHeals`, mismo mirror que usa el backend de verdad al confirmar — nunca se
/// calcula la vista previa de forma independiente). Una vez la vista previa llega a ILESO, no se
/// puede seguir añadiendo más objetos MÉDICOS (los de solo energía, como "Raciones de viaje", no
/// tienen tope: seguir cargando energía siempre tiene sentido).
export function HealSelectionModal({ inventory, condicionFisica, onConfirm, onCancel }: HealSelectionModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [selectionOrder, setSelectionOrder] = useState<string[]>([])

  const curativos = inventory.filter((i) => i.curaHasta || i.curaEnergia)
  const yaIleso = condicionFisica === 'ILESO'

  const previewCondicion = applySequentialHeals(
    condicionFisica,
    selectionOrder.flatMap((id) => {
      const item = curativos.find((i) => i.id === id)
      const qty = quantities[id] ?? 0
      if (!item?.curaHasta || qty <= 0) return []
      return Array.from({ length: qty }, () => ({ curaHasta: item.curaHasta!, curaUnPaso: !!item.curaUnPaso }))
    }),
  )
  const previewAtIleso = previewCondicion === 'ILESO'

  function setQuantity(id: string, next: number, max: number) {
    const clamped = Math.max(0, Math.min(next, max))
    setQuantities((prev) => ({ ...prev, [id]: clamped }))
    setSelectionOrder((prev) => {
      const had = (prev.includes(id) ? (quantities[id] ?? 0) : 0) > 0
      const has = clamped > 0
      if (has && !had) return [...prev, id]
      if (!has && had) return prev.filter((x) => x !== id)
      return prev
    })
  }

  function handleConfirmar() {
    if (selectionOrder.length === 0) return
    const healItemUses = selectionOrder.map((id) => ({ itemId: id, quantity: quantities[id] ?? 0 })).filter((u) => u.quantity > 0)
    if (healItemUses.length === 0) return
    onConfirm('Reviso mi inventario y me curo con lo que llevo encima.', healItemUses)
  }

  return (
    <SelectionModalShell
      title="Curar"
      onCancel={onCancel}
      footer={
        !yaIleso &&
        curativos.length > 0 && (
          <button onClick={handleConfirmar} disabled={selectionOrder.length === 0} className={confirmButtonClasses('accent')}>
            Curarme
          </button>
        )
      }
    >
      {/* Condición actual → vista previa en vivo (petición explícita, 2026-08-18) — las dos
          coloreadas con el mismo criterio (verde/ámbar/rojo), para ver de un vistazo a dónde
          llevaría lo ya marcado antes de confirmar nada. */}
      <div className="flex items-center gap-2 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2 text-xs">
        <span className={`font-semibold ${CONDICION_TEXT_COLOR[condicionFisica]}`}>{CONDICION_LABEL[condicionFisica]}</span>
        {selectionOrder.length > 0 && previewCondicion !== condicionFisica && (
          <>
            <span aria-hidden="true" className="text-wood-500">
              →
            </span>
            <span className={`font-semibold ${CONDICION_TEXT_COLOR[previewCondicion]}`}>{CONDICION_LABEL[previewCondicion]}</span>
          </>
        )}
      </div>

      {yaIleso ? (
        <p className="text-xs text-wood-500">Ya estás ileso — no hace falta usar nada más.</p>
      ) : curativos.length === 0 ? (
        <p className="text-xs text-wood-500">No llevas ningún objeto curativo encima.</p>
      ) : (
        <div className="space-y-1.5">
          {curativos.map((item) => {
            const max = quantityOf(item.name)
            const value = quantities[item.id] ?? 0
            // Tope solo para objetos MÉDICOS (curaHasta) una vez la vista previa llega a ILESO —
            // los de solo energía ("Raciones de viaje") no tienen techo, seguir cargando energía
            // siempre tiene sentido.
            const blockedByIleso = previewAtIleso && !!item.curaHasta
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs text-wood-300 transition-colors ${
                  value > 0 ? 'border-accent-600/60 bg-accent-500/10' : 'border-iron-700'
                }`}
              >
                <span className="min-w-0">
                  <span className="font-semibold text-wood-100">{baseNameOf(item.name)}</span>
                  <span className="ml-1.5 text-2xs text-wood-500">
                    {item.curaHasta &&
                      `— cura ${item.curaUnPaso ? 'un escalón, hasta ' : 'hasta '}${CONDICION_LABEL[item.curaHasta].toLowerCase()}`}
                    {item.curaEnergia ? ` · +${item.curaEnergia} energía` : ''}
                    {max > 1 ? ` · llevas ${max}` : ''}
                  </span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(item.id, value - 1, max)}
                    disabled={value <= 0}
                    className="tactile h-6 w-6 rounded border border-iron-700 text-wood-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-4 text-center font-mono text-wood-100">{value}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(item.id, value + 1, max)}
                    disabled={value >= max || blockedByIleso}
                    title={blockedByIleso ? 'Ya estarías ileso con lo marcado — no hace falta más' : undefined}
                    className="tactile h-6 w-6 rounded border border-iron-700 text-wood-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SelectionModalShell>
  )
}
