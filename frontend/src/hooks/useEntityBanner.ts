import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { pickMentionedEntityBanner, mentionedEntityKey, resolveEntityBannerFromRef } from '../lib/mentionedEntityBanner'
import { resolveImageUrl, setLogEntryBanner } from '../lib/api'
import type { EnciclopediaIndex } from '../lib/enciclopediaIndex'
import type { LogEntry, MentionedEntityBanner } from '../types'

// Banner de elemento citado bajo la narración (petición explícita de la usuaria, 2026-07-24):
// ventana de "no repetir" de las últimas 4 narraciones, en memoria de esta sesión — no hace falta
// persistirlo, un cambio de partida/recarga simplemente empieza la ventana de cero.
//
// Bug real jugando en vivo (2026-07-24, "sigue sin salir la imagen"): la primera versión guardaba
// solo una lista de las últimas 6 claves MOSTRADAS y la recortaba con `.slice(-6)` — es decir,
// expiraba una entrada solo cuando aparecían 6 entidades DISTINTAS nuevas después de ella. Con
// solo 2-3 candidatas reales con imagen subida en esta zona del juego (Gistera Koh, Orco
// Enfurecido...), en cuanto cada una se mostraba una vez quedaban ambas bloqueadas para siempre —
// nunca hay una tercera/cuarta/etc. distinta que las empuje fuera de la ventana. Ahora la
// expiración es por Nº DE NARRACIONES transcurridas (turnCounter), no por cuántas entidades
// distintas se han enseñado — así una NPC protagonista puede volver a aparecer pasadas unas pocas
// narraciones aunque no haya ninguna otra entidad nueva de por medio.
const RECENTLY_SHOWN_TURN_WINDOW = 4

export interface UseEntityBannerResult {
  /// `logEntryId` (rework 2026-07-24, persistencia de banners): el id REAL de la fila LogEntry ya
  /// creada en el backend para esta narración — antes se usaba un id inventado (`c-${Date.now()}`)
  /// que no correspondía a nada en BD, así que no había forma de guardarle luego qué entidad se
  /// mostró. Si se pasa, y hay match, se dispara un PATCH de fondo (fire-and-forget: un fallo aquí
  /// solo significa que la imagen no sobrevive a una recarga, nada más grave).
  buildEntityBanner: (text: string, logEntryId?: string) => MentionedEntityBanner | undefined
}

/// Extraído de GameView.tsx (refactor de deuda técnica, 2026-08-13) — mismo comportamiento
/// exacto, solo reorganizado en un hook propio.
///
/// `enciclopediaIndexRef` (mismo patrón que `characterThinkingRef`/`fictionalDateRef` en
/// GameView): el sondeo de ambientación (`tickSurroundings`) vive dentro de un efecto con
/// `[saveId]` como única dependencia, así que su clausura sobre `buildEntityBanner` se crea una
/// sola vez — sin este ref, se quedaría leyendo para siempre el índice vacío del primer render, de
/// antes de que `useEnciclopedia` terminara de cargar los datos reales.
export function useEntityBanner(
  saveId: string | null,
  enciclopediaIndex: EnciclopediaIndex,
  setCharacterLog: Dispatch<SetStateAction<LogEntry[]>>,
  setWorldLog: Dispatch<SetStateAction<LogEntry[]>>,
): UseEntityBannerResult {
  const recentlyShownEntitiesRef = useRef<Map<string, number>>(new Map())
  const entityBannerTurnRef = useRef(0)
  const enciclopediaIndexRef = useRef(enciclopediaIndex)
  useEffect(() => {
    enciclopediaIndexRef.current = enciclopediaIndex
  }, [enciclopediaIndex])

  // Reconstruye `entityBanner` para las entradas ya persistidas (rework 2026-07-24) en cuanto la
  // Enciclopedia termina de cargar — `syncFromSave` (al entrar/recargar) las rellena con
  // `entityBannerType`/`entityBannerSlug` (la referencia que sí sobrevive en BD), pero necesita el
  // índice de la Enciclopedia ya construido para resolver la imagen real; como ese fetch es
  // asíncrono y separado, este efecto corre en cuanto está listo, no en el momento de la carga.
  useEffect(() => {
    if (!enciclopediaIndex.bySlugKey.size) return
    const resolve = (entry: LogEntry): LogEntry => {
      if (entry.entityBanner || !entry.entityBannerType || !entry.entityBannerSlug) return entry
      const resolved = resolveEntityBannerFromRef(entry.entityBannerType, entry.entityBannerSlug, enciclopediaIndex)
      if (!resolved) return entry
      // Bug real jugando en vivo (2026-07-24, "las imágenes al recargar no se ven" — icono de
      // imagen rota): `resolveEntityBannerFromRef` devuelve la ruta relativa tal cual (igual que
      // `pickMentionedEntityBanner` con `bannerUrl`), quien llama es quien la convierte en URL
      // completa con `resolveImageUrl` (mismo patrón que `buildEntityBanner`) — faltaba aquí.
      const imageUrl = resolveImageUrl(resolved.imageUrl)
      if (!imageUrl) return entry
      return { ...entry, entityBanner: { ...resolved, imageUrl } }
    }
    setCharacterLog((prev) => prev.map(resolve))
    setWorldLog((prev) => prev.map(resolve))
  }, [enciclopediaIndex, setCharacterLog, setWorldLog])

  function buildEntityBanner(text: string, logEntryId?: string): MentionedEntityBanner | undefined {
    // Cualquier fallo aquí es puramente cosmético (una imagen de más o de menos) — nunca debe
    // impedir que la narración en sí se guarde/muestre. Aislado en try/catch tras un bug real
    // sospechado de un remount/HMR dejando `recentlyShownEntitiesRef` con una forma antigua.
    try {
      const currentTurn = ++entityBannerTurnRef.current
      const recentlyShown = new Set(
        Array.from(recentlyShownEntitiesRef.current.entries())
          .filter(([, shownAtTurn]) => currentTurn - shownAtTurn < RECENTLY_SHOWN_TURN_WINDOW)
          .map(([key]) => key),
      )
      const match = pickMentionedEntityBanner(text, enciclopediaIndexRef.current, recentlyShown)
      if (!match) return undefined
      const imageUrl = resolveImageUrl(match.bannerUrl)
      if (!imageUrl) return undefined
      recentlyShownEntitiesRef.current.set(mentionedEntityKey(match.target), currentTurn)
      if (logEntryId && saveId && match.target.entityType && match.target.entitySlug) {
        // Persistencia best-effort: el banner ya se ve en pantalla con el valor calculado aquí;
        // si esta llamada falla solo se pierde que sobreviva a un recargar de página, no algo
        // que la usuaria deba resolver.
        setLogEntryBanner(saveId, logEntryId, match.target.entityType, match.target.entitySlug).catch(() => {})
      }
      return { name: match.target.name, icon: match.target.icon, imageUrl }
    } catch (err) {
      console.error('buildEntityBanner failed', err)
      return undefined
    }
  }

  return { buildEntityBanner }
}
