import { Capa } from '../components/Capa'
import { ModoConsultaContext } from '../context/modoConsultaContext'
// Sugerencias desactivadas (2026-09-06, ver comentario junto a `suggestions` más abajo) —
// `SuggestionBar` deja de importarse mientras la entrada visible está oculta.
// import { SuggestionBar } from '../components/SuggestionBar'
import { type PanelId } from '../components/NavTabs'
import { PanelDrawer } from '../components/PanelDrawer'
import { MapaPanel } from '../components/panels/MapaPanel'
import { DiarioPanel } from '../components/panels/DiarioPanel'
import { LeyendasPanel } from '../components/panels/LeyendasPanel'
import { InventarioPanel } from '../components/panels/InventarioPanel'
import { EnciclopediaPanel } from '../components/panels/EnciclopediaPanel'
import { PersonajePanel } from '../components/panels/PersonajePanel'
import { ReputacionPanel } from '../components/panels/ReputacionPanel'
import { CompanerosPanel } from '../components/panels/CompanerosPanel'
import { ReinoPanel } from '../components/panels/ReinoPanel'
import { MisionesPanel } from '../components/panels/MisionesPanel'
import { HabilidadesPanel } from '../components/panels/HabilidadesPanel'
import { inventoryCapacityFor } from '../lib/inventoryCapacity'

import { useGameView } from './GameViewContext'

/// BAS-5 (hito 0.2): el cajón de paneles (Inventario, Personaje, Mapa, Reino…) que se abre desde
/// los raíles. Lee el estado de `GameViewContext`.
export function GamePanelCajon() {
  const {
    saveId,
    worldIdSlug,
    characterName,
    characterMotivation,
    characterArchetype,
    characterOrigin,
    characterAttributes,
    characterAttributeBonuses,
    secondaryAttributes,
    setCharacterLog,
    inventory,
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
    savedActions,
    activeCombatAbilityNames,
    combatSlots,
    entorno,
    currentLocation,
    professionRecipes,
    recipesStatus,
    destinations,
    setActivePanel,
    enciclopediaInitialCategory,
    enciclopediaOpenKey,
    personajeSubTab,
    setPersonajeSubTab,
    reinoSubTab,
    setReinoSubTab,
    enciclopediaData,
    enciclopediaLoading,
    condicionFisica,
    energia,
    energiaMax,
    hambre,
    sed,
    quests,
    bloqueoTurno,
    modoConsulta,
    panelMostrado,
    panelSaliendo,
    avisoLlegadas,
    leyendaPedida,
    rumoresDelMapa,
    refreshSave,
    handleEntregarMision,
    handleAbandonarMision,
    handleReabrirFundacionReino,
    handleCreateHabilidad,
    handleSetActiveCombatAbilityNames,
    handleAttachAbility,
    handleItemDetail,
    handleAbilityDetail,
    handleSlotClick,
    handleEnciclopediaInsert,
    handleEnciclopediaDetail,
    handleAttachItem,
    handleSubmit,
    handleSpendAttributePoint,
    worldName,
  } = useGameView()
  if (!saveId || !worldName || !characterName || !characterAttributes || !secondaryAttributes) return null

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
    <>
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
              saveId={saveId}
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
              edificiosConstruidos={buildings.flatMap((b) => (b.recipeKey ? [b.recipeKey] : []))}
              onUse={handleAttachAbility}
              onCreate={handleCreateHabilidad}
              onDetail={handleAbilityDetail}
            />
          )}
          </ModoConsultaContext.Provider>
        </PanelDrawer>
        </Capa>
      )}
    </>
  )
}
