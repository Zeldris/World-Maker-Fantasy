import { memo, useEffect, useRef, useState } from 'react'
import type { CombatExchangeInfo, CondicionFisica, LogEntry } from '../types'
import { RollBadge } from './RollBadge'
import { CombatExchangeBadge } from './CombatExchangeBadge'
import { DiceRollReveal } from './DiceRollReveal'
import { PanelRivets } from './Rivet'
import { EnciclopediaLinkedText } from './EnciclopediaLinkedText'
import { useEnciclopediaLink } from '../context/useEnciclopediaLink'
import { OfferCard } from './OfferCard'

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
  /// Colapsar este panel (2026-08-14, petición explícita: "que pueda colapsar el log de
  /// personaje... y que el de mundo ocupe todo") — sin `onCollapse`, no sale ningún botón (mismo
  /// patrón opcional que el resto de callbacks de esta interfaz). `collapseIcon` decide el
  /// glifo: GameView.tsx pasa uno que apunta hacia el borde de pantalla más cercano a este panel.
  onCollapse?: () => void
  collapseIcon?: string
  /// Alternar de canal (2026-08-17, log de Reino que se alterna con el de mundo, uno u otro,
  /// nunca los dos a la vez) — sin `onToggleView`, no sale ningún botón (mismo patrón opcional
  /// que `onCollapse`). `toggleViewLabel` es el texto del botón (apunta a la vista A LA QUE SE
  /// CAMBIARÍA, no a la actual — p.ej. "Reino" mientras se ve "El mundo").
  onToggleView?: () => void
  toggleViewLabel?: string
  /// Nombre real del personaje (2026-08-14, petición explícita: "poner la mención al npc o
  /// personaje que ganó el turno") — reenviado tal cual a CombatExchangeBadge; el nombre del NPC
  /// rival viaja YA en cada `entry.npcAbilityUsed.npcName`, no hace falta pasarlo aparte aquí.
  characterName?: string
  /// Animación de dados en paralelo (petición explícita, 2026-08-15) — intercambio de combate ya
  /// resuelto que llega ANTES que el texto de narración (ver DiceRollReveal.tsx); se pinta dentro
  /// de la propia tarjeta de "pensando" mientras la narración se sigue generando debajo. `null`/
  /// ausente = turno sin intercambio de combate, la tarjeta de "pensando" sigue igual que siempre.
  diceReveal?: { exchange: CombatExchangeInfo; npcName: string | null } | null
  /// Botones Aceptar/Cancelar en una oferta de misión (2026-08-26, `entry.questOffer`) — opcional,
  /// mismo criterio que `onCollapse`/`onToggleView`: sin estos dos callbacks, LogPanel simplemente
  /// no pinta la tarjeta de oferta (aunque no debería pasar — GameView.tsx los pasa siempre en el
  /// panel de "Tu personaje", el único que puede recibir `questOffer`).
  onAcceptQuestOffer?: (entryId: string, title: string, description: string) => void
  onDismissQuestOffer?: (entryId: string) => void
  /// "Modo dinámico" (2026-08-27, `entry.dynamicModeOffer`) — mismo criterio opcional que
  /// `onAcceptQuestOffer`/`onDismissQuestOffer`.
  onInteractuarModoDinamico?: (entryId: string, tipo: 'NPC' | 'FAUNA', targetSlug: string, targetName: string) => void
  onDismissDynamicModeOffer?: (entryId: string) => void
  /// CONVALECIENTE deja de ser "victoria automática" (2026-08-26) — `combatNpcsDisplay` es el
  /// mismo estado en vivo que ya usa CombatPanel.tsx (useCombatFlow.ts). Antes solo se usaba para
  /// saber si un `entry.convalecienteOffers` concreto ya se había resuelto; desde el fix del
  /// 2026-08-28 ("recargar tras Convaleciente atasca el combate del todo" — la oferta vivía SOLO en
  /// el `characterLog` efímero de React, sin reconstruirse tras F5) la tarjeta persistente de abajo
  /// se calcula DIRECTAMENTE de aquí (filtrando CONVALECIENTE sin `dismissed`), sin depender de
  /// ninguna `LogEntry` concreta — `name`/`capturable` hacen falta para poder pintar la tarjeta sin
  /// tener que ir a buscarlos a otro sitio.
  combatNpcsDisplay?: { slug: string; name: string; condicion: CondicionFisica; dismissed?: boolean; capturable?: boolean; targetedForKill?: boolean }[]
  onMatarConvaleciente?: (npcSlug: string) => void
  /// Atajo a Diario (2026-08-27, auditoría de diseño/UX § 4.3: "no hay ningún atajo desde el log
  /// en vivo hacia el Diario — el jugador tiene que saber por su cuenta que existe esa pestaña
  /// aparte" — este log solo muestra las últimas 24h por diseño, ver comentario de `entries`).
  /// Mismo patrón opcional que `onCollapse`/`onToggleView`: sin este callback, no sale el enlace.
  onViewFullHistory?: () => void
  onCapturarConvaleciente?: (npcSlug: string) => void
  onClementeConvaleciente?: (npcSlug: string) => void
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
    // Botones de colapsar/alternar (2026-08-18, "los botones para colapsar los logs no se ven
    // nada claros" — el primer intento con fondo iron-800 seguía siendo casi tan oscuro como el
    // propio panel): chip con relleno de color y resplandor propio, no solo texto apagado.
    controlButton:
      'border-accent-500/60 bg-accent-500/20 text-accent-300 shadow-[0_0_8px_-2px_var(--color-accent-500)] hover:border-accent-400 hover:bg-accent-500/35',
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
    controlButton:
      'border-accent2-500/60 bg-accent2-500/20 text-accent2-300 shadow-[0_0_8px_-2px_var(--color-accent2-500)] hover:border-accent2-400 hover:bg-accent2-500/35',
  },
}

