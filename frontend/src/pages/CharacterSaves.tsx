import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { pregeneratedCharacters, worlds } from '../data/mock'
import { useSession } from '../context/SessionContext'
import { Button } from '../components/Button'
import { StepDots } from '../components/StepDots'
import { listSaves, deleteSave, restartSave, type SaveSummary } from '../lib/api'

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
  const { selectedCharacter, setSelectedWorld, setSelectedCharacter } = useSession()

  const world = worlds.find((w) => w.id === worldId) ?? null
  const character =
    pregeneratedCharacters.find((c) => c.id === characterId) ??
    (selectedCharacter?.id === characterId ? selectedCharacter : null)

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
      await restartSave(saveId)
      setSaves((prev) =>
        prev.map((s) => (s.id === saveId ? { ...s, fictionalDate: 'Día 1, mañana', lastPlayedAt: new Date().toISOString() } : s)),
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
  }, [world, character])

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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
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
          saves.map((save) => (
            <div
              key={save.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/solitario/partida/${save.id}`)}
              className="plank-panel relative flex cursor-pointer items-center justify-between gap-4 rounded-xl px-5 py-4 text-left transition-[filter,border-color] hover:border-accent-600/40 hover:brightness-110"
            >
              <div>
                <p className="font-serif tracking-wide text-wood-100">
                  {save.characterName} <span className="font-sans text-sm text-wood-500">— {save.worldName}</span>
                </p>
                <p className="mt-1.5 inline-block rounded border border-iron-700 bg-wood-950/60 px-2 py-0.5 font-serif text-xs tracking-wide text-wood-300">
                  {save.fictionalDate}
                </p>
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

      <div className="flex justify-end">
        <Button onClick={() => navigate('/solitario/partida/nueva')}>+ Nueva partida</Button>
      </div>
    </div>
  )
}
