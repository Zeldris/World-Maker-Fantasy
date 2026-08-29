import { useState } from 'react'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'

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

  return (
    <SelectionModalShell
      title={title}
      onCancel={onCancel}
      cancelDisabled={busy}
      footer={
        <button type="button" onClick={() => onConfirm(Array.from(selected))} disabled={busy || selected.size === 0} className={confirmButtonClasses(tone)}>
          {confirmLabel}
        </button>
      }
    >
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
    </SelectionModalShell>
  )
}
