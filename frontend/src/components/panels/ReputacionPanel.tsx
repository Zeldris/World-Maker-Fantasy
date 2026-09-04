import { useEffect, useRef, useState } from 'react'
import { PanelEmptyState } from '../PanelEmptyState'
import type { EnciclopediaFaccionInfo } from '../../lib/api'
import { faccionToDetailTarget } from '../../lib/enciclopediaTargets'
import { useEnciclopediaLink } from '../../context/useEnciclopediaLink'

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

/// Feedback de cambio (2026-08-27, auditoría de diseño/UX § 3.1: "una bajada de reputación... es
/// mecánicamente el mismo tipo de evento que 'recibir daño'... pero hoy no tiene ningún eco
/// visual"). Mismo patrón exacto que `HealthBar.tsx` (useRef del valor anterior + flash 'worse'/
/// 'better' comparado contra ese valor, nunca contra un umbral fijo) — extraído a su propio
/// componente para que cada facción tenga su propio `useRef`/`useState` de instancia (React ya
/// distingue cada fila por `key={faction}` en el `.map` del padre).
function FactionRow({
  faction,
  value,
  factionEntry,
  onEntityDetail,
}: {
  faction: string
  value: number
  factionEntry: EnciclopediaFaccionInfo | undefined
  onEntityDetail?: (target: ReturnType<typeof faccionToDetailTarget>) => void
}) {
  const band = bandFor(value)
  const percent = Math.max(0, Math.min(100, (value / FACTION_REP_MAX) * 100))
  const prevRef = useRef(value)
  const [flash, setFlash] = useState<'worse' | 'better' | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    if (prev !== value) {
      setFlash(value < prev ? 'worse' : 'better')
      prevRef.current = value
    }
  }, [value])

  return (
    <div
      key={value}
      className={`relative overflow-hidden rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5 ${flash === 'worse' ? 'animate-shake-no' : ''}`}
    >
      {flash && (
        <span
          className={`pointer-events-none absolute inset-0 ${flash === 'worse' ? 'animate-hit-flash-red bg-danger-500' : 'animate-hit-flash-moss bg-moss-500'}`}
          aria-hidden="true"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <p className="truncate font-medium text-wood-100">{faction}</p>
          {factionEntry && (
            <button
              type="button"
              onClick={() => onEntityDetail?.(faccionToDetailTarget(factionEntry))}
              aria-label={`Consultar ${faction} en la Enciclopedia`}
              className="tactile flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-iron-700 text-2xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
            >
              ⓘ
            </button>
          )}
        </span>
        <span className={`shrink-0 text-2xs font-bold uppercase tracking-wide ${band.textClass}`}>{band.label}</span>
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
}

interface ReputacionPanelProps {
  factionsStatus: Record<string, number>
  /// Enlace cruzado con Enciclopedia > Facciones (2026-08-27, auditoría de diseño/UX § 1.2:
  /// "son la MISMA entidad mostrada en dos rieles sin ninguna conexión... la app ya tiene la
  /// infraestructura para esto"). Solo se ofrece el enlace si la facción ya está descubierta —
  /// nunca revela una ficha de Enciclopedia todavía bloqueada desde aquí.
  factions: EnciclopediaFaccionInfo[]
}

export function ReputacionPanel({ factionsStatus, factions }: ReputacionPanelProps) {
  const entries = Object.entries(factionsStatus)
  const { onEntityDetail } = useEnciclopediaLink()
  const factionByName = new Map(factions.filter((f) => f.discovered).map((f) => [f.name, f]))

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
      {entries.map(([faction, value]) => (
        <FactionRow key={faction} faction={faction} value={value} factionEntry={factionByName.get(faction)} onEntityDetail={onEntityDetail} />
      ))}
    </div>
  )
}
