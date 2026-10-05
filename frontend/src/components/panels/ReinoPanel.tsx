import type { AlmacenItemInfo, BuildingInfo, CompanionInfo, InventoryItemInfo, KingdomStatsInfo, PlantillaEquipoInfo, ProfessionRecipeInfo, RecipeStatusInfo, SubjectInfo, TerritoryInfo } from '../../types'
import type { EnciclopediaFaccionInfo } from '../../lib/api'
import { PanelEmptyState } from '../PanelEmptyState'
import { VisionGeneralSection } from './reino/VisionGeneralSection'
import { EdificiosParcelasSection } from './reino/EdificiosParcelasSection'
import { ProduccionSection } from './reino/ProduccionSection'
import { SubditosSection } from './reino/SubditosSection'
import { DiplomaciaMercadoSection } from './reino/DiplomaciaMercadoSection'
import { ComercioSection } from './reino/ComercioSection'

// Re-exportado tal cual (2026-09-21, rediseño en sub-tabs) — CompanerosPanel.tsx lo importa desde
// aquí (`import { PlantillaSelect } from './ReinoPanel'`); el componente real ahora vive en
// `reino/SubditosSection.tsx`, este re-export evita tocar ese import existente sin necesidad.
export { PlantillaSelect } from './reino/SubditosSection'

export type ReinoSubTab = 'vision-general' | 'edificios' | 'produccion' | 'subditos' | 'diplomacia-mercado'

const SUB_TABS: { id: ReinoSubTab; label: string; icon: string }[] = [
  { id: 'vision-general', label: 'Visión general', icon: '🏰' },
  { id: 'edificios', label: 'Edificios', icon: '🧱' },
  { id: 'produccion', label: 'Producción', icon: '⚙️' },
  { id: 'subditos', label: 'Súbditos', icon: '👥' },
  { id: 'diplomacia-mercado', label: 'Diplomacia', icon: '🤝' },
]

interface ReinoPanelProps {
  saveId: string
  kingdomName: string | null
  characterMotivation: string | null
  territories: TerritoryInfo[]
  buildings: BuildingInfo[]
  subjects: SubjectInfo[]
  companions: CompanionInfo[]
  /// Economía de Reino (sesión de diseño 2026-07-23) — null hasta fundar el primer Territory.
  kingdomStats: KingdomStatsInfo | null
  /// Bug real (auditoría de deuda técnica 2026-08-04): cancelar el popup de fundación (o recargar
  /// la página con él abierto) perdía la única oportunidad de nombrar el reino para siempre — no
  /// había ningún sitio para volver a intentarlo. undefined = no reabrir (no debería pasar en la
  /// práctica, GameView siempre lo pasa).
  onFundarReino?: () => void
  /// Grupo 3 § Compañeros y supervivencia (2026-08-25) — Almacén de Reino + Plantillas de equipo.
  inventory: InventoryItemInfo[]
  almacenItems: AlmacenItemInfo[]
  plantillasEquipo: PlantillaEquipoInfo[]
  onRefreshSave: () => Promise<void>
  /// Producción (Fase 2, 2026-09-21) — roster estático de recetas ya cargado por `useRecipesData`
  /// en GameView.tsx, reutilizado tal cual para el selector de "Nueva orden".
  professionRecipes: ProfessionRecipeInfo[]
  /// Diplomacia y Mercado (Fase 3, 2026-09-21) — mismo dato ya cargado que consume ReputacionPanel
  /// (`enciclopediaData?.factions`), reutilizado tal cual.
  factions: EnciclopediaFaccionInfo[]
  goirnos: number
  /// Sub-tabs (rediseño 2026-09-21, mismo patrón que `PersonajeSubTab`/`PersonajePanel.tsx`) — el
  /// estado vive en GameView.tsx, no aquí, igual que el resto de paneles con sub-navegación.
  activeSubTab: ReinoSubTab
  onSubTabChange: (tab: ReinoSubTab) => void
  /// H-12 — estado de recetas de construcción + envío del texto de construir (Edificios).
  recipesStatus?: RecipeStatusInfo[]
  onBuild?: (actionText: string) => void
  /// UX-3 (hito 0.1) — motivo por el que ahora no se puede lanzar un turno (narrador escribiendo,
  /// ocupado…); `null`/ausente = libre. Deshabilita los botones que mandan una acción al turno.
  bloqueoTurno?: string | null
}

