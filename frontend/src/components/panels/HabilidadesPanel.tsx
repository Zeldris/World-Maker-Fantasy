import { useState } from 'react'
import type { SavedActionCategory, SavedActionInfo } from '../../types'

interface HabilidadesPanelProps {
  savedActions: SavedActionInfo[]
  combatSlots: number
  onUse: (ability: SavedActionInfo) => void
  onCreate: (params: { name: string; promptText: string; icon: string; description: string; category: SavedActionCategory }) => Promise<void>
  onDelete: (id: string) => void
}

const ICON_OPTIONS = ['✨', '⚔️', '🛡️', '🏹', '🔥', '❄️', '🌿', '👁️', '💨', '🩹', '🐺', '🗿', '🎯', '🧭']

export function HabilidadesPanel({ savedActions, combatSlots, onUse, onCreate, onDelete }: HabilidadesPanelProps) {
  const [tab, setTab] = useState<SavedActionCategory>('combate')
  const [name, setName] = useState('')
  const [promptText, setPromptText] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState(ICON_OPTIONS[0])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const inTab = savedActions.filter((a) => a.category === tab)
  const combatUsed = savedActions.filter((a) => a.category === 'combate' && !a.isStarting).length
  const combatFull = combatUsed >= combatSlots

  async function handleCreate() {
    if (!name.trim() || !promptText.trim()) return
    if (tab === 'combate' && combatFull) return
    setCreating(true)
    setError(null)
    try {
      await onCreate({ name: name.trim(), promptText: promptText.trim(), icon, description: description.trim(), category: tab })
      setName('')
      setPromptText('')
      setDescription('')
      setIcon(ICON_OPTIONS[0])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la habilidad')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 border-b border-iron-700">
        <button
          onClick={() => setTab('combate')}
          className={`border-b-2 px-3 py-2 text-sm transition-colors ${
            tab === 'combate' ? 'border-accent-500 font-medium text-accent-300' : 'border-transparent text-wood-400 hover:text-wood-200'
          }`}
        >
          Combate
        </button>
        <button
          onClick={() => setTab('general')}
          className={`border-b-2 px-3 py-2 text-sm transition-colors ${
            tab === 'general' ? 'border-accent-500 font-medium text-accent-300' : 'border-transparent text-wood-400 hover:text-wood-200'
          }`}
        >
          Generales
        </button>
      </div>

      <p className="text-[11px] text-wood-500">
        {tab === 'combate' ? `Huecos usados: ${combatUsed} / ${combatSlots} (crecen con el nivel)` : 'Sin límite de huecos.'}
      </p>

      {inTab.length === 0 ? (
        <p className="text-sm text-wood-500 italic">Todavía no hay habilidades aquí.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {inTab.map((a) => (
            <div key={a.id} className="group relative">
              <button
                onClick={() => onUse(a)}
                title={a.description}
                className="flex w-full flex-col items-center gap-1 rounded-lg border border-iron-700 bg-wood-950/40 px-2 py-3 text-center transition-colors hover:border-accent-600/60 hover:bg-accent-500/10"
              >
                <span className="text-2xl leading-none">{a.icon}</span>
                <span className="text-[11px] leading-tight text-wood-200">{a.name}</span>
              </button>
              <button
                onClick={() => onDelete(a.id)}
                aria-label={`Borrar ${a.name}`}
                className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full border border-red-900/60 bg-wood-950 text-[10px] text-red-400/80 hover:border-red-700 hover:text-red-400 group-hover:flex"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wood-400">
            Guardar nueva ({tab === 'combate' ? 'combate' : 'general'})
          </p>
          <span className="h-px flex-1 bg-iron-700" />
        </div>
        {tab === 'combate' && combatFull ? (
          <p className="text-xs text-wood-500 italic">No quedan huecos de combate en este nivel. Sube de nivel para desbloquear más.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setIcon(opt)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-base transition-colors ${
                    icon === opt ? 'border-accent-500 bg-accent-500/15' : 'border-iron-700 bg-wood-950/40 hover:border-accent-600/40'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la habilidad"
              className="rounded-lg border border-iron-700 bg-wood-950/60 px-3 py-2 text-sm text-wood-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition-colors placeholder:text-wood-600 focus:border-accent-500"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción corta (para el tooltip)"
              className="rounded-lg border border-iron-700 bg-wood-950/60 px-3 py-2 text-sm text-wood-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition-colors placeholder:text-wood-600 focus:border-accent-500"
            />
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Texto de la acción, tal como la escribirías en el chat"
              rows={2}
              className="resize-none rounded-lg border border-iron-700 bg-wood-950/60 px-3 py-2 text-sm text-wood-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition-colors placeholder:text-wood-600 focus:border-accent-500"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim() || !promptText.trim()}
              className="self-end rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-wood-950 transition-all hover:from-accent-300 hover:to-accent-500 disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
            >
              {creating ? '...' : 'Guardar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
