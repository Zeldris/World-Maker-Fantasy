import type { Attribute, AttributeBlock } from '../../types'
import { AttributeBars } from '../AttributeBars'
import { attributeLabels } from '../../lib/dice'
import { MAX_LEVEL, xpProgress } from '../../lib/progression'

interface EstadisticasPanelProps {
  attributes: AttributeBlock
  level: number
  xp: number
  pendingAttributePoints: number
  onSpendPoint: (attribute: Attribute) => void
}

export function EstadisticasPanel({ attributes, level, xp, pendingAttributePoints, onSpendPoint }: EstadisticasPanelProps) {
  const progress = xpProgress(level, xp)
  const percent = progress.span > 0 ? Math.min(100, (progress.current / progress.span) * 100) : 100

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-2 font-serif text-sm tracking-wide text-wood-100">
            <span className="gem" /> Nivel {level}
          </p>
          <p className="font-mono text-xs text-wood-400">
            {level >= MAX_LEVEL ? `${xp} XP (máximo)` : `${progress.current} / ${progress.span} XP`}
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-iron-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400 shadow-[0_0_6px_color-mix(in_srgb,var(--color-accent-500)_45%,transparent)] transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {pendingAttributePoints > 0 && (
        <div className="rounded-lg border border-accent-600/50 bg-accent-500/10 px-4 py-3">
          <p className="mb-2 text-xs text-wood-200">
            Tienes <span className="font-bold text-accent-300">{pendingAttributePoints}</span> punto
            {pendingAttributePoints === 1 ? '' : 's'} de atributo por repartir (tope 18 por atributo).
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(attributes) as Attribute[]).map((attr) => (
              <button
                key={attr}
                onClick={() => onSpendPoint(attr)}
                disabled={attributes[attr] >= 18}
                className="rounded-lg border border-accent-600/60 bg-wood-950/50 px-2.5 py-1 text-xs text-accent-300 transition-colors hover:bg-accent-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                +1 {attributeLabels[attr]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wood-400">Atributos jugables</p>
          <span className="h-px flex-1 bg-iron-700" />
        </div>
        <AttributeBars attributes={attributes} />
      </div>

      <div className="rounded-lg border border-dashed border-iron-700 bg-wood-950/40 px-4 py-3 text-xs leading-relaxed text-wood-500">
        Inteligencia, Magia, Poder de Semilla, Moral y las 4 Resistencias están documentadas
        (ver <span className="text-wood-400">docs/rpgtarkor/personajes.md</span>) pero el motor
        de juego todavía no las usa — solo los 6 atributos de arriba mueven las tiradas por ahora.
      </div>
    </div>
  )
}
