import { useEffect, useState } from 'react'
import { getProfessionRecipes, getRecipesStatus } from '../lib/api'
import type { AttributeBlock, CurrentLocationInfo, InventoryItemInfo, ProfessionRecipeInfo, RecipeStatusInfo } from '../types'

export interface UseRecipesDataResult {
  professionRecipes: ProfessionRecipeInfo[]
  recipesStatus: RecipeStatusInfo[]
}

/// Extraído de GameView.tsx (auditoría de deuda técnica, 2026-08-21) — mismo comportamiento exacto
/// (mismos dos fetches independientes, mismas dependencias), solo reorganizado en un hook propio.
export function useRecipesData(
  saveId: string | null,
  inventory: InventoryItemInfo[],
  characterAttributes: AttributeBlock | null,
  currentLocation: CurrentLocationInfo | null,
): UseRecipesDataResult {
  // Roster estático de recetas de oficio (rediseño de profesiones, 2026-08-07) — independiente de
  // partida, se pide una sola vez al montar (no cambia mientras se juega). Habilidades > Profesiones
  // lo usa para mostrar TODAS las recetas de una profesión creadora, bloqueadas o no.
  const [professionRecipes, setProfessionRecipes] = useState<ProfessionRecipeInfo[]>([])
  useEffect(() => {
    getProfessionRecipes()
      .then(setProfessionRecipes)
      .catch(() => {
        // Si falla, Habilidades > Profesiones simplemente no muestra el roster bloqueado — no
        // rompe nada más, no hace falta reintentar agresivamente.
      })
  }, [])

  // Estado real de cada receta EN ESTA PARTIDA (2026-08-13, petición explícita: "que salgan
  // deshabilitadas si no cumples las condiciones... el hover con... 5/10") — depende del
  // inventario/atributos/ubicación reales, así que se recarga cada vez que cualquiera de los tres
  // cambia. Bug real de auditoría (2026-08-13): al depender solo de `[saveId, inventory]`, subir
  // un punto de atributo (handleSpendAttributePoint) o viajar a la ubicación que pedía una receta
  // (ej. Campamento del Clan Serhu) no refrescaba nada — las tarjetas se quedaban mostrando "Falta:
  // Fuerza" o "Debes estar en X" aunque el jugador ya cumpliera la condición, hasta que algo no
  // relacionado tocara el inventario.
  const [recipesStatus, setRecipesStatus] = useState<RecipeStatusInfo[]>([])
  useEffect(() => {
    if (!saveId) return
    getRecipesStatus(saveId)
      .then((res) => setRecipesStatus(res.recipes))
      .catch(() => {
        // Si falla, las tarjetas de Habilidades/Enciclopedia simplemente no se deshabilitan por
        // esto — no rompe nada más.
      })
  }, [saveId, inventory, characterAttributes, currentLocation])

  return { professionRecipes, recipesStatus }
}
