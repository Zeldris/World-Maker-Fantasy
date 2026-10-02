import { useEffect, useState } from 'react'

/// BAS-7 (hito 0.2, roadmap-front.md § 3, opción A recomendada: sin dependencias) — animaciones de
/// salida. Mientras `valor` está presente lo devuelve tal cual; cuando pasa a null/false, sigue
/// devolviendo el último valor durante `ms` con `saliendo: true`, para que el componente pinte su
/// animación de salida antes de desmontarse. Con «Animaciones: ninguna» (data-motion en <html>,
/// CFG-14) cierra en seco.
export function usePresence<T>(valor: T | null | false | undefined, ms: number): { mostrado: T | null; saliendo: boolean } {
  const actual = valor || null
  const [ultimo, setUltimo] = useState<T | null>(actual)
  const [saliendo, setSaliendo] = useState(false)

  useEffect(() => {
    if (actual !== null) {
      setUltimo(actual)
      setSaliendo(false)
      return
    }
    const sinAnimaciones = typeof document !== 'undefined' && document.documentElement.dataset.motion === 'ninguna'
    if (sinAnimaciones || ms <= 0) {
      setUltimo(null)
      setSaliendo(false)
      return
    }
    setSaliendo(true)
    const t = setTimeout(() => {
      setUltimo(null)
      setSaliendo(false)
    }, ms)
    return () => clearTimeout(t)
  }, [actual, ms])

  return actual !== null ? { mostrado: actual, saliendo: false } : { mostrado: ultimo, saliendo: ultimo !== null && saliendo }
}
