import { useEffect, useState } from 'react'
import type { HuntCandidate, NpcInSceneInfo } from '../types'
import { getCazarCandidatos, explorarCaza, confirmarCaza } from '../lib/api'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'

/// Color de fondo por dificultad (petición explícita, 2026-08-14: "verde, amarillo o rojo según su
/// dificultad") — mismos 3 tokens semánticos que ya usa el resto del juego para lo mismo (moss=
/// éxito/fácil, quest=amarillo, danger=fallo/peligro), nunca colores nuevos sueltos. `dificultad`
/// viene ya calculada por `difficultyHintFor` (backend/src/services/npcScene.ts) — Fácil(12)→verde,
/// Media(15)→amarillo, Difícil(18)/Muy difícil(22)→rojo.
function difficultyRowClasses(dificultad: number): string {
  if (dificultad <= 12) return 'border-moss-600/40 bg-moss-500/10'
  if (dificultad <= 15) return 'border-quest-600/40 bg-quest-500/10'
  return 'border-danger-600/40 bg-danger-500/10'
}

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
/// los objetos"). `avistados` es una cifra realista para esta visita, nunca la población mundial
/// real.
///
/// Caza en grupo (2026-08-13, petición explícita: "el jugador primero debe marcar contra cuantos
/// quiere combatir") — con `avistados > 1`, un selector +/- deja elegir cuántos comprometer al
/// combate (tope real: `avistados`); el backend tira un dado sobre esto y PUEDE devolver algo
/// distinto (menos o más), nunca es un número garantizado — se avisa aquí mismo para que no
/// sorprenda.
export function HuntSelectionModal({ saveId, onResuelto, onCancel }: HuntSelectionModalProps) {
  const [loading, setLoading] = useState(true)
  const [exploring, setExploring] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [candidates, setCandidates] = useState<HuntCandidate[]>([])
  const [puedeExplorar, setPuedeExplorar] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
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
      if (next.has(slug)) {
        next.delete(slug)
      } else {
        next.add(slug)
        // Por defecto, comprometer a TODOS los avistados — la jugadora puede bajarlo con el
        // selector +/- si prefiere arriesgar menos.
        const avistados = candidates.find((c) => c.slug === slug)?.avistados ?? 1
        setCantidades((prevCantidades) => ({ ...prevCantidades, [slug]: avistados }))
      }
      return next
    })
  }

  function setCantidad(slug: string, avistados: number, delta: number) {
    setCantidades((prev) => ({ ...prev, [slug]: Math.max(1, Math.min(avistados, (prev[slug] ?? avistados) + delta)) }))
  }

  const cazaLimpiaDisponible = selected.size === 1 && candidates.find((c) => c.slug === [...selected][0])?.debil

  async function handleConfirmar() {
    if (selected.size === 0) return
    setConfirming(true)
    setError(null)
    try {
      const res = await confirmarCaza(saveId, [...selected], cantidades)
      onResuelto(res)
    } catch {
      setError('No se pudo cazar — puede que otra acción se haya adelantado.')
      setConfirming(false)
    }
  }

  return (
    <SelectionModalShell
      title="Cazar"
      onCancel={onCancel}
      cancelDisabled={confirming}
      footer={
        candidates.length > 0 && (
          <button onClick={handleConfirmar} disabled={confirming || selected.size === 0} className={confirmButtonClasses('accent')}>
            {confirming ? 'Cazando...' : 'Cazar'}
          </button>
        )
      }
    >
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
            <div
              key={c.slug}
              title={`Dificultad: ${c.dificultadLabel}`}
              className={`rounded-lg border p-2.5 text-xs text-wood-300 ${difficultyRowClasses(c.dificultad)}`}
            >
              <label className="flex cursor-pointer items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={selected.has(c.slug)} onChange={() => toggle(c.slug)} className="accent-accent-500" />
                  {c.name} <span className="text-wood-500">×{c.avistados}</span>
                </span>
                {c.debil && <span className="text-2xs uppercase tracking-wide text-accent-400">presa débil</span>}
              </label>
              {selected.has(c.slug) && c.avistados > 1 && (
                <div className="mt-2 flex items-center justify-between gap-2 pl-6">
                  <span className="text-2xs text-wood-500">Combatir contra:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCantidad(c.slug, c.avistados, -1)}
                      disabled={(cantidades[c.slug] ?? c.avistados) <= 1}
                      className="tactile h-6 w-6 rounded border border-iron-700 text-wood-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-4 text-center font-mono text-wood-100">{cantidades[c.slug] ?? c.avistados}</span>
                    <button
                      type="button"
                      onClick={() => setCantidad(c.slug, c.avistados, 1)}
                      disabled={(cantidades[c.slug] ?? c.avistados) >= c.avistados}
                      className="tactile h-6 w-6 rounded border border-iron-700 text-wood-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {candidates.length > 0 && (
        <p className="text-2xs text-wood-500">
          {selected.size === 0
            ? 'Elige una o varias presas.'
            : cazaLimpiaDisponible
              ? 'Presa débil y sola — puede caer sin pelear, según tu destreza.'
              : 'Combate obligatorio contra todas las seleccionadas — con varios avistados, puede que se comprometan menos o más de los que marques.'}
        </p>
      )}
      {error && candidates.length > 0 && <p className="text-xs text-red-400">{error}</p>}
    </SelectionModalShell>
  )
}
