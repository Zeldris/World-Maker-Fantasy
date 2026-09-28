/// B5/B6 (pruebas 2026-09-28) — rumbo de una salida de región deducido de su posición en el lienzo
/// de la zona (800×600). El backend coloca cada salida en el borde según el rumbo real hacia su
/// destino (`posicionesDeSalidas`, zonaPosicion.ts), así que el ángulo desde el centro es ese rumbo.
const CENTRO = { x: 400, y: 300 }

/// Ángulo en grados (0 = este, 90 = sur, sentido SVG) desde el centro hacia la salida.
export function anguloSalida(pos: { x: number; y: number }): number {
  return (Math.atan2(pos.y - CENTRO.y, pos.x - CENTRO.x) * 180) / Math.PI
}

const RUMBOS = ['este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste', 'norte', 'noreste']

/// "noreste", "sur"... — el octante más cercano al ángulo.
export function rumboSalida(pos: { x: number; y: number }): string {
  const octante = Math.round(anguloSalida(pos) / 45)
  return RUMBOS[((octante % 8) + 8) % 8]
}
