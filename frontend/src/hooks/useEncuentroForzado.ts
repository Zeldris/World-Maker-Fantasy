import { useCallback, useEffect, useRef, useState } from 'react'

interface EntradaConOferta {
  dynamicModeOffer?: { combateForzado?: boolean } | null
}

/// P116 (cierre de la tanda Zona): ¿hay un encuentro que corta el paso? El servidor decide con la
/// oferta guardada (`Save.pendingDynamicModeOffer.combateForzado`, que llega en `SaveDetail`); el
/// cliente solo miraba la tarjeta colgada del registro, y las dos podían discrepar (p. ej. con el
/// registro vacío tras recargar, la tarjeta no se cuelga y «Viajar» parecía libre para un 409).
/// Aquí cuentan las dos: la oferta guardada que trajo la última carga (`guardarOferta`) y la tarjeta
/// viva del registro. La guardada se olvida en cuanto la tarjeta viva se resuelve (Interactuar), que
/// es el momento en que el servidor la limpia, para no bloquear de más hasta la próxima recarga.
export function useEncuentroForzado(log: EntradaConOferta[]): { encuentroForzado: boolean; guardarOferta: (oferta: { combateForzado?: boolean } | null | undefined) => void } {
  const [guardada, setGuardada] = useState(false)
  const enLog = log.some((e) => e.dynamicModeOffer?.combateForzado)
  const enLogAntes = useRef(false)
  useEffect(() => {
    if (enLogAntes.current && !enLog) setGuardada(false)
    enLogAntes.current = enLog
  }, [enLog])
  const guardarOferta = useCallback((oferta: { combateForzado?: boolean } | null | undefined) => setGuardada(!!oferta?.combateForzado), [])
  return { encuentroForzado: guardada || enLog, guardarOferta }
}
