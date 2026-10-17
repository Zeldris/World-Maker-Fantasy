// P185 (QA-27): casillas del mapa de zona por las que no se pasa (muros, empalizadas), por Location.
// Sin ellas, el camino al Pozo atravesaba la empalizada de Colmillo Ceniza, que solo tiene una puerta
// (como el navmesh de BG3 o los muros de Manor Lords). Se sacan de la ilustración de cada zona, casilla
// a casilla (16×12 de 50 px), dejando abiertas las puertas. Un punto puede caer sobre un muro (el recinto
// de múrgoles, pegado a la empalizada) si tiene al lado una casilla libre desde la que interactuar.
// `calcularCamino` (zonaPosicion.ts) las rodea, y `GET /zona` las manda al frontend para la ruta prevista.
import { claveCelda, type Celda } from './zonaPosicion.js';

const MUROS_POR_LOCATION: Record<string, [number, number][]> = {
  // Empalizada del Colmillo Ceniza (zona/campamento-serhu-mapa.png): la elipse de estacas; la puerta, abajo
  // (12,9) con su pasarela (12,10).
  'campamento-serhu': [
    [5, 5], [5, 6], [5, 7], [6, 4], [6, 5], [6, 7], [6, 8], [7, 4], [7, 8], [7, 9], [8, 3], [8, 4], [8, 9], [9, 3], [9, 9], [10, 3],
    [10, 9], [11, 3], [11, 9], [12, 3], [13, 3], [13, 4], [13, 9], [14, 4], [14, 8], [14, 9], [15, 4], [15, 5], [15, 6], [15, 7], [15, 8],
  ],
};

export { claveCelda };

export function murosDe(locationSlug: string | null | undefined): ReadonlySet<string> {
  return new Set((locationSlug ? (MUROS_POR_LOCATION[locationSlug] ?? []) : []).map(([col, row]) => claveCelda({ col, row })));
}

/// Para el frontend (`GET /zona`).
export function murosComoCeldas(locationSlug: string | null | undefined): Celda[] {
  return (locationSlug ? (MUROS_POR_LOCATION[locationSlug] ?? []) : []).map(([col, row]) => ({ col, row }));
}
