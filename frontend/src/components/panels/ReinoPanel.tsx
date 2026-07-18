import type { ReactNode } from 'react'
import type { BuildingInfo, SubjectInfo, TerritoryInfo } from '../../types'

interface ReinoPanelProps {
  kingdomName: string | null
  characterMotivation: string | null
  territories: TerritoryInfo[]
  buildings: BuildingInfo[]
  subjects: SubjectInfo[]
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wood-400">{title}</p>
        <span className="h-px flex-1 bg-iron-700" />
      </div>
      {children}
    </div>
  )
}

export function ReinoPanel({ kingdomName, characterMotivation, territories, buildings, subjects }: ReinoPanelProps) {
  const isEmpty = territories.length === 0 && buildings.length === 0 && subjects.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-iron-700 bg-wood-950/40 px-6 py-10 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-iron-700 bg-iron-800 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
          🏰
        </span>
        <p className="font-serif text-sm tracking-wide text-wood-300">Todavía no gobierna a nadie</p>
        <p className="max-w-sm text-xs leading-relaxed text-wood-500">
          {characterMotivation
            ? characterMotivation
            : 'Ni tierra, ni súbditos, ni edificios propios — todavía. Lo que consiga a lo largo de la partida aparecerá aquí.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {kingdomName && (
        <p className="font-serif text-lg tracking-wide text-accent-300">{kingdomName}</p>
      )}

      {territories.length > 0 && (
        <Section title="Territorios">
          <div className="flex flex-col gap-2">
            {territories.map((t) => (
              <div key={t.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
                <p className="flex items-center justify-between font-medium text-wood-100">
                  {t.name}
                  <span className="rounded-full border border-iron-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-wood-400">
                    {controlLabel[t.control]}
                  </span>
                </p>
                {t.region && <p className="mt-0.5 text-[11px] text-wood-500">{t.region}</p>}
                <p className="mt-1 text-xs leading-relaxed text-wood-400">{t.description}</p>
                {t.population > 0 && (
                  <p className="mt-1 text-[11px] text-wood-500">Población: {t.population}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {buildings.length > 0 && (
        <Section title="Edificios">
          <div className="flex flex-col gap-2">
            {buildings.map((b) => (
              <div key={b.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
                <p className="flex items-center justify-between font-medium text-wood-100">
                  {b.name}
                  <span className="rounded-full border border-iron-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-wood-400">
                    {buildingStatusLabel[b.status]}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-wood-500">{b.kind}</p>
                <p className="mt-1 text-xs leading-relaxed text-wood-400">{b.description}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {subjects.length > 0 && (
        <Section title="Súbditos">
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
        </Section>
      )}
    </div>
  )
}
