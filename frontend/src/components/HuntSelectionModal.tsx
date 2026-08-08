import { useEffect, useState } from 'react'
import type { HuntCandidate, NpcInSceneInfo } from '../types'
import { getCazarCandidatos, explorarCaza, confirmarCaza } from '../lib/api'

interface HuntSelectionModalProps {
  saveId: string
  onResuelto: (
    result:
      | {
          resuelveSinCombate: true
          combate: { npcs: NpcInSceneInfo[] }
          logEntry: { id: string; text: string; timeLabel: string; createdAt: string }
        }
      | { resuelveSinCombate: false; actionText: string },
  ) => void
  onCancel: () => void
}

/// Pop-up de la habilidad "Cazar" (revisión de partida 2026-08-08, mismo patrón en dos pasos que
/// HarvestSelectionModal — "ya localizado" vs "Explorar" — a raíz de "podría cazar cualquier presa
/// en cualquier zona... que no sea el listado completo, puede darse que no encuentres nada, como
/// los objetos"). Checkboxes simples, sin cantidad — no hay stock por especie que repartir (ver
/// comentario de cazar.ts sobre el límite de una presa por especie a la vez), y `avistados` es una
/// cifra realista para esta visita, nunca la población mundial real.
export function HuntSelectionModal({ saveId, onResuelto, onCancel }: HuntSelectionModalProps) {
  const [loading, setLoading] = useState(true)
  const [exploring, setExploring] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [candidates, setCandidates] = useState<HuntCandidate[]>([])
  const [puedeExplorar, setPuedeExplorar] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCazarCandidatos(saveId)
      .then((res) => {
        setCandidates(res.candidates)
        setPuedeExplorar(res.puedeExplorar)
      })
      .catch(() => setError('No se pudo comprobar qué fauna hay en la zona.'))
      .finally(() => setLoading(false))
  }, [saveId])

  async function handleExplorar() {
    setExploring(true)
    setError(null)
    try {
      const res = await explorarCaza(saveId)
      setCandidates(res.candidates)
      setPuedeExplorar(false)
    } catch {
      setError('No se pudo explorar la zona.')
    } finally {
      setExploring(false)
    }
  }

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const cazaLimpiaDisponible = selected.size === 1 && candidates.find((c) => c.slug === [...selected][0])?.debil

  async function handleConfirmar() {
    if (selected.size === 0) return
    setConfirming(true)
    setError(null)
    try {
      const res = await confirmarCaza(saveId, [...selected])
      onResuelto(res)
    } catch {
      setError('No se pudo cazar — puede que otra acción se haya adelantado.')
      setConfirming(false)
    }
  }

  return (
    <div className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onCancel}>
      <div
        className="plank-panel animate-combat-enter relative flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg text-wood-100">Cazar</h3>

        {loading ? (
          <p className="text-xs text-wood-500">Buscando fauna en la zona...</p>
        ) : error && candidates.length === 0 ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : candidates.length === 0 ? (
          puedeExplorar ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-xs text-wood-400">No has localizado ninguna presa todavía en esta zona.</p>
              <button
                onClick={handleExplorar}
                disabled={exploring}
                className="tactile rounded-lg border border-accent-600/60 px-3 py-1.5 text-xs text-accent-300 transition-colors hover:bg-accent-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exploring ? 'Explorando...' : '🔍 Explorar'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-wood-500">No hay fauna real en esta región ahora mismo.</p>
          )
        ) : (
          <div className="space-y-1.5">
            {candidates.map((c) => (
              <label
                key={c.slug}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-iron-700 bg-wood-950/40 p-2.5 text-xs text-wood-300"
              >
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={selected.has(c.slug)} onChange={() => toggle(c.slug)} className="accent-accent-500" />
                  {c.name} <span className="text-wood-500">×{c.avistados}</span>
                </span>
                {c.debil && <span className="text-2xs uppercase tracking-wide text-accent-400">presa débil</span>}
              </label>
            ))}
          </div>
        )}

        {candidates.length > 0 && (
          <p className="text-2xs text-wood-500">
            {selected.size === 0
              ? 'Elige una o varias presas.'
              : cazaLimpiaDisponible
                ? 'Presa débil y sola — puede caer sin pelear, según tu destreza.'
                : 'Combate obligatorio contra todas las seleccionadas.'}
          </p>
        )}
        {error && candidates.length > 0 && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="tactile flex-1 rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          {candidates.length > 0 && (
            <button
              onClick={handleConfirmar}
              disabled={confirming || selected.size === 0}
              className="tactile flex-1 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 transition-colors disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
            >
              {confirming ? 'Cazando...' : 'Cazar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
