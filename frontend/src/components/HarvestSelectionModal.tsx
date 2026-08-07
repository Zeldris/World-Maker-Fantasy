import { useEffect, useState } from 'react'
import type { HarvestSourceCandidate, InventoryItemInfo } from '../types'
import { getRecolectarLocalizado, explorarRecolectar, confirmarRecoleccion } from '../lib/api'

interface HarvestSelectionModalProps {
  saveId: string
  oficio: string
  oficioLabel: string
  inventoryUsed: number
  inventoryCapacity: number
  onConfirm: (created: InventoryItemInfo[]) => void
  onCancel: () => void
}

type SelectionKey = string // `${sourceSlug}:${itemSlug}`

/// Pop-up de recolección (rediseño de profesiones, 2026-08-07, mismo patrón que
/// CombatSelectionModal pero con cantidades en vez de checkboxes simples): al abrirse, busca qué
/// hay YA LOCALIZADO en la zona (GET); si no hay nada, ofrece "Explorar" (determinista, sin
/// gastar turno). Aceptar manda cantidades PARCIALES elegidas, nunca todo-o-nada — topadas tanto
/// por lo que de verdad queda (`disponible`/`cantidadMaxima`) como por el espacio libre real de
/// inventario (Parte D).
export function HarvestSelectionModal({ saveId, oficio, oficioLabel, inventoryUsed, inventoryCapacity, onConfirm, onCancel }: HarvestSelectionModalProps) {
  const [loading, setLoading] = useState(true)
  const [exploring, setExploring] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [sources, setSources] = useState<HarvestSourceCandidate[]>([])
  const [puedeExplorar, setPuedeExplorar] = useState(false)
  const [selections, setSelections] = useState<Record<SelectionKey, number>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRecolectarLocalizado(saveId, oficio)
      .then((res) => {
        setSources(res.sources)
        setPuedeExplorar(res.puedeExplorar)
      })
      .catch(() => setError('No se pudo comprobar qué hay en la zona.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveId, oficio])

  async function handleExplorar() {
    setExploring(true)
    setError(null)
    try {
      const res = await explorarRecolectar(saveId, oficio)
      setSources(res.sources)
      setPuedeExplorar(false)
    } catch {
      setError('No se pudo explorar la zona.')
    } finally {
      setExploring(false)
    }
  }

  const totalSeleccionado = Object.values(selections).reduce((sum, n) => sum + n, 0)
  const espacioLibre = Math.max(0, inventoryCapacity - inventoryUsed)

  function setQuantity(key: SelectionKey, value: number, max: number) {
    const clamped = Math.max(0, Math.min(value, max, espacioLibre - (totalSeleccionado - (selections[key] ?? 0))))
    setSelections((prev) => ({ ...prev, [key]: clamped }))
  }

  async function handleConfirmar() {
    const selectionList = Object.entries(selections)
      .filter(([, cantidad]) => cantidad > 0)
      .map(([key, cantidad]) => {
        const [sourceSlug, itemSlug] = key.split(':')
        return { sourceSlug, itemSlug, cantidad }
      })
    if (selectionList.length === 0) return
    setConfirming(true)
    setError(null)
    try {
      const res = await confirmarRecoleccion(saveId, selectionList)
      onConfirm(res.items)
    } catch {
      setError('No se pudo recolectar — puede que otra acción se haya adelantado.')
      setConfirming(false)
    }
  }

  return (
    <div className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onCancel}>
      <div
        className="plank-panel animate-combat-enter relative flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg text-wood-100">{oficioLabel}</h3>

        {loading ? (
          <p className="text-xs text-wood-500">Buscando qué hay en la zona...</p>
        ) : error && sources.length === 0 ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : sources.length === 0 ? (
          puedeExplorar ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-xs text-wood-400">No has localizado nada todavía en esta zona.</p>
              <button
                onClick={handleExplorar}
                disabled={exploring}
                className="tactile rounded-lg border border-accent-600/60 px-3 py-1.5 text-xs text-accent-300 transition-colors hover:bg-accent-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exploring ? 'Explorando...' : '🔍 Explorar'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-wood-500">No hay nada recolectable con este oficio en esta región ahora mismo.</p>
          )
        ) : (
          <div className="space-y-3">
            {sources.map((source) => (
              <div key={source.sourceSlug} className="rounded-lg border border-iron-700 bg-wood-950/40 p-3">
                <p className="mb-1.5 text-sm font-medium text-wood-100">{source.sourceName}</p>
                <div className="space-y-1.5">
                  {source.yields.map((y) => {
                    const key = `${source.sourceSlug}:${y.itemSlug}`
                    const max = Math.min(y.cantidadMaxima, source.disponible)
                    const value = selections[key] ?? 0
                    return (
                      <div key={key} className="flex items-center justify-between gap-2 text-xs text-wood-300">
                        <span className="min-w-0 truncate">{y.itemName}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => setQuantity(key, value - 1, max)}
                            disabled={value <= 0}
                            className="tactile flex h-6 w-6 items-center justify-center rounded border border-iron-700 text-wood-300 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="w-10 text-center font-mono tabular-nums">
                            {value}/{max}
                          </span>
                          <button
                            onClick={() => setQuantity(key, value + 1, max)}
                            disabled={value >= max || espacioLibre - totalSeleccionado <= 0}
                            className="tactile flex h-6 w-6 items-center justify-center rounded border border-iron-700 text-wood-300 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {sources.length > 0 && (
          <p className="text-2xs text-wood-500">
            Vas a añadir {totalSeleccionado} objeto{totalSeleccionado === 1 ? '' : 's'} — inventario {inventoryUsed + totalSeleccionado}/{inventoryCapacity}
          </p>
        )}
        {error && sources.length > 0 && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="tactile flex-1 rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          {sources.length > 0 && (
            <button
              onClick={handleConfirmar}
              disabled={confirming || totalSeleccionado === 0}
              className="tactile flex-1 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 transition-colors disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
            >
              {confirming ? 'Recolectando...' : 'Aceptar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
