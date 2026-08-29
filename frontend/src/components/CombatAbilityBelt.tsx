import { useState } from 'react'
import type { SavedActionInfo } from '../types'
import { abilityBonusSuffix } from '../lib/abilityBonusSuffix'

const BELT_SLOTS = 6

interface CombatAbilityBeltProps {
  /// Todas las habilidades de combate NO genéricas del personaje (aprendidas, no solo activas) —
  /// necesarias para resolver icono/nombre de cada nombre activo y para la lista de abajo, de
  /// donde se eligen/quitan.
  abilities: SavedActionInfo[]
  /// Nombres en el cinturón, en orden — fuente de verdad real (viene del backend, ya saneada).
  activeNames: string[]
  onChange: (names: string[]) => void
}

/// "Cinturón de combate" (2026-08-28, pendiente 2026-08-27 punto 3, "selección de habilidades de
/// clase activas en combate") — fila de slots que refleja de un vistazo qué está activo (petición
/// explícita: "un sitio que sean habilidades activas donde se refleje lo que vas marcando y
/// desmarcando"). Click en una tarjeta de la lista de abajo añade/quita del cinturón; arrastrar un
/// slot ya ocupado sobre otro reordena (drag-and-drop nativo del navegador — la app es solo de
/// escritorio, sin necesidad de soporte táctil).
export function CombatAbilityBelt({ abilities, activeNames, onChange }: CombatAbilityBeltProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const byName = new Map(abilities.map((a) => [a.name, a]))
  const slots: (SavedActionInfo | null)[] = Array.from({ length: BELT_SLOTS }, (_, i) => {
    const name = activeNames[i]
    return name ? (byName.get(name) ?? null) : null
  })

  function moveSlot(from: number, to: number) {
    if (from === to) return
    const next = [...activeNames]
    const [moved] = next.splice(from, 1)
    if (moved === undefined) return
    next.splice(to, 0, moved)
    onChange(next)
  }

  function removeAt(index: number) {
    onChange(activeNames.filter((_, i) => i !== index))
  }

  return (
    <div>
      <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">
        Cinturón de combate ({activeNames.length}/{BELT_SLOTS})
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
  )
}

/// Tarjeta de la lista completa de habilidades de combate — separada de IconCard/AbilityGrid
/// porque necesita un indicador propio de "en el cinturón" y su click activa/desactiva en vez de
/// abrir el detalle (el detalle sigue accesible por el botón ⓘ, mismo patrón que el resto).
export function CombatAbilityToggleGrid({
  abilities,
  activeNames,
  onToggle,
  onDetail,
  atMax,
}: {
  abilities: SavedActionInfo[]
  activeNames: string[]
  onToggle: (name: string) => void
  onDetail: (ability: SavedActionInfo) => void
  atMax: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {abilities.map((a) => {
        const active = activeNames.includes(a.name)
        const blocked = !active && atMax
        return (
          <div key={a.id} className="group relative">
            <button type="button"
              onClick={() => !blocked && onToggle(a.name)}
              disabled={blocked}
              title={blocked ? `${a.name} — el cinturón está lleno (${BELT_SLOTS}/${BELT_SLOTS})` : `${a.description}${abilityBonusSuffix(a)}`}
              className={`tactile flex w-full flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors ${
                active
                  ? 'border-accent-500 bg-accent-500/15'
                  : blocked
                    ? 'cursor-not-allowed border-iron-800 bg-wood-950/20 opacity-60'
                    : 'border-iron-700 bg-wood-950/40 hover:border-accent-600/60 hover:bg-accent-500/10'
              }`}
            >
              <span className="text-2xl leading-none">{a.icon}</span>
              <span className="text-2xs leading-tight text-wood-200">{a.name}</span>
            </button>
            {active && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-accent-500 bg-wood-950 text-2xs leading-none text-accent-400"
              >
                ✓
              </span>
            )}
            <button type="button"
              onClick={() => onDetail(a)}
              aria-label={`Detalle de ${a.name}`}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-iron-700 bg-wood-950 text-2xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 sm:hidden sm:group-hover:flex sm:group-focus-within:flex"
            >
              ⓘ
            </button>
          </div>
        )
      })}
    </div>
  )
}
