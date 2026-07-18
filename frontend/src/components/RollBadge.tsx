import type { RollInfo } from '../types'
import { attributeLabels } from '../lib/dice'

export function RollBadge({ roll }: { roll: RollInfo }) {
  return (
    <div
      className={`mt-2 inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-[11px] ${
        roll.success
          ? 'border-moss-600/60 bg-moss-500/10 text-moss-400 shadow-[0_0_10px_-4px_var(--color-moss-500)]'
          : 'border-iron-700 bg-iron-800/80 text-wood-400'
      }`}
    >
      <span>{attributeLabels[roll.attribute]}</span>
      <span className="text-wood-600">·</span>
      <span>
        {roll.result} vs {roll.difficulty}
      </span>
      <span className="text-wood-600">·</span>
      <span className={`font-semibold ${roll.success ? 'text-moss-400' : 'text-wood-300'}`}>
        {roll.success ? 'Éxito' : 'Fallo'}
      </span>
    </div>
  )
}
