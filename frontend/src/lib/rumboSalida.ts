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

/// Texto de una salida en el mapa de zona. QA-27 (P7): las puertas de una zona interior (dentro de
/// un asentamiento) no son un camino con rumbo: «Entrar en …» desde fuera, «Salir a …» desde dentro.
export function etiquetaSalida(s: { x: number; y: number; nombre: string; visitada: boolean; conocida?: boolean; puerta?: 'ENTRAR' | 'SALIR' }): string {
  if (s.puerta === 'ENTRAR') return `Entrar en ${s.nombre}`
  if (s.puerta === 'SALIR') return `Salir a ${s.nombre}`
  // P115 (QA-27): con el mapa de la región, el destino tiene nombre aunque no se haya visitado.
  return s.visitada || s.conocida ? s.nombre : `Camino hacia el ${rumboSalida(s)}`
}

/// P115 (QA-27): cuánto se tarda en llegar, en palabras («una hora y media de camino»), redondeado a
/// los 10 minutos (P170: a la media hora, 1 h 40 salía como «una hora y media»; a los 5 si no llega a
/// una hora).
export function duracionDeCamino(minutos: number): string {
  // Se redondea antes de elegir la unidad: 58 minutos son «una hora» y 1436, «un día» (no «24 horas»).
  if (Math.round(minutos / 5) * 5 < 60) return `unos ${Math.max(5, Math.round(minutos / 5) * 5)} minutos de camino`
  const redondeo = Math.round(minutos / 10) * 10
  if (redondeo < 1440) {
    const horas = Math.floor(redondeo / 60)
    const resto = redondeo % 60
    const cola = resto === 0 ? '' : resto === 30 ? ' y media' : ` y ${resto} minutos`
    return `${horas === 1 ? 'una hora' : `unas ${horas} horas`}${cola} de camino`
  }
  const dias = Math.round(minutos / 1440)
  return `${dias === 1 ? 'un día' : `unos ${dias} días`} de camino`
}
