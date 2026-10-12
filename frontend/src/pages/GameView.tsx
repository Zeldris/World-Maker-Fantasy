import { Notificaciones } from '../components/Notificaciones'
import { GameHeader } from '../components/GameHeader'
import { GameFooter } from '../components/GameFooter'
import { CapasContext } from '../context/capasContext'
// Sugerencias desactivadas (2026-09-06, ver comentario junto a `suggestions` más abajo) —
// `SuggestionBar` deja de importarse mientras la entrada visible está oculta.
// import { SuggestionBar } from '../components/SuggestionBar'
import { EnciclopediaLinkProvider } from '../context/EnciclopediaLinkContext'
import { MisionesContext } from '../context/misionesContext'
import { CombatComposer } from '../components/CombatComposer'
import { formatCountdown, formatFictionalDuration } from '../lib/gameViewHelpers'

import { useGameViewState } from './useGameViewState'
import { GameViewContext } from './GameViewContext'
import { GameModals } from './GameModals'
import { GameLayout } from './GameLayout'
import { GamePanelCajon } from './GamePanelCajon'

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
    worldName,
    characterName,
    characterAttributes,
    secondaryAttributes,
    setHarvestModal,
    carcassPending,
    level,
    pendingAttributePoints,
    deathCount,
    dificultad,
    savedActions,
    fictionalDate,
    entorno,
    setInput,
    setConfirmingExit,
    skillHudView,
    setSkillHudView,
    skillBars,
    setEditingSkillBar,
    composerRef,
    busyUntil,
    busyActivity,
    busyDuracionMinutos,
    setActivePanel,
    setPersonajeSubTab,
    enciclopediaIndex,
    notFound,
    creacionError,
    setReintentosCreacion,
    condicionFisica,
    energia,
    energiaMax,
    hambre,
    sed,
    endedAt,
    pendingDeathResolution,
    resolvingDeath,
    combateIniciado,
    combat,
    decisiones,
    avisoDecision,
    anyModalOpen,
    fase,
    permisoTurno,
    etiquetaFase,
    worldThinking,
    notificaciones,
    descartarNotificacion,
    noticiasMundo,
    misionesValue,
    handleAttachAbility,
    handleSelectSkillBar,
    handleBackToComposer,
    handleCreateSkillBar,
    handleDeleteSkillBar,
    handleEntityDetailNavigate,
    handleEntityQuickInsert,
    handleSubmit,
    handleResolveDeath,
    cancelingTransit,
    errorCancelar,
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

      <GameLayout />

      {busyUntil && (
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-iron-800 bg-wood-950/90 px-4 py-2 text-center text-xs text-wood-400">
          <span>
            <span className="gem mr-1.5 align-middle" /> Ocupado{busyActivity ? ` con «${busyActivity}»` : ''} — vuelve en{' '}
            <span className="font-mono font-semibold text-accent-300">{formatCountdown(busyUntil, nowTick)}</span>
            {busyDuracionMinutos ? (
              <>
                {' '}
                (<span className="font-semibold text-wood-200">{formatFictionalDuration(busyDuracionMinutos)}</span> en {worldName})
              </>
            ) : null}{' '}
            (sobre las {new Date(busyUntil).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}), se resolverá solo.
          </span>
          <button type="button"
            onClick={handleCancelTransit}
            disabled={cancelingTransit}
            className="tactile rounded-lg border border-iron-700 bg-wood-950/60 px-2.5 py-1 text-2xs text-wood-300 transition-colors hover:border-red-700/60 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelingTransit ? 'Cancelando...' : 'Cancelar acción'}
          </button>
          {errorCancelar && <span role="status" className="text-red-400">{errorCancelar}</span>}
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

      <GamePanelCajon />
      <Notificaciones notificaciones={notificaciones} onDescartar={descartarNotificacion} />
    </div>
    </MisionesContext.Provider>
    </CapasContext.Provider>
    </GameViewContext.Provider>
    </EnciclopediaLinkProvider>
  )
}
