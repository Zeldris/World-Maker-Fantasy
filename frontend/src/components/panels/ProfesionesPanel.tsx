import { professions } from '../../data/professions'

interface ProfesionesPanelProps {
  currentProfession: string | null
  onAdopt: (name: string) => void
}

export function ProfesionesPanel({ currentProfession, onAdopt }: ProfesionesPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      {currentProfession && (
        <p className="rounded-lg border border-accent-600/50 bg-accent-500/10 px-3.5 py-2.5 text-sm text-accent-300">
          Ejerce como <span className="font-medium">{currentProfession}</span>.
        </p>
      )}
      {professions.map((p) => {
        const active = p.name === currentProfession
        return (
          <div
            key={p.id}
            className={`rounded-lg border px-3.5 py-2.5 ${
              active ? 'border-accent-600/60 bg-accent-500/5' : 'border-iron-700 bg-wood-950/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className={`font-medium ${active ? 'text-accent-300' : 'text-wood-100'}`}>{p.name}</p>
              {!active && (
                <button
                  onClick={() => onAdopt(p.name)}
                  className="shrink-0 rounded-lg border border-iron-700 bg-wood-950/50 px-2 py-1 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
                >
                  Adoptar
                </button>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-wood-400">{p.description}</p>
          </div>
        )
      })}
    </div>
  )
}
