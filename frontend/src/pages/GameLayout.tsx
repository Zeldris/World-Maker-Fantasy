import { LogPanel } from '../components/LogPanel'
import { CollapsedRail } from '../components/CollapsedRail'
// Sugerencias desactivadas (2026-09-06, ver comentario junto a `suggestions` más abajo) —
// `SuggestionBar` deja de importarse mientras la entrada visible está oculta.
// import { SuggestionBar } from '../components/SuggestionBar'
import { SideNav } from '../components/SideNav'
import { characterTabs, worldTabs } from '../components/NavTabs'
import { isConsumibleSlot } from '../lib/equipSlots'
import { CombatPanel } from '../components/CombatPanel'
import { responderPropuesta } from '../lib/api'

import { useGameView } from './GameViewContext'
import { conTransicion } from '../lib/transicionVista'

/// BAS-5 (hito 0.2): el cuerpo de la partida — raíles laterales y los dos paneles (personaje y mundo),
/// entre la cabecera y el pie. Lee el estado de `GameViewContext`.
export function GameLayout() {
  const {
    saveId,
    characterName,
    characterAttributes,
    characterLog,
    liveRevealedIdsRef,
    worldLog,
    kingdomLog,
    worldLogView,
    setWorldLogView,
    diceReveal,
    inventory,
    kingdomName,
    savedActions,
    activeCombatAbilityNames,
    characterThinking,
    timedThinkingText,
    streamingNarration,
    activePanel,
    setActivePanel,
    collapsedSide,
    setCollapsedSide,
    enciclopediaData,
    condicionFisica,
    playerActiveEffects,
    energia,
    pendingDeathResolution,
    combateIniciado,
    lastInitiativeRoll,
    COMBAT_DISABLED_CHARACTER_TABS,
    COMBAT_DISABLED_WORLD_TABS,
    DEATH_PENDING_DISABLED_TABS,
    combat,
    anyModalOpen,
    fase,
    bloqueoTurno,
    permisoMover,
    worldThinking,
    setLeyendaPedida,
    characterFlavor,
    worldFlavor,
    handleContinuarTrasCombate,
    handleAcceptQuestOffer,
    handleDismissQuestOffer,
    handleMatarConvaleciente,
    handleCapturarConvaleciente,
    handleClementeConvaleciente,
    handleItemDetail,
    handleAbilityDetail,
    handleResponderEscribiendo,
    handleOpenHarvestSuggestion,
    zonaModalOpen,
    setZonaModalOpen,
    handleCazarEnZona,
    handleInteractuarModoDinamico,
    handleDismissDynamicModeOffer,
    handleVerRecursoDetalle,
    handleChooseNpcInteraction,
    worldName,
    secondaryAttributes,
  } = useGameView()
  if (!saveId || !worldName || !characterName || !characterAttributes || !secondaryAttributes) return null

  return (
    <>
      <div className="flex min-h-0 flex-1 gap-2 overflow-hidden p-2">
        <SideNav
          tabs={characterTabs}
          active={activePanel}
          align="left"
          dimmed={!!activePanel}
          disabledIds={pendingDeathResolution ? DEATH_PENDING_DISABLED_TABS : combat.combatOpen ? COMBAT_DISABLED_CHARACTER_TABS : undefined}
          disabledReason={pendingDeathResolution ? 'muerte-pendiente' : 'combate'}
          onSelect={(id) => setActivePanel((prev) => (prev === id ? null : id))}
        />
        <div
          className={`relative grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden ${
            collapsedSide === 'character' ? 'lg:grid-cols-[2.75rem_1fr]' : collapsedSide === 'world' ? 'lg:grid-cols-[1fr_2.75rem]' : 'lg:grid-cols-2'
          }`}
        >
          {/* Icono de brújula fijado en el centro entre los dos paneles (2026-09-09, petición
              explícita de Álvaro: "en vez de que flote que esté ubicado justo ahí fijado entre los
              divs pero sin ocupar espacio") — `absolute` centrado sobre ESTE contenedor grid (el
              padre inmediato de los 2 paneles, no el div raíz del componente), oculto en el layout
              de 1 columna (`lg:hidden` en el propio grid-cols-1 de móvil no aplica aquí, así que se
              oculta explícitamente por debajo de `lg` donde los paneles ya no están lado a lado).
              Mismas condiciones de visibilidad que antes (sin abrir ningún modal ya abierto), más
              `activePanel` (bug real 2026-09-09, captura de Álvaro: el botón, en `z-40`, se pintaba
              POR ENCIMA del `PanelDrawer` de Mapa/Reputación/Diario/etc., que vive en `z-20` — ese
              drawer nunca contó como "modal" para `anyModalOpen`, así que la brújula tapaba su
              contenido en vez de quedar oculta detrás). */}
          {/* UX-7 (hito 0.2) — si la fase no deja moverse (narrador escribiendo, encuentro, combate…),
              la brújula sigue a la vista pero deshabilitada con el motivo, en vez de desaparecer. */}
          {saveId && !anyModalOpen && !zonaModalOpen && !activePanel && (
            <button
              type="button"
              onClick={() => setZonaModalOpen(true)}
              disabled={!permisoMover.permitido}
              title={permisoMover.motivo ?? 'Moverte por la zona'}
              aria-label="Moverte por la zona"
              className="tactile absolute bottom-1 left-1/2 z-40 hidden h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-accent2-600/60 bg-wood-950/90 text-xl shadow-lg backdrop-blur-sm transition-colors hover:border-accent2-400 hover:bg-wood-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-accent2-600/60 disabled:hover:bg-wood-950/90 lg:flex"
            >
              🧭
              {/* UX-8 (hito 0.2) — candado visible además del motivo en el tooltip. */}
              {!permisoMover.permitido && (
                <span aria-hidden="true" className="absolute -right-1 -top-1 text-xs">
                  🔒
                </span>
              )}
            </button>
          )}
          {collapsedSide === 'character' ? (
            <CollapsedRail label="Tu personaje" icon="›" accentClass="text-accent-300" onExpand={() => conTransicion(() => setCollapsedSide(null))} />
          ) : (
            <LogPanel
              title="Tu personaje"
              bloqueoAcciones={bloqueoTurno}
              // Las tarjetas del combate (Matar/Clemente…) son la acción que toca en combate: no
              // las bloquea la fase de combate, sí el narrador escribiendo o la partida terminada.
              bloqueoCombate={fase === 'combate' ? null : bloqueoTurno}
              subtitle="Lo que haces, dices y percibes"
              entries={characterLog}
              accent="accent"
              isThinking={characterThinking}
              thinkingText={streamingNarration ?? timedThinkingText ?? characterFlavor}
              streaming={!!streamingNarration}
              combate={combat.combatOpen}
              diceReveal={diceReveal}
              onDiceRevealAllLanded={combat.triggerExchangeApply}
              emptyHint="Aquí aparecerá lo que le ocurra a tu personaje."
              onCollapse={() => conTransicion(() => setCollapsedSide('character'))}
              collapseIcon="‹"
              onViewFullHistory={() => setActivePanel('diario')}
              characterName={characterName ?? undefined}
              onAcceptQuestOffer={handleAcceptQuestOffer}
              onDismissQuestOffer={handleDismissQuestOffer}
              onInteractuarModoDinamico={handleInteractuarModoDinamico}
              onResponderEscribiendo={handleResponderEscribiendo}
              onVerRecursoDetalle={handleVerRecursoDetalle}
              onCazarEnZona={handleCazarEnZona}
              onDismissDynamicModeOffer={handleDismissDynamicModeOffer}
              onChooseNpcInteraction={handleChooseNpcInteraction}
              onOpenHarvestSuggestion={handleOpenHarvestSuggestion}
              combatNpcsDisplay={combat.combatNpcsDisplay}
              onMatarConvaleciente={handleMatarConvaleciente}
              onCapturarConvaleciente={handleCapturarConvaleciente}
              onClementeConvaleciente={handleClementeConvaleciente}
              liveEntryIds={liveRevealedIdsRef.current}
              motivoNoCapturar={inventory.some((i) => i.catalogSlug === 'cuerdas') ? null : 'Necesitas cuerdas en el inventario para atarlo.'}
            />
          )}
          {collapsedSide === 'world' ? (
            <CollapsedRail
              label={combat.combatOpen && combateIniciado ? 'Combate' : 'El mundo'}
              icon="‹"
              accentClass={combat.combatOpen && combateIniciado ? 'text-danger-400' : 'text-accent2-300'}
              onExpand={() => conTransicion(() => setCollapsedSide(null))}
            />
          ) : combat.combatOpen && combateIniciado ? (
            // Rediseño de la vista de combate (2026-07-28, petición explícita: "quiero que la
            // sección de combate salga sustituyendo a los logs de mundo") — el panel "El mundo"
            // se sustituye por CombatPanel mientras dura el combate; el log de mundo en sí sigue
            // acumulándose por debajo, sin perderse, listo para cuando termine.
            <CombatPanel
              characterName={characterName ?? undefined}
              playerCondicion={condicionFisica}
              playerActiveEffects={playerActiveEffects}
              energia={energia}
              npcs={combat.combatNpcsDisplay}
              selectedNpcSlug={combat.combatSelectedNpcSlug}
              onSelectNpc={combat.setCombatSelectedNpcSlug}
              // "Cinturón de combate" (2026-08-28) — solo las genéricas (siempre disponibles) +
              // las marcadas activas por el jugador se ofrecen para pulsar en plena pelea. El
              // resto de habilidades aprendidas sigue existiendo, consultable en Habilidades.
              combatAbilities={savedActions.filter(
                (a) => a.category === 'combate' && (a.isGeneric || activeCombatAbilityNames.includes(a.name)),
              )}
              selectedAbilityId={combat.combatSelectedAbilityId}
              onSelectAbility={combat.setCombatSelectedAbilityId}
              // Consumibles de combate (2026-07-30, petición explícita: "raciones y cataplasma
              // catalogalo como Consumible que tendrá 6 slots en equipo donde podrás añadir los
              // consumibles que quieres usar en el combate") — antes CUALQUIER objeto sin ranura
              // (mochila entera, incluidos documentos/materiales) contaba como "usable" en
              // combate; ahora solo lo que el jugador equipó a propósito en una de las 6 ranuras.
              combatItems={inventory.filter((i) => isConsumibleSlot(i.slot))}
              selectedItemId={combat.combatSelectedItemId}
              onSelectItem={combat.setCombatSelectedItemId}
              playerAttributes={characterAttributes}
              // `awaitingNextInitiative` (hallazgo 25a, revisar-partida-hallazgos.md 2026-09-07,
              // useCombatFlow.ts) — `combatBusy` solo cubre la espera de la respuesta del turno,
              // no la animación posterior de `DiceRollVs` (2×ROLL_DURATION_MS) para la iniciativa
              // siguiente: sin esto, el jugador podía lanzar una habilidad mientras los dados
              // todavía están rodando en pantalla.
              busy={combat.combatBusy || combat.awaitingNextInitiative || combat.awaitingExchangeApply}
              ended={combat.combatEnded}
              playerJustDied={combat.combatPlayerJustDied}
              pendingDecisions={combat.combatHasPendingConvalecientes}
              awaitingDefense={combat.combatAwaitingDefense}
              lastInitiativeRoll={lastInitiativeRoll}
              onActuar={combat.handleCombatActuar}
              onRegistrar={combat.handleCombatRegistrar}
              onHuir={combat.handleCombatHuir}
              onContinue={handleContinuarTrasCombate}
              onSaquearSeleccion={combat.handleSaquearSeleccion}
              onAbilityDetail={handleAbilityDetail}
              onItemDetail={handleItemDetail}
              enciclopedia={enciclopediaData}
              onCollapse={() => conTransicion(() => setCollapsedSide('world'))}
              collapseIcon="›"
            />
          ) : (
            <LogPanel
              title={worldLogView === 'world' ? 'El mundo' : 'Reino'}
              subtitle={worldLogView === 'world' ? 'Lo que ocurre más allá de tu personaje' : 'Lo que ocurre en tu reino'}
              entries={worldLogView === 'world' ? worldLog : kingdomLog}
              accent="accent2"
              isThinking={worldLogView === 'world' && worldThinking}
              thinkingText={worldFlavor}
              emptyHint={worldLogView === 'world' ? 'El mundo todavía no ha mostrado sus cartas.' : 'Todavía no ha pasado nada en tu reino.'}
              // CR-34 (34e): Aceptar/Rechazar la propuesta de una facción al Reino.
              onResponderPropuesta={saveId ? (propuestaId: string, acepta: boolean) => responderPropuesta(saveId, propuestaId, acepta).then((r) => r.respuesta) : undefined}
              onVerLeyendas={(sucesoId) => {
                setLeyendaPedida(sucesoId)
                setActivePanel('leyendas')
              }}
              onCollapse={() => conTransicion(() => setCollapsedSide('world'))}
              collapseIcon="›"
              // Alternar Mundo/Reino (2026-08-17) — solo tiene sentido ofrecerlo una vez hay reino
              // fundado, o si ya quedó alguna entrada de reino de cuando lo hubo.
              onToggleView={kingdomName || kingdomLog.length > 0 ? () => setWorldLogView((v) => (v === 'world' ? 'kingdom' : 'world')) : undefined}
              toggleViewLabel={worldLogView === 'world' ? 'Reino' : 'Mundo'}
              characterName={characterName ?? undefined}
            />
          )}
        </div>
        <SideNav
          tabs={worldTabs}
          active={activePanel}
          align="right"
          dimmed={!!activePanel}
          disabledIds={combat.combatOpen ? COMBAT_DISABLED_WORLD_TABS : undefined}
          onSelect={(id) => setActivePanel((prev) => (prev === id ? null : id))}
        />
      </div>
    </>
  )
}
