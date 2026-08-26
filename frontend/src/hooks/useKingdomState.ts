import { useState } from 'react'
import type { AlmacenItemInfo, BuildingInfo, KingdomFoundedInfo, KingdomStatsInfo, PlantillaEquipoInfo, SubjectInfo, TerritoryInfo } from '../types'

/// Estado de Reino (deuda técnica, auditoría 2026-08-25 — ver
/// [[tarkor_extraccion_hooks_gameview_2026-08-21]] para el criterio real de extracción usado en
/// este proyecto: "¿quién más escribe este mismo estado?", no cuántas líneas tiene el bloque).
/// `syncFromSave` (GameView.tsx, al cargar/recargar la partida) y `useCombatFlow` (tras resolver un
/// turno con intercambio de combate) escriben esta misma pieza de estado desde FUERA de este hook
/// — por eso no puede vivir aislado como `useSurroundingsPolling`/`useRecipesData`: el hook solo
/// agrupa las declaraciones `useState` (reduce el recuento de líneas de `GameView.tsx`), pero cada
/// setter se sigue pasando tal cual a quien ya lo necesitaba (mismo patrón que `factionsStatus` ya
/// usaba antes de esta extracción).
export function useKingdomState() {
  const [kingdomName, setKingdomName] = useState<string | null>(null)
  // Popup de fundación de reino (2026-08-04) — se abre solo al construir el Ayuntamiento tier 1.
  const [kingdomFoundedInfo, setKingdomFoundedInfo] = useState<KingdomFoundedInfo | null>(null)
  const [territories, setTerritories] = useState<TerritoryInfo[]>([])
  const [buildings, setBuildings] = useState<BuildingInfo[]>([])
  const [subjects, setSubjects] = useState<SubjectInfo[]>([])
  // Grupo 3 § Compañeros y supervivencia (2026-08-25) — Almacén de Reino + Plantillas de equipo.
  const [almacenItems, setAlmacenItems] = useState<AlmacenItemInfo[]>([])
  const [plantillasEquipo, setPlantillasEquipo] = useState<PlantillaEquipoInfo[]>([])
  const [factionsStatus, setFactionsStatus] = useState<Record<string, number>>({})
  const [kingdomStats, setKingdomStats] = useState<KingdomStatsInfo | null>(null)

  return {
    kingdomName,
    setKingdomName,
    kingdomFoundedInfo,
    setKingdomFoundedInfo,
    territories,
    setTerritories,
    buildings,
    setBuildings,
    subjects,
    setSubjects,
    almacenItems,
    setAlmacenItems,
    plantillasEquipo,
    setPlantillasEquipo,
    factionsStatus,
    setFactionsStatus,
    kingdomStats,
    setKingdomStats,
  }
}
