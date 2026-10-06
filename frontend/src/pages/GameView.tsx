import { Notificaciones } from '../components/Notificaciones'
import { GameHeader } from '../components/GameHeader'
import { GameFooter } from '../components/GameFooter'
import { CapasContext } from '../context/capasContext'
import { Capa } from '../components/Capa'
import { ModoConsultaContext } from '../context/modoConsultaContext'
import { LogPanel } from '../components/LogPanel'
import { CollapsedRail } from '../components/CollapsedRail'
// Sugerencias desactivadas (2026-09-06, ver comentario junto a `suggestions` más abajo) —
// `SuggestionBar` deja de importarse mientras la entrada visible está oculta.
// import { SuggestionBar } from '../components/SuggestionBar'
import { SideNav } from '../components/SideNav'
import { characterTabs, worldTabs, type PanelId } from '../components/NavTabs'
import { PanelDrawer } from '../components/PanelDrawer'
import { MapaPanel } from '../components/panels/MapaPanel'
import { DiarioPanel } from '../components/panels/DiarioPanel'
import { LeyendasPanel } from '../components/panels/LeyendasPanel'
import { InventarioPanel } from '../components/panels/InventarioPanel'
import { EnciclopediaPanel } from '../components/panels/EnciclopediaPanel'
import { isConsumibleSlot } from '../lib/equipSlots'
import { PersonajePanel } from '../components/panels/PersonajePanel'
import { ReputacionPanel } from '../components/panels/ReputacionPanel'
import { EnciclopediaLinkProvider } from '../context/EnciclopediaLinkContext'
import { CompanerosPanel } from '../components/panels/CompanerosPanel'
import { ReinoPanel } from '../components/panels/ReinoPanel'
import { MisionesPanel } from '../components/panels/MisionesPanel'
import { MisionesContext } from '../context/misionesContext'
import { HabilidadesPanel } from '../components/panels/HabilidadesPanel'
import { CombatComposer } from '../components/CombatComposer'
import { CombatPanel } from '../components/CombatPanel'
import { inventoryCapacityFor } from '../lib/inventoryCapacity'
import { responderPropuesta } from '../lib/api'
import { formatCountdown, formatFictionalDuration } from '../lib/gameViewHelpers'

import { useGameViewState } from './useGameViewState'
import { GameViewContext } from './GameViewContext'
import { GameModals } from './GameModals'

/// Combina los adjuntos del composer con el texto libre en una única acción (docs/mecanicas/14-combate-y-muerte.md
/// § 3: "composición verbo + objetivo"). Una habilidad (verbo) emparejada con un NPC o un hallazgo
/// (objetivo) en la misma tanda se combina como "{promptText} '{nombre del objetivo}'." — los
/// prompts de habilidad ya están en primera persona con el enemigo implícito ("mi enemigo"), así
/// que añadir el nombre entre comillas al final desambigua el objetivo sin reescribir cada prompt.
/// Un hallazgo sin habilidad asociada se recoge con cantidad explícita; un objeto de inventario
/// mantiene la mención simple de siempre.
// Espejo de limiteMuertes() en backend/src/services/death.ts — NOVATO no tiene límite, así que
// no aparece aquí (el indicador de muerte permanente solo se muestra para MEDIO/AVANZADO).

