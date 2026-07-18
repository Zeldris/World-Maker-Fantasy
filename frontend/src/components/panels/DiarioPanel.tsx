import type { LogEntry } from '../../types'
import { RollBadge } from '../RollBadge'

interface DiarioPanelProps {
  characterLog: LogEntry[]
  worldLog: LogEntry[]
}

const channelLabel: Record<LogEntry['channel'], string> = {
  character: 'Personaje',
  world: 'Mundo',
}

const channelClasses: Record<LogEntry['channel'], string> = {
  character: 'gem',
  world: 'gem2',
}

export function DiarioPanel({ characterLog, worldLog }: DiarioPanelProps) {
  const entries = [...characterLog, ...worldLog].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-wood-500 italic">Todavía no hay nada que registrar.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
          <div className="mb-1 flex items-center gap-2">
            <span className={channelClasses[entry.channel]} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-wood-400">
              {channelLabel[entry.channel]}
            </span>
            <span className="text-wood-600">·</span>
            <span className="text-[10px] tracking-wide text-wood-500">{entry.timeLabel}</span>
            {!!entry.xpDelta && (
              <span className="rounded-full border border-accent-600/50 bg-accent-500/10 px-1.5 py-0.5 font-mono text-[10px] text-accent-300">
                +{entry.xpDelta} XP
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-wood-200">{entry.text}</p>
          {entry.roll && <RollBadge roll={entry.roll} />}
        </div>
      ))}
    </div>
  )
}
