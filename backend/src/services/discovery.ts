import { normalizeText } from './travel.js';

const SEARCH_INTENT_REGEX = /busc|explor|rebusc|recog|recolect|rastre/;

/// Sigue viva tras retirar el panel de descubrimiento (2026-08-25, ver comentario de cabecera más
/// abajo) — turn.ts la sigue usando como red de seguridad de duración: una acción de
/// explorar/buscar sin duración explícita no debería durar más de una hora de ficción.
export function detectsSearchIntent(action: string): boolean {
  return SEARCH_INTENT_REGEX.test(normalizeText(action));
}

// Nombres "núcleo" de región (auditoría 2026-07-24, segunda vuelta — probado en vivo contra la
// partida real de Gorhorn: la primera versión de este filtro dejó pasar "Cuña de hielo sílice sin
// tallar", un material de `ItemCatalog` cuyo `lugarOrigen` dice explícitamente "Cristal Helado.",
// porque no tiene fila `Npc` propia — el filtro original solo cubría fauna). `Location.region` usa
// el artículo completo ("Las Llanuras del Viento Rojo"), pero `lugarOrigen` es texto libre que casi
// siempre lo abrevia sin artículo ("Clan Serhu, Llanuras del Viento Rojo.") — de ahí el núcleo sin
// "Las/El/La", comparado por subcadena en ambos sentidos.
export const REGION_CORE_NAMES = ['Llanuras del Viento Rojo', 'Cristal Helado', 'Ciénaga Troncal', 'Margen Silencioso', 'Meseta del Orden'];

/// Exportado (2026-07-29, colapsables de fauna/flora por zona en la Enciclopedia) — usado por
/// world.ts para agrupar por región. El resto de este archivo (descubrimiento de texto libre
/// "exploro/busco...", `selectDiscoveries`/`detectsSearchIntent`) se retiró el 2026-08-25 —
/// decisión explícita de la usuaria: "exploro" como texto libre pasa a ser solo narración del
/// LLM, sin ningún panel mecánico; recoger objetos narrativos ahora depende de la habilidad
/// general "Recoger" (ver `pasivoCandidatesFor`, recolectar.ts) y de los botones de oficio para
/// recursos reales.
export function coreRegionOf(text: string | null | undefined): string | null {
  if (!text) return null;
  return REGION_CORE_NAMES.find((r) => text.includes(r)) ?? null;
}
