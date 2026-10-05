import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import { isExtendedLogRoll, type CombatExchangeInfo, type CondicionFisica, type LogEntry, type MetodoObtencion } from '../types'
import { RollBadge } from './RollBadge'
import { ExtendedRollBadge } from './ExtendedRollBadge'
import { DiceRollSingle } from './DiceRoll'
import { CombatExchangeBadge } from './CombatExchangeBadge'
import { DiceRollReveal } from './DiceRollReveal'
import { PanelRivets } from './Rivet'
import { EnciclopediaLinkedText } from './EnciclopediaLinkedText'
import { NoticiaMundo, type ResponderPropuesta } from './NoticiaMundo'
import { useEnciclopediaLink } from '../context/useEnciclopediaLink'
import { OfferCard } from './OfferCard'
import { presentacionOferta } from '../lib/ofertaModoDinamico'
import { combatKeyFor } from '../lib/gameViewHelpers'
import { retrasoEnVivo } from '../lib/presentacionTurno'
import { professions } from '../data/professions'
import { Chip } from './base/Chip'

interface LogPanelProps {
  /// UX-4 (hito 0.1) — motivo global por el que ahora no se puede actuar (mismo `bloqueoTurno` de
  /// GameView.tsx); se reenvía a todas las tarjetas de oferta. `null`/ausente = libre.
  bloqueoAcciones?: string | null
  /// Motivo para las tarjetas del propio combate (Matar / Capturar / Clemente de un convaleciente).
  /// En la fase de combate son justo la acción que toca, así que GameView pasa null; mientras el
  /// narrador escribe o fuera de combate, el mismo motivo que el resto. Ausente = `bloqueoAcciones`.
  bloqueoCombate?: string | null
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
  /// CR-34 (34e): responder a la propuesta de una facción al Reino (noticia de «El mundo»). Sin él,
  /// los botones salen deshabilitados.
  onResponderPropuesta?: ResponderPropuesta
  /// NAR-9: abre el panel de Leyendas en la entrada del suceso de una noticia.
  onVerLeyendas?: (sucesoId: string) => void
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
  /// Reenviado a `DiceRollReveal` (2026-09-20) — dispara cuando el segundo dado del intercambio
  /// termina de aterrizar de verdad, para que `useCombatFlow.ts` sincronice la vida/condición
  /// actualizada con ese instante exacto en vez de un `setTimeout` fijo aparte.
  onDiceRevealAllLanded?: () => void
  /// Botones Aceptar/Cancelar en una oferta de misión (2026-08-26, `entry.questOffer`) — opcional,
  /// mismo criterio que `onCollapse`/`onToggleView`: sin estos dos callbacks, LogPanel simplemente
  /// no pinta la tarjeta de oferta (aunque no debería pasar — GameView.tsx los pasa siempre en el
  /// panel de "Tu personaje", el único que puede recibir `questOffer`).
  onAcceptQuestOffer?: (entryId: string, title: string, description: string) => void
  onDismissQuestOffer?: (entryId: string) => void
  /// Responder escribiendo (petición de la usuaria, 2026-10-02) — cuando una persona te habla o te
  /// corta el paso, «✍️ Responder» lleva al composer con «Le digo a <nombre>: » ya puesto, para
  /// contestar con texto libre sin pasar por el modo dinámico.
  onResponderEscribiendo?: (targetName: string) => void
  /// "Modo dinámico" (2026-08-27, `entry.dynamicModeOffer`) — mismo criterio opcional que
  /// `onAcceptQuestOffer`/`onDismissQuestOffer`. Solo NPC/FAUNA (conversación de vueltas, abre
  /// DynamicModeModal) — RECURSO usa `onVerRecursoDetalle` abajo (modal de detalle propio).
  onInteractuarModoDinamico?: (
    entryId: string,
    tipo: 'NPC' | 'FAUNA',
    targetSlug: string,
    targetName: string,
    quienInicia?: 'jugador' | 'npc',
    combateForzado?: boolean,
    // Agresivo en grupo (Fase 2, 2026-09-28) — reenvía `offer.zonePointId`/`cantidad` tal cual.
    zonePointId?: string,
    cantidad?: number,
  ) => void
  /// RECURSO (2026-09-08, "Ver qué hay en la zona") — a diferencia de NPC/FAUNA, no abre
  /// conversación. Desde 2026-09-29 "Interactuar" abre el modal de detalle del elemento
  /// (RecursoDetalleModal, estado en useModoDinamico.ts), cuyo botón (Talar/Minar/Recolectar...) es
  /// quien dispara la recolección real de una sola llamada (tirada + inventario + LogEntry).
  onVerRecursoDetalle?: (entryId: string, targetSlug: string, targetName: string, metodo?: MetodoObtencion | null) => void
  /// Cazar desde la tarjeta de encuentro (Fase 2, 2026-09-28,
  /// `plan-mecanicas-por-zona-2026-09-28.md`) — solo se ofrece para FAUNA no forzada con
  /// `zonePointId` (un grupo real con el que se ha colisionado en el mapa); caza ESE grupo exacto,
  /// nunca por sorteo de población regional como el viejo botón suelto "Cazar".
  onCazarEnZona?: (entryId: string, zonePointId: string) => void
  onDismissDynamicModeOffer?: (entryId: string) => void
  /// Menú contextual de interacción con NPC (2026-09-06, `entry.npcInteractionOffer`) — mismo
  /// criterio opcional que `onInteractuarModoDinamico`, un solo callback para cualquier opción
  /// (incluida "Salir"), a diferencia de aceptar/cancelar de misión.
  onChooseNpcInteraction?: (entryId: string, npcSlug: string, opcion: string) => void
  /// Recolección por texto libre redirigida al mapa de la zona (Pieza 6d 2026-09-03; Fase 4
  /// 2026-09-28, `entry.harvestSuggestion`) — abre el modal de movimiento (🧭). Sin "Ignorar": el
  /// mensaje ya narra el rechazo, este botón es pura comodidad.
  onOpenHarvestSuggestion?: () => void
  /// CONVALECIENTE deja de ser "victoria automática" (2026-08-26) — `combatNpcsDisplay` es el
  /// mismo estado en vivo que ya usa CombatPanel.tsx (useCombatFlow.ts). Antes solo se usaba para
  /// saber si un `entry.convalecienteOffers` concreto ya se había resuelto; desde el fix del
  /// 2026-08-28 ("recargar tras Convaleciente atasca el combate del todo" — la oferta vivía SOLO en
  /// el `characterLog` efímero de React, sin reconstruirse tras F5) la tarjeta persistente de abajo
  /// se calcula DIRECTAMENTE de aquí (filtrando CONVALECIENTE sin `dismissed`), sin depender de
  /// ninguna `LogEntry` concreta — `name`/`capturable` hacen falta para poder pintar la tarjeta sin
  /// tener que ir a buscarlos a otro sitio.
  /// `participantId` (bug real 2026-09-03, mismo hueco que ya se cerró en useCombatFlow.ts pero
  /// reaparecido aquí en la cadena LogPanel→GameView): con 2+ individuos del mismo tipo en el
  /// mismo `CombatEncounter`, resolver por `slug` a secas siempre coge el PRIMERO del array, sin
  /// importar cuál tarjeta pulsó la jugadora — `onMatarConvaleciente`/etc. de abajo deben recibir
  /// la key real (`combatKeyFor`, participantId cuando existe) para poder actuar sobre el
  /// individuo correcto.
  combatNpcsDisplay?: { slug: string; participantId?: string; name: string; condicion: CondicionFisica; dismissed?: boolean; capturable?: boolean; targetedForKill?: boolean }[]
  onMatarConvaleciente?: (npcKey: string) => void
  /// Atajo a Diario (2026-08-27, auditoría de diseño/UX § 4.3: "no hay ningún atajo desde el log
  /// en vivo hacia el Diario — el jugador tiene que saber por su cuenta que existe esa pestaña
  /// aparte" — este log solo muestra las últimas 24h por diseño, ver comentario de `entries`).
  /// Mismo patrón opcional que `onCollapse`/`onToggleView`: sin este callback, no sale el enlace.
  onViewFullHistory?: () => void
  onCapturarConvaleciente?: (npcKey: string) => void
  onClementeConvaleciente?: (npcKey: string) => void
  /// Tirada en vivo vs histórica (2026-09-04, centralización de todas las tiradas del juego) —
  /// ids de `LogEntry` recién añadidas en ESTA sesión (turno normal/Huir resuelto en vivo, nunca
  /// tocado por la carga inicial de partida — ver `liveRevealedIdsRef`, GameView.tsx). Si el id de
  /// la entrada está aquí, su tirada anima con `DiceRollSingle` (primera vez que se ve); si no,
  /// `RollBadge` estático (recarga, Diario, o simplemente turnos anteriores de esta misma sesión
  /// que ya se vieron una vez). Ausente = comportamiento siempre estático, mismo criterio opcional
  /// que el resto de props de este componente.
  liveEntryIds?: Set<string>
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

// Nombre visible de un oficio (2026-09-04, auditoría "representar siempre XP/profesión/reputación")
// — `professionXpGain.oficio` que llega del backend es el slug técnico (`professionId`, ej.
// "minero-orcos-llanuras"), no un nombre legible; mismo catálogo estático que ya usa
// HabilidadesPanel.tsx para resolver `profession.name` a partir de `professionId`. Fallback al
// slug crudo si algún día se sembrara un oficio nuevo sin entrada aquí, en vez de no mostrar nada.
function professionNameFor(oficio: string): string {
  return professions.find((p) => p.id === oficio)?.name ?? oficio
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
  onResponderPropuesta,
  onVerLeyendas,
  onToggleView,
  toggleViewLabel,
  characterName,
  diceReveal,
  onDiceRevealAllLanded,
  onAcceptQuestOffer,
  onDismissQuestOffer,
  onResponderEscribiendo,
  onInteractuarModoDinamico,
  onVerRecursoDetalle,
  onCazarEnZona,
  onDismissDynamicModeOffer,
  onChooseNpcInteraction,
  onOpenHarvestSuggestion,
  combatNpcsDisplay,
  onMatarConvaleciente,
  onCapturarConvaleciente,
  onClementeConvaleciente,
  onViewFullHistory,
  liveEntryIds,
  bloqueoAcciones,
  bloqueoCombate,
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
  // Pegado al final (2026-09-28, bug real medido con Playwright: tras recargar una partida con
  // imágenes en el log — banners de NPC/objetos —, la vista se quedaba ~1300px por encima de la
  // última entrada para siempre). El scroll de abajo corre cuando cambian las entradas, ANTES de
  // que carguen las imágenes; al cargar, cada una empuja el contenido hacia abajo sin que nada
  // vuelva a bajar. `pegadoAlFinalRef` recuerda si el jugador estaba abajo del todo (se pierde en
  // cuanto sube a mano para leer), y `onLoadCapture` del contenedor re-baja tras cada imagen.
  const pegadoAlFinalRef = useRef(true)
  const ultimoScrollTopRef = useRef(0)
  useEffect(() => {
    pegadoAlFinalRef.current = true
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
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        onScroll={(e) => {
          // Solo un scroll HACIA ARRIBA despega (el scroll suave programático también dispara este
          // evento a mitad de animación, bajando); volver abajo del todo vuelve a pegar.
          const el = e.currentTarget
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) pegadoAlFinalRef.current = true
          else if (el.scrollTop < ultimoScrollTopRef.current) pegadoAlFinalRef.current = false
          ultimoScrollTopRef.current = el.scrollTop
        }}
        onLoadCapture={() => {
          if (pegadoAlFinalRef.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
        }}
      >
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
                  <span aria-hidden="true">{entry.npcAbilityUsed.rol === 'ataque' && !entry.npcAbilityUsed.inofensivo ? '🗡️' : '🛡️'}</span>
                  {/* B23 (pruebas 2026-09-28): fauna que "No ataca" no se presenta como ataque. */}
                  {entry.npcAbilityUsed.inofensivo ? (
                    <span>{entry.npcAbilityUsed.npcName} se revuelve, sin atacar</span>
                  ) : (
                    <span>
                      {entry.npcAbilityUsed.npcName} {entry.npcAbilityUsed.rol === 'ataque' ? 'ataca con' : 'se defiende con'} "
                      {entry.npcAbilityUsed.abilityName}"
                    </span>
                  )}
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
              {/* CFG-13 (hito 0.2) — tamaño, fuente e interlineado de la narración desde los ajustes. */}
              {/* UX-38 — noticia de «El mundo» con categoría, oportunidad o resumen plegable. */}
              {entry.noticia ? (
                <NoticiaMundo
                  text={entry.text}
                  noticia={entry.noticia}
                  onResponderPropuesta={onResponderPropuesta}
                  onVerLeyendas={onVerLeyendas}
                  texto={(t) => (
                    <EnciclopediaLinkedText text={t} index={enciclopediaIndex} onDetail={(x) => onEntityDetail?.(x)} onQuickInsert={(x) => onEntityQuickInsert?.(x)} />
                  )}
                />
              ) : (
                <p className="texto-narracion whitespace-pre-line">
                  <EnciclopediaLinkedText
                    text={entry.text}
                    index={enciclopediaIndex}
                    onDetail={(t) => onEntityDetail?.(t)}
                    onQuickInsert={(t) => onEntityQuickInsert?.(t)}
                  />
                </p>
              )}
              {/* Bug real (2026-08-14, petición explícita: "ahora hay 3" — la tirada del jugador
                  salía dos veces, aquí y dentro de CombatExchangeBadge más abajo): el backend
                  copia la tirada del jugador de un intercambio al campo genérico `roll` por
                  compatibilidad con otros sitios que solo lo leen a él (turnResolution.ts,
                  `combatExchangeRoll ?? roll`) — cuando hay `combatExchange`, ese mismo número ya
                  se muestra ahí (fila "Tú"), con más contexto (el lado del enemigo, quién gana). */}
              {/* Fase 10 (2026-09-29) — tiradas con `kind` (recolección, encuentro, caza, grupo): antes
                  descartadas en el backend; mismo criterio en vivo/histórico que la tirada normal. */}
              {isExtendedLogRoll(entry.roll) && <ExtendedRollBadge roll={entry.roll} characterName={characterName} live={liveEntryIds?.has(entry.id)} />}
              {entry.roll && !isExtendedLogRoll(entry.roll) && !entry.combatExchange && (
                <>
                  {/* Legend "Tirada de iniciativa" (2026-09-04, petición explícita jugando en
                      vivo: poder distinguir esta tirada del resto) — `entry.initiativeRoll`
                      presente en la MISMA entrada es la señal real de que este turno, además de
                      resolver la acción (`entry.roll`), decidió quién actúa primero en el
                      combate que arranca (emboscada real, turnResolution.ts `openingAmbush`) —
                      no un turno normal cualquiera con tirada. */}
                  {entry.initiativeRoll && (
                    <p className="mt-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-accent-400">Tirada de iniciativa</p>
                  )}
                  {liveEntryIds?.has(entry.id) ? <DiceRollSingle roll={entry.roll} /> : <RollBadge roll={entry.roll} />}
                </>
              )}
              {entry.combatExchange && (
                <CombatExchangeBadge exchange={entry.combatExchange} playerName={characterName} enemyName={entry.npcAbilityUsed?.npcName ?? entry.combatExchange.rivalNombre} />
              )}
              {/* UX-11 (hito 0.2) — en una entrada en vivo, las consecuencias (misión, ofertas, XP,
                  reputación) entran cuando ha aterrizado la tirada, no a la vez que el texto. */}
              {(() => {
                const retraso = retrasoEnVivo(entry, !!liveEntryIds?.has(entry.id))
                return (
              <div
                className={retraso !== null ? 'animate-paso-turno' : undefined}
                style={retraso !== null ? ({ '--retraso': `${retraso}ms` } as CSSProperties) : undefined}
              >
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
                  bloqueo={bloqueoAcciones}
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
                  "Interactuar" abre el mini-flujo (DynamicModeModal.tsx) para NPC/FAUNA; "Ignorar"
                  solo limpia la tarjeta. B.9/B.10 (checklist frontend 2026-08-27): `accent2`
                  (azulado, canal "El mundo") en vez del "quest" amarillo, más segunda línea de
                  contexto. `busy`/`error` (A.7): antes un fallo de red dejaba los botones sin
                  explicación.
                  RECURSO (2026-09-08, "Ver qué hay en la zona") — estructuralmente distinto: no hay
                  conversación, "Interactuar" resuelve la recolección real de una sola llamada
                  (`onVerRecursoDetalle` abre RecursoDetalleModal, no DynamicModeModal) — mismo botón/
                  tarjeta, callback distinto. */}
              {entry.dynamicModeOffer && (
                <OfferCard
                  bloqueo={bloqueoAcciones}
                  {...presentacionOferta(entry.id, entry.dynamicModeOffer, {
                    onInteractuarModoDinamico,
                    onResponderEscribiendo,
                    onVerRecursoDetalle,
                    onCazarEnZona,
                    onDismissDynamicModeOffer,
                  })}
                />
              )}
              {/* Menú contextual de interacción con NPC (2026-09-06, "Aprender oficio" deja de
                  depender de una habilidad suelta) — mismo patrón que `dynamicModeOffer`: un botón
                  por cada opción real de `npcInteractionOffer.options` (varía según el NPC), en
                  vez de los 2 fijos de las otras tarjetas. */}
              {entry.npcInteractionOffer && (
                <OfferCard
                  bloqueo={bloqueoAcciones}
                  tone="accent2"
                  icon="🗣️"
                  title={entry.npcInteractionOffer.npcName}
                  subtitle="¿Qué quieres hacer?"
                  error={entry.npcInteractionOffer.error}
                  actions={entry.npcInteractionOffer.options.map((opcion) => ({
                    label: opcion,
                    tone: opcion === 'Salir' ? 'neutral' : opcion === 'Combatir' ? 'danger' : 'primary',
                    disabled: entry.npcInteractionOffer!.busy,
                    onClick: () => onChooseNpcInteraction?.(entry.id, entry.npcInteractionOffer!.npcSlug, opcion),
                  }))}
                />
              )}
              {/* Recolección por texto libre redirigida al mapa (Pieza 6d 2026-09-03; Fase 4
                  2026-09-28) — un único botón que abre el modal de movimiento de zona. */}
              {entry.harvestSuggestion && (
                <OfferCard
                  bloqueo={bloqueoAcciones}
                  tone="accent2"
                  icon="🧭"
                  title={`Busca ${entry.harvestSuggestion.sourceName} en el mapa de la zona`}
                  subtitle="Acércate hasta ello en el mapa y elige Interactuar al llegar."
                  actions={[{ label: 'Abrir mapa de la zona', tone: 'primary', onClick: () => onOpenHarvestSuggestion?.() }]}
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
                const npc = combatNpcsDisplay?.find((n) => combatKeyFor(n) === offer.combatKey)
                const resuelto = !npc || npc.condicion === 'MUERTO' || !!npc.dismissed
                if (!resuelto) return null
                return (
                  <OfferCard
                    bloqueo={bloqueoCombate !== undefined ? bloqueoCombate : bloqueoAcciones}
                    key={offer.combatKey}
                    tone="danger"
                    icon="⚠️"
                    title={`${offer.npcName} está convaleciente`}
                    resolvedText="Resuelto."
                    actions={[
                      { label: 'Matar', tone: 'danger', onClick: () => onMatarConvaleciente?.(offer.combatKey) },
                      ...(offer.capturable ? [{ label: 'Capturar', tone: 'accent' as const, onClick: () => onCapturarConvaleciente?.(offer.combatKey) }] : []),
                      { label: 'Clemente', tone: 'neutral', onClick: () => onClementeConvaleciente?.(offer.combatKey) },
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
              {/* UX 2026-09-01 (hallazgo jugando en vivo): antes el XP de hito/capítulo se sumaba
                  sin más al chip "+N XP" de abajo — si la tirada del turno FALLABA pero el hito
                  era grande (p.ej. "capitulo", 500 XP), el jugador veía un "+500 XP" pegado a un
                  "Fallo" en rojo, como si el juego premiara el fracaso. Caja propia, mismo patrón
                  visual que "Misión completada" de arriba, para que quede claro que ese XP viene
                  de otra fuente (progreso de historia/Reino) y no de lo que acaba de intentar. */}
              {!!entry.xpHitoDelta && (
                <div className="mt-2 rounded-lg border border-quest-600/50 bg-quest-500/10 px-2.5 py-2">
                  <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-quest-400">
                    <span aria-hidden="true">📖</span>
                    <span>{entry.xpHitoLabel ?? 'Hito alcanzado'} (+{entry.xpHitoDelta} XP)</span>
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
                {/* UX 2026-09-01: `xpDelta` es el TOTAL del turno (tirada + hito); la parte de
                    hito ya tiene su propia caja arriba (📖), así que aquí solo se muestra el
                    resto — evita contar el mismo XP dos veces y, si el resto es 0 (turno fallido
                    con solo hito detrás), no pinta un "+0 XP" confuso junto al resultado. */}
                {!!entry.xpDelta && entry.xpDelta - (entry.xpHitoDelta ?? 0) > 0 && (
                  <Chip tono="accent" mono>
                    +{entry.xpDelta - (entry.xpHitoDelta ?? 0)} XP
                  </Chip>
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
                {/* Feedback de UX (2026-09-04, misma petición que el chip de reputación de arriba:
                    "quiero que SIEMPRE se represente... indicando cuál es exp de personaje, cuál
                    de profesión y qué profesión") — mismo tono `accent` que el chip de XP de
                    personaje (nunca negativo: crafteo/construcción con éxito nunca resta XP de
                    oficio), pero separado en su propio chip con el nombre del oficio para que
                    nunca se confunda con la XP de personaje de al lado. "🆙" adicional si el
                    oficio cruzó de nivel este mismo turno. */}
                {!!entry.professionXpGain && (
                  <Chip tono="accent" mono>
                    +{entry.professionXpGain.xpDelta} XP {professionNameFor(entry.professionXpGain.oficio)}
                    {entry.professionXpGain.leveledUp ? ` (nivel ${entry.professionXpGain.newLevel})` : ''}
                  </Chip>
                )}
              </div>
              </div>
                )
              })()}
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
              bloqueo={bloqueoCombate !== undefined ? bloqueoCombate : bloqueoAcciones}
              key={`persistent-convaleciente-${npc.slug}`}
              tone="danger"
              icon="⚠️"
              title={`${npc.name} está convaleciente`}
              actions={[
                { label: 'Matar', tone: 'danger', onClick: () => onMatarConvaleciente?.(combatKeyFor(npc)) },
                ...(npc.capturable ? [{ label: 'Capturar', tone: 'accent' as const, onClick: () => onCapturarConvaleciente?.(combatKeyFor(npc)) }] : []),
                { label: 'Clemente', tone: 'neutral', onClick: () => onClementeConvaleciente?.(combatKeyFor(npc)) },
              ]}
            />
          ))}
        {/* Bug real jugando en vivo (2026-09-21/22, "hasta que acaba la tirada de iniciativa no
            se está actualizando [la vida]... y eso está mal, pasa en TODOS los turnos, no solo el
            primero"): esta tarjeta entera (incluida `DiceRollReveal`, la animación que dispara
            `onDiceRevealAllLanded` → aplica vida/condición real) vivía condicionada solo a
            `isThinking` — pero `isThinking` se apaga en `finally` en cuanto la respuesta HTTP del
            turno termina (narración ya streameada completa), que normalmente ocurre MUCHO antes
            de que la animación de 10s de los dados del intercambio (`ROLL_DURATION_MS × 2`,
            DiceRoll.tsx) termine de rodar. Eso desmontaba `DiceRollReveal` a mitad de su propio
            `setTimeout` interno, matándolo antes de que `onAllLanded` disparase NUNCA por la vía
            real — la vida solo se actualizaba por el timer de FALLBACK de useCombatFlow.ts
            (`2×ROLL_DURATION_MS+1000` = 11s), que por coincidencia de timing cae casi a la vez que
            la animación de iniciativa del turno siguiente (10s, arranca en paralelo en cuanto
            llega la respuesta) — de ahí la sensación de "espera a que acabe la iniciativa" en
            TODOS los turnos, siempre, no solo el primero. Ahora la tarjeta vive mientras
            `isThinking` O `diceReveal` sigan activos (lo que dure más) — la animación de dados ya
            no depende de que la narración siga "pensando". */}
        {(isThinking || diceReveal) && (
          <div
            className={`relative overflow-hidden rounded-lg border border-dashed px-3.5 py-3 ${
              combate ? 'border-red-700/50 bg-danger-500/10' : classes.thinkingCard
            }`}
          >
            {isThinking && <div className="thinking-sheen" />}
            {isThinking && (
              <div className="flex items-center gap-2.5">
                {/* Los 3 puntos parpadeantes se retiran (roadmap de animaciones 2026-07-20): la
                    gema del header ya respira mientras se piensa — dos bucles a la vez (ella +
                    thinking-sheen) es el tope de presupuesto en este hardware, no tres. */}
                <span className={`h-1.5 w-1.5 rounded-full ${combate ? 'bg-red-400' : classes.thinkingDot}`} />
                <p className={`text-2xs font-semibold uppercase tracking-[0.14em] ${combate ? 'text-red-300' : classes.thinkingLabel}`}>
                  {combate ? 'Resolviendo combate' : classes.thinkingRail}
                </p>
              </div>
            )}
            {diceReveal && (
              <DiceRollReveal
                exchange={diceReveal.exchange}
                playerName={characterName}
                enemyName={diceReveal.npcName ?? undefined}
                onAllLanded={onDiceRevealAllLanded}
              />
            )}
            {isThinking &&
              thinkingText &&
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