export function GameView() {
  const estado = useGameViewState()
  const {
    id,
    navigate,
    saveId,
    worldIdSlug,
    worldName,
    characterName,
    characterMotivation,
    characterArchetype,
    characterOrigin,
    characterAttributes,
    characterAttributeBonuses,
    secondaryAttributes,
    characterLog,
    liveRevealedIdsRef,
    setCharacterLog,
    worldLog,
    kingdomLog,
    worldLogView,
    setWorldLogView,
    diceReveal,
    inventory,
    setHarvestModal,
    carcassPending,
    setSimpleModal,
    companions,
    level,
    xp,
    goirnos,
    pendingAttributePoints,
    kingdomName,
    territories,
    buildings,
    subjects,
    almacenItems,
    plantillasEquipo,
    factionsStatus,
    kingdomStats,
    professionProgress,
    deathCount,
    dificultad,
    savedActions,
    activeCombatAbilityNames,
    combatSlots,
    fictionalDate,
    entorno,
    currentLocation,
    professionRecipes,
    recipesStatus,
    destinations,
    setInput,
    setConfirmingExit,
    skillHudView,
    setSkillHudView,
    skillBars,
    setEditingSkillBar,
    composerRef,
    characterThinking,
    timedThinkingText,
    streamingNarration,
    busyUntil,
    busyActivity,
    busyDuracionMinutos,
    activePanel,
    setActivePanel,
    enciclopediaInitialCategory,
    enciclopediaOpenKey,
    collapsedSide,
    setCollapsedSide,
    personajeSubTab,
    setPersonajeSubTab,
    reinoSubTab,
    setReinoSubTab,
    enciclopediaIndex,
    enciclopediaData,
    enciclopediaLoading,
    notFound,
    creacionError,
    setReintentosCreacion,
    condicionFisica,
    playerActiveEffects,
    energia,
    energiaMax,
    hambre,
    sed,
    endedAt,
    pendingDeathResolution,
    resolvingDeath,
    combateIniciado,
    lastInitiativeRoll,
    COMBAT_DISABLED_CHARACTER_TABS,
    COMBAT_DISABLED_WORLD_TABS,
    DEATH_PENDING_DISABLED_TABS,
    quests,
    combat,
    decisiones,
    avisoDecision,
    anyModalOpen,
    fase,
    permisoTurno,
    bloqueoTurno,
    modoConsulta,
    panelMostrado,
    panelSaliendo,
    avisoLlegadas,
    permisoMover,
    etiquetaFase,
    worldThinking,
    notificaciones,
    descartarNotificacion,
    leyendaPedida,
    setLeyendaPedida,
    rumoresDelMapa,
    noticiasMundo,
    characterFlavor,
    worldFlavor,
    refreshSave,
    misionesValue,
    handleEntregarMision,
    handleAbandonarMision,
    handleContinuarTrasCombate,
    handleReabrirFundacionReino,
    handleCreateHabilidad,
    handleSetActiveCombatAbilityNames,
    handleAttachAbility,
    handleSelectSkillBar,
    handleBackToComposer,
    handleCreateSkillBar,
    handleDeleteSkillBar,
    handleAcceptQuestOffer,
    handleDismissQuestOffer,
    handleMatarConvaleciente,
    handleCapturarConvaleciente,
    handleClementeConvaleciente,
    handleItemDetail,
    handleAbilityDetail,
    handleSlotClick,
    handleResponderEscribiendo,
    handleEnciclopediaInsert,
    handleEnciclopediaDetail,
    handleEntityDetailNavigate,
    handleEntityQuickInsert,
    handleOpenHarvestSuggestion,
    handleAttachItem,
    handleSubmit,
    zonaModalOpen,
    setZonaModalOpen,
    handleCazarEnZona,
    handleInteractuarModoDinamico,
    handleDismissDynamicModeOffer,
    handleVerRecursoDetalle,
    handleChooseNpcInteraction,
    handleResolveDeath,
    handleSpendAttributePoint,
    cancelingTransit,
    nowTick,
    handleCancelTransit,
    composerDisabled,
    composerDisabledReason,
    estadoCapas,
  } = estado

  if (id === 'nueva' && creacionError) {
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-wood-200">
          {creacionError === 'fallo' ? 'No se pudo crear la partida.' : 'Se ha perdido la elección de mundo y personaje.'}
        </p>
        <p className="max-w-md text-xs text-wood-500">
          {creacionError === 'fallo'
            ? 'El servidor no respondió como esperábamos. Tu elección sigue guardada: puedes volver a intentarlo.'
            : 'Vuelve a elegir el mundo y el personaje para empezar.'}
        </p>
        <div className="flex gap-4">
          {creacionError === 'fallo' && (
            <button
              type="button"
              onClick={() => setReintentosCreacion((n) => n + 1)}
              className="tactile rounded-lg border border-accent-600 bg-accent-500/20 px-3.5 py-1.5 text-sm font-semibold text-accent-300 hover:bg-accent-500/35"
            >
              Reintentar
            </button>
          )}
          <button type="button" onClick={() => navigate('/solitario')} className="text-sm text-accent-400 hover:text-accent-300">
            ← Volver al menú
          </button>
        </div>
      </div>
    )
  }

  if (notFound || (!saveId && id !== 'nueva')) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-wood-400">No se encuentra esta partida.</p>
        <button type="button" onClick={() => navigate('/solitario')} className="text-sm text-accent-400 hover:text-accent-300">
          ← Volver al menú
        </button>
      </div>
    )
  }

  if (!saveId || !worldName || !characterName || !characterAttributes || !secondaryAttributes) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="gem animate-pulse-soft" />
        <p className="text-wood-500 italic">Cargando partida...</p>
      </div>
    )
  }

  const panelTitles: Record<PanelId, string> = {
    mapa: 'Mapa',
    inventario: 'Inventario',
    personaje: 'Personaje',
    diario: 'Diario',
    leyendas: 'Leyendas',
    misiones: 'Misiones',
    companeros: 'Compañeros',
    reino: 'Reino',
    habilidades: 'Habilidades',
    enciclopedia: 'Enciclopedia',
    reputacion: 'Reputación',
  }
  // Roadmap de diseño CSS (Fable, 2026-07-20, Nivel 3): el marco del cajón sigue la misma
  // partición que ya usan characterTabs/worldTabs (riel izquierdo "Tu personaje" vs derecho "El
  // mundo") — Diario se deja en 'accent' por defecto porque mezcla ambos canales por diseño
  // (ver DiarioPanel, gem/gem2 por entrada) y no encaja limpiamente en ninguno de los dos.
  const panelAccent: Record<PanelId, 'accent' | 'accent2'> = {
    inventario: 'accent',
    personaje: 'accent',
    habilidades: 'accent',
    companeros: 'accent',
    reino: 'accent',
    mapa: 'accent2',
    diario: 'accent',
    // CR-20: Leyendas es del riel «El mundo».
    leyendas: 'accent2',
    misiones: 'accent2',
    enciclopedia: 'accent2',
    reputacion: 'accent2',
  }


  return (
    <EnciclopediaLinkProvider
      value={{ enciclopediaIndex, onEntityDetail: handleEntityDetailNavigate, onEntityQuickInsert: handleEntityQuickInsert }}
    >
    <GameViewContext.Provider value={estado}>
    <CapasContext.Provider value={estadoCapas}>
    <MisionesContext.Provider value={misionesValue}>
    <div className="relative flex min-h-0 flex-1 flex-col">
      <GameHeader
        characterName={characterName}
        worldName={worldName}
        level={level}
        pendingAttributePoints={pendingAttributePoints}
        condicionFisica={condicionFisica}
        energia={energia}
        energiaMax={energiaMax}
        hambre={hambre}
        sed={sed}
        dificultad={dificultad}
        deathCount={deathCount}
        decisionEnEspera={decisiones.enEspera}
        avisoDecision={avisoDecision}
        onAbrirDecision={decisiones.abrirYa}
        etiquetaFase={etiquetaFase}
        motivoFase={permisoTurno.motivo}
        ocupadoHasta={fase === 'ocupado' ? busyUntil : null}
        nowTick={nowTick}
        fictionalDate={fictionalDate}
        entorno={entorno}
        mundoAvanza={worldThinking || noticiasMundo.esperandoMundo}
        onSalir={() => setConfirmingExit(true)}
        onAbrirNivel={() => {
          setPersonajeSubTab('estadisticas')
          setActivePanel('personaje')
        }}
      />

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
            <CollapsedRail label="Tu personaje" icon="›" accentClass="text-accent-300" onExpand={() => setCollapsedSide(null)} />
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
              onCollapse={() => setCollapsedSide('character')}
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
            />
          )}
          {collapsedSide === 'world' ? (
            <CollapsedRail
              label={combat.combatOpen && combateIniciado ? 'Combate' : 'El mundo'}
              icon="‹"
              accentClass={combat.combatOpen && combateIniciado ? 'text-danger-400' : 'text-accent2-300'}
              onExpand={() => setCollapsedSide(null)}
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
              onCollapse={() => setCollapsedSide('world')}
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
              onCollapse={() => setCollapsedSide('world')}
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

      {busyUntil && (
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-iron-800 bg-wood-950/90 px-4 py-2 text-center text-xs text-wood-400">
          <span>
            <span className="gem mr-1.5 align-middle" /> Ocupado{busyActivity ? ` con "${busyActivity}"` : ''} — vuelve en{' '}
            <span className="font-mono font-semibold text-accent-300">{formatCountdown(busyUntil, nowTick)}</span>
            {busyDuracionMinutos ? (
              <>
                {' '}
                (<span className="font-semibold text-wood-200">{formatFictionalDuration(busyDuracionMinutos)}</span> en {worldName})
              </>
            ) : null}{' '}
            (sobre las {new Date(busyUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}), se resolverá solo.
          </span>
          <button type="button"
            onClick={handleCancelTransit}
            disabled={cancelingTransit}
            className="tactile rounded-lg border border-iron-700 bg-wood-950/60 px-2.5 py-1 text-2xs text-wood-300 transition-colors hover:border-red-700/60 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelingTransit ? 'Cancelando...' : 'Cancelar acción'}
          </button>
        </div>
      )}

      {combateIniciado && !combat.combatOpen && !endedAt && !pendingDeathResolution && (
        <div className="flex flex-col items-center gap-1.5 border-t border-iron-800 bg-wood-950/90 px-4 py-2 text-center">
          {combat.combatDifficulty && (
            <p className={`text-2xs font-semibold uppercase tracking-[0.1em] ${combat.combatDifficulty.colorClass}`}>
              Dificultad: {combat.combatDifficulty.label}
            </p>
          )}
          <div className="flex items-center justify-center gap-2">
            <button type="button"
              // `() => combat.openCombat()` explícito, no `combat.openCombat` a secas (bug real
              // introducido al añadir `combatOverride`, auditoría 2026-08-21): un handler de
              // `onClick` pasado directo recibe el `MouseEvent` como primer argumento — con
              // `openCombat` aceptando ahora un parámetro opcional, ese evento se habría colado
              // como `combatOverride` (truthy, sin `.npcs`) y reventado en `combate.npcs.map(...)`.
              onClick={() => combat.openCombat()}
              disabled={combat.fleeingPreCombat}
              className="animate-alert-pulse rounded-lg border border-red-700 bg-danger-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-danger-400 shadow-[0_0_14px_-4px_color-mix(in_srgb,var(--color-danger-500)_70%,transparent)] transition-colors hover:bg-danger-500/20 disabled:opacity-50"
            >
              {/* UX 2026-09-01 (hallazgo jugando en vivo): el botón siempre lleva ⚔️ — nunca hubo
                  aquí una condición que cambiara a ❌ (revisado, no existe en ningún componente de
                  combate; el ❌ visto en partida real fue casi seguro un fallback de fuente del
                  sistema sin glifo de espada, no un icono a propósito del juego). El botón nunca
                  está deshabilitado por dificultad — solo por estar ya huyendo — así que ⚠️ en
                  dificultad alta refuerza "puedes combatir pero es arriesgado" sin la ambigüedad
                  de "no disponible" que tendría un aspa junto al texto "Dificultad" de arriba. */}
              {combat.combatDifficulty?.label === 'Difícil' || combat.combatDifficulty?.label === 'Muy difícil' ? '⚠️' : '⚔️'} Combatir
            </button>
            <button type="button"
              onClick={combat.handleFleeAttempt}
              disabled={combat.fleeingPreCombat}
              className="tactile rounded-lg border border-iron-700 bg-wood-950/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:opacity-50"
            >
              {combat.fleeingPreCombat ? 'Huyendo...' : '🏃 Huir'}
            </button>
          </div>
        </div>
      )}

      <GameFooter
        modo={endedAt ? 'fin' : pendingDeathResolution ? 'muerte' : combat.combatOpen && combateIniciado ? 'combate' : 'normal'}
        characterName={characterName}
        onResolverMuerte={handleResolveDeath}
        resolviendoMuerte={resolvingDeath}
        combatComposer={
            // Rework 2026-07-24, recortado en el rediseño de la vista de combate (2026-07-28): sigue
            // sustituyendo al ChatComposer normal en el mismo sitio, pero ahora solo es el input de
            // texto libre — enemigos/ficha/habilidades/objetos/Actuar viven en CombatPanel, arriba.
            <CombatComposer
              freeText={combat.combatFreeText}
              onFreeTextChange={combat.setCombatFreeText}
              onSubmit={combat.handleCombatFreeSubmit}
              busy={combat.combatBusy || combat.awaitingNextInitiative || combat.awaitingExchangeApply}
              ended={combat.combatEnded}
              pendingDecisions={combat.combatHasPendingConvalecientes}
              rematar={combat.combatNpcsDisplay.filter((n) => n.condicion === 'CONVALECIENTE' && n.targetedForKill && !n.dismissed).map((n) => n.name)}
            />
        }
        // Petición explícita, 2026-08-15: "si se detecta combate: true que no saque sugerencias" —
        // ni el aviso de desollar ni la barra de habilidades con un combate detectado.
        desollar={
          !combateIniciado && carcassPending
            ? { disabled: anyModalOpen || pendingDeathResolution, onClick: () => setHarvestModal({ oficio: 'desollador', label: 'Desollar' }) }
            : null
        }
        conHabilidades={!combateIniciado}
        skillHudView={skillHudView}
        setSkillHudView={setSkillHudView}
        skillBars={skillBars}
        savedActions={savedActions}
        onSelectBar={handleSelectSkillBar}
        onCreateBar={handleCreateSkillBar}
        onEditBar={setEditingSkillBar}
        onDeleteBar={handleDeleteSkillBar}
        onUseAbility={handleAttachAbility}
        onBackToComposer={handleBackToComposer}
        composerRef={composerRef}
        onChange={setInput}
        onSubmit={handleSubmit}
        composerDisabled={composerDisabled}
        disabledReason={composerDisabledReason}
      />

      <GameModals />

      {panelMostrado && (
        <Capa id="panel">
        <PanelDrawer title={panelTitles[panelMostrado]} accent={panelAccent[panelMostrado]} onClose={() => setActivePanel(null)}
          saliendo={panelSaliendo}
          modoConsulta={modoConsulta}
          novedad={avisoLlegadas ? { texto: avisoLlegadas, onVer: () => setActivePanel(null) } : null}
        >
          <ModoConsultaContext.Provider value={modoConsulta}>
          {panelMostrado === 'personaje' && (
            <PersonajePanel
              activeSubTab={personajeSubTab}
              onSubTabChange={setPersonajeSubTab}
              characterArchetype={characterArchetype}
              characterOrigin={characterOrigin}
              items={inventory}
              onSlotClick={handleSlotClick}
              attributes={characterAttributes}
              attributeBonuses={characterAttributeBonuses}
              secondaryAttributes={secondaryAttributes}
              level={level}
              xp={xp}
              pendingAttributePoints={pendingAttributePoints}
              onSpendPoint={handleSpendAttributePoint}
              condicionFisica={condicionFisica}
              energia={energia}
              energiaMax={energiaMax}
              hambre={hambre}
              sed={sed}
            />
          )}
          {panelMostrado === 'reputacion' && (
            <ReputacionPanel factionsStatus={factionsStatus} factions={enciclopediaData?.factions ?? []} worldSlug={worldIdSlug} saveId={saveId} />
          )}
          {panelMostrado === 'mapa' && (
            <MapaPanel
              worldSlug={worldIdSlug}
              saveId={saveId}
              currentLocation={currentLocation}
              destinations={destinations}
              inventory={inventory}
              quests={quests}
              buildings={buildings}
              entorno={entorno}
              onViajar={() => {
                setSimpleModal('travel')
                setActivePanel(null)
              }}
              onEncuentroZona={(entry) => setCharacterLog((prev) => [...prev, entry])}
              rumores={rumoresDelMapa.rumores}
              regionesConRumor={rumoresDelMapa.sinLeer}
              onLeerRumores={rumoresDelMapa.marcarLeidos}
            />
          )}
          {panelMostrado === 'diario' && saveId && <DiarioPanel saveId={saveId} />}
          {panelMostrado === 'leyendas' && saveId && <LeyendasPanel saveId={saveId} irAlSuceso={leyendaPedida} />}
          {panelMostrado === 'inventario' && saveId && (
            <InventarioPanel
              saveId={saveId}
              items={inventory}
              goirnos={goirnos}
              capacity={inventoryCapacityFor(
                characterAttributes,
                inventory.filter((i) => i.slot !== null),
              )}
              onUse={handleAttachItem}
              onDetail={handleItemDetail}
              onRefreshSave={refreshSave}
            />
          )}
          {panelMostrado === 'companeros' && saveId && (
            <CompanerosPanel saveId={saveId} companions={companions} inventory={inventory} onRefreshSave={refreshSave} plantillasEquipo={plantillasEquipo} characterName={characterName ?? undefined} />
          )}
          {panelMostrado === 'misiones' && <MisionesPanel quests={quests} onEntregar={handleEntregarMision} onAbandonar={handleAbandonarMision} />}
          {panelMostrado === 'reino' && saveId && (
            <ReinoPanel
              saveId={saveId}
              kingdomName={kingdomName}
              characterMotivation={characterMotivation}
              territories={territories}
              buildings={buildings}
              subjects={subjects}
              companions={companions}
              kingdomStats={kingdomStats}
              onFundarReino={handleReabrirFundacionReino}
              inventory={inventory}
              almacenItems={almacenItems}
              plantillasEquipo={plantillasEquipo}
              onRefreshSave={refreshSave}
              professionRecipes={professionRecipes}
              factions={enciclopediaData?.factions ?? []}
              goirnos={goirnos}
              activeSubTab={reinoSubTab}
              onSubTabChange={setReinoSubTab}
              recipesStatus={recipesStatus}
              onBuild={(actionText) => handleSubmit(actionText)}
              bloqueoTurno={bloqueoTurno}
            />
          )}
          {panelMostrado === 'enciclopedia' && (
            <EnciclopediaPanel
              key={enciclopediaOpenKey}
              data={enciclopediaData}
              loading={enciclopediaLoading}
              recipesStatus={recipesStatus}
              onInsert={handleEnciclopediaInsert}
              onDetail={handleEnciclopediaDetail}
              initialCategory={enciclopediaInitialCategory}
            />
          )}
          {panelMostrado === 'habilidades' && (
            <HabilidadesPanel
              savedActions={savedActions}
              combatSlots={combatSlots}
              activeCombatAbilityNames={activeCombatAbilityNames}
              onChangeActiveCombatAbilityNames={handleSetActiveCombatAbilityNames}
              professionProgress={professionProgress}
              professionRecipes={professionRecipes}
              recipesStatus={recipesStatus}
              onUse={handleAttachAbility}
              onCreate={handleCreateHabilidad}
              onDetail={handleAbilityDetail}
            />
          )}
          </ModoConsultaContext.Provider>
        </PanelDrawer>
        </Capa>
      )}
      <Notificaciones notificaciones={notificaciones} onDescartar={descartarNotificacion} />
    </div>
    </MisionesContext.Provider>
    </CapasContext.Provider>
    </GameViewContext.Provider>
    </EnciclopediaLinkProvider>
  )
}
