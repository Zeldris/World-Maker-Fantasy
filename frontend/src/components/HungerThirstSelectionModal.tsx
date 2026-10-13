import { useState } from 'react'
import type { InventoryItemInfo } from '../types'
import { applySequentialHunger, applySequentialThirst } from '../lib/hungerThirst'
import { quantityOf, baseNameOf } from '../lib/gameViewHelpers'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'
import { QuantityStepper } from './QuantityStepper'
import { Miniatura } from './Miniatura'
import { ACCION_BEBER_DE_LA_FUENTE } from '../lib/puntosDeAgua'

interface HungerThirstSelectionModalProps {
  inventory: InventoryItemInfo[]
  hambre: number
  sed: number
  /// Energía actual y máxima: con el hambre llena, lo que da energía solo se ofrece mientras falte
  /// energía (P121, `/code-review` del PR #53). Sin ellas, la energía no pone tope.
  energia?: number
  energiaMax?: number
  /// QA-27 P39: el personaje está en un punto de agua real y puede beber sin odre.
  enFuente?: boolean
  onConfirm: (actionText: string, hambreSedItemUses: { itemId: string; quantity: number }[]) => void
  onCancel: () => void
}

// Verde ≥50%, ámbar <50%, rojo <25% — mismo criterio de umbral que ResourceBar (EstadisticasPanel.tsx).
function pctTextColor(pct: number): string {
  if (pct < 25) return 'text-danger-400'
  if (pct < 50) return 'text-cost-400'
  return 'text-moss-400'
}

