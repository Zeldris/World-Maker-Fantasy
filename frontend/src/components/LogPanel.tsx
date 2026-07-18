import { useEffect, useRef } from 'react'
import type { LogEntry } from '../types'
import { RollBadge } from './RollBadge'
import { PanelRivets } from './Rivet'

interface LogPanelProps {
  title: string
  subtitle: string
  entries: LogEntry[]
  accent: 'accent' | 'accent2'
  isThinking?: boolean
  thinkingText?: string
  emptyHint: string
}

const accentClasses = {
  accent: {
    gem: 'gem',
    heading: 'text-accent-300',
    hairline: 'accent-hairline',
    playerBubble: 'border-accent-600/40 bg-accent-500/10',
    playerLabel: 'text-accent-400',
    thinkingCard: 'border-accent-600/40 bg-accent-500/5',
    thinkingLabel: 'text-accent-300/90',
    thinkingDot: 'bg-accent-400',
    thinkingRail: 'El Narrador escribe',
  },
  accent2: {
    gem: 'gem2',
    heading: 'text-accent2-300',
    hairline: 'accent2-hairline',
    playerBubble: 'border-accent2-600/40 bg-accent2-500/10',
    playerLabel: 'text-accent2-400',
    thinkingCard: 'border-accent2-600/40 bg-accent2-500/5',
    thinkingLabel: 'text-accent2-300/90',
    thinkingDot: 'bg-accent2-400',
    thinkingRail: 'El mundo se mueve',
  },
}

export function LogPanel({ title, subtitle, entries, accent, isThinking, thinkingText, emptyHint }: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const classes = accentClasses[accent]

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [entries.length, isThinking])

  return (
    <section className="plank-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
      <PanelRivets />
      <header className="relative flex items-center gap-2.5 px-4 py-3">
        <span className={classes.gem} />
        <div className="min-w-0">
          <h2 className={`font-serif text-sm tracking-wide ${classes.heading}`}>{title}</h2>
          <p className="text-[11px] text-wood-400">{subtitle}</p>
        </div>
        <div className={`absolute inset-x-0 bottom-0 ${classes.hairline}`} />
      </header>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {entries.length === 0 && !isThinking && (
          <p className="pt-2 text-sm text-wood-500 italic">{emptyHint}</p>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={
              entry.isPlayerAction
                ? `animate-entry-in rounded-lg border border-l-2 px-3.5 py-2.5 text-sm text-wood-100 ${classes.playerBubble}`
                : 'animate-entry-in text-sm leading-relaxed text-wood-200'
            }
          >
            {entry.isPlayerAction && (
              <p className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${classes.playerLabel}`}>
                Tu acción
              </p>
            )}
            <p>{entry.text}</p>
            {entry.roll && <RollBadge roll={entry.roll} />}
            <div className="mt-1.5 flex items-center gap-2">
              <p className="text-[10px] tracking-wide text-wood-500">{entry.timeLabel}</p>
              {!!entry.xpDelta && (
                <span className="rounded-full border border-accent-600/50 bg-accent-500/10 px-1.5 py-0.5 font-mono text-[10px] text-accent-300">
                  +{entry.xpDelta} XP
                </span>
              )}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className={`relative overflow-hidden rounded-lg border border-dashed px-3.5 py-3 ${classes.thinkingCard}`}>
            <div className="thinking-sheen" />
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 animate-pulse-soft rounded-full ${classes.thinkingDot}`} />
                <span className={`h-1.5 w-1.5 animate-pulse-soft rounded-full ${classes.thinkingDot} [animation-delay:0.2s]`} />
                <span className={`h-1.5 w-1.5 animate-pulse-soft rounded-full ${classes.thinkingDot} [animation-delay:0.4s]`} />
              </div>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${classes.thinkingLabel}`}>
                {classes.thinkingRail}
              </p>
            </div>
            {thinkingText && (
              <p key={thinkingText} className="animate-entry-in mt-2 text-xs italic leading-relaxed text-wood-300">
                {thinkingText}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
