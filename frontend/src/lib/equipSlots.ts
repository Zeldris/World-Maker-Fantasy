import type { EquipSlot } from '../types'

export const SLOT_ORDER: EquipSlot[] = [
  'CASCO',
  'ABALORIO',
  'CAMISA',
  'ARMADURA_SUPERIOR',
  'GUANTES',
  'ARMADURA_INFERIOR',
  'ACCESORIO',
  'BOTAS',
  'ARMA_PRINCIPAL',
  'ARMA_SECUNDARIA',
  'ANILLO_1',
  'ANILLO_2',
  'CINTURON',
  'CONSUMIBLE_1',
  'CONSUMIBLE_2',
  'CONSUMIBLE_3',
  'CONSUMIBLE_4',
  'CONSUMIBLE_5',
  'CONSUMIBLE_6',
]

/// Familia de ranuras compatibles (2026-07-30, petición explícita: "categorizar por ranura para
/// que no pueda poner un casco en los pies") — mismo criterio que `equipSlotFamily` (backend,
/// equipment.ts): cualquier arma vale en cualquier mano, cualquier anillo en cualquier dedo, el
/// resto de ranuras son 1:1 exactas.
export const CONSUMIBLE_SLOTS: EquipSlot[] = ['CONSUMIBLE_1', 'CONSUMIBLE_2', 'CONSUMIBLE_3', 'CONSUMIBLE_4', 'CONSUMIBLE_5', 'CONSUMIBLE_6']

export function equipSlotFamily(canonical: EquipSlot): EquipSlot[] {
  if (canonical === 'ARMA_PRINCIPAL' || canonical === 'ARMA_SECUNDARIA') return ['ARMA_PRINCIPAL', 'ARMA_SECUNDARIA']
  if (canonical === 'ANILLO_1' || canonical === 'ANILLO_2') return ['ANILLO_1', 'ANILLO_2']
  if ((CONSUMIBLE_SLOTS as string[]).includes(canonical)) return CONSUMIBLE_SLOTS
  return [canonical]
}

/// Ranura equipada de consumible (2026-07-30) — determina qué aparece como "Tus objetos" en
/// combate (CombatPanel.tsx vía GameView.tsx), ya no "cualquier objeto sin ranura".
export function isConsumibleSlot(slot: EquipSlot | null | undefined): boolean {
  return !!slot && (CONSUMIBLE_SLOTS as string[]).includes(slot)
}

/// Un objeto es candidato a una ranura si tiene una `equipSlot` real cuya familia incluye esa
/// ranura. Ajustado 2026-07-30 tras probarlo en vivo: la primera versión era permisiva "sin
/// equipSlot = vale en cualquier ranura", y eso dejaba equipar una Cataplasma o un Mapa en la
/// Camisa. Solo se queda permisivo si el objeto NO tiene ningún `catalogSlug` (narrativo suelto
/// inventado por el modelo, sin fila de catálogo contra la que validar nada) — mismo criterio que
/// la ruta PATCH del backend.
export function isCompatibleWithSlot(item: { catalogSlug?: string | null; equipSlot?: EquipSlot | null }, targetSlot: EquipSlot): boolean {
  if (!item.catalogSlug) return true
  if (!item.equipSlot) return false
  return equipSlotFamily(item.equipSlot).includes(targetSlot)
}

export const SLOT_LABEL: Record<EquipSlot, string> = {
  CASCO: 'Casco',
  ABALORIO: 'Abalorio',
  CAMISA: 'Camisa',
  ARMADURA_SUPERIOR: 'Armadura superior',
  GUANTES: 'Guantes',
  ARMADURA_INFERIOR: 'Armadura inferior',
  ACCESORIO: 'Accesorio',
  BOTAS: 'Botas',
  ARMA_PRINCIPAL: 'Arma principal',
  ARMA_SECUNDARIA: 'Arma secundaria',
  ANILLO_1: 'Anillo 1',
  ANILLO_2: 'Anillo 2',
  CINTURON: 'Cinturón',
  CONSUMIBLE_1: 'Consumible 1',
  CONSUMIBLE_2: 'Consumible 2',
  CONSUMIBLE_3: 'Consumible 3',
  CONSUMIBLE_4: 'Consumible 4',
  CONSUMIBLE_5: 'Consumible 5',
  CONSUMIBLE_6: 'Consumible 6',
}
