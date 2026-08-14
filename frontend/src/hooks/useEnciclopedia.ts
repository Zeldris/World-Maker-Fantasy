import { useCallback, useEffect, useMemo, useState } from 'react'
import { getEnciclopedia, type EnciclopediaResponse } from '../lib/api'
import { buildEnciclopediaIndex, EMPTY_ENCICLOPEDIA_INDEX, type EnciclopediaIndex } from '../lib/enciclopediaIndex'
import type { RecipeStatusInfo } from '../types'

export interface UseEnciclopediaResult {
  index: EnciclopediaIndex
  /// Rediseño de la vista de combate (2026-07-28) — CombatPanel necesita el catálogo crudo
  /// (`classes`/`razas`, y los `npcs`/`faunaFlora` con `attributes`/`ataqueBase`/etc ya resueltos
  /// por el backend), no solo el índice de nombre→ficha que ya usaba la navegación de narración.
  raw: EnciclopediaResponse | null
  /// `true` mientras la petición sigue en vuelo (auditoría 2026-08-13, dedupe de doble fetch) —
  /// distinto de `raw === null`, que también describe el estado tras un fallo de red ya resuelto;
  /// EnciclopediaPanel.tsx lo usa para su "Cargando enciclopedia..." de siempre.
  loading: boolean
  /// Repetir la petición sin depender de que cambien `worldSlug`/`saveId` (bug real, 2026-08-14:
  /// tras el dedupe de doble fetch del 2026-08-13, la Enciclopedia se pedía UNA sola vez al
  /// montar la partida y nunca más — cualquier descubrimiento nuevo durante la sesión [recolectar,
  /// combate, misión...] quedaba invisible hasta recargar la página entera). GameView.tsx la llama
  /// desde `syncFromSave`, el mismo punto central que ya resincroniza todo lo demás tras un turno.
  refetch: () => void
}

/// Única fuente de red de la Enciclopedia (auditoría 2026-08-13, dedupe de doble fetch): hasta
/// ahora este hook Y EnciclopediaPanel.tsx pedían cada uno por su cuenta la misma respuesta del
/// backend, con un comentario que aceptaba la duplicación a propósito — pero sin ninguna razón
/// real (misma vida útil, mismo `worldSlug`, EnciclopediaPanel ya se monta dentro de GameView,
/// que ya llama a este hook). Peor: este hook nunca pasaba `saveId`, así que el índice de
/// menciones enlazables veía SIEMPRE contenido de Historia sin gatear (`unlocked`/`text` reales)
/// aunque el panel sí gateaba lo suyo — un descuido real, no querido. Ahora GameView.tsx pasa
/// `data`/`loading` de este hook como prop a EnciclopediaPanel.tsx en vez de que ese panel vuelva
/// a pedir nada.
// `recipesStatus` (2026-08-13, petición explícita: "que ponga lo que tienes contra lo que
// falta 0/5") — opcional: sin ella (llamadas fuera de GameView, si las hubiera), el índice se
// queda con el listado estático de siempre, igual que antes.
export function useEnciclopedia(worldSlug: string | null, saveId: string | null, recipesStatus: RecipeStatusInfo[] = []): UseEnciclopediaResult {
  const [data, setData] = useState<EnciclopediaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  // Contador, no booleano — cambiar de valor es lo único que le importa a `useEffect` de abajo
  // para volver a disparar el mismo fetch (ver `refetch`).
  const [refetchToken, setRefetchToken] = useState(0)

  useEffect(() => {
    if (!worldSlug) return
    let cancelled = false
    // Solo la carga inicial pone "Cargando..." — un refetch en segundo plano tras un turno (ver
    // `refetch`) no debe hacer parpadear el panel si ya estaba abierto con datos de antes.
    if (refetchToken === 0) setLoading(true)
    getEnciclopedia(worldSlug, saveId)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch(() => {
        // Sin conexión al backend: el texto se queda sin enlazar en vez de romper la pantalla.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [worldSlug, saveId, refetchToken])

  const refetch = useCallback(() => setRefetchToken((t) => t + 1), [])

  const index = useMemo(() => (data ? buildEnciclopediaIndex(data, recipesStatus) : EMPTY_ENCICLOPEDIA_INDEX), [data, recipesStatus])
  return { index, raw: data, loading, refetch }
}
