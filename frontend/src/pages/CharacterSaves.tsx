import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { pregeneratedCharacters, worlds } from '../data/mock'
import { useSession } from '../context/useSession'
import { Button } from '../components/Button'
import { StepDots } from '../components/StepDots'
import { listSaves, deleteSave, restartSave, type SaveSummary } from '../lib/api'
import type { Character, Dificultad } from '../types'

const DIFICULTAD_OPTIONS: { value: Dificultad; label: string; hint: string }[] = [
  { value: 'NOVATO', label: 'Novato', hint: 'Sin límite de muertes — la Entidad siempre responde.' },
  { value: 'MEDIO', label: 'Medio', hint: 'Hasta 4 muertes; la 3ª avisa, la 4ª acaba la partida.' },
  { value: 'AVANZADO', label: 'Avanzado', hint: 'Hasta 2 muertes; la 1ª avisa, la 2ª acaba la partida.' },
]

const DIFICULTAD_LABEL: Record<Dificultad, string> = { NOVATO: 'Novato', MEDIO: 'Medio', AVANZADO: 'Avanzado' }

// "18/7/2026, 0:26" se puede leer como "minuto 26" en vez de la hora real a la que se creó la
// partida — un relativo ("hace 3 min") es mucho más claro que una fecha/hora absoluta ambigua.
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'justo ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

