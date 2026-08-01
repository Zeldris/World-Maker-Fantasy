import type { ReactNode } from 'react'
import { EnciclopediaLinkContext, type EnciclopediaLinkValue } from './enciclopediaLinkContext'

/// Deduplicado (auditoría 2026-07-22): el trío `enciclopediaIndex`/`onEntityDetail`/
/// `onEntityQuickInsert` se perforaba idéntico desde GameView.tsx a 4 sitios (LogPanel ×2,
/// DiarioPanel, DetailModal) — cada uno solo lo reenviaba a `EnciclopediaLinkedText`. Un solo
/// Provider en GameView reemplaza esas 12 líneas de props repetidas; los 3 consumidores leen del
/// contexto en vez de recibirlo. El valor por defecto (índice vacío, sin handlers) permite seguir
/// usando estos componentes fuera de un `EnciclopediaLinkProvider` sin que nada reviente — mismo
/// comportamiento que las props opcionales que sustituye.
export function EnciclopediaLinkProvider({ value, children }: { value: EnciclopediaLinkValue; children: ReactNode }) {
  return <EnciclopediaLinkContext.Provider value={value}>{children}</EnciclopediaLinkContext.Provider>
}
