import { createContext, useContext, type ReactNode } from 'react'
import { EMPTY_ENCICLOPEDIA_INDEX, type EnciclopediaIndex, type EnciclopediaLinkTarget } from '../lib/enciclopediaIndex'

/// Deduplicado (auditoría 2026-07-22): el trío `enciclopediaIndex`/`onEntityDetail`/
/// `onEntityQuickInsert` se perforaba idéntico desde GameView.tsx a 4 sitios (LogPanel ×2,
/// DiarioPanel, DetailModal) — cada uno solo lo reenviaba a `EnciclopediaLinkedText`. Un solo
/// Provider en GameView reemplaza esas 12 líneas de props repetidas; los 3 consumidores leen del
/// contexto en vez de recibirlo. El valor por defecto (índice vacío, sin handlers) permite seguir
/// usando estos componentes fuera de un `EnciclopediaLinkProvider` sin que nada reviente — mismo
/// comportamiento que las props opcionales que sustituye.
interface EnciclopediaLinkValue {
  enciclopediaIndex: EnciclopediaIndex
  onEntityDetail?: (target: EnciclopediaLinkTarget) => void
  onEntityQuickInsert?: (target: EnciclopediaLinkTarget) => void
}

const EnciclopediaLinkContext = createContext<EnciclopediaLinkValue>({ enciclopediaIndex: EMPTY_ENCICLOPEDIA_INDEX })

export function EnciclopediaLinkProvider({ value, children }: { value: EnciclopediaLinkValue; children: ReactNode }) {
  return <EnciclopediaLinkContext.Provider value={value}>{children}</EnciclopediaLinkContext.Provider>
}

export function useEnciclopediaLink(): EnciclopediaLinkValue {
  return useContext(EnciclopediaLinkContext)
}
