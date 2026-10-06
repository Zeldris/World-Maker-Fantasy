// CR-15 (hito 0.3): cómo se lee la aprobación de un compañero — barra con etiqueta, sin el número
// (como en Baldur's Gate 3). Mismos cortes que `etiquetaDeAprobacion` del backend (cronista/aprobacion.ts).
export type EtiquetaAprobacion = 'Hostil' | 'Distante' | 'Neutral' | 'Afín' | 'Leal'

export function etiquetaDeAprobacion(aprobacion: number): EtiquetaAprobacion {
  if (aprobacion < 20) return 'Hostil'
  if (aprobacion < 40) return 'Distante'
  if (aprobacion < 60) return 'Neutral'
  if (aprobacion < 80) return 'Afín'
  return 'Leal'
}

export const COLOR_APROBACION: Record<EtiquetaAprobacion, string> = {
  Hostil: 'bg-danger-500',
  Distante: 'bg-cost-500',
  Neutral: 'bg-wood-400',
  Afín: 'bg-moss-500',
  Leal: 'bg-accent-400',
}
