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
}
