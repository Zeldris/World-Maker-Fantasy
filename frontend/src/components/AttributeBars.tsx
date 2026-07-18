import type { AttributeBlock } from '../types'
import { attributeLabels } from '../lib/dice'

export function AttributeBars({ attributes }: { attributes: AttributeBlock }) {
  const max = 18
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
      {(Object.keys(attributes) as Array<keyof AttributeBlock>).map((key) => {
        const value = attributes[key]
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-wood-300">{attributeLabels[key]}</span>
              <span className="font-mono text-accent-300">{value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-iron-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400 shadow-[0_0_6px_color-mix(in_srgb,var(--color-accent-500)_45%,transparent)] transition-[width] duration-500"
                style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
