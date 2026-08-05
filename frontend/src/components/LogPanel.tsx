import { memo, useEffect, useRef, useState } from 'react'
import type { LogEntry } from '../types'
import { RollBadge } from './RollBadge'
import { PanelRivets } from './Rivet'
import { EnciclopediaLinkedText } from './EnciclopediaLinkedText'
import { useEnciclopediaLink } from '../context/useEnciclopediaLink'

interface LogPanelProps {
  title: string
  subtitle: string
  entries: LogEntry[]
  accent: 'accent' | 'accent2'
  isThinking?: boolean
  thinkingText?: string
  /// Combate en curso (2026-07-29, "tiene que salir en rojo cuando sea de combate"): la tarjeta
  /// de "pensando" normalmente sigue el tono de `accent`, pero en combate debe llevar el mismo
  /// tinte rojo que ya usan las entradas resueltas (`entry.combate` más abajo) — si no, nada
  /// distingue visualmente "el Narrador está resolviendo este turno de combate" de una espera
  /// normal fuera de combate.
  combate?: boolean
  /// Streaming (roadmap de velocidad, 2026-07-20, punto 13): true cuando `thinkingText` es la
  /// narración real creciendo palabra a palabra, no una frase de espera rotando — cambia cómo se
  /// renderiza (sin key-remount por cada carácter nuevo, que si no repetiría el fade-in en bucle).
  streaming?: boolean
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
    tollGradient: 'bg-[linear-gradient(90deg,transparent,var(--color-accent-300),transparent)]',
  },
  accent2: {
    gem: 'gem2',
    heading: 'text-accent2-300',
    hairline: 'accent2-hairline',
    playerBubble: 'border-accent2-600/40 bg-accent2-500/10',
    playerLabel: 'text-accent2-400',
    // Asimetría estática (roadmap de rediseño visual, Fable 2026-07-20, Nivel 1): "Tu personaje"
    // piensa con tono cálido denso (accent, sin textura); "El mundo" piensa con Hierro Grabado
    // añadido, reforzando que el mundo sigue su curso frío mientras esperas.
    thinkingCard: 'border-accent2-600/40 bg-accent2-500/5 iron-etched corner-bracket',
    thinkingLabel: 'text-accent2-300/90',
    thinkingDot: 'bg-accent2-400',
    thinkingRail: 'El mundo se mueve',
    tollGradient: 'bg-[linear-gradient(90deg,transparent,var(--color-accent2-300),transparent)]',
  },
}

