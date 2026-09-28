/// Deriva el continente de una región de `Location.region` (string libre, ver docs/rpgtarkor/lore-mundo/areas.md).
/// Usado solo para excluir contaminación de lore del continente contrario en el panel "El mundo"
/// (entorno.ts) — no es un campo estructurado en el schema a propósito (el lore vive en los .md).
const VAELIRA_REGIONS = ['la cicatriz de cristal', 'el susurro de las raíces', 'la costa del azabache'];
const BERIG_REGIONS = [
  'la meseta del orden',
  'las llanuras del viento rojo',
  'cristal helado',
  'ciénaga troncal',
  'el margen silencioso',
];

export type Continent = 'vaelira' | 'berig';

export function continentForRegion(region: string): Continent | null {
  const normalized = region.trim().toLowerCase();
  if (VAELIRA_REGIONS.some((r) => normalized.includes(r))) return 'vaelira';
  if (BERIG_REGIONS.some((r) => normalized.includes(r))) return 'berig';
  return null;
}

export function oppositeContinent(continent: Continent): Continent {
  return continent === 'berig' ? 'vaelira' : 'berig';
}
