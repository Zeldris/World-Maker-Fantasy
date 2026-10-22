/// P288: qué `combateIniciado` deja una resincronización con el backend (recarga, reconexión, tránsito).
/// Antes solo se fijaba cuando la partida traía combate y nunca se limpiaba: si el backend ya lo había
/// cerrado, el HUD seguía en «⚔️ En combate» con el composer bloqueado. Con el panel abierto se conserva
/// el local, porque la pantalla de resumen (victoria, saqueo) lo necesita hasta pulsar «Continuar».
export function combateTrasResync<T extends { npcs: unknown[] }>(
  guardado: T | null | undefined,
  actual: T | null,
  panelAbierto: boolean,
): T | null {
  if (guardado && guardado.npcs.length > 0) return guardado
  return panelAbierto ? actual : null
}
