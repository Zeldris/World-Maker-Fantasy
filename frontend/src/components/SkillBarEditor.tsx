import { useState } from 'react'
import type { SavedActionInfo, SkillBarInfo } from '../types'
import { SelectionModalShell } from './SelectionModalShell'

const SKILL_BAR_SLOTS = 12

/// Modo edición de una barra de habilidades múltiple (2026-09-04) — clon directo de
/// CombatAbilityBelt.tsx/CombatAbilityToggleGrid, parametrizado por categoría y por la barra
/// concreta en vez de fijo a combate: mismo drag&drop HTML5 nativo, mismo `moveSlot`/`removeAt`
/// controlado por el padre vía `onChange`. Incluye renombrar la barra (no existía en combate,
/// donde el cinturón es único y sin nombre).
export function SkillBarEditor({
  bar,
  categoryAbilities,
  onSave,
  onCancel,
}: {
  bar: SkillBarInfo
  /// Todas las SavedAction de la MISMA categoría que la barra (de donde se eligen/quitan slots).
  categoryAbilities: SavedActionInfo[]
  onSave: (params: { name?: string; abilityNames?: string[] }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(bar.name)
  const [activeNames, setActiveNames] = useState<string[]>(bar.abilityNames)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const byName = new Map(categoryAbilities.map((a) => [a.name, a]))
  const slots: (SavedActionInfo | null)[] = Array.from({ length: SKILL_BAR_SLOTS }, (_, i) => {
    const abilityName = activeNames[i]
    return abilityName ? (byName.get(abilityName) ?? null) : null
  })

  function moveSlot(from: number, to: number) {
    if (from === to) return
    const next = [...activeNames]
    const [moved] = next.splice(from, 1)
    if (moved === undefined) return
    next.splice(to, 0, moved)
    setActiveNames(next)
  }

  function removeAt(index: number) {
    setActiveNames((prev) => prev.filter((_, i) => i !== index))
  }

  function toggle(abilityName: string) {
    setActiveNames((prev) => (prev.includes(abilityName) ? prev.filter((n) => n !== abilityName) : [...prev, abilityName]))
  }

  function handleGuardar() {
    if (saving) return
    setSaving(true)
    onSave({ name: name.trim() || bar.name, abilityNames: activeNames })
  }

  const atMax = activeNames.length >= SKILL_BAR_SLOTS

  return (
    <SelectionModalShell
      title="Editar barra"
      onCancel={onCancel}
      cancelDisabled={saving}
      footer={
        <button type="button" onClick={handleGuardar} disabled={saving} className="tactile flex-1 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 transition-colors disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500">
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      }
    >
      <label className="flex flex-col gap-1 text-xs text-wood-300">
        Nombre de la barra
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className="rounded-lg border border-iron-700 bg-wood-950/50 px-2.5 py-1.5 text-sm text-wood-100 outline-none focus:border-accent-600/60"
        />
      </label>

      <div>
        <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">
          Slots ({activeNames.length}/{SKILL_BAR_SLOTS})
        </p>
        <div className="grid grid-cols-6 gap-2">
          {slots.map((ability, i) => (
            <div
              key={i}
              draggable={!!ability}
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                if (dragIndex !== null) e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragIndex !== null) moveSlot(dragIndex, i)
                setDragIndex(null)
              }}
              onDragEnd={() => setDragIndex(null)}
              title={ability ? `${ability.name} — arrastra para reordenar, click para quitar` : 'Vacío'}
              onClick={() => ability && removeAt(i)}
              className={`flex aspect-square items-center justify-center rounded-lg border text-xl transition-colors ${
                ability
                  ? 'cursor-grab border-accent-600/60 bg-accent-500/10 hover:border-danger-600/60 hover:bg-danger-500/10 active:cursor-grabbing'
                  : 'border-dashed border-iron-700 bg-wood-950/30 text-wood-700'
              }`}
            >
              {ability ? ability.icon : '·'}
            </div>
          ))}
        </div>
      </div>

      {categoryAbilities.length === 0 ? (
        <p className="text-xs text-wood-500">No tienes ninguna habilidad de esta categoría todavía.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {categoryAbilities.map((a) => {
            const active = activeNames.includes(a.name)
            const blocked = !active && atMax
            return (
              <button
                type="button"
                key={a.id}
                onClick={() => !blocked && toggle(a.name)}
                disabled={blocked}
                title={blocked ? `La barra está llena (${SKILL_BAR_SLOTS}/${SKILL_BAR_SLOTS})` : a.description}
                className={`tactile relative flex w-full flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors ${
                  active
                    ? 'border-accent-500 bg-accent-500/15'
                    : blocked
                      ? 'cursor-not-allowed border-iron-800 bg-wood-950/20 opacity-60'
                      : 'border-iron-700 bg-wood-950/40 hover:border-accent-600/60 hover:bg-accent-500/10'
                }`}
              >
                <span className="text-2xl leading-none">{a.icon}</span>
                <span className="text-2xs leading-tight text-wood-200">{a.name}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-accent-500 bg-wood-950 text-2xs leading-none text-accent-400"
                  >
                    ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </SelectionModalShell>
  )
}
