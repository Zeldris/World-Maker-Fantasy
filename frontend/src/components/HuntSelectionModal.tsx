import { useEffect, useState } from 'react'
import type { HuntCandidate, NpcInSceneInfo } from '../types'
import { getCazarCandidatos, explorarCaza, confirmarCaza } from '../lib/api'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'
import { useAsyncModalData } from '../hooks/useAsyncModalData'

/// Refresco en vivo mientras el modal está abierto (2026-08-31, bug real "Cazar rechaza sin motivo
/// aparente" — el jugador no puede hacer nada más en paralelo con el composer bloqueado, pero la
/// población de la presa SÍ puede cambiar en segundo plano: crecimiento natural o muerte de la
/// misma especie en otra parte del mundo, `WorldPopulation` no está ligada a esta Location). Con
/// solo la carga inicial (`useAsyncModalData`), la lista mostrada podía quedar desfasada frente a lo
/// que `/cazar/confirmar` recalcula de cero al pulsar Cazar — el jugador veía la presa disponible,
/// el backend la rechazaba igual. Pedido explícito: "quiero que aparente ser dinámico".
const REFRESCO_CANDIDATOS_MS = 2000;

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
  const [exploring, setExploring] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [candidates, setCandidates] = useState<HuntCandidate[]>([])
  const [puedeExplorar, setPuedeExplorar] = useState(false)
  // Bug real jugando en vivo (2026-09-03): tras un "Explorar" sin resultado, `vacioReal` distingue
  // si la región está de verdad vacía (`true`, sin más reintentos posibles) o si solo falló la
  // tirada de avistamiento (`false`, invita a reintentar con el mismo botón).
  const [vacioReal, setVacioReal] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const { loading, error, setError } = useAsyncModalData(
    () => getCazarCandidatos(saveId),
    (res) => {
      setCandidates(res.candidates)
      setPuedeExplorar(res.puedeExplorar)
    },
    'No se pudo comprobar qué fauna hay en la zona.',
    [saveId],
  )

  // Refresco silencioso — nunca toca `loading`/`error` de la carga inicial, ni corre mientras se
  // está confirmando o si ya no hay nada que mostrar (evita reabrir "Explorar" solo bajo el pulso).
  useEffect(() => {
    if (confirming || candidates.length === 0) return
    const interval = setInterval(() => {
      getCazarCandidatos(saveId)
        .then((res) => {
          setCandidates(res.candidates)
          setSelected((prev) => {
            const stillSighted = new Set(res.candidates.map((c) => c.slug))
            const next = new Set([...prev].filter((slug) => stillSighted.has(slug)))
            return next.size === prev.size ? prev : next
          })
          setCantidades((prev) => {
            const next = { ...prev }
            for (const c of res.candidates) {
              if (next[c.slug] != null) next[c.slug] = Math.min(next[c.slug], c.avistados)
            }
            return next
          })
        })
        .catch(() => {
          // Silencioso a propósito — un refresco fallido no debe interrumpir al jugador leyendo el
          // modal; si el problema persiste, ya se verá al pulsar Cazar de verdad.
        })
    }, REFRESCO_CANDIDATOS_MS)
    return () => clearInterval(interval)
  }, [saveId, confirming, candidates.length])

  async function handleExplorar() {
    setExploring(true)
    setError(null)
    try {
      const res = await explorarCaza(saveId)
      setCandidates(res.candidates)
      setPuedeExplorar(false)
      setVacioReal(res.vacioReal)
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
    } catch (err) {
      // Bug real (2026-08-30, reportado jugando): este catch siempre mostraba el mismo texto
      // genérico ("puede que otra acción se haya adelantado"), aunque `fetchJson` ya propaga el
      // mensaje real del backend (p.ej. "Ya hay un combate en curso" o "Esa fauna ya no está
      // disponible aquí") — la causa real quedaba oculta tras un mensaje que siempre culpaba a una
      // condición de carrera, aunque el jugador no hubiera hecho nada más en paralelo.
      setError(err instanceof Error && err.message ? err.message : 'No se pudo cazar — puede que otra acción se haya adelantado.')
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
          <button type="button" onClick={handleConfirmar} disabled={confirming || selected.size === 0} className={confirmButtonClasses('accent')}>
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
        puedeExplorar || !vacioReal ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-xs text-wood-400">
              {puedeExplorar ? 'No has localizado ninguna presa todavía en esta zona.' : 'No se ha visto nada esta vez.'}
            </p>
            <button type="button"
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