/// Cascarón de sub-tabs del Reino (rediseño 2026-09-21, docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md) —
/// reestructurado de una lista plana de 6+ secciones (677 líneas en un solo archivo) a 5
/// sub-pestañas, mismo patrón exacto que `PersonajePanel.tsx`. Auditoría de friendliness
/// (2026-09-21): el scroll único mezclaba Economía/Territorios/Edificios/Súbditos/Almacén/
/// Plantillas sin ninguna jerarquía de navegación — cada sección real ahora vive en su propio
/// componente bajo `panels/reino/`.
export function ReinoPanel({
  saveId,
  kingdomName,
  characterMotivation,
  territories,
  buildings,
  subjects,
  companions,
  kingdomStats,
  onFundarReino,
  inventory,
  almacenItems,
  plantillasEquipo,
  onRefreshSave,
  professionRecipes,
  factions,
  goirnos,
  activeSubTab,
  onSubTabChange,
  recipesStatus,
  onBuild,
  bloqueoTurno,
}: ReinoPanelProps) {
  const isEmpty = territories.length === 0 && buildings.length === 0 && subjects.length === 0
  const ayuntamiento = buildings.some((b) => b.recipeKey === 'ayuntamiento')

  if (isEmpty) {
    // Auditoría de UX (2026-09-08): a diferencia de Compañeros/Reputación (mismo componente
    // `PanelEmptyState`), este hint solo mostraba la frase de motivación del personaje cuando
    // existía — evocador, pero sin ninguna pista práctica de cómo llegar a tener un Reino. Se
    // añade la pista real (construir un Ayuntamiento, docs/mecanicas/17-reglas-construcciones-reino.md)
    // detrás de la motivación en vez de sustituirla, para no perder el sabor narrativo.
    const practicalHint = 'Construye un Ayuntamiento para fundar tu reino.'
    return (
      <PanelEmptyState
        icon="🏰"
        title="Todavía no gobierna a nadie"
        hint={characterMotivation ? `${characterMotivation} ${practicalHint}` : practicalHint}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5 border-b border-iron-800 pb-2">
        {SUB_TABS.map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => onSubTabChange(tab.id)}
            className={`tactile flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              activeSubTab === tab.id
                ? 'bg-wood-950/70 text-accent-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]'
                : 'text-wood-400 hover:bg-wood-950/40 hover:text-wood-200'
            }`}
          >
            <span className="text-sm leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'vision-general' && (
        <VisionGeneralSection
          saveId={saveId}
          kingdomName={kingdomName}
          territories={territories}
          kingdomStats={kingdomStats}
          buildings={buildings}
          ayuntamiento={ayuntamiento}
          onFundarReino={onFundarReino}
          onRefreshSave={onRefreshSave}
        />
      )}
      {activeSubTab === 'edificios' && <EdificiosParcelasSection buildings={buildings} recipesStatus={recipesStatus} onBuild={onBuild} bloqueoTurno={bloqueoTurno} />}
      {activeSubTab === 'produccion' && (
        <ProduccionSection
          saveId={saveId}
          buildings={buildings}
          companions={companions}
          almacenItems={almacenItems}
          professionRecipes={professionRecipes}
          onRefreshSave={onRefreshSave}
        />
      )}
      {activeSubTab === 'subditos' && (
        <SubditosSection
          saveId={saveId}
          subjects={subjects}
          companions={companions}
          inventory={inventory}
          almacenItems={almacenItems}
          plantillasEquipo={plantillasEquipo}
          onRefreshSave={onRefreshSave}
        />
      )}
      {activeSubTab === 'diplomacia-mercado' && (
        <>
          <DiplomaciaMercadoSection saveId={saveId} companions={companions} factions={factions} goirnos={goirnos} onRefreshSave={onRefreshSave} almacenItems={almacenItems} />
          {/* CR-47: comercio de volumen con caravanas. */}
          <ComercioSection saveId={saveId} />
        </>
      )}
    </div>
  )
}
