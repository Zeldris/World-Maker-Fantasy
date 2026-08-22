import { useEffect, useState } from 'react'
import { cancelTransit, getSave, type SaveDetail } from '../lib/api'

interface UseTransitPollingParams {
  saveId: string | null
  /// Solo se LEE aquí — quien la escribe de verdad (`syncFromSave` en GameView.tsx, vía
  /// `save.transit?.busyUntil`) y quien la fija tras un 409 `isBusyError` (`handleSubmit`) viven
  /// fuera de este hook. Sin esto, no hay forma de saber si toca sondear/hacer tictac.
  busyUntil: string | null
  /// Vuelca un SaveDetail completo en GameView (candado ~25 piezas de estado) — se le pasa tal
  /// cual, este hook no necesita saber qué hace con él, solo llamarlo cuando el transit resuelve.
  syncFromSave: (save: SaveDetail) => void
}

/// Bloque de transit/busy de GameView.tsx (deuda técnica 2026-08-21) — a diferencia del bloque de
/// combate (ver useCombatFlow.ts), aquí casi todo el estado real (`busyUntil`/`busyActivity`/
/// `busyDuracionMinutos`) lo escriben `syncFromSave`/`handleSubmit` FUERA de cualquier lógica de
/// transit propiamente dicha — este hook nunca los escribe, solo los lee (`busyUntil`) para saber
/// cuándo sondear. Lo único genuinamente interno es `cancelingTransit` (estado del propio botón
/// "Cancelar acción") y `nowTick` (reloj de cuenta atrás local, sin request).
export function useTransitPolling({ saveId, busyUntil, syncFromSave }: UseTransitPollingParams) {
  const [cancelingTransit, setCancelingTransit] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())

  // Mientras el personaje está en una acción por tiempo (extendida/larga), sondea la partida
  // cada 30s para detectar cuándo el worldTick la resuelve — en ese momento `transit` desaparece
  // y syncFromSave trae ya la narración diferida que se generó en el worker.
  useEffect(() => {
    if (!saveId || !busyUntil) return
    let cancelled = false

    async function pollOnce() {
      try {
        const save = await getSave(saveId!)
        if (cancelled) return
        if (!save.transit) syncFromSave(save)
      } catch {
        // Se reintenta en el siguiente sondeo.
      }
    }

    const interval = setInterval(pollOnce, 30_000)

    // Sondeo puntual justo cuando se espera que la acción termine (bug real jugando en vivo,
    // 2026-08-22: "al craftear se queda mucho tiempo en resolviendo...pero si es determinista...
    // porque tarda tanto?" — un crafteo tier 1 tarda 5s de verdad en el backend, pero sin esto el
    // frontend podía quedarse hasta 25s de más en "resolviendo..." esperando al próximo tick de
    // 30s). +500ms de margen para que la resolución anticipada del backend (`startEagerTransitResolution`,
    // turn.ts) ya haya comprometido su transacción. Si `busyUntil` ya pasó al montar (reconexión a
    // mitad de resolución), dispara casi de inmediato en vez de esperar el intervalo completo.
    const remainingMs = new Date(busyUntil).getTime() - Date.now()
    const timeout = setTimeout(pollOnce, Math.max(0, remainingMs) + 500)

    return () => {
      cancelled = true
      clearInterval(interval)
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveId, busyUntil])

  // Reloj de la cuenta atrás (roadmap 2026-07-20): solo aritmética local, ningún request — el
  // sondeo real que confirma la resolución sigue siendo el de 30s de arriba.
  useEffect(() => {
    if (!busyUntil) return
    const tick = setInterval(() => setNowTick(Date.now()), 1_000)
    return () => clearInterval(tick)
  }, [busyUntil])

  async function handleCancelTransit() {
    if (!saveId || cancelingTransit) return
    setCancelingTransit(true)
    try {
      await cancelTransit(saveId)
      const save = await getSave(saveId)
      syncFromSave(save)
    } catch {
      // Si falla (p. ej. ya se resolvió justo antes), el sondeo de 30s ya en marcha lo reflejará.
    } finally {
      setCancelingTransit(false)
    }
  }

  return { cancelingTransit, nowTick, handleCancelTransit }
}
