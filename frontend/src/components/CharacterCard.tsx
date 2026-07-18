import type { Character } from '../types'
import { AttributeBars } from './AttributeBars'
import { PanelRivets } from './Rivet'

export function CharacterCard({
  character,
  selected,
  onSelect,
}: {
  character: Character
  selected?: boolean
  onSelect?: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`plank-panel relative flex flex-col gap-4 rounded-xl p-5 text-left transition-[filter,box-shadow,border-color] ${
        selected ? 'card-selected' : 'hover:border-accent-600/40 hover:brightness-110'
      }`}
    >
      <PanelRivets />
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-gradient-to-b from-wood-800 to-wood-950 font-serif text-lg ${
            selected
              ? 'border-accent-500/70 text-accent-300 shadow-[0_0_10px_-2px_var(--color-accent-500)]'
              : 'border-iron-700 text-accent-400'
          }`}
        >
          {character.portraitInitial}
        </div>
        <div>
          <h3 className={`font-serif text-base tracking-wide ${selected ? 'text-accent-300' : 'text-wood-100'}`}>
            {character.name}
          </h3>
          <p className="text-xs text-wood-400">{character.archetype}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-wood-300">{character.origin}</p>
      <p className="text-xs italic text-wood-400">"{character.motivation}"</p>
      <AttributeBars attributes={character.attributes} />
    </button>
  )
}