// Auditoría de rendimiento 2026-07-28 ("rascar segundos"): memoizado — GameView.tsx monta DOS
// LogPanel a la vez ("Tu personaje"/"El mundo") y re-renderiza en cada chunk de narración en
// streaming (varias veces por segundo). El panel "El mundo" recibe props completamente estables
// mientras narra el canal de personaje (ni `worldLog` ni `worldFlavor` cambian en ese momento),
// así que memo() le evita re-renderizar (y volver a montar cada LogEntry) sin ninguna razón real
// — el panel que SÍ está narrando sigue re-renderizando igual, sus props sí cambian de verdad.
export const LogPanel = memo(function LogPanel({ title, subtitle, entries, accent, isThinking, thinkingText, streaming, emptyHint, combate }: LogPanelProps) {
  const { enciclopediaIndex, onEntityDetail, onEntityQuickInsert } = useEnciclopediaLink()
  const scrollRef = useRef<HTMLDivElement>(null)
  const classes = accentClasses[accent]

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    // thinkingText en la dependencia (roadmap de velocidad, 2026-07-20): con streaming, la
    // tarjeta "pensando" crece de tamaño en vivo — sin esto, el scroll no la sigue mientras narra.
    // Los chunks llegan cada ~200-300ms en este hardware (3-4,5 tok/s medido), no cada frame.
  }, [entries.length, isThinking, thinkingText])

  // Campanada silenciosa: un barrido único del hairline al pasar isThinking true→false —
  // anuncia que la respuesta llegó, sin sonido ni bucle (roadmap de animaciones 2026-07-20).
  const [tollTick, setTollTick] = useState(0)
  const wasThinkingRef = useRef(isThinking)
  useEffect(() => {
    if (wasThinkingRef.current && !isThinking) setTollTick((t) => t + 1)
    wasThinkingRef.current = isThinking
  }, [isThinking])

  return (
    <section className="plank-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
      <PanelRivets />
      <header className="relative flex items-center gap-2.5 px-4 py-3">
        <span className={isThinking ? `${classes.gem} animate-gem-breathe` : classes.gem} />
        <div className="min-w-0">
          <h2 className={`font-serif text-sm tracking-wide ${classes.heading}`}>{title}</h2>
          <p className="text-2xs text-wood-400">{subtitle}</p>
        </div>
        <div className={`absolute inset-x-0 bottom-0 overflow-hidden ${classes.hairline}`}>
          {tollTick > 0 && (
            <span key={tollTick} aria-hidden="true" className={`animate-hairline-toll absolute inset-0 ${classes.tollGradient}`} />
          )}
        </div>
      </header>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {entries.length === 0 && !isThinking && (
          <p className="pt-2 text-sm text-wood-500 italic">{emptyHint}</p>
        )}
        {entries.map((entry) =>
          entry.isLevelUp ? (
            <div
              key={entry.id}
              className="animate-entry-in relative overflow-hidden rounded-lg border border-accent-500/60 bg-accent-500/10 px-3.5 py-2.5 text-sm text-wood-100"
            >
              <span
                aria-hidden="true"
                className="animate-sheen-sweep-once pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.14)_50%,transparent_70%)]"
              />
              <div className="relative flex items-center gap-2">
                <span className={`${classes.gem} animate-stamp-in`} />
                <p className="font-serif font-semibold text-accent-300">{entry.text}</p>
              </div>
              <p className="relative mt-1.5 text-2xs tracking-wide text-wood-400">{entry.timeLabel}</p>
            </div>
          ) : (
            <div
              key={entry.id}
              className={
                // Rediseño de la vista de combate (2026-07-28, petición explícita: "narraciones
                // del combate se vean reflejadas... con fondo color rojo") — el tinte de combate
                // manda sobre el de "tu acción" (una entrada puede ser ambas a la vez), nunca al
                // revés; fuera de combate, el estilo de siempre. Notificación de misión aceptada
                // (2026-07-31, petición explícita: "fondo azul la narración normal, rojo combate y
                // amarillo misiones") — `newQuest` manda sobre todo lo demás (es el evento más raro
                // y específico de los tres); la narración normal pasa de texto plano a un fondo
                // azul explícito, para que los 3 estados queden igual de intencionados.
                // Eventos de viaje interactivos (2026-08-05) — 4º estado, fondo ámbar: por debajo
                // de `newQuest` pero por encima de `combate`/`isPlayerAction` (es su propia
                // LogEntry aparte, nunca coincide con ninguno de los otros tres en la misma fila).
                entry.newQuest
                  ? 'animate-entry-in rounded-lg border border-l-2 border-quest-600/50 bg-quest-500/10 px-3.5 py-2.5 text-sm text-wood-100'
                  : entry.travelInterrupted
                    ? 'animate-entry-in rounded-lg border border-l-2 border-cost-600/50 bg-cost-500/10 px-3.5 py-2.5 text-sm text-wood-100'
                    : entry.combate
                      ? 'animate-entry-in rounded-lg border border-l-2 border-red-700/50 bg-danger-500/10 px-3.5 py-2.5 text-sm text-wood-100'
                      : entry.isPlayerAction
                        ? `animate-entry-in rounded-lg border border-l-2 px-3.5 py-2.5 text-sm text-wood-100 ${classes.playerBubble}`
                        : 'animate-entry-in rounded-lg border border-l-2 border-accent-600/50 bg-accent-500/10 px-3.5 py-2.5 text-sm text-wood-100'
              }
            >
              {entry.isPlayerAction && (
                <p className={`mb-1 text-2xs font-semibold uppercase tracking-[0.14em] ${classes.playerLabel}`}>
                  Tu acción
                </p>
              )}
              {entry.travelInterrupted && (
                <p className="mb-1 flex items-center gap-1 text-2xs font-semibold uppercase tracking-[0.1em] text-cost-400">
                  <span aria-hidden="true">🧭</span>
                  <span>Viaje interrumpido</span>
                </p>
              )}
              {entry.npcAbilityUsed && (
                <p className="mb-1 flex items-center gap-1 text-2xs font-semibold uppercase tracking-[0.1em] text-danger-400">
                  <span aria-hidden="true">{entry.npcAbilityUsed.rol === 'ataque' ? '🗡️' : '🛡️'}</span>
                  <span>
                    {entry.npcAbilityUsed.npcName} {entry.npcAbilityUsed.rol === 'ataque' ? 'ataca con' : 'se defiende con'} "
                    {entry.npcAbilityUsed.abilityName}"
                  </span>
                </p>
              )}
              <p>
                <EnciclopediaLinkedText
                  text={entry.text}
                  index={enciclopediaIndex}
                  onDetail={(t) => onEntityDetail?.(t)}
                  onQuickInsert={(t) => onEntityQuickInsert?.(t)}
                />
              </p>
              {entry.roll && <RollBadge roll={entry.roll} />}
              {entry.newQuest && (
                <div className="mt-2 rounded-lg border border-quest-600/50 bg-quest-500/10 px-2.5 py-2">
                  <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-quest-400">
                    <span aria-hidden="true">🎯</span>
                    <span>Nueva misión: {entry.newQuest.title}</span>
                  </p>
                  <p className="mt-1 text-2xs text-wood-300">{entry.newQuest.objetivo}</p>
                </div>
              )}
              {entry.entityBanner && (
                <button
                  type="button"
                  onClick={() => {
                    const target = enciclopediaIndex.entries.get(entry.entityBanner!.name.toLowerCase())
                    if (target) onEntityDetail?.(target)
                  }}
                  className="tactile group mt-2 block w-full overflow-hidden rounded-lg border border-iron-700 bg-wood-950/40 text-left transition-colors hover:border-accent-600/60"
                >
                  <img src={entry.entityBanner.imageUrl} alt="" className="aspect-[2.5/1] w-full object-cover" />
                  <p className="flex items-center gap-1.5 px-2.5 py-1.5 text-2xs text-wood-300 group-hover:text-accent-300">
                    <span aria-hidden="true">{entry.entityBanner.icon}</span>
                    <span className="font-medium">{entry.entityBanner.name}</span>
                  </p>
                </button>
              )}
              <div className="mt-1.5 flex items-center gap-2">
                <p className="text-2xs tracking-wide text-wood-400">{entry.timeLabel}</p>
                {!!entry.xpDelta && (
                  <span className="rounded-full border border-accent-600/50 bg-accent-500/10 px-1.5 py-0.5 font-mono text-2xs text-accent-300">
                    +{entry.xpDelta} XP
                  </span>
                )}
              </div>
            </div>
          ),
        )}
        {isThinking && (
          <div
            className={`relative overflow-hidden rounded-lg border border-dashed px-3.5 py-3 ${
              combate ? 'border-red-700/50 bg-danger-500/10' : classes.thinkingCard
            }`}
          >
            <div className="thinking-sheen" />
            <div className="flex items-center gap-2.5">
              {/* Los 3 puntos parpadeantes se retiran (roadmap de animaciones 2026-07-20): la
                  gema del header ya respira mientras se piensa — dos bucles a la vez (ella +
                  thinking-sheen) es el tope de presupuesto en este hardware, no tres. */}
              <span className={`h-1.5 w-1.5 rounded-full ${combate ? 'bg-red-400' : classes.thinkingDot}`} />
              <p className={`text-2xs font-semibold uppercase tracking-[0.14em] ${combate ? 'text-red-300' : classes.thinkingLabel}`}>
                {combate ? 'Resolviendo combate' : classes.thinkingRail}
              </p>
            </div>
            {thinkingText &&
              (streaming ? (
                <p className="mt-2 text-xs leading-relaxed text-wood-200">{thinkingText}</p>
              ) : (
                <p key={thinkingText} className="animate-entry-in mt-2 text-xs italic leading-relaxed text-wood-300">
                  {thinkingText}
                </p>
              ))}
          </div>
        )}
      </div>
    </section>
  )
})
