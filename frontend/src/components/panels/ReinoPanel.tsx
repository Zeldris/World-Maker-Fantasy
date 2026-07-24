import type { BuildingInfo, KingdomStatsInfo, SubjectInfo, TerritoryInfo } from '../../types'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'

interface ReinoPanelProps {
  kingdomName: string | null
  characterMotivation: string | null
  territories: TerritoryInfo[]
  buildings: BuildingInfo[]
  subjects: SubjectInfo[]
  // Reputación de facción (2026-07-19) — hoy solo baja (derrotar a un NPC de una facción conocida
  // resta 1), sin lado positivo todavía; se muestra igual aquí porque es la relación del
  // personaje con el mundo, más cerca de "Reino" que de ningún otro panel existente.
  factionsStatus: Record<string, number>
  /// Economía de Reino (sesión de diseño 2026-07-23) — null hasta fundar el primer Territory.
  kingdomStats: KingdomStatsInfo | null
}

const KINGDOM_STAT_LABEL: Record<keyof KingdomStatsInfo, string> = {
  poblacion: 'Población',
  felicidad: 'Felicidad',
  comida: 'Comida',
  bebida: 'Bebida',
  riqueza: 'Riqueza',
  soldados: 'Soldados',
  trabajadores: 'Trabajadores',
  visitantes: 'Visitantes',
}

const controlLabel: Record<TerritoryInfo['control'], string> = {
  RECLAMADO: 'Reclamado',
  DISPUTADO: 'Disputado',
  CONSOLIDADO: 'Consolidado',
  PERDIDO: 'Perdido',
}

const buildingStatusLabel: Record<BuildingInfo['status'], string> = {
  EN_CONSTRUCCION: 'En construcción',
  ACTIVO: 'Activo',
  DANADO: 'Dañado',
  ABANDONADO: 'Abandonado',
}

export function ReinoPanel({ kingdomName, characterMotivation, territories, buildings, subjects, factionsStatus, kingdomStats }: ReinoPanelProps) {
  const isEmpty = territories.length === 0 && buildings.length === 0 && subjects.length === 0
  const factionEntries = Object.entries(factionsStatus)

  if (isEmpty && factionEntries.length === 0) {
    return (
      <PanelEmptyState
        icon="🏰"
        title="Todavía no gobierna a nadie"
        hint={
          characterMotivation ??
          'Ni tierra, ni súbditos, ni edificios propios — todavía. Lo que consiga a lo largo de la partida aparecerá aquí.'
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {kingdomName && (
        <p className="font-serif text-lg tracking-wide text-accent2-300">{kingdomName}</p>
      )}

      {kingdomStats && (
        <PanelSection title="Economía">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {(Object.keys(KINGDOM_STAT_LABEL) as Array<keyof KingdomStatsInfo>).map((key) => (
              <div key={key} className="rounded-lg border border-iron-700 bg-wood-950/40 px-2.5 py-2 text-center">
                <p className="text-2xs uppercase tracking-wide text-wood-500">{KINGDOM_STAT_LABEL[key]}</p>
                <p className="font-mono text-sm tabular-nums text-accent2-300">{kingdomStats[key]}</p>
              </div>
            ))}
          </div>
        </PanelSection>
      )}

      {factionEntries.length > 0 && (
        <PanelSection title="Reputación de facción">
          <div className="flex flex-wrap gap-2">
            {factionEntries.map(([faction, score]) => (
              <span
                key={faction}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  score < 0 ? 'border-red-700/60 bg-red-500/10 text-red-400' : 'border-iron-700 bg-wood-950/40 text-wood-300'
                }`}
              >
                {faction}: {score > 0 ? `+${score}` : score}
              </span>
            ))}
          </div>
        </PanelSection>
      )}

      {territories.length > 0 && (
        <PanelSection title="Territorios">
          <div className="flex flex-col gap-2">
            {territories.map((t) => (
              <div key={t.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
                <p className="flex items-center justify-between font-medium text-wood-100">
                  {t.name}
                  <span className="rounded-full border border-iron-700 px-2 py-0.5 text-2xs uppercase tracking-wide text-wood-400">
                    {controlLabel[t.control]}
                  </span>
                </p>
                {t.region && <p className="mt-0.5 text-2xs text-wood-500">{t.region}</p>}
                <p className="mt-1 text-xs leading-relaxed text-wood-400">{t.description}</p>
                {t.population > 0 && (
                  <p className="mt-1 text-2xs text-wood-500">Población: {t.population}</p>
                )}
              </div>
            ))}
          </div>
        </PanelSection>
      )}

      {buildings.length > 0 && (
        <PanelSection title="Edificios">
          <div className="flex flex-col gap-2">
            {buildings.map((b) => (
              <div key={b.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
                <p className="flex items-center justify-between font-medium text-wood-100">
                  {b.name}
                  <span className="rounded-full border border-iron-700 px-2 py-0.5 text-2xs uppercase tracking-wide text-wood-400">
                    {buildingStatusLabel[b.status]}
                  </span>
                </p>
                <p className="mt-0.5 text-2xs text-wood-500">{b.kind}</p>
                <p className="mt-1 text-xs leading-relaxed text-wood-400">{b.description}</p>
              </div>
            ))}
          </div>
        </PanelSection>
      )}

      {subjects.length > 0 && (
        <PanelSection title="Súbditos">
          <div className="flex flex-col gap-2">
            {subjects.map((s) => (
              <div key={s.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
                <p className="font-medium text-wood-100">
                  {s.name} <span className="font-sans text-xs text-wood-500">— {s.role}</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-wood-400">{s.notes}</p>
              </div>
            ))}
          </div>
        </PanelSection>
      )}
    </div>
  )
}
