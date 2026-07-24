import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PanelRivets } from '../components/Rivet'
import { listSaves, type SaveSummary } from '../lib/api'

export function Home() {
  const navigate = useNavigate()
  const [lastSave, setLastSave] = useState<SaveSummary | null>(null)

  useEffect(() => {
    listSaves()
      .then((saves) => setLastSave(saves[0] ?? null))
      .catch(() => setLastSave(null))
  }, [])

  return (
    <div className="crystal-sky flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 flex w-56 items-center gap-3 sm:w-72">
          <span className="accent-hairline flex-1" />
          <span className="gem" />
          <span className="accent-hairline flex-1" />
        </div>
        <p className="mb-2 text-xs tracking-[0.3em] text-accent-400 uppercase">Tarkor</p>
        <h1 className="font-serif text-4xl text-wood-100 sm:text-5xl">¿Cómo quieres jugar?</h1>
        <div className="mt-4 flex w-56 items-center gap-3 sm:w-72">
          <span className="accent-hairline flex-1" />
          <span className="gem" />
          <span className="accent-hairline flex-1" />
        </div>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
        <button
          onClick={() => navigate('/solitario')}
          className="plank-panel group relative flex flex-col items-start gap-3 rounded-xl p-7 text-left transition-[filter,border-color,box-shadow] hover:border-accent-600/50 hover:brightness-110 hover:shadow-[0_0_26px_-10px_var(--color-accent-500),0_8px_24px_-12px_rgba(0,0,0,0.7)]"
        >
          <PanelRivets />
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-iron-700 bg-iron-800 text-2xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
            ⚔️
          </span>
          <h2 className="font-serif text-2xl tracking-wide text-wood-100 transition-colors group-hover:text-accent-300">
            En solitario
          </h2>
          <p className="text-sm leading-relaxed text-wood-400">
            Tus partidas guardadas. Un mundo dirigido por la IA, un personaje, tu historia.
          </p>
        </button>

        <button
          onClick={() => navigate('/multijugador')}
          className="plank-panel group relative flex flex-col items-start gap-3 rounded-xl p-7 text-left transition-[filter,border-color,box-shadow] hover:border-moss-600/50 hover:brightness-110 hover:shadow-[0_0_26px_-10px_var(--color-moss-500),0_8px_24px_-12px_rgba(0,0,0,0.7)]"
        >
          <PanelRivets />
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-iron-700 bg-iron-800 text-2xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
            🛡️
          </span>
          <h2 className="font-serif text-2xl tracking-wide text-wood-100 transition-colors group-hover:text-moss-400">
            Multijugador
          </h2>
          <p className="text-sm leading-relaxed text-wood-400">
            Salas que has creado o en las que participas, junto a otros jugadores.
          </p>
        </button>
      </div>

      {lastSave && (
        <button
          onClick={() => navigate(`/solitario/partida/${lastSave.id}`)}
          className="animate-entry-in group flex items-center gap-2.5 rounded-full border border-iron-700 bg-wood-900/60 px-4 py-2 text-sm text-wood-300 transition-colors hover:border-accent-600/60 hover:bg-accent-500/10 hover:text-accent-300"
        >
          <span className="gem" />
          Continuar como {lastSave.characterName} — {lastSave.worldName} ({lastSave.fictionalDate})
        </button>
      )}
    </div>
  )
}
