import { useEffect, useState, type DependencyList } from 'react'

/// Deuda técnica 2026-08-21 — el trío `loading`/`error`/fetch-en-useEffect (con
/// `.then(...).catch(() => setError(...)).finally(() => setLoading(false))`) vivía duplicado
/// byte-a-byte en 4 modales de selección (CampSelectionModal, HarvestSelectionModal,
/// HuntSelectionModal, SaquearZonaModal) — cada uno solo variaba en qué llamada hace y qué hace
/// con la respuesta. `SelectionModalShell.tsx` ya compartía el cascarón visual; esto comparte el
/// otro trozo duplicado, el estado de carga async. `onSuccess` decide qué hacer con la respuesta
/// (puede llamar a varios setters propios del modal, ver Harvest/Hunt), así que cada modal sigue
/// controlando su propio estado de datos — el hook solo centraliza loading/error.
export function useAsyncModalData<T>(
  fetchFn: () => Promise<T>,
  onSuccess: (result: T) => void,
  errorMessage: string,
  deps: DependencyList,
): { loading: boolean; error: string | null; setError: (error: string | null) => void; reintentar: () => void } {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // MOD-2 (hito 0.2) — «Reintentar» tras un fallo de carga: vuelve a pedir lo mismo.
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchFn()
      .then(onSuccess)
      .catch(() => setError(errorMessage))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intento])

  return { loading, error, setError, reintentar: () => setIntento((n) => n + 1) }
}
