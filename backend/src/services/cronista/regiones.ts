// Regiones vecinas de Berig (CR-11, hito 0.2), según el lore canónico: «Cómo encajan en el mapa»
// de `docs/rpgtarkor/lore-mundo/areas.md`. En el grafo de lugares del juego no hay todavía caminos
// entre regiones, así que esta tabla es la que dice adónde huye la gente de una facción caída (y,
// con CR-12, la fauna que escapa de una tormenta). Nombres tal como los lleva `Location.region`.
//
// - Norte: Cristal Helado, de costa a costa, sobre la franja central.
// - Franja central: las Llanuras al oeste y la Ciénaga al este, lado a lado.
// - El Margen Silencioso cierra la franja central por el sur (toda la Ciénaga y el extremo sur de las
//   Llanuras).
// - Sur: la Meseta del Orden, que solo toca el Margen.
export const REGIONES_VECINAS: Record<string, string[]> = {
  'Cristal Helado': ['Las Llanuras del Viento Rojo', 'Ciénaga Troncal'],
  'Las Llanuras del Viento Rojo': ['Cristal Helado', 'Ciénaga Troncal', 'El Margen Silencioso'],
  'Ciénaga Troncal': ['Cristal Helado', 'Las Llanuras del Viento Rojo', 'El Margen Silencioso'],
  'El Margen Silencioso': ['Ciénaga Troncal', 'Las Llanuras del Viento Rojo', 'La Meseta del Orden'],
  'La Meseta del Orden': ['El Margen Silencioso'],
};

export function regionesVecinas(region: string): string[] {
  return REGIONES_VECINAS[region] ?? [];
}
