import { useState } from 'react'
import type { HarvestSourceCandidate, InventoryItemInfo, GatheringRollInfo } from '../types'
import { getRecolectarLocalizado, explorarRecolectar, confirmarRecoleccion } from '../lib/api'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'
import { useAsyncModalData } from '../hooks/useAsyncModalData'
import { GatheringDiceReveal } from './GatheringDiceReveal'

interface HarvestSelectionModalProps {
  saveId: string
  oficio: string
  oficioLabel: string
  inventoryUsed: number
  inventoryCapacity: number
  onConfirm: (created: InventoryItemInfo[], updated: { id: string; name: string }[], logEntry: { id: string; text: string; timeLabel: string; createdAt: string } | null) => void
  onCancel: () => void
}

type SelectionKey = string // `${sourceSlug}:${itemSlug}`

/// Cadencia del listado apareciendo de uno en uno TRAS aterrizar el dado (bug real jugando en
/// vivo, 2026-08-22: "antes de incluso acabar el roll ya me está mostrando todo" — petición
/// explícita: "los items tienen que ir apareciendo como una transacción una vez acabe la
/// tirada... de uno en uno"). Solo aplica cuando de verdad hubo un roll que esperar — el listado
/// ya localizado (sin "Explorar" de por medio) se sigue viendo instantáneo, como siempre.
const REVEAL_STAGGER_MS = 150

/// Sensación de proceso al confirmar (petición explícita, 2026-08-22: "igual que el crafteo, la
/// recolección... no debería tener también una espera... para dar la impresión de estar
/// procesándolo") — a diferencia del crafteo (`CharacterTransit`/`busyUntil`, espera real que
/// bloquea el composer entero), aquí es puramente cosmético: la transacción real del backend sigue
/// resolviéndose al instante, sin tocar nada de mecánica ni reabrir ninguna ventana de condición de
/// carrera — solo se alarga el estado visual "Recolectando..." un mínimo fijo (`Promise.all` con
/// la petición real, nunca un `setTimeout` extra si la red ya tarda más que esto).
const MIN_CONFIRM_DISPLAY_MS = 1200

