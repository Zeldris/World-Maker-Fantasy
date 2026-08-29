import type { EntornoTemporalInfo } from '../types'

// Estación/clima (2026-08-27, auditoría backend↔frontend + diseño/UX) — mismos emoji que ya usa el
// selector de imágenes de Location/Zona en DetailModal.tsx (§ ESTACION_LABEL), para no inventar un
// segundo vocabulario de iconos para el mismo concepto. Compartido entre MapaPanel.tsx (badge bajo
// "Berig") y GameView.tsx (pill de fecha del header) — un solo sitio, no duplicado en los dos.
export const ESTACION_ICON: Record<EntornoTemporalInfo['estacion']['key'], string> = {
  PRIMAVERA: '🌸',
  VERANO: '☀️',
  OTONO: '🍂',
  INVIERNO: '❄️',
}

export const CLIMA_ICON: Record<NonNullable<EntornoTemporalInfo['clima']>['key'], string> = {
  CLIMA_LLEVABLE: '🌤️',
  VIENTO_FUERTE: '💨',
  TORMENTA_GRANDE: '🌪️',
  TORMENTA_EXTREMA: '⛈️',
}
