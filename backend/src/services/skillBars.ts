/// Barras de habilidades múltiples fuera de combate (2026-08-29, v1: una única barra; 2026-09-04,
/// v2: 3 barras POR CADA categoría, 12 slots; 2026-09-06, v3, hallazgo 10 de la sesión de pruebas:
/// 3 barras EN GENERAL, sin distinguir tipo, 20 slots — al editar una barra, 3 tabs
/// General/Profesión/Reino para elegir qué meter, sin importar de qué tab salió cada habilidad una
/// vez está dentro). Puro, mismo espíritu que combatAbilities.ts: cómo se reconcilia una barra
/// guardada contra las habilidades reales AHORA MISMO. Sin el concepto "genérica" (no aplica fuera
/// de combate) ni "everConfigured" (una barra recién creada simplemente empieza vacía).

export const SKILL_BAR_SLOTS = 20;
export const SKILL_BARS_MAX = 3;

/// `SavedActionCategory` válidas dentro de una barra (Combate queda fuera, sigue con su propio
/// cinturón de combate aparte, `activeCombatAbilityNames`) — ya NO categoriza la `SkillBar` en sí,
/// solo sirve de filtro para los 3 tabs del editor.
export const SKILL_BAR_CATEGORIES = ['general', 'profesion', 'reino'] as const;
export type SkillBarCategory = (typeof SKILL_BAR_CATEGORIES)[number];

export interface SkillBarAbilityLike {
  name: string;
}

/// Puro: valida una lista propuesta de nombres contra las `SavedAction` reales disponibles ahora
/// mismo (las 3 categorías juntas) — descarta nombres que ya no existen y trunca al tope. El orden
/// propuesto se respeta tal cual (drag-and-drop en el frontend).
export function sanitizeSkillBarAbilityNames(proposed: string[], available: SkillBarAbilityLike[]): string[] {
  const availableNames = new Set(available.map((a) => a.name));
  const deduped = [...new Set(proposed)];
  return deduped.filter((name) => availableNames.has(name)).slice(0, SKILL_BAR_SLOTS);
}

/// Puro: `true` si el save YA tiene su barra base (`slotIndex: 0`) — para que `GET /saves/:id`
/// garantice que ninguna partida llegue sin ninguna barra (partidas viejas creadas antes de este
/// sistema, mismo criterio que el resto del proyecto: reconciliar en lectura, no exigir una
/// migración de datos que sembrar a mano).
export function hasBaseSkillBar(existing: { slotIndex: number }[]): boolean {
  return existing.some((b) => b.slotIndex === 0);
}

/// B20 (pruebas en la nube 2026-09-28): una partida nueva abría con "Barra 1 (0)" y un jugador
/// nuevo no veía ninguna acción. La barra base nace con las generales de uso diario que la partida
/// ya tenga (en este orden); las de recolección/caza se retiraron en la Fase 4 (se hacen desde el
/// mapa de la zona).
export const BASE_SKILL_BAR_DEFAULTS = ['Descansar', 'Comer/Beber', 'Curar', 'Volver al campamento', 'Entregar'];

/// Puro: nombres de `BASE_SKILL_BAR_DEFAULTS` que la partida tiene de verdad.
export function defaultBaseSkillBarAbilities(savedActionNames: string[]): string[] {
  const tiene = new Set(savedActionNames);
  return BASE_SKILL_BAR_DEFAULTS.filter((n) => tiene.has(n));
}

/// Puro: el próximo `slotIndex` libre (0-2) para una nueva barra del save, o `null` si ya hay
/// `SKILL_BARS_MAX` (tope alcanzado).
export function nextFreeSkillBarSlot(existingSlotIndexes: number[]): number | null {
  for (let i = 0; i < SKILL_BARS_MAX; i++) {
    if (!existingSlotIndexes.includes(i)) return i;
  }
  return null;
}
