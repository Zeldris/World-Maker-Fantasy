import { createContext } from 'react'

/// UX-5 (hito 0.2) — motivo por el que los paneles están en modo consulta (null = se puede
/// cambiar). Lo da GameView con `canDo(fase, 'modificarPanel')`; fuera de una partida no hay
/// proveedor y todo queda libre.
export const ModoConsultaContext = createContext<string | null>(null)
