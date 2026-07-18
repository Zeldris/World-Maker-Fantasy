import type { CompanionInfo } from '../../types'

export function CompanerosPanel({ companions }: { companions: CompanionInfo[] }) {
  if (companions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-wood-500 italic">
        Vas solo por ahora. Los aliados o súbditos que ganes durante la partida aparecerán aquí.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {companions.map((companion) => (
        <div key={companion.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
          <p className="font-medium text-wood-100">
            {companion.name} <span className="font-sans text-xs text-wood-500">— {companion.role}</span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-wood-400">{companion.notes}</p>
        </div>
      ))}
    </div>
  )
}
