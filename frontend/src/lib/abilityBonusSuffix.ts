import type { SavedActionInfo } from '../types'

/// Bug real (2026-08-28, "jugando no se ve el +2/+4 de las habilidades de arma/clase" — ni en la
/// ficha ni en el resultado de la tirada): `attributeBonus` se aplicaba en combate desde siempre
/// pero nunca se mencionaba en ningún tooltip. Compartido entre HabilidadesPanel.tsx (AbilityGrid)
/// y CombatAbilityBelt.tsx (CombatAbilityToggleGrid) — ambos muestran `a.description` como
/// tooltip; extraído aparte para no crear una dependencia circular entre esos dos componentes.
export function abilityBonusSuffix(a: SavedActionInfo): string {
  return a.attributeBonus ? ` (+${a.attributeBonus} de bono fijo al usarla)` : ''
}
