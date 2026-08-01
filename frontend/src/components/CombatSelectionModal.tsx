import { useState } from 'react'

export interface CombatSelectionOption {
  id: string
  label: string
  sublabel?: string
}

interface CombatSelectionModalProps {
  title: string
  description?: string
  options: CombatSelectionOption[]
  /// Marcadas por defecto al abrir (petición explícita, 2026-07-30: para "Saquear", todo viene
  /// pre-marcado — es lo que ya pasaba antes de este modal, el jugador solo desmarca lo que NO
  /// quiere; para "Decapitar" tiene más sentido empezar vacío, una decisión explícita por enemigo).
  defaultSelectedIds?: string[]
  confirmLabel: string
  onConfirm: (selectedIds: string[]) => void
  onCancel: () => void
  busy?: boolean
  /// Rojo para "Decapitar" (irreversible, letal), accent para "Saquear" (neutro) — mismo criterio
  /// de color que ya usa el resto de CombatPanel.tsx.
  tone?: 'accent' | 'danger'
}

/// Modal de selección con checkboxes (petición explícita, 2026-07-30: "que salga un popup donde
/// marcando con checkbox pueda elegir... y confirmarlo o cancelarlo") — reutilizado tanto para
/// elegir a quién decapitar como qué objetos saquear, misma carcasa que DetailModal.tsx.
export function CombatSelectionModal({
  title,
  description,
  options,
  defaultSelectedIds,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  tone = 'accent',
}: CombatSelectionModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelectedIds ?? []))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const confirmClasses =
    tone === 'danger'
      ? 'border-danger-600 bg-danger-600/20 text-danger-300 hover:bg-danger-600/35'
      : 'border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 text-wood-950'

  return (
    <div className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onCancel}>
      <div
        className="plank-panel animate-combat-enter relative flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg text-wood-100">{title}</h3>
        {description && <p className="text-xs text-wood-400">{description}</p>}
        {options.length === 0 ? (
          <p className="text-xs text-wood-500">No hay nada que elegir aquí.</p>
        ) : (
          <ul className="space-y-1.5">
            {options.map((opt) => (
              <li key={opt.id}>
                <label className="tactile flex cursor-pointer items-center gap-2.5 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2 text-sm text-wood-200 transition-colors hover:border-accent-600/40">
                  <input
                    type="checkbox"
                    checked={selected.has(opt.id)}
                    onChange={() => toggle(opt.id)}
                    className="h-4 w-4 shrink-0 accent-[var(--color-accent-500)]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{opt.label}</span>
                    {opt.sublabel && <span className="block truncate text-2xs text-wood-500">{opt.sublabel}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="tactile flex-1 rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(Array.from(selected))}
            disabled={busy || selected.size === 0}
            className={`tactile flex-1 rounded-lg border px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500 ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