// Auditoría de rendimiento 2026-07-28 ("rascar segundos"): memoizado — GameView.tsx monta DOS
// LogPanel a la vez ("Tu personaje"/"El mundo") y re-renderiza en cada chunk de narración en
// streaming (varias veces por segundo). El panel "El mundo" recibe props completamente estables
// mientras narra el canal de personaje (ni `worldLog` ni `worldFlavor` cambian en ese momento),
// así que memo() le evita re-renderizar (y volver a montar cada LogEntry) sin ninguna razón real
// — el panel que SÍ está narrando sigue re-renderizando igual, sus props sí cambian de verdad.
export const LogPanel = memo(function LogPanel({
  title,
  subtitle,
  entries,
  accent,
  isThinking,
  thinkingText,
  streaming,
  emptyHint,
  combate,
  onCollapse,
  collapseIcon,
  onToggleView,
  toggleViewLabel,
  characterName,
  diceReveal,
  onAcceptQuestOffer,
  onDismissQuestOffer,
  onInteractuarModoDinamico,
  onDismissDynamicModeOffer,
  combatNpcsDisplay,
  onMatarConvaleciente,
  onCapturarConvaleciente,
  onClementeConvaleciente,
  onViewFullHistory,
}: LogPanelProps) {
  const { enciclopediaIndex, onEntityDetail, onEntityQuickInsert } = useEnciclopediaLink()
  const scrollRef = useRef<HTMLDivElement>(null)
  const classes = accentClasses[accent]

  // Bug real (pendiente 2026-08-27, "el foco no siempre baja a la narración" — investigado
  // 2026-08-28): con `behavior: 'smooth'` en CADA chunk (cada ~200-300ms mientras narra), cualquier
  // gesto de scroll manual del usuario (rueda del ratón, trackpad) durante el streaming CANCELA la
  // animación programática en curso — comportamiento estándar del navegador, sin evento para
  // detectarlo y reintentar. El siguiente chunk relanzaba un nuevo scroll suave, pero si el usuario
  // no volvía a tocar el scroll, la vista se quedaba a medio camino sin motivo aparente — "en
  // muchas narraciones", no todas, coincide justo con las veces que hubo ese gesto de por medio.
  // Fix: instantáneo (`'auto'`) mientras NO se está narrando en directo (`!isThinking`) — cubre
  // tanto la transición true→false del streaming normal como el caso de viaje/tránsito
  // (2026-08-30, bug real: `useTurnFlow.ts` pone `isThinking` en `false` INMEDIATAMENTE tras
  // clasificar, y las entradas reales del viaje llegan después de golpe vía `syncFromSave` — para
  // entonces `isThinking` ya llevaba un rato en `false`, así que la vieja condición de "transición
  // en este mismo render" nunca se cumplía y el scroll se quedaba en `'smooth'`, sin garantía de
  // completarse). Mientras SIGUE narrando (`isThinking` true), se mantiene `'smooth'` — más
  // agradable de ver, y si un scroll manual cancela una animación intermedia no importa: el chunk
  // siguiente relanza el scroll normal.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: isThinking ? 'smooth' : 'auto' })
    // thinkingText en la dependencia (roadmap de velocidad, 2026-07-20): con streaming, la
    // tarjeta "pensando" crece de tamaño en vivo — sin esto, el scroll no la sigue mientras narra.
    // Los chunks llegan cada ~200-300ms en este hardware (3-4,5 tok/s medido), no cada frame.
    // diceReveal (petición explícita, 2026-08-15: "asegurarse de que hace bien el focus a la parte
    // final de la narración... en combate") — el intercambio resuelto llega y monta
    // `DiceRollReveal` ANTES de que empiece a narrar (ver onExchangeResolved), creciendo la
    // tarjeta de "pensando" de golpe; sin esto en la dependencia, la vista se quedaba donde
    // estaba mientras los dados giraban, sin bajar a mostrarlos.
  }, [entries.length, isThinking, thinkingText, diceReveal])

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
        <div className="min-w-0 flex-1">
          <h2 className={`font-serif text-sm tracking-wide ${classes.heading}`}>{title}</h2>
          <p className="text-2xs text-wood-400">{subtitle}</p>
        </div>
        {onToggleView && (
          <button type="button"
            onClick={onToggleView}
            title={`Ver "${toggleViewLabel}"`}
            className={`tactile relative shrink-0 rounded-full border px-2.5 py-1 text-2xs font-bold uppercase tracking-wide transition-colors ${classes.controlButton}`}
          >
            {toggleViewLabel}
          </button>
        )}
        {onCollapse && (
          <button type="button"
            onClick={onCollapse}
            title={`Colapsar "${title}"`}
            className={`tactile relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-base transition-colors ${classes.controlButton}`}
          >
            {collapseIcon}
          </button>
        )}
        <div className={`absolute inset-x-0 bottom-0 overflow-hidden ${classes.hairline}`}>
          {tollTick > 0 && (
            <span key={tollTick} aria-hidden="true" className={`animate-hairline-toll absolute inset-0 ${classes.tollGradient}`} />
          )}
        </div>
      </header>
      {onViewFullHistory && (
        <button type="button"
          onClick={onViewFullHistory}
          className="tactile shrink-0 px-4 pb-1 text-left text-2xs text-wood-500 transition-colors hover:text-accent-300"
        >
          Ver historial completo en el Diario →
        </button>
      )}
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
                // Notificación de misión COMPLETADA (2026-08-13) — mismo fondo amarillo que
                // `newQuest` (es el mismo tipo de evento, alta vs. cierre), en su propia LogEntry
                // aparte, así que nunca coincide con `newQuest` en la misma fila.
                // Eventos de viaje interactivos (2026-08-05) — 4º estado, fondo ámbar: por debajo
                // de `newQuest` pero por encima de `combate`/`isPlayerAction` (es su propia
                // LogEntry aparte, nunca coincide con ninguno de los otros tres en la misma fila).
                entry.newQuest || entry.questCompleted || entry.questOffer || entry.questOfferResolved
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
              {/* Mismo hueco exacto que npcAbilityUsed pero para el jugador (revisión de partida
                  2026-08-08, petición explícita: "cuando seleccione una habilidad esta se refleje
                  en la narración con su descripción") — usa el icono real de la habilidad en vez
                  del genérico 🗡️/🛡️, y muestra la descripción para saber qué hace de verdad. */}
              {entry.playerAbilityUsed && (
                <div className="mb-1 flex items-start gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-accent-400">
                  <span aria-hidden="true" className="shrink-0 text-sm not-italic">
                    {entry.playerAbilityUsed.icon}
                  </span>
                  <span className="normal-case tracking-normal">
                    <span className="font-semibold uppercase tracking-[0.1em]">
                      {entry.playerAbilityUsed.rol === 'ataque' ? 'Usas' : 'Te defiendes con'} "{entry.playerAbilityUsed.name}"
                    </span>
                    {entry.playerAbilityUsed.description && <span className="ml-1.5 font-normal text-wood-400">— {entry.playerAbilityUsed.description}</span>}
                  </span>
                </div>
              )}
              {/* whitespace-pre-line (bug real, 2026-08-30, "esta respuesta ha quedado rara"): un
                  `\n\n` en el texto (p.ej. la despedida de Gistera tras aceptar la misión, quests.ts)
                  se colapsaba a un simple espacio por el HTML por defecto — la reacción de Gorhorn
                  y la de Gistera se leían pegadas en la misma frase corrida, sin ninguna pausa entre
                  ambas. Inocuo para el resto de narraciones (sin `\n\n` en el texto, se ve idéntico). */}
              <p className="whitespace-pre-line">
                <EnciclopediaLinkedText
                  text={entry.text}
                  index={enciclopediaIndex}
                  onDetail={(t) => onEntityDetail?.(t)}
                  onQuickInsert={(t) => onEntityQuickInsert?.(t)}
                />
              </p>
              {/* Bug real (2026-08-14, petición explícita: "ahora hay 3" — la tirada del jugador
                  salía dos veces, aquí y dentro de CombatExchangeBadge más abajo): el backend
                  copia la tirada del jugador de un intercambio al campo genérico `roll` por
                  compatibilidad con otros sitios que solo lo leen a él (turnResolution.ts,
                  `combatExchangeRoll ?? roll`) — cuando hay `combatExchange`, ese mismo número ya
                  se muestra ahí (fila "Tú"), con más contexto (el lado del enemigo, quién gana). */}
              {entry.roll && !entry.combatExchange && <RollBadge roll={entry.roll} />}
              {entry.combatExchange && (
                <CombatExchangeBadge exchange={entry.combatExchange} playerName={characterName} enemyName={entry.npcAbilityUsed?.npcName} />
              )}
              {entry.newQuest && (
                <div className="mt-2 rounded-lg border border-quest-600/50 bg-quest-500/10 px-2.5 py-2">
                  <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-quest-400">
                    <span aria-hidden="true">🎯</span>
                    <span>Nueva misión: {entry.newQuest.title}</span>
                  </p>
                  <p className="mt-1 text-2xs text-wood-300">{entry.newQuest.objetivo}</p>
                </div>
              )}
              {/* Botones Aceptar/Cancelar (2026-08-26, petición explícita: "en vez de depender de
                  que la jugadora escriba texto libre para aceptar... que 'Aceptar' genere una
                  narración determinista de aceptación, sin esperar a que el LLM decida") — la
                  Quest todavía no existe en la base de datos, solo se ofrece (`newQuestOfferInfo`,
                  turnResolution.ts). "Aceptar" la materializa de verdad vía
                  POST /saves/:id/quests/aceptar; "Cancelar" solo limpia la tarjeta, sin backend. */}
              {/* Botones Aceptar/Cancelar (2026-08-26, petición explícita: "en vez de depender de
                  que la jugadora escriba texto libre para aceptar... que 'Aceptar' genere una
                  narración determinista de aceptación, sin esperar a que el LLM decida") — la
                  Quest todavía no existe en la base de datos, solo se ofrece (`newQuestOfferInfo`,
                  turnResolution.ts). "Aceptar" la materializa de verdad vía
                  POST /saves/:id/quests/aceptar; "Cancelar" solo limpia la tarjeta, sin backend. */}
              {entry.questOffer && (
                <OfferCard
                  tone="quest"
                  icon="🎯"
                  title={`Misión propuesta: ${entry.questOffer.title}`}
                  subtitle={entry.questOffer.description}
                  actions={[
                    { label: 'Aceptar', tone: 'primary', onClick: () => onAcceptQuestOffer?.(entry.id, entry.questOffer!.title, entry.questOffer!.description) },
                    { label: 'Cancelar', tone: 'neutral', onClick: () => onDismissQuestOffer?.(entry.id) },
                  ]}
                />
              )}
              {/* "Modo dinámico" (2026-08-27, `entry.dynamicModeOffer`) — mismo patrón que la
                  tarjeta de misión: oferta opcional al final del turno, nunca lo interrumpe.
                  "Interactuar" abre el mini-flujo (DynamicModeModal.tsx); "Ignorar" solo limpia
                  la tarjeta. B.9/B.10 (checklist frontend 2026-08-27): `accent2` (azulado, canal
                  "El mundo") en vez del "quest" amarillo, más segunda línea de contexto. `busy`/
                  `error` (A.7): antes un fallo de red dejaba los botones sin explicación. */}
              {entry.dynamicModeOffer && (
                <OfferCard
                  tone="accent2"
                  icon="💬"
                  title={`${entry.dynamicModeOffer.targetName} busca tu atención`}
                  subtitle={entry.dynamicModeOffer.tipo === 'NPC' ? 'Puedes hablar con esta persona.' : 'Hay algo cerca con lo que puedes interactuar.'}
                  error={entry.dynamicModeOffer.error}
                  actions={[
                    {
                      label: entry.dynamicModeOffer.busy ? 'Interactuando...' : 'Interactuar',
                      tone: 'primary',
                      disabled: entry.dynamicModeOffer.busy,
                      onClick: () =>
                        onInteractuarModoDinamico?.(
                          entry.id,
                          entry.dynamicModeOffer!.tipo,
                          entry.dynamicModeOffer!.targetSlug,
                          entry.dynamicModeOffer!.targetName,
                        ),
                    },
                    { label: 'Ignorar', tone: 'neutral', disabled: entry.dynamicModeOffer.busy, onClick: () => onDismissDynamicModeOffer?.(entry.id) },
                  ]}
                />
              )}
              {/* CONVALECIENTE deja de ser "victoria automática" (2026-08-26, petición explícita)
                  — una tarjeta por cada NPC que pasó a CONVALECIENTE este turno, con Matar/
                  Capturar/Clemente; bloquea el composer (CombatComposer.tsx §
                  `pendingDecisions`) hasta que TODAS estén resueltas. El estado de "ya resuelto"
                  no vive en la propia LogEntry — se mira en vivo contra `combatNpcsDisplay`, así
                  que sigue siendo correcto aunque la jugadora resuelva desde la tarjeta de un
                  turno posterior o anterior.
                  Fix 2026-08-28: mientras SIGUE pendiente, los botones activos ahora viven solo en
                  la tarjeta PERSISTENTE de más abajo (calculada de `combatNpcsDisplay`, sobrevive a
                  una recarga) — esta de aquí, ligada a la LogEntry del turno concreto, se queda como
                  registro histórico de "aquí pasó a convaleciente" y solo muestra acciones mientras
                  ninguna recarga ha intervenido (si ya se resolvió, sigue mostrando "Resuelto." como
                  siempre; si sigue pendiente, no repite los mismos 3 botones que ya están abajo). */}
              {entry.convalecienteOffers?.map((offer) => {
                const npc = combatNpcsDisplay?.find((n) => n.slug === offer.npcSlug)
                const resuelto = !npc || npc.condicion === 'MUERTO' || !!npc.dismissed
                if (!resuelto) return null
                return (
                  <OfferCard
                    key={offer.npcSlug}
                    tone="danger"
                    icon="⚠️"
                    title={`${offer.npcName} está convaleciente`}
                    resolvedText="Resuelto."
                    actions={[
                      { label: 'Matar', tone: 'danger', onClick: () => onMatarConvaleciente?.(offer.npcSlug) },
                      ...(offer.capturable ? [{ label: 'Capturar', tone: 'accent' as const, onClick: () => onCapturarConvaleciente?.(offer.npcSlug) }] : []),
                      { label: 'Clemente', tone: 'neutral', onClick: () => onClementeConvaleciente?.(offer.npcSlug) },
                    ]}
                  />
                )
              })}
              {entry.questCompleted && (
                <div className="mt-2 rounded-lg border border-quest-600/50 bg-quest-500/10 px-2.5 py-2">
                  <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-quest-400">
                    <span aria-hidden="true">🏆</span>
                    <span>Misión completada: {entry.questCompleted.title}</span>
                  </p>
                  <p className="mt-1 text-2xs text-wood-300">
                    {entry.questCompleted.grantedItems.length > 0 && `${entry.questCompleted.grantedItems.join(', ')} · `}
                    +{entry.questCompleted.rewardXp} XP
                  </p>
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
                {/* Feedback de UX (2026-08-30, "falta que la suma de repu o la perdida se refleje
                    en la UX... sino el usuario ni se entera") — mismo patrón visual que el chip de
                    XP, en rojo/verde según el signo del delta (hoy solo se dispara en negativo, al
                    matar/dejar convaleciente a un NPC de facción — el signo queda genérico por si
                    algún día una acción distinta suma reputación). */}
                {!!entry.factionRepChange && (
                  <span
                    className={`rounded-full border px-1.5 py-0.5 font-mono text-2xs ${
                      entry.factionRepChange.delta < 0 ? 'border-danger-600/50 bg-danger-500/10 text-danger-300' : 'border-moss-600/50 bg-moss-500/10 text-moss-300'
                    }`}
                  >
                    {entry.factionRepChange.delta > 0 ? '+' : ''}
                    {entry.factionRepChange.delta} {entry.factionRepChange.faction}
                  </span>
                )}
              </div>
            </div>
          ),
        )}
        {/* Fix 2026-08-28 ("recargar tras Convaleciente atasca el combate del todo"): tarjeta
            PERSISTENTE, calculada directamente de `combatNpcsDisplay` (estado real de combate, ya
            viene de `GET /saves/:id` — sobrevive a una recarga) — a diferencia de la de arriba
            (`entry.convalecienteOffers`, ligada al `characterLog` efímero de React, que nunca
            sobrevive a F5), esta no depende de haber visto nacer la oferta en el turno en curso.
            `!targetedForKill` (2026-08-30, bug real: la tarjeta reaparecía en cada turno mientras
            el NPC seguía convaleciente tras pulsar "Matar") — una vez elegido "Matar", la tarjeta
            desaparece (el panel de combate normal ya queda desbloqueado para atacar). */}
        {combatNpcsDisplay
          ?.filter((n) => n.condicion === 'CONVALECIENTE' && !n.dismissed && !n.targetedForKill)
          .map((npc) => (
            <OfferCard
              key={`persistent-convaleciente-${npc.slug}`}
              tone="danger"
              icon="⚠️"
              title={`${npc.name} está convaleciente`}
              actions={[
                { label: 'Matar', tone: 'danger', onClick: () => onMatarConvaleciente?.(npc.slug) },
                ...(npc.capturable ? [{ label: 'Capturar', tone: 'accent' as const, onClick: () => onCapturarConvaleciente?.(npc.slug) }] : []),
                { label: 'Clemente', tone: 'neutral', onClick: () => onClementeConvaleciente?.(npc.slug) },
              ]}
            />
          ))}
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
            {diceReveal && (
              <DiceRollReveal exchange={diceReveal.exchange} playerName={characterName} enemyName={diceReveal.npcName ?? undefined} />
            )}
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
