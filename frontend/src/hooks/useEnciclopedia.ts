import { useEffect, useMemo, useState } from 'react'
import { getEnciclopedia, type EnciclopediaResponse } from '../lib/api'
import { buildEnciclopediaIndex, EMPTY_ENCICLOPEDIA_INDEX, type EnciclopediaIndex } from '../lib/enciclopediaIndex'

/// Fetch propio para GameView (2026-07-22, texto enlazable en narración/diario/descripciones) —
/// duplica la llamada que ya hace EnciclopediaPanel.tsx al abrir esa pestaña, aceptado a propósito:
/// evita tocar el fetch/estado ya probado de ese panel solo para compartirlo, a cambio de una
/// petición de red de más (la respuesta no es pesada — texto, sin imágenes embebidas).
export function useEnciclopedia(worldSlug: string | null): EnciclopediaIndex {
  const [data, setData] = useState<EnciclopediaResponse | null>(null)

  useEffect(() => {
    if (!worldSlug) return
    let cancelled = false
    getEnciclopedia(worldSlug)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch(() => {
        // Sin conexión al backend: el texto se queda sin enlazar en vez de romper la pantalla.
      })
    return () => {
      cancelled = true
    }
  }, [worldSlug])

  return useMemo(() => (data ? buildEnciclopediaIndex(data) : EMPTY_ENCICLOPEDIA_INDEX), [data])
}
