/// Filtro de recolección/caza por terreno de la zona (petición explícita, 2026-08-14: "en una
/// misma zona me sale todo esto al recolectar... en zonas aridas no deberia haber muchas plantas
/// y en zonas humedas deberias haber mas... con la de mineria/tala/caza igual, segun terreno o
/// habitat") — hasta ahora `candidateSourcesFor` (recolectar.ts) y `candidateFaunaFor` (cazar.ts)
/// solo filtraban por REGIÓN amplia (`WorldPopulation.distribucion`), y todas las fuentes de una
/// misma región (p. ej. las 8 hierbas de Las Llanuras) salían siempre juntas sin importar la zona
/// exacta. Parche deliberadamente simple (petición explícita: "hagámoslo así", se afinará cuando
/// haya más lore) — match/no-match categórico, sin pesos ni fórmulas.
export type TerrainTag = 'arido' | 'humedo' | 'vegetacion' | 'rocoso';

/// `locationTags` viene de `locationTerrainTags` (worldCatalog.ts): `undefined` si la Location no
/// está catalogada todavía (regiones sin lore desarrollado, o Locations nuevas sin taguear) —
/// nunca filtra en ese caso, se comporta igual que antes de este cambio. `sourceTag` viene de
/// `harvestSourceTerrainTag`/`faunaTerrainTag`: `null`/`undefined` = fuente sin afinidad marcada,
/// nunca se penaliza (mismo criterio "solo premia, nunca penaliza" de `attributeWheel.ts`).
export function pasaFiltroTerreno(locationTags: TerrainTag[] | undefined, sourceTag: TerrainTag | null | undefined): boolean {
  if (!sourceTag) return true;
  if (!locationTags || locationTags.length === 0) return true;
  return locationTags.includes(sourceTag);
}
