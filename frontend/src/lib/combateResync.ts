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

/// P426: el HUD y la fase de juego dicen «En combate» solo mientras el combate sigue. Con todos los
/// rivales resueltos (muertos, huidos, Clemente) el panel enseña el resumen, pero el combate ya está
/// cerrado: antes el HUD seguía en «⚔️ En combate» hasta pulsar «Salir» o recargar.
export function hayCombateEnCurso(combateIniciado: unknown, combatOpen: boolean, combatEnded: boolean): boolean {
  return (!!combateIniciado || combatOpen) && !combatEnded
}

/// P362: el mapa de zona se cierra en cuanto hay combate, aunque el panel aún no esté abierto: tras un
/// «Huir» fallido el combate queda con sus botones Combatir/Huir en el diario (`combateIniciado` sin
/// `combatOpen`) y el mapa, encima, los tapaba.
export function mapaDeZonaDebeCerrarse(combateIniciado: { npcs: unknown[] } | null | undefined, combatOpen: boolean): boolean {
  return combatOpen || (!!combateIniciado && combateIniciado.npcs.length > 0)
}
