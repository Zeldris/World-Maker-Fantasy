import { normalizeText } from './travel.js';

/// Lint post-narración determinista (roadmap 2026-07-20, P1.4 de Fable) — regex barato sobre la
/// SALIDA ya generada, para detectar (nunca prevenir de antemano, eso ya lo hacen los contextBlocks
/// de turnResolution.ts) violaciones graves que un 7B en CPU comete de todas formas. v1 solo
/// detecta y registra (console.warn) — sin reintento automático: en este hardware, gastar otra
/// llamada completa a Ollama (30-220s) por una incoherencia de prosa no es buen cambio; ver
/// memoria del proyecto para la decisión completa.

const KNOWN_REGIONS = ['Ciénaga Troncal', 'Cristal Helado', 'La Meseta del Orden', 'El Margen Silencioso', 'Las Llanuras del Viento Rojo'];

/// Puro: si el texto menciona una región nombrada DISTINTA a la actual, la devuelve — null si no
/// hay ninguna mención de otra región. Mismo bug real que ya se arregló en entorno.ts, aquí para
/// la narración del turno normal (turnResolution.ts), que tiene su propia superficie de RAG/lore.
export function lintRegionMismatch(text: string, currentRegion: string): string | null {
  const normalizedCurrent = normalizeText(currentRegion);
  const normalizedText = normalizeText(text);
  for (const region of KNOWN_REGIONS) {
    const normalizedRegion = normalizeText(region);
    if (normalizedRegion === normalizedCurrent) continue;
    if (normalizedText.includes(normalizedRegion)) return region;
  }
  return null;
}