export function CharacterSaves() {
  const navigate = useNavigate()
  const { worldId, characterId } = useParams()
  const [searchParams] = useSearchParams()
  const { selectedCharacter, setSelectedWorld, setSelectedCharacter, selectedDificultad, setSelectedDificultad } = useSession()

  const world = worlds.find((w) => w.id === worldId) ?? null
  // Bug real (2026-07-24, "al salir de la partida me lleva a seleccionar mundo"): las dos vías de
  // abajo dependen de `selectedCharacter` (SessionContext, en memoria — se pierde al recargar) o
  // de que `characterId` sea un id real de `pregeneratedCharacters`, pero el botón "Salir a tus
  // partidas" de GameView manda el `saveId`, no un id de personaje — así que tras recargar dentro
  // de la partida, ninguna de las dos resolvía nunca nada. `characterName` por query (que GameView
  // sí conoce siempre) es el último respaldo: no hace falta el personaje "real", este panel solo
  // lee `character.name` (para filtrar y mostrar), así que un carácter mínimo con ese nombre basta.
  const characterNameParam = searchParams.get('characterName')
  // Memoizado (bug real encontrado al revisar esto: sin `useMemo`, el objeto sintético de más
  // abajo era una referencia NUEVA en cada render — los dos efectos de debajo, que dependen de
  // `character`, se disparaban sin parar: `listSaves()` pidiéndose de nuevo en bucle).
  const character: Character | null = useMemo(
    () =>
      pregeneratedCharacters.find((c) => c.id === characterId) ??
      (selectedCharacter?.id === characterId ? selectedCharacter : null) ??
      (characterNameParam
        ? (pregeneratedCharacters.find((c) => c.name === characterNameParam) ?? {
            id: characterId ?? 'desconocido',
            name: characterNameParam,
            archetype: '',
            origin: '',
            motivation: '',
            attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 },
            isPregenerated: false,
            portraitInitial: characterNameParam.charAt(0).toUpperCase(),
          })
        : null),
    [characterId, selectedCharacter, characterNameParam],
  )

  const [saves, setSaves] = useState<SaveSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [restartingId, setRestartingId] = useState<string | null>(null)

  async function handleDelete(e: React.MouseEvent, saveId: string) {
    e.stopPropagation()
    if (!window.confirm('¿Borrar esta partida? No se puede deshacer.')) return
    setDeletingId(saveId)
    try {
      await deleteSave(saveId)
      setSaves((prev) => prev.filter((s) => s.id !== saveId))
    } catch {
      window.alert('No se pudo borrar. ¿Está el backend corriendo en localhost:3001?')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRestart(e: React.MouseEvent, saveId: string) {
    e.stopPropagation()
    if (!window.confirm('¿Reiniciar esta partida? Volverá a Día 1 y se perderá todo el progreso, pero seguirá en la lista.'))
      return
    setRestartingId(saveId)
    try {
      // Intro propia por personaje pregenerado (2026-07-28, paridad con la creación de partida
      // nueva) — este panel ya conoce el personaje de esta lista de partidas (`character`, de
      // data/mock.ts); si tiene intro propia, se manda para que el reinicio la use también, en
      // vez de caer siempre a la plantilla genérica del backend.
      await restartSave(saveId, { introCharacterText: character?.introCharacterText, introWorldText: character?.introWorldText })
      setSaves((prev) =>
        prev.map((s) =>
          s.id === saveId ? { ...s, fictionalDate: 'Día 1, mañana', lastPlayedAt: new Date().toISOString(), endedAt: null } : s,
        ),
      )
    } catch {
      window.alert('No se pudo reiniciar. ¿Está el backend corriendo en localhost:3001?')
    } finally {
      setRestartingId(null)
    }
  }

  useEffect(() => {
    if (world) setSelectedWorld(world)
    if (character) setSelectedCharacter(character)
  }, [world, character, setSelectedWorld, setSelectedCharacter])

  useEffect(() => {
    if (!world || !character) return
    let cancelled = false
    listSaves()
      .then((all) => {
        if (cancelled) return
        setSaves(all.filter((s) => s.worldId === world.id && s.characterName === character.name))
      })
      .catch(() => {
        if (!cancelled) setSaves([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [world, character])

  if (!world || !character) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-wood-400">Primero tienes que elegir mundo y personaje.</p>
        <Button onClick={() => navigate('/solitario')}>Elegir mundo</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <button
          onClick={() => navigate(`/solitario/mundo/${world.id}`)}
          className="mb-2 text-xs text-wood-500 transition-colors hover:text-accent-300"
        >
          ← Volver
        </button>
        <div className="flex items-center gap-3">
          <StepDots current={3} />
          <p className="text-xs tracking-[0.2em] text-accent-400 uppercase">
            Paso 3 de 3 — {world.name} · {character.name}
          </p>
        </div>
        <h1 className="mt-1.5 font-serif text-3xl text-wood-100">Sus partidas</h1>
      </div>

      <div className="flex flex-col gap-3">
        {!loading &&
          saves.map((save, i) => (
            <div
              key={save.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!save.endedAt) navigate(`/solitario/partida/${save.id}`)
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !save.endedAt) {
                  e.preventDefault()
                  navigate(`/solitario/partida/${save.id}`)
                }
              }}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`plank-panel animate-entry-in relative flex items-center justify-between gap-4 rounded-xl px-5 py-4 text-left transition-[filter,border-color] ${
                save.endedAt ? 'cursor-default opacity-70' : 'cursor-pointer hover:border-accent-600/40 hover:brightness-110'
              }`}
            >
              <div>
                <p className="font-serif tracking-wide text-wood-100">
                  {save.characterName} <span className="font-sans text-sm text-wood-500">— {save.worldName}</span>
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <p className="inline-block rounded border border-iron-700 bg-wood-950/60 px-2 py-0.5 font-serif text-xs tracking-wide text-wood-300">
                    {save.fictionalDate}
                  </p>
                  <p className="inline-block rounded border border-iron-700 bg-wood-950/60 px-2 py-0.5 text-2xs text-wood-400">
                    {DIFICULTAD_LABEL[save.dificultad]}
                  </p>
                  {save.endedAt && (
                    <p className="inline-block rounded border border-red-900/60 bg-red-500/10 px-2 py-0.5 text-2xs font-medium text-red-400">
                      Partida terminada
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-wood-500">{relativeTime(save.lastPlayedAt)}</span>
                <button
                  onClick={(e) => handleRestart(e, save.id)}
                  disabled={restartingId === save.id}
                  title="Reiniciar partida (vuelve a Día 1, sigue en la lista)"
                  className="rounded-lg border border-iron-700 bg-wood-950/50 px-2 py-1 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:opacity-50"
                >
                  {restartingId === save.id ? '...' : '↺ Reiniciar'}
                </button>
                <button
                  onClick={(e) => handleDelete(e, save.id)}
                  disabled={deletingId === save.id}
                  title="Borrar partida (desaparece de la lista)"
                  className="rounded-lg border border-red-900/60 bg-wood-950/50 px-2 py-1 text-xs text-red-400/80 transition-colors hover:border-red-700 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                >
                  {deletingId === save.id ? '...' : '🗑'}
                </button>
              </div>
            </div>
          ))}

        {loading && <p className="text-sm text-wood-500 italic">Cargando partidas...</p>}

        {!loading && saves.length === 0 && (
          <div className="rounded-xl border border-dashed border-iron-700 bg-wood-950/40 px-5 py-10 text-center text-sm text-wood-500">
            Todavía no hay partidas de {character.name} en {world.name}.
          </div>
        )}
      </div>

      <div className="plank-panel flex flex-col gap-3 rounded-xl p-4">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-wood-400">
          Dificultad para tu próxima partida nueva
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {DIFICULTAD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedDificultad(opt.value)}
              className={`rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                selectedDificultad === opt.value
                  ? 'border-accent2-500 bg-accent2-500/10'
                  : 'border-iron-700 bg-wood-950/40 hover:border-accent2-600/40'
              }`}
            >
              <p className="font-medium text-wood-100">{opt.label}</p>
              <p className="mt-1 leading-relaxed text-wood-400">{opt.hint}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => navigate('/solitario/partida/nueva')}>+ Nueva partida</Button>
      </div>
    </div>
  )
}
