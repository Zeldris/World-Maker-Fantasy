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

/// P405: al cargar la partida (recarga de página) con un combate en curso, el panel se reabre solo.
/// Antes `combatOpen` arrancaba en false y solo quedaba el aviso «⚔️ Combatir», como si el combate
/// empezara de nuevo. Con una muerte pendiente de resolver manda el modal de la Entidad, no el panel.
export function abrirCombateAlCargar(save: { combateIniciado?: { npcs: unknown[] } | null; pendingDeathResolution?: boolean }): boolean {
  return !!save.combateIniciado && save.combateIniciado.npcs.length > 0 && !save.pendingDeathResolution
}
