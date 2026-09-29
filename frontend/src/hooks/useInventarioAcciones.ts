import type { Dispatch, SetStateAction } from 'react'
import { getSave, setItemSlot, tirarItem } from '../lib/api'
import type { SaveDetail } from '../lib/api'
import type { EquipSlot, InventoryItemInfo } from '../types'

// Bloque equipar/desequipar/tirar extraído de GameView.tsx (Fase 12 del plan, refactor puro, mismo
// patrón que useZonaAcciones.ts): GameView sigue siendo dueño de `inventory` y de `syncFromSave`,
// el hook los recibe como parámetros.
interface UseInventarioAccionesParams {
  saveId: string | null
  inventory: InventoryItemInfo[]
  setInventory: Dispatch<SetStateAction<InventoryItemInfo[]>>
  syncFromSave: (save: SaveDetail) => void
}

export function useInventarioAcciones({ saveId, inventory, setInventory, syncFromSave }: UseInventarioAccionesParams) {
  async function handleEquipItem(item: InventoryItemInfo, slot: EquipSlot) {
    const previous = inventory
    // Solo puede haber un objeto por hueco — el que ya lo ocupara vuelve a la mochila, igual que
    // hace el backend en la misma transacción.
    setInventory((prev) =>
      prev.map((i) => {
        if (i.id === item.id) return { ...i, slot }
        if (i.slot === slot) return { ...i, slot: null }
        return i
      }),
    )
    try {
      if (saveId) {
        await setItemSlot(saveId, item.id, slot)
        // Bug real jugando en vivo (2026-08-12, "me he puesto la maza pero sigo viendo la
        // habilidad de estocada del cuchillo"): el backend SÍ resincroniza las habilidades de arma
        // dinámicas en la misma transacción del PATCH (syncDynamicCombatAbilities, dynamicAbilities.ts)
        // — el hueco era puramente de caché del frontend, `setItemSlot` solo actualiza `inventory`
        // en local y nunca vuelve a pedir `savedActions`, así que el tab de Habilidades seguía
        // mostrando la instantánea de antes de equipar hasta el próximo turno/recarga. Un `getSave`
        // + `syncFromSave` tras equipar es el mismo patrón ya usado en el resto de mutaciones de
        // esta pantalla (ver `handleCancelTransit` más arriba).
        const save = await getSave(saveId)
        syncFromSave(save)
      }
    } catch (err) {
      setInventory(previous)
      // Re-lanzado a propósito (sesión de diseño 2026-07-23): el equipar puede fallar de verdad
      // ahora (requisitos de atributo no cumplidos) — DetailModal espera esta promesa y muestra
      // el mensaje en vez de que el objeto "se desequipe solo" en silencio.
      throw err
    }
  }

  async function handleUnequipItem(item: InventoryItemInfo) {
    const previous = inventory
    setInventory((prev) => prev.map((i) => (i.id === item.id ? { ...i, slot: null } : i)))
    try {
      if (saveId) {
        await setItemSlot(saveId, item.id, null)
        // Mismo hueco de caché que handleEquipItem — desequipar también dispara
        // syncDynamicCombatAbilities en el backend (vuelve al arma desarmada/la otra mano).
        const save = await getSave(saveId)
        syncFromSave(save)
      }
    } catch (err) {
      setInventory(previous)
      throw err
    }
  }

  // "Tirar" un objeto al suelo de la Zona actual (2026-09-06, hallazgo 8) — mismo criterio de
  // rollback optimista que handleUnequipItem: se quita del inventario local de inmediato, y si el
  // backend rechaza la petición (posición en el mapa no disponible, etc.) se restaura.
  async function handleTirarItem(item: InventoryItemInfo) {
    if (!saveId) return
    const previous = inventory
    setInventory((prev) => prev.filter((i) => i.id !== item.id))
    try {
      await tirarItem(saveId, item.id)
    } catch (err) {
      setInventory(previous)
      throw err
    }
  }


  return { handleEquipItem, handleUnequipItem, handleTirarItem }
}
