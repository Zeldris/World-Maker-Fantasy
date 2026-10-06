import { MenuPausa } from '../components/MenuPausa'
import { Capa } from '../components/Capa'
// Sugerencias desactivadas (2026-09-06, ver comentario junto a `suggestions` más abajo) —
// `SuggestionBar` deja de importarse mientras la entrada visible está oculta.
// import { SuggestionBar } from '../components/SuggestionBar'
import { SkillBarEditor } from '../components/SkillBarEditor'
import { presentacionOferta } from '../lib/ofertaModoDinamico'
import { DetailModal } from '../components/DetailModal'
import { AvisosModal } from '../components/AvisosModal'
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
import { getRecolectarLocalizado } from '../lib/api'
import { applyInventoryDelta } from '../lib/gameViewHelpers'

import { useGameView } from './GameViewContext'

/// BAS-5 (hito 0.2): las capas modales de la partida (detalle, Reino, clase, recolectar, viajar,
/// zona, modo dinámico…), sacadas de `GameView`. Leen el estado de `GameViewContext`.
export function GameModals() {
  const {
    navigate,
    saveId,
    worldIdSlug,
    characterAttributes,
    characterLog,
    setCharacterLog,
    inventory,
    setInventory,
    harvestModal,
    setHarvestModal,
    checkCarcassPending,
    simpleModal,
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
    setGoirnos,
    kingdomFoundedInfo,
    setKingdomFoundedInfo,
    setProfessionProgress,
    savedActions,
    setFictionalDate,
    professionRecipes,
    confirmingExit,
    setConfirmingExit,
    editingSkillBar,
    setEditingSkillBar,
    characterThinking,
    detailTarget,
    setDetailTarget,
    detailInsertHandler,
    setDetailInsertHandler,
    enciclopediaData,
    condicionFisica,
    hambre,
    sed,
    pendingClaseChoice,
    clasesDisponibles,
    pendingEspecializacionChoice,
    especializacionesDisponibles,
    clase,
    handleAssignClase,
    handleAssignEspecializacion,
    avisosAbiertos,
    setAvisosAbiertos,
    combat,
    reinoVisible,
    claseVisible,
    especializacionVisible,
    puede,
    bloqueoTurno,
    permisoMover,
    refreshSave,
    handleAceptarAviso,
    handleFundarReino,
    handleDeleteHabilidad,
    handleUpdateHabilidad,
    handleSaveSkillBarEdit,
    handleResponderEscribiendo,
    handleSimpleModalSelect,
    closeSimpleModal,
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
    handleElegirDynamicMode,
    handleSalirDynamicMode,
    handleOpenEnciclopediaClasses,
    salirAPartidas,
    abrirPanelAjustes,
    worldName,
    characterName,
    secondaryAttributes,
  } = useGameView()
  if (!saveId || !worldName || !characterName || !characterAttributes || !secondaryAttributes) return null

  return (
    <>
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
    </>
  )
}
