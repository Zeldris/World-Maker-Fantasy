// Reparto de cada facción del mundo (CR-54, hito 0.3 — Fase D, decisión Q16 de la usuaria del
// 2026-10-06, tabla en docs/producto/plan-roadmap-0.3.md). Única fuente de las cifras: de aquí
// salen las filas `WorldPopulation` FACCION de la siembra y la re-siembra de las partidas.
//
// Cada facción conserva su total; comen todos (1 al día) y cada trabajador produce 2 de comida.
// Estándar: 55 % trabajadores, 15 % soldados, 30 % civiles (+10 % de margen). Los Serhu, a propósito,
// comen justo lo que producen y no tienen sitio para crecer (idea de la usuaria: «no saben crecer»;
// el ciclo de rearme y deuda llega con `CR-59`). Nabieus y Faerus van al estándar a la espera de
// Álvaro (`propuestas-lore.md`).

export interface RepartoFaccion {
  slug: string;
  nombre: string;
  region: string;
  trabajadores: number;
  soldados: number;
  civiles: number;
  /// Margen para crecer sobre su total (los Serhu, casi ninguno).
  holgura: number;
}

export const REPARTO_FACCIONES: RepartoFaccion[] = [
  { slug: 'clan-serhu', nombre: 'Clan Serhu', region: 'Las Llanuras del Viento Rojo', trabajadores: 359, soldados: 208, civiles: 153, holgura: 0.02 },
  { slug: 'clan-helsig', nombre: 'Clan Helsig', region: 'Cristal Helado', trabajadores: 198, soldados: 54, civiles: 108, holgura: 0.25 },
  { slug: 'clan-goshg', nombre: 'Clan Goshg', region: 'Ciénaga Troncal', trabajadores: 297, soldados: 81, civiles: 162, holgura: 0.25 },
  { slug: 'concordia-de-hierro', nombre: 'Concordia de Hierro', region: 'La Meseta del Orden', trabajadores: 880, soldados: 480, civiles: 240, holgura: 0.25 },
  { slug: 'los-del-obelisco', nombre: 'Los del Obelisco', region: 'La Meseta del Orden', trabajadores: 165, soldados: 45, civiles: 90, holgura: 0.25 },
  { slug: 'keseg-sael', nombre: 'Keseg Sael', region: 'El Margen Silencioso', trabajadores: 825, soldados: 225, civiles: 450, holgura: 0.2 },
  { slug: 'keseg-prisilke', nombre: 'Keseg Prisilke', region: 'Ciénaga Troncal', trabajadores: 275, soldados: 75, civiles: 150, holgura: 0.25 },
  { slug: 'feg-tusha', nombre: 'Feg Tusha', region: 'El Margen Silencioso', trabajadores: 467, soldados: 128, civiles: 255, holgura: 0.25 },
  { slug: 'feg-ger', nombre: 'Feg Ger', region: 'Las Llanuras del Viento Rojo', trabajadores: 110, soldados: 30, civiles: 60, holgura: 0.5 },
];

export type CampoFaccion = 'poblacion' | 'soldados' | 'trabajadores' | 'visitantes';

/// Puro: las cuatro filas de población de una facción (`poblacion` son sus civiles).
export function filasDeFaccion(r: RepartoFaccion): { campo: CampoFaccion; targetSlug: string; label: string; poblacion: number; poblacionMax: number; distribucion: Record<string, number> }[] {
  const max = (v: number) => Math.max(10, Math.ceil(v * (1 + r.holgura)));
  const fila = (campo: CampoFaccion, label: string, poblacion: number) => ({
    campo, targetSlug: `${r.slug}-${campo}`, label: `${r.nombre} — ${label}`, poblacion, poblacionMax: max(poblacion), distribucion: { [r.region]: 1 },
  });
  return [
    fila('poblacion', 'civiles', r.civiles),
    fila('soldados', 'soldados', r.soldados),
    fila('trabajadores', 'trabajadores', r.trabajadores),
    fila('visitantes', 'visitantes', 0),
  ];
}
