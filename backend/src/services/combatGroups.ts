/// Grupos de combate (2026-09-08, diseño de la usuaria: "grupos de 4 con los compañeros... el
/// Grupo 1 siempre estará el PJ a la cabeza... podrás mover tus compañeros entre los diferentes
/// grupos, un poco como las habilidades de combate") — funciones puras compartidas entre el
/// endpoint de gestión (routes/saves/combatGroups.ts) y cualquier consumidor futuro.

/// Grupo 1 (slotIndex 0) siempre existe implícitamente, con el PJ a la cabeza — nunca se crea como
/// fila de `CombatGroup` salvo que el jugador lo renombre (mismo criterio que `hasBaseSkillBar`,
/// pero aquí la base ni necesita fila para EXISTIR, solo para tener un nombre custom).
export const COMBAT_GROUP_BASE_SLOT = 0;

/// Puro: el próximo `slotIndex` libre para un grupo nuevo (nunca reutiliza el 0, ya reservado al
/// Grupo 1 implícito). Sin tope — a diferencia de `SKILL_BARS_MAX`, la usuaria no pidió un límite
/// de CUÁNTOS grupos puede haber, solo un límite de 4 combatientes POR grupo (ya aplicado en
/// cazar.ts al construir el bando JUGADOR).
export function nextFreeCombatGroupSlot(existingSlotIndexes: number[]): number {
  let i = COMBAT_GROUP_BASE_SLOT + 1;
  while (existingSlotIndexes.includes(i)) i++;
  return i;
}
