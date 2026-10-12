/// Edificios sin oficio (Campamento, Ayuntamiento x3 — 2026-08-13): no tienen tier/oficio, así
/// que no viven en professionRecipes (GET /profession-recipes) como el resto de recetas — mismo
/// criterio "solo hay N, mapeo fijo aquí es más simple" que otros mapeos fijos del proyecto
/// (ej. HARVEST_ABILITY_OFICIO en GameView.tsx). Fuente única compartida entre GameView.tsx
/// (enlace a Enciclopedia) y HabilidadesPanel.tsx (estado de materiales/disabled), para no tener
/// el mismo mapeo duplicado y potencialmente desincronizado en dos sitios.
export const REINO_ABILITY_RECIPE_KEY: Record<string, string> = {
  'Construir campamento': 'campamento',
  'Fundar ayuntamiento': 'ayuntamiento',
  'Ampliar ayuntamiento a mediano': 'ayuntamiento-mediano',
  'Ampliar ayuntamiento a grande': 'ayuntamiento-grande',
  // P81 (QA-27): sin esto, las jaulas salían activas y su aviso no decía qué necesitan.
  'Construir jaula pequeña': 'jaula-pequena',
  'Construir jaula mediana': 'jaula-mediana',
  'Construir jaula grande': 'jaula-grande',
}

/// P19 (QA-27): una ampliación solo tiene sentido si ya existe el nivel anterior. Antes se ofrecía
/// «Ampliar ayuntamiento a mediano/grande» sin tener ninguno.
const REINO_REQUIERE_EDIFICIO: Record<string, string> = {
  'Ampliar ayuntamiento a mediano': 'ayuntamiento',
  'Ampliar ayuntamiento a grande': 'ayuntamiento-mediano',
}

export function reinoAbilityDisponible(abilityName: string, edificiosConstruidos: readonly string[]): boolean {
  const requiere = REINO_REQUIERE_EDIFICIO[abilityName]
  return !requiere || edificiosConstruidos.includes(requiere)
}
