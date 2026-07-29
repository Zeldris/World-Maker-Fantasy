import { PanelEmptyState } from '../PanelEmptyState'

// Gauge 0-5000 por facción (backend: reputation.ts) — mismo concepto que la barra de XP, pero
// bipolar: 2500 es el punto neutro, sube hacia AMIGABLE o baja hacia ENEMIGO. Umbrales duplicados
// aquí a propósito, igual que ProfesionesPanel ya duplica PROFESSION_LEVEL_THRESHOLDS — es una
// tabla fija, no vale la pena pedirla al backend solo para pintar una barra.
const FACTION_REP_MAX = 5000

interface ReputationBand {
  label: string
  min: number
  textClass: string
  barClass: string
}

const REPUTATION_BANDS: ReputationBand[] = [
  { label: 'Enemigo', min: 0, textClass: 'text-red-400', barClass: 'from-red-700 to-red-500' },
  { label: 'Agresivo', min: 1000, textClass: 'text-orange-400', barClass: 'from-orange-700 to-orange-500' },
  { label: 'Cauteloso', min: 2000, textClass: 'text-wood-300', barClass: 'from-wood-600 to-wood-400' },
  { label: 'Inofensivo', min: 3000, textClass: 'text-emerald-400', barClass: 'from-emerald-700 to-emerald-500' },
  { label: 'Amigable', min: 4000, textClass: 'text-accent-300', barClass: 'from-accent-600 to-accent-400' },
]

function bandFor(value: number): ReputationBand {
  for (let i = REPUTATION_BANDS.length - 1; i >= 0; i--) {
    if (value >= REPUTATION_BANDS[i].min) return REPUTATION_BANDS[i]
  }
  return REPUTATION_BANDS[0]
}

interface ReputacionPanelProps {
  factionsStatus: Record<string, number>
}

export function ReputacionPanel({ factionsStatus }: ReputacionPanelProps) {
  const entries = Object.entries(factionsStatus)

  if (entries.length === 0) {
    return (
      <PanelEmptyState
        icon="🤝"
        title="Todavía sin reputación con ninguna facción"
        hint="Cómo trates a los NPCs de cada facción — en combate o en paz — sube o baja esta barra. Una facción hostil reacciona distinto a una amigable la próxima vez que te la cruces."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map(([faction, value]) => {
        const band = bandFor(value)
        const percent = Math.max(0, Math.min(100, (value / FACTION_REP_MAX) * 100))
        return (
          <div key={faction} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <p className="font-medium text-wood-100">{faction}</p>
              <span className={`text-2xs font-bold uppercase tracking-wide ${band.textClass}`}>{band.label}</span>
            </div>
            <div className="mt-1.5 mb-1 flex items-center justify-end text-2xs">
              <span className="font-mono tabular-nums text-wood-500">
                {value} / {FACTION_REP_MAX}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-iron-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
              <div
                className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ${band.barClass}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
