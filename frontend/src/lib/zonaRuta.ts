// ZON-31/ZON-32 (hito 0.2) — ruta prevista y su coste en el mapa de zona, calculados en el cliente
// con la MISMA cuadrícula y el MISMO camino que el motor (`backend/src/services/zonaPosicion.ts`:
// `celdaDePixel`, `pixelDeCelda`, `calcularCamino`; `energy.ts`: `energiaPasivaEntre`). Si allí
// cambia algo, cambia aquí: los tests espejan sus casos.

export const CELDA_PX = 50
export const COLUMNAS = 16
export const FILAS = 12
/// Minutos de ficción por paso (`MINUTOS_POR_PASO_ZONA`, routes/saves/zona.ts).
export const MINUTOS_POR_PASO = 1
/// Energía pasiva: un punto cada tantos minutos de ficción (`MINUTOS_POR_PUNTO_ENERGIA_PASIVA`).
export const MINUTOS_POR_PUNTO_ENERGIA = 10

export interface Celda {
  col: number
  row: number
}

export function celdaDePixel(p: { x: number; y: number }): Celda {
  return {
    col: Math.max(0, Math.min(COLUMNAS - 1, Math.floor(p.x / CELDA_PX))),
    row: Math.max(0, Math.min(FILAS - 1, Math.floor(p.y / CELDA_PX))),
  }
}

export function pixelDeCelda(c: Celda): { x: number; y: number } {
  return { x: c.col * CELDA_PX + CELDA_PX / 2, y: c.row * CELDA_PX + CELDA_PX / 2 }
}

/// Camino de celdas de `origen` (exclusive) a `destino` (inclusive), línea de Bresenham.
export function calcularCamino(origen: Celda, destino: Celda): Celda[] {
  const camino: Celda[] = []
  let { col, row } = origen
  const dCol = Math.abs(destino.col - origen.col)
  const dRow = -Math.abs(destino.row - origen.row)
  const signoCol = origen.col < destino.col ? 1 : -1
  const signoRow = origen.row < destino.row ? 1 : -1
  let error = dCol + dRow
  while (col !== destino.col || row !== destino.row) {
    const error2 = 2 * error
    if (error2 >= dRow) {
      error += dRow
      col += signoCol
    }
    if (error2 <= dCol) {
      error += dCol
      row += signoRow
    }
    camino.push({ col, row })
  }
  return camino
}

export function energiaPasivaEntre(antes: number, despues: number): number {
  if (despues <= antes) return 0
  return Math.floor(despues / MINUTOS_POR_PUNTO_ENERGIA) - Math.floor(antes / MINUTOS_POR_PUNTO_ENERGIA)
}

/// «07:45», o «Día 3, 07:45» si se llega otro día.
export function horaDeLlegada(ahora: number, llegada: number): string {
  const hhmm = (m: number) => {
    const delDia = ((m % 1440) + 1440) % 1440
    return `${String(Math.floor(delDia / 60)).padStart(2, '0')}:${String(delDia % 60).padStart(2, '0')}`
  }
  const dia = (m: number) => Math.floor(m / 1440) + 1
  return dia(llegada) === dia(ahora) ? hhmm(llegada) : `Día ${dia(llegada)}, ${hhmm(llegada)}`
}

export interface RutaPrevista {
  /// Centros de celda de la ruta, sin la del personaje.
  puntos: { x: number; y: number }[]
  pasos: number
  minutos: number
  /// Hora de llegada (solo si se conoce la hora actual).
  llegada: string | null
  energia: number
}

/// Ruta prevista del personaje (en píxeles del lienzo) a un punto, con su coste.
export function rutaPrevista(desde: { x: number; y: number }, hasta: { x: number; y: number }, ahora?: number): RutaPrevista {
  const celdas = calcularCamino(celdaDePixel(desde), celdaDePixel(hasta))
  const minutos = celdas.length * MINUTOS_POR_PASO
  return {
    puntos: celdas.map(pixelDeCelda),
    pasos: celdas.length,
    minutos,
    llegada: ahora === undefined ? null : horaDeLlegada(ahora, ahora + minutos),
    energia: ahora === undefined ? 0 : energiaPasivaEntre(ahora, ahora + minutos),
  }
}

/// «8 pasos · 8 min · llegas a las 07:45 · +1 energía».
export function textoCoste(r: RutaPrevista): string {
  const partes = [`${r.pasos} ${r.pasos === 1 ? 'paso' : 'pasos'}`, `${r.minutos} min`]
  if (r.llegada) partes.push(`llegas ${r.llegada.startsWith('Día') ? 'el' : 'a las'} ${r.llegada}`)
  if (r.energia > 0) partes.push(`+${r.energia} energía`)
  return partes.join(' · ')
}
