import type { Attribute, AttributeBlock, CondicionFisica, SecondaryAttributeBlock } from '../../types'
import { AttributeBars } from '../AttributeBars'
import { attributeLabels, attributeColorClasses } from '../../lib/dice'
import { secondaryAttributeLabels } from '../../lib/secondaryAttributes'
import { MAX_LEVEL, xpProgress } from '../../lib/progression'
import { PanelSection } from '../PanelSection'
import { HealthBar } from '../HealthBar'
import { EnergyBar } from '../EnergyBar'
import { ResourceBar } from '../ResourceBar'
import { useModoConsulta } from '../../context/useModoConsulta'

interface EstadisticasPanelProps {
  // Bug real (auditoría de elementos desconectados, 2026-08-23): el backend ya mandaba estos dos
  // campos en cada carga de partida, pero el frontend los descartaba sin mostrarlos nunca fuera de
  // la pantalla de creación de personaje.
  characterArchetype: string | null
  characterOrigin: string | null
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
  /// Hambre/Sed (Grupo 3 § Compañeros y supervivencia, 2026-08-25) — 0-100, derivadas en vivo del
  /// reloj de ficción. Por debajo de 25% empieza el desgaste real (docs/rpgtarkor/
  /// companeros-y-supervivencia.md § 5).
  hambre: number
  sed: number
}

export function EstadisticasPanel({
  characterArchetype,
  characterOrigin,
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
  hambre,
  sed,
}: EstadisticasPanelProps) {
  const progress = xpProgress(level, xp)
  // UX-5 (hito 0.2) — repartir puntos cambia el personaje: no en modo consulta.
  const consulta = useModoConsulta()
  const percent = progress.span > 0 ? Math.min(100, (progress.current / progress.span) * 100) : 100

  return (
    <div className="flex flex-col gap-5">
      {(characterArchetype || characterOrigin) && (
        <p className="-mb-1 truncate text-xs text-wood-500">
          {[characterArchetype, characterOrigin].filter(Boolean).join(' · ')}
        </p>
      )}
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

      <PanelSection title="Hambre / Sed">
        <div className="flex flex-col gap-2">
          {([
            ['🍖 Comida', hambre],
            ['💧 Agua', sed],
          ] as const).map(([label, pct]) => (
            <ResourceBar key={label} label={label} pct={pct} />
          ))}
          {(hambre < 50 || sed < 50) && (
            // Entrada animada (2026-08-27, auditoría de diseño/UX § 3.2: "el aviso aparece de
            // golpe, sin ninguna transición" — hambre/sed avanzan solas en el worldTick de fondo,
            // así que cruzar el umbral puede pasar mientras la jugadora está en otra pestaña; al
            // menos que la primera vez que se ve el aviso no sea un salto brusco en el DOM).
            //
            // B.23 (checklist frontend 2026-08-27) — antes solo 2 estados de texto pese a que la
            // barra ya tiene 3 umbrales de color (ResourceBar: <25 rojo, <50 ámbar, ≥50 verde). La
            // banda ámbar se veía amarilla sin ningún mensaje que la acompañara — saltaba directo
            // de "sin aviso" a "desgaste real" (rojo), como si no pasara nada hasta llegar ahí.
            <p className={`animate-entry-in text-2xs italic ${hambre < 25 || sed < 25 ? 'text-red-400' : 'text-amber-400'}`}>
              {hambre <= 0 && sed <= 0
                ? 'Ni comes ni bebes desde hace demasiado — la vida sigue bajando sin suelo mientras siga así.'
                : hambre < 25 || sed < 25
                  ? 'Llevas demasiado sin comer o beber — el desgaste ya es real, busca comida o agua pronto.'
                  : 'Empiezas a notar hambre o sed — no urge todavía, pero no lo dejes pasar mucho más.'}
            </p>
          )}
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
              <button type="button"
                key={attr}
                onClick={() => onSpendPoint(attr)}
                disabled={attributes[attr] >= 18 || !!consulta}
                title={consulta ?? undefined}
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
