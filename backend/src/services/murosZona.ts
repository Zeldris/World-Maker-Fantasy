// P185 (QA-27): casillas del mapa de zona por las que no se pasa (muros, empalizadas), por Location.
// Sin ellas, el camino al Pozo atravesaba la empalizada de Colmillo Ceniza, que solo tiene una puerta
// (como el navmesh de BG3 o los muros de Manor Lords). Se sacan de la ilustración de cada zona, casilla
// a casilla (16×12 de 50 px), dejando abiertas las puertas. Un punto puede caer sobre un muro (el recinto
// de múrgoles, pegado a la empalizada) si tiene al lado una casilla libre desde la que interactuar.
// `calcularCamino` (zonaPosicion.ts) las rodea, y `GET /zona` las manda al frontend para la ruta prevista.
// Cómo sacarlas de la ilustración y comprobarlas: docs/runbooks/nuevo-elemento-catalogo.md § «Muros de una zona».
import { claveCelda, type Celda } from './zonaPosicion.js';

const MUROS_POR_LOCATION: Record<string, [number, number][]> = {
  // Empalizada del Colmillo Ceniza (zona/campamento-serhu-mapa.png): la elipse de estacas; la puerta, abajo
  // (12,9) con su pasarela (12,10).
  'campamento-serhu': [
    [5, 5], [5, 6], [5, 7], [6, 4], [6, 5], [6, 7], [6, 8], [7, 4], [7, 8], [7, 9], [8, 3], [8, 4], [8, 9], [9, 3], [9, 9], [10, 3],
    [10, 9], [11, 3], [11, 9], [12, 3], [13, 3], [13, 4], [13, 9], [14, 4], [14, 8], [14, 9], [15, 4], [15, 5], [15, 6], [15, 7], [15, 8],
  ],
};

/// P193 (QA-27): las puertas de cada empalizada. Cerradas, lo que queda dentro es el interior (`interiorDe`).
const PUERTAS_POR_LOCATION: Record<string, [number, number][]> = {
  'campamento-serhu': [[12, 9]],
};

const COLUMNAS = 16;
const FILAS = 12;

export { claveCelda };

export function murosDe(locationSlug: string | null | undefined): ReadonlySet<string> {
  return new Set((locationSlug ? (MUROS_POR_LOCATION[locationSlug] ?? []) : []).map(([col, row]) => claveCelda({ col, row })));
}

/// Para el frontend (`GET /zona`).
export function murosComoCeldas(locationSlug: string | null | undefined): Celda[] {
  return (locationSlug ? (MUROS_POR_LOCATION[locationSlug] ?? []) : []).map(([col, row]) => ({ col, row }));
}

/// P193 (QA-27): casillas libres dentro de la empalizada: a las que no se llega desde el borde del mapa sin
/// cruzar un muro ni una puerta. Vacío si la zona no tiene empalizada con puertas.
export function interiorDe(locationSlug: string | null | undefined): ReadonlySet<string> {
  const puertas = locationSlug ? PUERTAS_POR_LOCATION[locationSlug] : undefined;
  if (!puertas) return new Set();
  const cerrado = new Set([...murosDe(locationSlug), ...puertas.map(([col, row]) => claveCelda({ col, row }))]);
  const fuera = new Set<string>();
  const cola: Celda[] = [];
  for (let col = 0; col < COLUMNAS; col++) for (let row = 0; row < FILAS; row++) {
    if ((col === 0 || row === 0 || col === COLUMNAS - 1 || row === FILAS - 1) && !cerrado.has(claveCelda({ col, row }))) {
      fuera.add(claveCelda({ col, row }));
      cola.push({ col, row });
    }
  }
  while (cola.length > 0) {
    const c = cola.shift()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const v = { col: c.col + dc, row: c.row + dr };
      const k = claveCelda(v);
      if (v.col < 0 || v.row < 0 || v.col >= COLUMNAS || v.row >= FILAS || fuera.has(k) || cerrado.has(k)) continue;
      fuera.add(k);
      cola.push(v);
    }
  }
  const dentro = new Set<string>();
  for (let col = 0; col < COLUMNAS; col++) for (let row = 0; row < FILAS; row++) {
    const k = claveCelda({ col, row });
    if (!fuera.has(k) && !cerrado.has(k)) dentro.add(k);
  }
  return dentro;
}

/// P193 (QA-27): ¿se alcanza desde `jugador` un punto en `punto` (vecinas o la misma)? Un punto sobre las
/// estacas de una empalizada (el recinto de múrgoles) solo desde dentro: desde fuera no se ordeña.
export function alcanzableDesde(locationSlug: string | null | undefined, jugador: Celda, punto: Celda): boolean {
  if (!murosDe(locationSlug).has(claveCelda(punto))) return true;
  const interior = interiorDe(locationSlug);
  return interior.size === 0 || interior.has(claveCelda(jugador));
}
