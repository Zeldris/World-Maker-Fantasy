import type { World } from '../types'
import { PanelRivets } from './Rivet'

const lethalityLabel: Record<World['lethality'], string> = {
  baja: 'Letalidad baja',
  media: 'Letalidad media',
  alta: 'Letalidad alta',
}

export function WorldCard({
  world,
  selected,
  onSelect,
}: {
  world: World
  selected?: boolean
  onSelect?: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`plank-panel group relative flex flex-col gap-4 rounded-xl p-6 text-left transition-[filter,box-shadow,border-color] ${
        selected ? 'card-selected' : 'hover:border-accent-600/40 hover:brightness-110'
      }`}
    >
      <PanelRivets />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className={`font-serif text-2xl tracking-wide ${selected ? 'text-accent-300' : 'text-wood-100'}`}>
            {world.name}
          </h3>
          <p className="mt-1 text-sm text-accent-400">{world.tagline}</p>
        </div>
        <span className="whitespace-nowrap rounded-full border border-iron-700 bg-iron-800/70 px-3 py-1 text-xs text-wood-300">
          {lethalityLabel[world.lethality]}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-wood-300">{world.synopsis}</p>
      <div className="flex flex-wrap gap-2">
        {world.factions.map((f) => (
          <span
            key={f}
            className="rounded-full border border-iron-700 bg-wood-900/60 px-2.5 py-1 text-xs text-wood-300 transition-colors group-hover:border-accent-600/50"
          >
            {f}
          </span>
        ))}
      </div>
      <p className="text-xs italic text-wood-400">{world.tone}</p>
    </button>
  )
}
