import { useContext } from 'react'
import { ModoConsultaContext } from './modoConsultaContext'

/// UX-5 (hito 0.2) — null si el panel puede cambiar datos; si no, el motivo para el tooltip.
export function useModoConsulta(): string | null {
  return useContext(ModoConsultaContext)
}
