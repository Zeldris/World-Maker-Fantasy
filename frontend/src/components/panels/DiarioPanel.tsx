import { useEffect, useState } from 'react'
import type { SessionSummaryInfo } from '../../types'
import { getDiario, type DiarioEntry } from '../../lib/api'
import { RollBadge } from '../RollBadge'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'
import { EnciclopediaLinkedText } from '../EnciclopediaLinkedText'
import { useEnciclopediaLink } from '../../context/useEnciclopediaLink'

interface DiarioPanelProps {
  saveId: string
  chapters?: SessionSummaryInfo[]
}

const channelLabel: Record<DiarioEntry['channel'], string> = {
  character: 'Personaje',
  world: 'Mundo',
  kingdom: 'Reino',
}

const channelClasses: Record<DiarioEntry['channel'], string> = {
  character: 'gem',
  world: 'gem2',
  kingdom: 'gem2',
}

/// Registro completo de la partida (rework 2026-07-24: "el log de personaje solo muestre 24h del
/// mundo... si quieres verlo todo vendrá clasificado por días en el diario"). Fetch propio y bajo
/// demanda (solo al abrir esta pestaña) en vez de recibir characterLog/worldLog ya cargados desde
/// GameView — esos dos ahora solo traen las últimas 24h de juego, el historial completo vive aquí.
/// Deliberadamente sin banners de entidad: es solo texto, mismo criterio que ya tenía este panel.
export function DiarioPanel({ saveId, chapters = [] }: DiarioPanelProps) {
  const { enciclopediaIndex, onEntityDetail, onEntityQuickInsert } = useEnciclopediaLink()
  const [entries, setEntries] = useState<DiarioEntry[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    setFailed(false)
    getDiario(saveId)
      .then((data) => {
        if (!cancelled) setEntries(data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [saveId])

  if (failed) {
    return <PanelEmptyState icon="⚠️" title="No se pudo cargar el diario" hint="Inténtalo de nuevo más tarde." />
  }
  if (entries === null) {
    return <p className="text-xs text-wood-400">Cargando...</p>
  }
  if (entries.length === 0) {
    return <PanelEmptyState icon="📜" title="Todavía no hay nada que registrar" hint="Lo que vivas jugando irá apareciendo aquí, capítulo a capítulo." />
  }

  const byDay = new Map<number, DiarioEntry[]>()
  for (const entry of entries) {
    if (!byDay.has(entry.day)) byDay.set(entry.day, [])
    byDay.get(entry.day)!.push(entry)
  }
  const days = Array.from(byDay.keys()).sort((a, b) => a - b)

  return (
    <div className="flex flex-col gap-3">
      {chapters.length > 0 && (
        <div className="mb-1 flex flex-col gap-2">
          <PanelSection title="Resumen por capítulos">
            <div className="flex flex-col gap-2">
              {chapters.map((c) => (
                <div key={c.chapterNumber} className="rounded-lg border border-accent-600/40 bg-accent-500/5 px-3.5 py-2.5">
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-accent-400">
                    Capítulo {c.chapterNumber}
                  </p>
                  <p className="text-sm leading-relaxed text-wood-200">
                    <EnciclopediaLinkedText
                      text={c.summary}
                      index={enciclopediaIndex}
                      onDetail={(t) => onEntityDetail?.(t)}
                      onQuickInsert={(t) => onEntityQuickInsert?.(t)}
                    />
                  </p>
                </div>
              ))}
            </div>
          </PanelSection>
          <PanelSection title="Registro completo" />
        </div>
      )}
      {days.map((day) => (
        <div key={day} className="flex flex-col gap-2">
          <p className="sticky top-0 z-10 -mx-1 bg-wood-950/90 px-1 py-1 text-2xs font-semibold uppercase tracking-[0.14em] text-wood-400">
            Día {day}
          </p>
          {byDay.get(day)!.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
              <div className="mb-1 flex items-center gap-2">
                <span className={channelClasses[entry.channel]} />
                <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-wood-400">{channelLabel[entry.channel]}</span>
                <span className="text-wood-600">·</span>
                <span className="text-2xs tracking-wide text-wood-400">{entry.timeLabel}</span>
                {!!entry.xpDelta && (
                  <span className="rounded-full border border-accent-600/50 bg-accent-500/10 px-1.5 py-0.5 font-mono text-2xs text-accent-300">
                    +{entry.xpDelta} XP
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-wood-200">
                <EnciclopediaLinkedText
                  text={entry.text}
                  index={enciclopediaIndex}
                  onDetail={(t) => onEntityDetail?.(t)}
                  onQuickInsert={(t) => onEntityQuickInsert?.(t)}
                />
              </p>
              {entry.roll && <RollBadge roll={entry.roll} />}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
