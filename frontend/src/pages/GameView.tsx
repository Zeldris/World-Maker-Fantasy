import { MenuPausa } from '../components/MenuPausa'
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
import { SkillBarEditor } from '../components/SkillBarEditor'
import { SideNav } from '../components/SideNav'
import { characterTabs, worldTabs, type PanelId } from '../components/NavTabs'
import { PanelDrawer } from '../components/PanelDrawer'
import { MapaPanel } from '../components/panels/MapaPanel'
import { DiarioPanel } from '../components/panels/DiarioPanel'
import { LeyendasPanel } from '../components/panels/LeyendasPanel'
import { presentacionOferta } from '../lib/ofertaModoDinamico'
import { InventarioPanel } from '../components/panels/InventarioPanel'
import { EnciclopediaPanel } from '../components/panels/EnciclopediaPanel'
import { isConsumibleSlot } from '../lib/equipSlots'
import { PersonajePanel } from '../components/panels/PersonajePanel'
import { ReputacionPanel } from '../components/panels/ReputacionPanel'
import { DetailModal } from '../components/DetailModal'
import { EnciclopediaLinkProvider } from '../context/EnciclopediaLinkContext'
import { CompanerosPanel } from '../components/panels/CompanerosPanel'
import { ReinoPanel } from '../components/panels/ReinoPanel'
import { MisionesPanel } from '../components/panels/MisionesPanel'
import { AvisosModal } from '../components/AvisosModal'
import { MisionesContext } from '../context/misionesContext'
import { HabilidadesPanel } from '../components/panels/HabilidadesPanel'
import { CombatComposer } from '../components/CombatComposer'
import { CombatPanel } from '../components/CombatPanel'
import { KingdomFoundingModal } from '../components/KingdomFoundingModal'
import { HarvestSelectionModal } from '../components/HarvestSelectionModal'
import { PostCombatInteractionModal } from '../components/PostCombatInteractionModal'
import { DynamicModeModal } from '../components/DynamicModeModal'
import { RecursoDetalleModal } from '../components/RecursoDetalleModal'
import { ZonaMovimientoModal } from '../components/ZonaMovimientoModal'
import { CampSelectionModal } from '../components/CampSelectionModal'
import { TravelDestinationModal } from '../components/TravelDestinationModal'
import { SaquearZonaModal } from '../components/SaquearZonaModal'
import { HealSelectionModal } from '../components/HealSelectionModal'
import { HungerThirstSelectionModal } from '../components/HungerThirstSelectionModal'
import { EntregaModal } from '../components/EntregaModal'
import { AprenderOficioModal } from '../components/AprenderOficioModal'
import { EspecializacionModal } from '../components/EspecializacionModal'
import { ClaseModal } from '../components/ClaseModal'
import { inventoryCapacityFor, totalInventoryUnits } from '../lib/inventoryCapacity'
import { getRecolectarLocalizado, responderPropuesta } from '../lib/api'
import { formatCountdown, formatFictionalDuration, applyInventoryDelta } from '../lib/gameViewHelpers'

