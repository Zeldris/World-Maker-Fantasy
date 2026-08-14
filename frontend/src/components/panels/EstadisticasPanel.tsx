import type { Attribute, AttributeBlock, CondicionFisica, SecondaryAttributeBlock } from '../../types'
import { AttributeBars } from '../AttributeBars'
import { attributeLabels, attributeColorClasses } from '../../lib/dice'
import { secondaryAttributeLabels } from '../../lib/secondaryAttributes'
import { MAX_LEVEL, xpProgress } from '../../lib/progression'
import { PanelSection } from '../PanelSection'
import { HealthBar } from '../HealthBar'
import { EnergyBar } from '../EnergyBar'

interface EstadisticasPanelProps {
  attributes: AttributeBlock
  attributeBonuses: Partial<AttributeBlock>
  secondaryAttributes: SecondaryAttributeBlock
  level: number
  xp: number
  pendingAttributePoints: number
  onSpendPoint: (attribute: Attribute) => void
  /// Vida/fatiga actuales (2026-07-30, petición explícita: "en estadísticas hay que añadir la
  /// vida actual y la fatiga") — mismos componentes ya usados en CombatPanel.tsx, reutilizados
  /// tal cual para que la ficha de personaje muestre el mismo estado sin duplicar la lógica de
  /// color/animación.
  condicionFisica: CondicionFisica
  energia: number
  energiaMax: number
}

export function EstadisticasPanel({
  attributes,
  attributeBonuses,
  secondaryAttributes,
  level,
  xp,
  pendingAttributePoints,
  onSpendPoint,
  condicionFisica,
  energia,
  energiaMax,
}: EstadisticasPanelProps) {
  const progress = xpProgress(level, xp)
  const percent = progress.span > 0 ? Math.min(100, (progress.current / progress.span) * 100) : 100

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-2 font-serif text-sm tracking-wide text-wood-100">
            <span className="gem" /> Nivel {level}
          </p>
          <p className="font-mono tabular-nums text-xs text-wood-400">
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

      <PanelSection title="Estado">
        <div className="flex flex-wrap items-center gap-2.5">
          <HealthBar condicionFisica={condicionFisica} />
          <EnergyBar energia={energia} energiaMax={energiaMax} />
        </div>
      </PanelSection>

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

      <PanelSection title="Atributos jugables">
        <AttributeBars attributes={attributes} bonuses={attributeBonuses} labels={attributeLabels} colors={attributeColorClasses} />
      </PanelSection>

      <PanelSection title="Atributos secundarios">
        <AttributeBars attributes={secondaryAttributes} labels={secondaryAttributeLabels} />
        <p className="mt-2.5 text-2xs italic text-wood-500">
          Nunca mueven una tirada — solo deciden si cumples los requisitos para craftear, equipar
          o construir algo (ver la Enciclopedia).
        </p>
      </PanelSection>
    </div>
  )
}
