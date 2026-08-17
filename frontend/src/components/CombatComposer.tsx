import type { CondicionFisica } from '../types'

export interface CombatNpcDisplay {
  slug: string
  name: string
  // Botón "Decapitar" (2026-07-30) — antes se colapsaba MUERTO a CONVALECIENTE al mostrarlo (un
  // enemigo rematado con una habilidad REMATE se veía igual que uno solo convaleciente); ahora que
  // el jugador puede rematar a propósito desde el resumen de combate, el estado real se muestra
  // tal cual, mismo criterio que el resto de la ficha de combate.
  condicion: CondicionFisica
  yaSaqueado: boolean
  // Saqueo parcial (2026-07-31) — qué objetos concretos ya se llevó el jugador de este NPC, para
  // que el modal de saqueo (CombatPanel.tsx) no vuelva a ofrecerlos.
  lootedItemNames: string[]
  // Rediseño de combate (2026-08-09, "Analizar rival") — gatea qué muestra la ficha del rival
  // (CombatPanel.tsx § EnemyFicha).
  analizado: boolean
}

interface CombatComposerProps {
  freeText: string
  onFreeTextChange: (text: string) => void
  onSubmit: () => void
  busy: boolean
  ended: boolean
}

/// Recortado a solo texto libre (rediseño de la vista de combate, 2026-07-28, petición explícita:
/// "la barra de abajo queda libre para el texto") — la lista de enemigos, la ficha, las
/// habilidades/objetos y el botón Actuar suben a `CombatPanel.tsx`, que sustituye al LogPanel "El
/// mundo" mientras dura el combate. El estado de selección vive en GameView.tsx, compartido entre
/// ambos; este componente ya no tiene estado propio.
export function CombatComposer({ freeText, onFreeTextChange, onSubmit, busy, ended }: CombatComposerProps) {
  if (ended) return null

  return (
    <div className="border-t border-red-900/50 bg-wood-950/90 px-4 pb-3 pt-3">
      <div className="flex gap-2">
        <input
          value={freeText}
          onChange={(e) => onFreeTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit()
          }}
          placeholder="O describe tu acción..."
          disabled={busy}
          className="flex-1 rounded-lg border border-iron-700 bg-wood-950/60 px-3 py-2 text-sm text-wood-100 outline-none disabled:opacity-50"
        />
        <button
          onClick={onSubmit}
          disabled={busy || !freeText.trim()}
          className="tactile shrink-0 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
        >
          Actuar
        </button>
      </div>
    </div>
  )
}
