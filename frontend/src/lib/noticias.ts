// UX-38 (hito 0.2) — piezas de las noticias de «El mundo» (ver `components/NoticiaMundo.tsx`).
import type { NoticiaMeta } from '../types'

export const ICONO_CATEGORIA: Record<NonNullable<NoticiaMeta['categoria']>, { icono: string; label: string }> = {
  CONFLICTO: { icono: '⚔️', label: 'Conflicto' },
  COMERCIO: { icono: '🐪', label: 'Comercio' },
  NATURALEZA: { icono: '🌿', label: 'Naturaleza' },
  REINO: { icono: '🏰', label: 'Tu Reino' },
}

/// Día de ficción (1 = el primero) de un minuto de ficción.
export function diaDeFiccion(minutos: number): number {
  return Math.floor(minutos / 1440) + 1
}