/// Pop-up de "Comer/Beber" (2026-09-04, mismo patrón exacto que HealSelectionModal.tsx) — dos
/// secciones separadas (Comida/Bebida), cada una con vista previa en vivo de cuánto subiría la
/// barra según lo marcado, bloqueando seguir añadiendo una vez llegaría al 100%. Ambas listan
/// items reales del inventario (`curaHambre`/`curaAgua`). El viejo botón fijo "Beber agua" (sin
/// item, repone Sed al 100% en cualquier sitio) se retiró con el hallazgo 13
/// (revisar-partida-hallazgos.md 2026-09-06, "el consumo de agua pasa a depender de un ítem
/// odre") — el Odre de agua (curtidor-orcos-llanuras, T1) se craftea vacío y se llena con
/// "recoger agua" solo en una zona con agua real; el odre LLENO (`curaAgua: 100`) es el que
/// aparece aquí como cualquier otra bebida.
export function HungerThirstSelectionModal({ inventory, hambre, sed, energia, energiaMax, enFuente = false, onConfirm, onCancel }: HungerThirstSelectionModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [selectionOrder, setSelectionOrder] = useState<string[]>([])
  const [confirmado, setConfirmado] = useState(false)

  const comestibles = inventory.filter((i) => i.curaHambre)
  const bebibles = inventory.filter((i) => i.curaAgua)
  const yaLleno = hambre >= 100
  const energiaLlena = energia !== undefined && energiaMax !== undefined && energia >= energiaMax
  // P121 (QA-27, decisión de la usuaria 2026-10-13): lo que da energía se puede comer aunque estés
  // saciado (antes la energía de una ración solo se sacaba desde Curar), mientras falte energía.
  const comestiblesVisibles = yaLleno
    ? energiaLlena ? [] : comestibles.filter((i) => (i.curaEnergia ?? 0) > 0)
    : comestibles
  const sedYaLlena = sed >= 100

  const gananciaHambre = selectionOrder.reduce((sum, id) => {
    const item = comestibles.find((i) => i.id === id)
    const qty = quantities[id] ?? 0
    return sum + (item?.curaHambre ?? 0) * qty
  }, 0)
  const previewHambre = applySequentialHunger(hambre, gananciaHambre)
  const previewHambreLlena = previewHambre >= 100
  const gananciaEnergia = selectionOrder.reduce((sum, id) => {
    const item = comestibles.find((i) => i.id === id)
    return sum + (item?.curaEnergia ?? 0) * (quantities[id] ?? 0)
  }, 0)
  const previewEnergiaLlena = energia !== undefined && energiaMax !== undefined && energia + gananciaEnergia >= energiaMax
  const gananciaSed = selectionOrder.reduce((sum, id) => {
    const item = bebibles.find((i) => i.id === id)
    const qty = quantities[id] ?? 0
    return sum + (item?.curaAgua ?? 0) * qty
  }, 0)
  const previewSed = applySequentialThirst(sed, gananciaSed)
  const previewSedLlena = previewSed >= 100

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
    if (confirmado) return
    const hambreSedItemUses = selectionOrder.map((id) => ({ itemId: id, quantity: quantities[id] ?? 0 })).filter((u) => u.quantity > 0)
    if (hambreSedItemUses.length === 0) return
    setConfirmado(true)
    onConfirm('Como y bebo algo antes de seguir.', hambreSedItemUses)
  }

  function handleBeberDeLaFuente() {
    if (confirmado) return
    setConfirmado(true)
    onConfirm(ACCION_BEBER_DE_LA_FUENTE, [])
  }

  const nadaQueHacer = comestibles.length === 0 && bebibles.length === 0
  const puedeConfirmar = selectionOrder.length > 0

  return (
    <SelectionModalShell
      title="Comer/Beber"
      onCancel={onCancel}
      cancelDisabled={confirmado}
      footer={
        !nadaQueHacer && (
          <button type="button" onClick={handleConfirmar} disabled={confirmado || !puedeConfirmar} className={confirmButtonClasses('accent')}>
            {confirmado ? 'Comiendo/bebiendo...' : 'Confirmar'}
          </button>
        )
      }
    >
      <div className="flex items-center gap-3 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true">🍖</span>
          <span className={`font-semibold ${pctTextColor(hambre)}`}>{Math.round(hambre)}%</span>
          {gananciaHambre > 0 && previewHambre !== hambre && (
            <>
              <span aria-hidden="true" className="text-wood-500">→</span>
              <span className={`font-semibold ${pctTextColor(previewHambre)}`}>{Math.round(previewHambre)}%</span>
            </>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true">💧</span>
          <span className={`font-semibold ${pctTextColor(sed)}`}>{Math.round(sed)}%</span>
          {gananciaSed > 0 && previewSed !== sed && (
            <>
              <span aria-hidden="true" className="text-wood-500">→</span>
              <span className={`font-semibold ${pctTextColor(previewSed)}`}>{Math.round(previewSed)}%</span>
            </>
          )}
        </span>
      </div>

      <div className="space-y-1.5">
        <h4 className="text-2xs font-bold uppercase tracking-wide text-wood-500">Comida</h4>
        {yaLleno && comestiblesVisibles.length > 0 && (
          <p className="text-xs text-wood-500">Ya estás saciado: solo comerías por la energía.</p>
        )}
        {yaLleno && comestiblesVisibles.length === 0 ? (
          <p className="text-xs text-wood-500">Ya estás saciado — no hace falta comer más.</p>
        ) : comestibles.length === 0 ? (
          <p className="text-xs text-wood-500">No llevas ningún alimento encima.</p>
        ) : (
          comestiblesVisibles.map((item) => {
            const max = quantityOf(item.name)
            const value = quantities[item.id] ?? 0
            // Lleno con lo marcado: no se añade más (lo ya marcado se puede bajar). Lo que da energía
            // sigue mientras falte energía.
            const blockedByLleno = previewHambreLlena && (!item.curaEnergia || previewEnergiaLlena)
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs text-wood-300 transition-colors ${
                  value > 0 ? 'border-accent-600/60 bg-accent-500/10' : 'border-iron-700'
                }`}
              >
                <Miniatura nombre={baseNameOf(item.name)} entityType="item" slug={item.catalogSlug ?? undefined} icono="🍖" />
                <span className="mr-auto min-w-0">
                  <span className="font-semibold text-wood-100">{baseNameOf(item.name)}</span>
                  <span className="ml-1.5 text-2xs text-wood-500">
                    {`+${item.curaHambre} hambre`}
                    {item.curaEnergia ? ` · +${item.curaEnergia} energía` : ''}
                    {max > 1 ? ` · llevas ${max}` : ''}
                  </span>
                </span>
                <QuantityStepper
                  value={value}
                  max={max}
                  tope={blockedByLleno ? value : max}
                  onChange={(n) => setQuantity(item.id, n, max)}
                  etiqueta={item.name}
                  motivoTope="Ya estarías saciado con lo marcado — no hace falta más"
                />
              </div>
            )
          })
        )}
      </div>

      <div className="space-y-1.5">
        <h4 className="text-2xs font-bold uppercase tracking-wide text-wood-500">Bebida</h4>
        {!sedYaLlena && enFuente && (
          <button
            type="button"
            onClick={handleBeberDeLaFuente}
            disabled={confirmado}
            className="flex w-full items-center gap-2 rounded-lg border border-iron-700 p-2.5 text-left text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:bg-accent-500/10 disabled:opacity-50"
          >
            <span aria-hidden="true">💧</span>
            <span className="mr-auto font-semibold text-wood-100">Beber de la fuente</span>
            <span className="text-2xs text-wood-500">hasta saciarte, sin odre</span>
          </button>
        )}
        {sedYaLlena ? (
          <p className="text-xs text-wood-500">Ya no tienes sed — no hace falta beber más.</p>
        ) : bebibles.length === 0 && enFuente ? null : bebibles.length === 0 ? (
          <p className="text-xs text-wood-500">No llevas nada que sacie la sed — necesitas un odre lleno u otra bebida.</p>
        ) : (
          bebibles.map((item) => {
            const max = quantityOf(item.name)
            const value = quantities[item.id] ?? 0
            const blockedByLlena = previewSedLlena
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs text-wood-300 transition-colors ${
                  value > 0 ? 'border-accent-600/60 bg-accent-500/10' : 'border-iron-700'
                }`}
              >
                <Miniatura nombre={baseNameOf(item.name)} entityType="item" slug={item.catalogSlug ?? undefined} icono="🍖" />
                <span className="mr-auto min-w-0">
                  <span className="font-semibold text-wood-100">{baseNameOf(item.name)}</span>
                  <span className="ml-1.5 text-2xs text-wood-500">
                    {`+${item.curaAgua} sed`}
                    {max > 1 ? ` · llevas ${max}` : ''}
                  </span>
                </span>
                <QuantityStepper
                  value={value}
                  max={max}
                  tope={blockedByLlena && value === 0 ? 0 : max}
                  onChange={(n) => setQuantity(item.id, n, max)}
                  etiqueta={item.name}
                  motivoTope="Ya no tendrías sed con lo marcado — no hace falta más"
                />
              </div>
            )
          })
        )}
      </div>
    </SelectionModalShell>
  )
}
