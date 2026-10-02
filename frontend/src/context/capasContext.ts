import { createContext } from 'react'
import type { EstadoCapas } from '../lib/capas'

/// UX-9 (hito 0.2) — qué capas se ven y cuáles esperan. Sin proveedor (tests, páginas sin
/// partida), `<Capa>` pinta siempre su contenido.
export const CapasContext = createContext<EstadoCapas | null>(null)