import { useGameViewState } from './useGameViewState'

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
    setInventory,
    harvestModal,
    setHarvestModal,
    carcassPending,
    checkCarcassPending,
    simpleModal,
    setSimpleModal,
    saquearZonaModalOpen,
    setSaquearZonaModalOpen,
    healModalOpen,
    setHealModalOpen,
    hungerThirstModalOpen,
    setHungerThirstModalOpen,
    entregaModalOpen,
    setEntregaModalOpen,
    aprenderOficioModalOpen,
    setAprenderOficioModalOpen,
    postCombatTarget,
    setPostCombatTarget,
    activeDynamicMode,
    setActiveDynamicMode,
    companions,
    level,
    xp,
    goirnos,
    setGoirnos,
    pendingAttributePoints,
    kingdomName,
    kingdomFoundedInfo,
    setKingdomFoundedInfo,
    territories,
    buildings,
    subjects,
    almacenItems,
    plantillasEquipo,
    factionsStatus,
    kingdomStats,
    professionProgress,
    setProfessionProgress,
    deathCount,
    dificultad,
    savedActions,
    activeCombatAbilityNames,
    combatSlots,
    fictionalDate,
    setFictionalDate,
    entorno,
    currentLocation,
    professionRecipes,
    recipesStatus,
    destinations,
    setInput,
    confirmingExit,
    setConfirmingExit,
    skillHudView,
    setSkillHudView,
    skillBars,
    editingSkillBar,
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
    detailTarget,
    setDetailTarget,
    detailInsertHandler,
    setDetailInsertHandler,
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
    pendingClaseChoice,
    clasesDisponibles,
    pendingEspecializacionChoice,
    especializacionesDisponibles,
    clase,
    handleAssignClase,
    handleAssignEspecializacion,
    combateIniciado,
    lastInitiativeRoll,
    COMBAT_DISABLED_CHARACTER_TABS,
    COMBAT_DISABLED_WORLD_TABS,
    DEATH_PENDING_DISABLED_TABS,
    quests,
    avisosAbiertos,
    setAvisosAbiertos,
    combat,
    decisiones,
    reinoVisible,
    avisoDecision,
    anyModalOpen,
    claseVisible,
    especializacionVisible,
    fase,
    puede,
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
    handleAceptarAviso,
    handleEntregarMision,
    handleAbandonarMision,
    handleContinuarTrasCombate,
    handleFundarReino,
    handleReabrirFundacionReino,
    handleCreateHabilidad,
    handleSetActiveCombatAbilityNames,
    handleDeleteHabilidad,
    handleUpdateHabilidad,
    handleAttachAbility,
    handleSelectSkillBar,
    handleBackToComposer,
    handleCreateSkillBar,
    handleSaveSkillBarEdit,
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
    handleSimpleModalSelect,
    closeSimpleModal,
    handleAttachItem,
    handleEquipItem,
    handleUnequipItem,
    handleTirarItem,
    handleSubmit,
    zonaModalOpen,
    setZonaModalOpen,
    saquearSoloNpcSlug,
    setSaquearSoloNpcSlug,
    handleCazarEnZona,
    handleInteractuarModoDinamico,
    handleDismissDynamicModeOffer,
    recursoDetalle,
    handleVerRecursoDetalle,
    handleCerrarRecursoDetalle,
    handleAccionRecursoDetalle,
    handleChooseNpcInteraction,
    handleElegirDynamicMode,
    handleSalirDynamicMode,
    handleResolveDeath,
    handleOpenEnciclopediaClasses,
    handleSpendAttributePoint,
    cancelingTransit,
    nowTick,
    handleCancelTransit,
    salirAPartidas,
    abrirPanelAjustes,
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

      {detailTarget && (
        <Capa id="detalle" hija>
        <DetailModal
          target={detailTarget}
          onClose={() => {
            setDetailTarget(null)
            setDetailInsertHandler(null)
          }}
          onUnequip={handleUnequipItem}
          onEquip={handleEquipItem}
          onTirar={handleTirarItem}
          onSaveAbility={handleUpdateHabilidad}
          onDeleteAbility={handleDeleteHabilidad}
          onInsert={detailInsertHandler ?? undefined}
          worldSlug={worldIdSlug}
          saveId={saveId}
        />
        </Capa>
      )}

      {reinoVisible && kingdomFoundedInfo && (
        <Capa id="reino">
        <KingdomFoundingModal info={kingdomFoundedInfo} onCancel={() => setKingdomFoundedInfo(null)} onConfirm={handleFundarReino} />
        </Capa>
      )}

      {/* Elección obligatoria de clase al empezar a jugar (2026-09-01, fix de bug real: personaje
          custom sin clase para siempre) — overlay bloqueante, mismo criterio de prioridad que
          muerte/fin de partida. Nunca coincide con el modal de especialización de abajo:
          pendingEspecializacionChoice exige `save.clase` ya asignada. */}
      {claseVisible && pendingClaseChoice && worldIdSlug && (
        <Capa id="clase">
        <ClaseModal clases={clasesDisponibles} worldSlug={worldIdSlug} onConfirm={handleAssignClase} />
        </Capa>
      )}

      {/* Elección obligatoria de especialización a nivel 10 (2026-09-01) — overlay bloqueante,
          mismo criterio de prioridad que el resto de estados excluyentes de la partida: la muerte
          permanente/fin de partida ganan si coinciden (no debería pasar de verdad: resolver una
          muerte no sube de nivel), especialización solo se muestra si ninguna de esas dos aplica. */}
      {especializacionVisible && pendingEspecializacionChoice && clase && worldIdSlug && (
        <Capa id="especializacion">
        <EspecializacionModal
          clase={clase}
          especializaciones={especializacionesDisponibles}
          worldSlug={worldIdSlug}
          onConfirm={handleAssignEspecializacion}
          onOpenEnciclopedia={handleOpenEnciclopediaClasses}
        />
        </Capa>
      )}

      {confirmingExit && (
        <Capa id="salir">
        {/* CFG-3 (hito 0.2) — menú de pausa (antes, la confirmación de «Salir a tus partidas»). */}
        <MenuPausa
          aviso={puede('salir').motivo}
          onReanudar={() => setConfirmingExit(false)}
          onConfiguracion={() => {
            setConfirmingExit(false)
            abrirPanelAjustes()
          }}
          onSalirPartidas={salirAPartidas}
          onSalirInicio={() => {
            setConfirmingExit(false)
            navigate('/')
          }}
        />
        </Capa>
      )}

      {harvestModal && saveId && characterAttributes && (
        <Capa id="recolectar">
        <HarvestSelectionModal
          saveId={saveId}
          oficio={harvestModal.oficio}
          oficioLabel={harvestModal.label}
          highlightSourceSlug={harvestModal.highlightSourceSlug}
          inventoryUsed={totalInventoryUnits(inventory)}
          inventoryCapacity={inventoryCapacityFor(
            characterAttributes,
            inventory.filter((i) => i.slot !== null),
          )}
          onConfirm={(created, updated, logEntry) => {
            // Bug real jugando en vivo (2026-08-07, "no acumula los items"): recolectar el mismo
            // objeto dos veces creaba dos filas sueltas en vez de sumar a la pila ya existente —
            // mismo patrón exacto que `applyInventoryDelta` ya resuelve para crafteo/construcción.
            setInventory((prev) => applyInventoryDelta(prev, created, [], updated))
            // Registro escrito determinista (petición explícita, 2026-08-07: "un texto de
            // narración que no dependa de la AI") — mismo canal (personaje) que cualquier otra
            // narración, sin pasar por streaming ni por el Narrador.
            if (logEntry) {
              setCharacterLog((prev) => [...prev, { ...logEntry, channel: 'character' }])
              // Coste de tiempo de recolección (petición explícita, 2026-08-14) — backend/
              // recolectar.ts ahora avanza el reloj de verdad; sin esto, `fictionalDate` (el mismo
              // valor congelado que ya causaba "se logea mal la hora") se quedaba atrás del propio
              // `timeLabel` que este turno acaba de sellar en su LogEntry.
              setFictionalDate(logEntry.timeLabel)
            }
            // Desollar pasiva (2026-08-25) — tras confirmar, puede que ya no quede nada pendiente
            // (o solo una parte, si había varias presas) — se recomprueba en vez de asumir false.
            if (harvestModal?.oficio === 'desollador' && saveId) {
              getRecolectarLocalizado(saveId, 'desollador')
                .then(({ sources }) => checkCarcassPending(sources.length > 0))
                .catch(() => {})
            }
            setHarvestModal(null)
          }}
          onCancel={() => setHarvestModal(null)}
        />
        </Capa>
      )}


      {simpleModal === 'camp' && saveId && (
        <Capa id="campamento">
        <CampSelectionModal saveId={saveId} onSelect={handleSimpleModalSelect} onCancel={closeSimpleModal} bloqueoTurno={bloqueoTurno} />
        </Capa>
      )}
      {simpleModal === 'travel' && saveId && (
        <Capa id="viajar">
        <TravelDestinationModal saveId={saveId} onSelect={handleSimpleModalSelect} onCancel={closeSimpleModal} bloqueoTurno={bloqueoTurno} />
        </Capa>
      )}
      {healModalOpen && (
        <Capa id="curar">
        <HealSelectionModal
          inventory={inventory}
          condicionFisica={condicionFisica}
          onConfirm={(actionText, healItemUses) => {
            setHealModalOpen(false)
            handleSubmit(actionText, { healItemUses })
          }}
          onCancel={() => setHealModalOpen(false)}
        />
        </Capa>
      )}

      {hungerThirstModalOpen && (
        <Capa id="comer">
        <HungerThirstSelectionModal
          inventory={inventory}
          hambre={hambre}
          sed={sed}
          onConfirm={(actionText, hambreSedItemUses) => {
            setHungerThirstModalOpen(false)
            handleSubmit(actionText, { hambreSedItemUses })
          }}
          onCancel={() => setHungerThirstModalOpen(false)}
        />
        </Capa>
      )}

      {editingSkillBar && (
        <Capa id="barra">
        <SkillBarEditor
          bar={editingSkillBar}
          savedActions={savedActions}
          onSave={handleSaveSkillBarEdit}
          onCancel={() => setEditingSkillBar(null)}
        />
        </Capa>
      )}

      {entregaModalOpen && saveId && (
        <Capa id="entregar">
        <EntregaModal
          saveId={saveId}
          onEntregado={(itemId, logEntry) => {
            setInventory((prev) => prev.filter((i) => i.id !== itemId))
            setCharacterLog((prev) => [...prev, { ...logEntry, channel: 'character' }])
            setFictionalDate(logEntry.timeLabel)
            setEntregaModalOpen(false)
          }}
          onCancel={() => setEntregaModalOpen(false)}
        />
        </Capa>
      )}

      {avisosAbiertos && (
        <Capa id="avisos">
          <AvisosModal
            titulo={avisosAbiertos.titulo}
            subtitulo={avisosAbiertos.subtitulo}
            avisos={avisosAbiertos.avisos}
            vacio={avisosAbiertos.vacio}
            cargando={avisosAbiertos.cargando}
            bandos={avisosAbiertos.bandos}
            onAceptar={handleAceptarAviso}
            onClose={() => setAvisosAbiertos(null)}
          />
        </Capa>
      )}

      {aprenderOficioModalOpen && saveId && (
        <Capa id="oficio">
        <AprenderOficioModal
          saveId={saveId}
          onAprendido={(professionId, costeGoirnos, logEntry) => {
            setProfessionProgress((prev) => [...prev, { professionId, nivel: 1, xp: 0 }])
            setGoirnos((prev) => Math.max(0, prev - costeGoirnos))
            setCharacterLog((prev) => [...prev, { ...logEntry, channel: 'character' }])
            setFictionalDate(logEntry.timeLabel)
            setAprenderOficioModalOpen(false)
          }}
          onCancel={() => setAprenderOficioModalOpen(false)}
        />
        </Capa>
      )}

      {saquearZonaModalOpen && saveId && (
        <Capa id="saquear">
        <SaquearZonaModal
          saveId={saveId}
          soloNpcSlug={saquearSoloNpcSlug ?? undefined}
          onConfirm={(actionText, lootItemNames) => {
            setSaquearZonaModalOpen(false)
            setSaquearSoloNpcSlug(null)
            combat.submitCombatAction(actionText, { lootItemNames, allowAfterEnded: true })
          }}
          onCancel={() => {
            setSaquearZonaModalOpen(false)
            setSaquearSoloNpcSlug(null)
          }}
        />
        </Capa>
      )}

      {postCombatTarget && (
        <Capa id="botin">
        <PostCombatInteractionModal
          target={postCombatTarget}
          busy={characterThinking}
          onSalir={() => setPostCombatTarget(null)}
          onSaquear={() => {
            const target = postCombatTarget
            setPostCombatTarget(null)
            handleSubmit(`Saqueo el cuerpo de '${target.name}'.`)
          }}
        />
        </Capa>
      )}

      {zonaModalOpen && saveId && (
        <Capa id="zona">
        <ZonaMovimientoModal
          saveId={saveId}
          onEncuentroZona={(entry) => setCharacterLog((prev) => [...prev, entry])}
          onClose={() => setZonaModalOpen(false)}
          // Icono de salida de región (2026-09-17) — mismo patrón que `handleSimpleModalSelect`:
          // cierra el modal de zona y manda el texto por el turno normal, como si el jugador lo
          // hubiera escrito él mismo (el motor de viaje determinista decide el resto).
          onViajarA={(actionText) => {
            setZonaModalOpen(false)
            handleSubmit(actionText)
          }}
          bloqueoTurno={bloqueoTurno}
          bloqueoMovimiento={permisoMover.motivo}
          // Icono de parcela (§ 7.4, 2026-09-21) — roster estático ya cargado por useRecipesData
          // (nombre/descripción por recipeKey) + refreshSave (mismo callback que ya usa ReinoPanel
          // tras "Descansar en campamento", una acción directa sin /turn/narrate).
          professionRecipes={professionRecipes}
          onRefreshSave={refreshSave}
          // Alejarse andando de una oferta pacífica la descarta en el backend (2026-09-28) — se
          // retira su tarjeta para no dejar un "Interactuar" huérfano en el log.
          // Cadáveres en el mapa (Fase 5, 2026-09-28) — el pin ya caminó hasta el cadáver y cerró el
          // mapa; aquí solo se abre el modal real (mismos que usaban el botón Saquear y el aviso de
          // escena de Desollar).
          onSaquearCadaver={(npcSlug) => {
            setSaquearSoloNpcSlug(npcSlug)
            setSaquearZonaModalOpen(true)
          }}
          onDesollarCadaver={() => setHarvestModal({ oficio: 'desollador', label: 'Desollar' })}
          onHoraActualizada={setFictionalDate}
          onOfertaDescartada={() =>
            setCharacterLog((prev) => prev.map((e) => (e.dynamicModeOffer && !e.dynamicModeOffer.combateForzado ? { ...e, dynamicModeOffer: undefined } : e)))
          }
          // ZON-5 (hito 0.2, petición de la usuaria): el encuentro sale también junto a su ficha y el
          // mapa no se cierra. Hablar o recolectar se abren encima (el mapa espera debajo y vuelve);
          // solo se cierra para escribir una respuesta o cuando empieza un combate (efecto de abajo).
          ofertaEnMapa={(entryId) => {
            const offer = characterLog.find((e) => e.id === entryId)?.dynamicModeOffer
            if (!offer) return null
            const cerrarMapa = () => setZonaModalOpen(false)
            return presentacionOferta(entryId, offer, {
              onInteractuarModoDinamico: handleInteractuarModoDinamico,
              onResponderEscribiendo: (nombre) => {
                cerrarMapa()
                handleResponderEscribiendo(nombre)
              },
              onVerRecursoDetalle: handleVerRecursoDetalle,
              onCazarEnZona: handleCazarEnZona,
              onDismissDynamicModeOffer: handleDismissDynamicModeOffer,
            })
          }}
        />
        </Capa>
      )}

      {recursoDetalle && (
        <Capa id="recurso">
        <RecursoDetalleModal
          nombre={recursoDetalle.targetName}
          metodo={recursoDetalle.metodo}
          entry={enciclopediaData?.faunaFlora.find((f) => f.sourceSlug === recursoDetalle.targetSlug)}
          onAccion={handleAccionRecursoDetalle}
          onCerrar={handleCerrarRecursoDetalle}
        />
        </Capa>
      )}

      {activeDynamicMode && (
        <Capa id="dinamico">
        <DynamicModeModal
          turno={activeDynamicMode.turno}
          busy={activeDynamicMode.busy}
          error={activeDynamicMode.error}
          imageUrl={activeDynamicMode.imageUrl}
          onElegir={handleElegirDynamicMode}
          onCerrar={() => setActiveDynamicMode(null)}
          onSalir={handleSalirDynamicMode}
        />
        </Capa>
      )}

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
    </EnciclopediaLinkProvider>
  )
}
