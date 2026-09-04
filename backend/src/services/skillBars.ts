/// Barras de habilidades múltiples fuera de combate (2026-09-04, v2 de la SkillBar única de
/// 2026-08-29) — puro, mismo espíritu que combatAbilities.ts: cómo se reconcilia una barra
/// guardada contra las habilidades reales de esa categoría AHORA MISMO. Sin el concepto
/// "genérica" (no aplica fuera de combate) ni "everConfigured" (una barra recién creada
/// simplemente empieza vacía, no hay cupo de combate detrás que rellenar por defecto).

export const SKILL_BAR_SLOTS = 12;
export const SKILL_BARS_PER_CATEGORY_MAX = 3;

export const SKILL_BAR_CATEGORIES = ['general', 'profesion', 'reino'] as const;
export type SkillBarCategory = (typeof SKILL_BAR_CATEGORIES)[number];

export interface SkillBarAbilityLike {
  name: string;
}

/// Puro: valida una lista propuesta de nombres contra las `SavedAction` reales de esa categoría
/// ahora mismo — descarta nombres que ya no existen y trunca al tope. El orden propuesto se
/// respeta tal cual (drag-and-drop en el frontend).
export function sanitizeSkillBarAbilityNames(proposed: string[], available: SkillBarAbilityLike[]): string[] {
  const availableNames = new Set(available.map((a) => a.name));
  const deduped = [...new Set(proposed)];
  return deduped.filter((name) => availableNames.has(name)).slice(0, SKILL_BAR_SLOTS);
}

/// Puro: dadas las categorías que YA tienen su barra base (`slotIndex: 0`), devuelve las que
/// faltan por crear — para que `GET /saves/:id` garantice que ninguna categoría llegue sin
/// ninguna barra (partidas viejas creadas antes de este sistema, mismo criterio que el resto del
/// proyecto: reconciliar en lectura, no exigir una migración de datos que sembrar a mano).
export function missingBaseSkillBarCategories(existing: { category: string; slotIndex: number }[]): SkillBarCategory[] {
  const withBase = new Set(existing.filter((b) => b.slotIndex === 0).map((b) => b.category));
  return SKILL_BAR_CATEGORIES.filter((c) => !withBase.has(c));
}

/// Puro: el próximo `slotIndex` libre (0-2) para una nueva barra de esa categoría, o `null` si ya
/// hay 3 (tope alcanzado).
export function nextFreeSkillBarSlot(existingSlotIndexes: number[]): number | null {
  for (let i = 0; i < SKILL_BARS_PER_CATEGORY_MAX; i++) {
    if (!existingSlotIndexes.includes(i)) return i;
  }
  return null;
}
