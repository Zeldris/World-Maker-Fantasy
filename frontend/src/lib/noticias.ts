// UX-38 (hito 0.2) — piezas de las noticias de «El mundo» (ver `components/NoticiaMundo.tsx`).
import type { NoticiaMeta } from '../types'
import type { AvisosSucesos } from './ajustes'

export const ICONO_CATEGORIA: Record<NonNullable<NoticiaMeta['categoria']>, { icono: string; label: string }> = {
  CONFLICTO: { icono: '⚔️', label: 'Conflicto' },
  COMERCIO: { icono: '🐪', label: 'Comercio' },
  NATURALEZA: { icono: '🌿', label: 'Naturaleza' },
  REINO: { icono: '🏰', label: 'Tu Reino' },
  // CR-13: nacimientos, quien destaca, sucesiones y muertes.
  GENTE: { icono: '👤', label: 'Gente' },
}

/// Día de ficción (1 = el primero) de un minuto de ficción.
export function diaDeFiccion(minutos: number): number {
  return Math.floor(minutos / 1440) + 1
}

/// CFG-35 (Fase E, Q7): ¿sale aviso emergente de esta noticia con el umbral elegido? Una propuesta
/// al Reino avisa siempre (pide respuesta) salvo con «ninguno»; un resumen de varios días, si alguna
/// de sus líneas avisaría; una noticia sin nivel (sin suceso detrás) cuenta como normal.
export function debeAvisar(meta: NoticiaMeta | null | undefined, umbral: AvisosSucesos): boolean {
  if (umbral === 'ninguno') return false
  if (umbral === 'todos') return true
  if (!meta) return false
  if (meta.propuesta) return true
  if (meta.resumen) return (meta.lineas ?? []).some((l) => debeAvisar(l, umbral))
  if (umbral === 'graves') return meta.nivel === 'GRAVE'
  return meta.nivel === 'DESTACADO' || meta.nivel === 'GRAVE'
}