/// Pop-up de recolección (rediseño de profesiones, 2026-08-07, mismo patrón que
/// CombatSelectionModal pero con cantidades en vez de checkboxes simples): al abrirse, busca qué
/// hay YA LOCALIZADO en la zona (GET); si no hay nada, ofrece "Explorar" (determinista, sin
/// gastar turno). Aceptar manda cantidades PARCIALES elegidas, nunca todo-o-nada — topadas tanto
/// por lo que de verdad queda (`disponible`/`cantidadMaxima`) como por el espacio libre real de
/// inventario (Parte D).
export function HarvestSelectionModal({ saveId, oficio, oficioLabel, inventoryUsed, inventoryCapacity, onConfirm, onCancel }: HarvestSelectionModalProps) {
  const [exploring, setExploring] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [sources, setSources] = useState<HarvestSourceCandidate[]>([])
  const [puedeExplorar, setPuedeExplorar] = useState(false)
  // Cooldown real por fuente (bug real jugando en vivo, 2026-08-07: "puedo minar indefinidamente
  // sin moverme de la zona") — distingue "no hay nada aquí" de "lo que hay está agotado por
  // ahora", para no invitar a "Explorar" algo que ya se sabe que sigue en cooldown.
  const [enCooldown, setEnCooldown] = useState(false)
  // Tirada visible (rediseño de recolección, 2026-08-22) — para desollador viene ya en el GET
  // (no hay "Explorar" propio, ver comentario de api.ts); para el resto solo llega tras pulsar
  // "Explorar". `undefined` distingue "todavía no se ha tirado nada" de una tirada real que se
  // quedó corta (sources vacío CON roll = mala suerte, sin roll = de verdad no hay nada aquí).
  const [roll, setRoll] = useState<GatheringRollInfo | undefined>(undefined)
  // Gatea el listado/mensaje de resultado hasta que el dado de verdad aterriza (ver
  // REVEAL_STAGGER_MS arriba) — `true` de entrada cuando no hay ningún roll que animar (localizado
  // sin pasar por "Explorar"), `false` mientras haya uno en curso.
  const [revealed, setRevealed] = useState(true)
  const [selections, setSelections] = useState<Record<SelectionKey, number>>({})
  const { loading, error, setError } = useAsyncModalData(
    () => getRecolectarLocalizado(saveId, oficio),
    (res) => {
      setSources(res.sources)
      setPuedeExplorar(res.puedeExplorar)
      setEnCooldown(!!res.enCooldown)
      setRoll(res.roll)
      setRevealed(!res.roll)
    },
    'No se pudo comprobar qué hay en la zona.',
    [saveId, oficio],
  )

  async function handleExplorar() {
    setExploring(true)
    setError(null)
    try {
      const res = await explorarRecolectar(saveId, oficio)
      setSources(res.sources)
      setPuedeExplorar(false)
      setEnCooldown(!!res.enCooldown)
      setRoll(res.roll)
      setRevealed(!res.roll)
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
      const [res] = await Promise.all([confirmarRecoleccion(saveId, selectionList), new Promise((resolve) => setTimeout(resolve, MIN_CONFIRM_DISPLAY_MS))])
      onConfirm(res.items, res.updatedItems, res.logEntry)
    } catch {
      setError('No se pudo recolectar — puede que otra acción se haya adelantado.')
      setConfirming(false)
    }
  }

  return (
    <SelectionModalShell
      title={oficioLabel}
      onCancel={onCancel}
      cancelDisabled={confirming}
      footer={
        sources.length > 0 &&
        revealed && (
          <button onClick={handleConfirmar} disabled={confirming || totalSeleccionado === 0} className={confirmButtonClasses('accent')}>
            {confirming ? 'Recolectando...' : 'Aceptar'}
          </button>
        )
      }
    >
      {loading ? (
        <p className="text-xs text-wood-500">Buscando qué hay en la zona...</p>
      ) : error && sources.length === 0 ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : sources.length === 0 ? (
        enCooldown ? (
          <p className="text-xs text-wood-400">Ya has agotado lo accesible por ahora — vuelve más tarde o busca en otra zona.</p>
        ) : roll ? (
          // Roll real que se quedó corto para TODO lo candidato (rediseño de recolección,
          // 2026-08-22) — distinto de "no hay nada aquí": el dado se anima igual, solo que esta
          // vez ningún recurso superó su dificultad. El mensaje espera a `revealed` igual que el
          // listado de abajo — verlo antes de que el dado aterrice spoilearía el resultado.
          <div className="flex flex-col items-center gap-2">
            {revealed && <p className="text-xs text-wood-400">La tirada no fue suficiente — no encuentras nada esta vez.</p>}
            <GatheringDiceReveal roll={roll} oficioLabel={oficioLabel} onLanded={() => setRevealed(true)} />
          </div>
        ) : puedeExplorar ? (
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
        (() => {
          // Índice corrido por TODOS los yields de TODAS las categorías (no por categoría) — el
          // orden de aparición es el mismo en el que ya se pintan, uno tras otro sin resetear el
          // contador entre tarjetas.
          let revealIndex = 0
          return (
            <div className="space-y-3">
              {roll && <GatheringDiceReveal roll={roll} oficioLabel={oficioLabel} onLanded={() => setRevealed(true)} />}
              {revealed &&
                sources.map((source) => (
                  <div key={source.sourceCategoryName} className="rounded-lg border border-iron-700 bg-wood-950/40 p-3">
                    <p className="mb-1.5 text-sm font-medium text-wood-100">{source.sourceCategoryName}</p>
                    <div className="space-y-1.5">
                      {source.yields.map((y) => {
                        // `y.sourceSlug`/`y.disponible`, NUNCA `source.*` (bug real, 2026-08-20: "0/NaN"
                        // en el modal, y una segunda rotura más grave detrás — la clave de selección
                        // usaba `source.sourceSlug`, inexistente desde el agrupado por categoría de
                        // 2026-08-15, así que al confirmar se mandaba `sourceSlug: "undefined"` al
                        // backend. Una tarjeta de categoría agrupa yields de VARIAS fuentes distintas —
                        // cada una lleva su propio `sourceSlug`/`disponible`, nunca uno compartido.
                        const key = `${y.sourceSlug}:${y.itemSlug}`
                        const max = Math.min(y.cantidadMaxima, y.disponible)
                        const value = selections[key] ?? 0
                        // Aparece de uno en uno tras la tirada (petición explícita, 2026-08-22) —
                        // `animate-entry-in` con `fill-mode: both` mantiene el ítem invisible hasta
                        // que le toca su turno, sin timers propios por fila. Sin roll (localizado
                        // sin explorar) no hay nada que escalonar: delay 0, aparece instantáneo
                        // como siempre.
                        const delayMs = roll ? revealIndex * REVEAL_STAGGER_MS : 0
                        revealIndex += 1
                        return (
                          <div
                            key={key}
                            style={roll ? { animationDelay: `${delayMs}ms` } : undefined}
                            className={`flex items-center justify-between gap-2 text-xs text-wood-300 ${roll ? 'animate-entry-in' : ''}`}
                          >
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
          )
        })()
      )}

      {sources.length > 0 && revealed && (
        <p className="text-2xs text-wood-500">
          Vas a añadir {totalSeleccionado} objeto{totalSeleccionado === 1 ? '' : 's'} — inventario {inventoryUsed + totalSeleccionado}/{inventoryCapacity}
        </p>
      )}
      {error && sources.length > 0 && <p className="text-xs text-red-400">{error}</p>}
    </SelectionModalShell>
  )
}
