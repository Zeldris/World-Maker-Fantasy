import { useCallback, useState } from 'react'
import type { FalloAccion } from '../components/ErrorBanner'

/// UX-24 (hito 0.1) — estado del `ErrorBanner` de una sección. `informar` va en el `catch` de cada
/// acción contra el backend, con el mensaje de qué no se pudo hacer y cómo repetirla; el detalle sale
/// del propio error (los `Error` de lib/api.ts ya traen el `error` del backend cuando lo hay).
export function useErrorConReintento() {
  const [fallo, setFallo] = useState<FalloAccion | null>(null)

  const informar = useCallback((mensaje: string, error: unknown, reintentar?: () => void) => {
    const detalle = error instanceof Error && error.message ? error.message : undefined
    setFallo({ mensaje, detalle, reintentar })
  }, [])

  const limpiar = useCallback(() => setFallo(null), [])

  /// Quita el aviso solo si es el de `mensaje` (p. ej. el de una carga fallida que ya fue bien): el de
  /// otra acción fallida sigue visible.
  const limpiarSi = useCallback((mensaje: string) => setFallo((f) => (f && f.mensaje === mensaje ? null : f)), [])

  return { fallo, informar, limpiar, limpiarSi }
}
