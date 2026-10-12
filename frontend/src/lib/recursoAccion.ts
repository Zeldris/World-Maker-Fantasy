import type { MetodoObtencion } from '../types'

/// Verbo del botón principal del modal de detalle de un RECURSO (2026-09-29, petición de Álvaro:
/// "un botón con texto según la profesión: Recolectar, Talar, Minar, etc."). Se deriva del
/// `metodoObtencion` real de la fuente (ver `dynamicModeOffer.metodo`, zona.ts). Un método
/// desconocido o ausente (ofertas antiguas persistidas en una partida) cae en "Recolectar".
export function etiquetaAccionRecurso(metodo: MetodoObtencion | null | undefined): string {
  switch (metodo) {
    case 'TALA':
      return 'Talar'
    case 'MINERIA':
      return 'Minar'
    case 'EXTRACCION':
      return 'Recolectar'
    case 'PESCA':
      return 'Pescar'
    case 'BUSQUEDA':
      return 'Buscar'
    case 'PASIVO':
      return 'Recoger'
    case 'CAZA':
      return 'Desollar'
    default:
      return 'Recolectar'
  }
}

/// P60 (QA-27): icono de la tarjeta de un RECURSO según cómo se obtiene. Antes era siempre 🪨, también
/// para una planta.
export function iconoRecurso(metodo: MetodoObtencion | null | undefined): string {
  switch (metodo) {
    case 'TALA':
      return '🌳'
    case 'MINERIA':
      return '🪨'
    case 'EXTRACCION':
      return '🌿'
    case 'PESCA':
      return '🐟'
    case 'BUSQUEDA':
      return '🐚'
    case 'CAZA':
      return '🦴'
    default:
      return '🧺'
  }
}
