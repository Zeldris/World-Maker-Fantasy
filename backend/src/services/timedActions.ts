import type { AttributeBlock } from './dice.js';
import type { Banda } from './narrador.js';

export interface DurationResult {
  minutos: number;
  produccion?: string;
}

/// Fórmulas deterministas de duración/producción (docs/08-acciones-por-tiempo.md § 4) — el
/// backend calcula esto con una fórmula sobre atributos, nunca la IA (misma disciplina que el
/// motor de dados). Empieza con las 3 acciones típicas que sugiere el propio diseño; el resto
/// de acciones por tiempo usan la estimación del clasificador tal cual.
export function computeDuration(action: string, banda: Banda, attributes: AttributeBlock, duracionEstimadaMinutos: number): DurationResult {
  if (banda === 'instantanea') return { minutos: 0 };

  const lower = action.toLowerCase();

  if (/le[ñn]a|le[ñn]ador/.test(lower)) {
    const maderaPorMinuto = 1 + Math.floor(attributes.fuerza / 4);
    const minutos = duracionEstimadaMinutos > 0 ? duracionEstimadaMinutos : 15;
    return { minutos, produccion: `${maderaPorMinuto * minutos} unidades de leña` };
  }

  if (/viaj|camin|desplaz|ruta|tramo/.test(lower)) {
    const base = duracionEstimadaMinutos > 0 ? duracionEstimadaMinutos : 60;
    const minutos = Math.max(1, Math.round(base / (1 + attributes.destreza / 20)));
    return { minutos };
  }

  if (/descans|dormir|acampar|recuperar/.test(lower)) {
    const minutos = duracionEstimadaMinutos > 0 ? duracionEstimadaMinutos : banda === 'extendida' ? 240 : 480;
    return { minutos };
  }

  const fallback: Record<Banda, number> = { instantanea: 0, corta: 15, extendida: 180, larga: 1440 };
  return { minutos: duracionEstimadaMinutos > 0 ? duracionEstimadaMinutos : fallback[banda] };
}
