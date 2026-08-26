import { useState } from 'react'
import type { SavedActionInfo } from '../types'
import { useSubmitError } from '../hooks/useSubmitError'

const ICON_OPTIONS = ['✨', '⚔️', '🛡️', '🏹', '🔥', '❄️', '🌿', '👁️', '💨', '🩹', '🐺', '🗿', '🎯', '🧭']

export interface AbilityFormParams {
  name: string
  promptText: string
  icon: string
  description: string
}

interface AbilityFormProps {
  mode: 'create' | 'edit'
  initial?: Pick<SavedActionInfo, 'name' | 'promptText' | 'icon' | 'description'>
  onSubmit: (params: AbilityFormParams) => Promise<void>
  onCancel?: () => void
}

// Formulario compartido entre "crear habilidad general" (HabilidadesPanel) y "editar habilidad
// propia" (DetailModal) — antes solo existía inline dentro de HabilidadesPanel; extraído para no
// mantener dos copias del mismo formulario (roadmap de rediseño de paneles, Fable 2026-07-20/21).
export function AbilityForm({ mode, initial, onSubmit, onCancel }: AbilityFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [promptText, setPromptText] = useState(initial?.promptText ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? ICON_OPTIONS[0])
  const { error, runCatchingError } = useSubmitError()
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    if (!name.trim() || !promptText.trim()) return
    setBusy(true)
    await runCatchingError(
      () => onSubmit({ name: name.trim(), promptText: promptText.trim(), icon, description: description.trim() }),
      'No se pudo guardar la habilidad',
    )
    setBusy(false)
  }

  return (
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
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="tactile rounded-lg border border-iron-700 px-3.5 py-1.5 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-wood-100"
          >
            Cancelar
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={busy || !name.trim() || !promptText.trim()}
          className="rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-wood-950 transition-all hover:from-accent-300 hover:to-accent-500 disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
        >
          {busy ? '...' : mode === 'create' ? 'Guardar' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
