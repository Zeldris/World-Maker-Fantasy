/// "Cinturón de combate" (2026-08-28, pendiente 2026-08-27 punto 3, "selección de habilidades de
/// clase activas en combate") — puro: qué nombres de `SavedAction` category:'combate' pueden estar
/// activos a la vez y cómo se reconcilia la lista guardada contra las habilidades reales de AHORA
/// MISMO (una habilidad dinámica —racial/de arma— puede haberse borrado/recreado con otro nombre
/// desde la última vez que se guardó el cinturón).

export const ACTIVE_COMBAT_ABILITIES_MAX = 6;

export interface CombatAbilityLike {
  name: string;
  isGeneric: boolean;
}

/// Puro: valida una lista propuesta de nombres contra las habilidades de combate NO genéricas que
/// el personaje tiene de verdad ahora mismo — descarta nombres que ya no existen (arma cambiada,
/// habilidad perdida) y trunca al tope. El orden de la lista propuesta se respeta tal cual (es el
/// orden elegido por drag-and-drop en el frontend).
export function sanitizeActiveCombatAbilityNames(proposed: string[], available: CombatAbilityLike[]): string[] {
  const availableNames = new Set(available.filter((a) => !a.isGeneric).map((a) => a.name));
  const deduped = [...new Set(proposed)];
  return deduped.filter((name) => availableNames.has(name)).slice(0, ACTIVE_COMBAT_ABILITIES_MAX);
}

/// Puro: qué nombres deberían estar activos por defecto — "todas activas" mientras el personaje
/// tenga como mucho el tope (confirmado, sin fricción para builds pequeños); por encima del tope,
/// ninguna activación automática (el jugador elige a mano cuáles).
export function defaultActiveCombatAbilityNames(available: CombatAbilityLike[]): string[] {
  const nonGeneric = available.filter((a) => !a.isGeneric).map((a) => a.name);
  return nonGeneric.length <= ACTIVE_COMBAT_ABILITIES_MAX ? nonGeneric : [];
}

/// Puro: la lista final a mostrar/usar en combate, dada la lista guardada y si esta partida ya
/// llegó a tener alguna vez el cinturón "tocado" de verdad (`everConfigured` — ver
/// `Save.activeCombatAbilityNamesConfigured`). Sin tocar nunca, cae al comportamiento por defecto
/// (todas activas mientras quepan) — así una partida recién creada no empieza con el cinturón
/// vacío sin motivo aparente. Una vez tocado, se respeta tal cual lo dejó el jugador, INCLUIDO un
/// cinturón vacío a propósito (0 habilidades activas, solo las 3 genéricas) — nunca se reactiva
/// solo por estar vacía.
export function resolveActiveCombatAbilityNames(saved: string[], available: CombatAbilityLike[], everConfigured: boolean): string[] {
  const sanitized = sanitizeActiveCombatAbilityNames(saved, available);
  if (everConfigured) return sanitized;
  return defaultActiveCombatAbilityNames(available);
}
