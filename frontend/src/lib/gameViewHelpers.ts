import type { BusyError, EndedGameError, PendingDeathError, TurnLockedError } from './api'
import type { CombatNpcDisplay } from '../components/CombatComposer'
import type { InventoryItemInfo, LogEntry, NpcInSceneInfo } from '../types'

/// Bug real (auditoría de código completa, 2026-08-07): crafteo/construcción SÍ borran/reducen
/// filas reales de InventoryItem al consumir materiales, pero el backend solo devolvía lo AÑADIDO
/// (`newInventoryItems`) — el estado local del inventario nunca se enteraba de lo consumido,
/// mostrando materiales ya gastados (fantasma) hasta recargar la partida entera. Aplica los tres
/// deltas de una vez, en el orden correcto: primero quita lo borrado y renombra lo reducido,
/// luego añade lo nuevo (un mismo turno puede crear Y consumir a la vez, p. ej. craftear).
export function applyInventoryDelta(
  prev: InventoryItemInfo[],
  added: InventoryItemInfo[],
  removedIds: string[],
  updated: { id: string; name: string }[],
): InventoryItemInfo[] {
  const updatedById = new Map(updated.map((u) => [u.id, u.name]))
  const reconciled = prev
    .filter((item) => !removedIds.includes(item.id))
    .map((item) => (updatedById.has(item.id) ? { ...item, name: updatedById.get(item.id)! } : item))
  return [...reconciled, ...added]
}

// Bug real cazado por useTurnFlow.test.tsx (checklist frontend 2026-08-27, A.1) — `!('ended' in
// err)` no bastaba para distinguir un BusyError real de un TurnLockedError real: ambos son
// `{ status: 409, ... }` sin `ended`, así que un TurnLockedError genuino ({status:409, locked:true})
// también cumplía esta guarda y se trataba como BusyError (fijaba `busyUntil` con `undefined`, sin
// mensaje de turno bloqueado). No se disparaba en producción hoy solo porque `requestTurnNarrate`
// (api.ts) nunca lanza BusyError, únicamente TurnLockedError — pero la función en sí era incorrecta
// de forma aislada, mismo criterio que el resto del proyecto: se arregla la causa, no solo el
// síntoma que hoy no se ve.
export function isBusyError(err: unknown): err is BusyError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { status?: number }).status === 409 &&
    !('ended' in err) &&
    !('locked' in err) &&
    !('pendingDeathResolution' in err)
  )
}

export function isEndedGameError(err: unknown): err is EndedGameError {
  return typeof err === 'object' && err !== null && (err as { ended?: boolean }).ended === true
}

export function isPendingDeathError(err: unknown): err is PendingDeathError {
  return typeof err === 'object' && err !== null && (err as { pendingDeathResolution?: boolean }).pendingDeathResolution === true
}

export function isTurnLockedError(err: unknown): err is TurnLockedError {
  return typeof err === 'object' && err !== null && (err as { locked?: boolean }).locked === true
}

/// Cuenta atrás de una acción larga en curso (roadmap 2026-07-20, hallazgo real jugando: sin
/// esto, "vuelve en un rato" no decía nada — ni cuánto quedaba ni cuándo mirar). `busyUntil` ya
/// llega como ISO string; se compara contra un reloj que se actualiza cada segundo (barato, es
/// solo aritmética de fechas, el sondeo real que sí llama al backend sigue siendo el de 30s ya
/// existente). Nunca negativo: si el tick de fondo tarda en confirmar la resolución, se queda en
/// "resolviendo..." en vez de enseñar un contador en números rojos.
export function formatCountdown(busyUntilIso: string, nowMs: number): string {
  const remainingMs = new Date(busyUntilIso).getTime() - nowMs
  if (remainingMs <= 0) return 'resolviendo...'
  // Tramo de segundos (crafteo con espera real, petición explícita 2026-08-20: "que lleve un
  // tiempo real... entre 5 segs y 60 segs") — redondear a MINUTOS enteros (rama de abajo, la de
  // siempre) dejaría cualquier resto por debajo de 60s clavado en "~1 min" sin moverse durante
  // toda la espera, sin sensación real de cuenta atrás. Inofensivo para viaje/descanso: su espera
  // real comprimida siempre está muy por encima de 60s (`TRANSIT_MAX_REAL_MINUTES`).
  const totalSeconds = Math.ceil(remainingMs / 1000)
  if (totalSeconds < 60) return `~${totalSeconds}s`
  const totalMinutes = Math.ceil(remainingMs / 60_000)
  if (totalMinutes < 60) return `~${totalMinutes} min`
  const horas = Math.floor(totalMinutes / 60)
  const minutos = totalMinutes % 60
  return minutos === 0 ? `~${horas}h` : `~${horas}h ${minutos}min`
}

/// Equivalente en tiempo de FICCIÓN de una espera comprimida (petición explícita de la usuaria,
/// 2026-07-30: "que ponga ej: 7 mins de tiempo real 2 dias en Helek" — sin esto, la espera real
/// comprimida no daba ninguna pista de cuánto dura la acción DENTRO del mundo, dejando "¿por qué
/// tarda tanto?" sin respuesta visible). `duracionMinutos` son minutos de ficción, no reales.
export function formatFictionalDuration(duracionMinutos: number): string {
  if (duracionMinutos < 60) return `${Math.round(duracionMinutos)} min`
  if (duracionMinutos < 1440) {
    const horas = duracionMinutos / 60
    return `${Number.isInteger(horas) ? horas : horas.toFixed(1)} h`
  }
  const dias = duracionMinutos / 1440
  return `${Number.isInteger(dias) ? dias : dias.toFixed(1)} días`
}

/// Mapeo puro reutilizado en los 3 sitios de GameView.tsx que construyen el estado de combate de
/// un NPC a partir de lo que trae el backend (`combateIniciado.npcs`) — botón "Decapitar"
/// (2026-07-30): el estado en pantalla ya no colapsa MUERTO a CONVALECIENTE, ver
/// `CombatNpcDisplay.condicion`.
export function npcInSceneToCombatDisplay(npc: NpcInSceneInfo): CombatNpcDisplay {
  return {
    slug: npc.slug,
    name: npc.name,
    condicion: npc.condicionFisica,
    yaSaqueado: npc.saqueado,
    lootedItemNames: npc.lootedItemNames,
    analizado: npc.analizado,
    activeEffects: npc.activeEffects,
    participantId: npc.participantId,
    instanceNumber: npc.instanceNumber,
    capturable: npc.capturable,
    targetedForKill: npc.targetedForKill,
  }
}

/// Identificador de combatientes duplicados (2026-08-27, bug real jugando: "ataqué a los dos
/// buitres a la vez" — dos `CombatNpcDisplay` con el mismo `slug` colapsaban al mismo estado local
/// porque todo el merge de useCombatFlow.ts usaba `slug` como clave única). Clave real a usar en
/// vez de `slug` puro en cualquier `Map`/selección de combate: `participantId` cuando existe (un
/// `CombatEncounter` de grupo real, cada `CombatParticipant` es único), `slug` de vuelta en combate
/// 1v1 clásico (sin `CombatEncounter`, nunca hay dos NPCs a la vez de todos modos).
export function combatKeyFor(npc: Pick<CombatNpcDisplay, 'slug' | 'participantId'>): string {
  return npc.participantId ?? npc.slug
}

/// Nombre citable en texto libre (2026-08-27) — "Buitre #2" cuando hace falta desambiguar
/// (`instanceNumber` no nulo), el nombre tal cual en el resto de casos. Mismo sufijo `#N` que el
/// backend acepta en el matching por texto citado (`turnResolution.ts`, `esperandoEleccionJugadora`).
export function combatDisplayNameFor(npc: Pick<CombatNpcDisplay, 'name' | 'instanceNumber'>): string {
  return npc.instanceNumber != null ? `${npc.name} #${npc.instanceNumber}` : npc.name
}

/// LogEntry de recompensa de misión completada (2026-08-13) — misma construcción usada tanto al
/// resolver un turno de combate como uno normal (handleSubmit), siempre como fila aparte, nunca
/// fusionada con la narración principal.
export function questCompletedLogEntry(
  info: { logEntryId: string; text: string; title: string; grantedItems: string[]; rewardXp: number },
  timeLabel: string,
): LogEntry {
  return {
    id: info.logEntryId,
    channel: 'character',
    text: info.text,
    timeLabel,
    createdAt: new Date().toISOString(),
    questCompleted: { title: info.title, grantedItems: info.grantedItems, rewardXp: info.rewardXp },
  }
}

/// Tiempo de JUEGO (nunca tiempo real) — extraída de MapaPanel.tsx (auditoría de código
/// 2026-08-18: promovida aquí para compartirla también con TravelDestinationModal.tsx, que la
/// necesita para el mismo dato exacto — minutos de ficción ya ajustados a destreza, no una
/// estimación aparte).
export function formatMinutos(minutos: number): string {
  if (minutos < 60) return `~${minutos} min`
  const horas = minutos / 60
  return horas < 24 ? `~${horas.toFixed(1)}h` : `~${(horas / 24).toFixed(1)}d`
}

const QUANTITY_SUFFIX_REGEX = /\((\d+)\)\s*$/

/// Espejo exacto de quantityOf/baseNameOf (ingredients.ts, backend) — cuántas unidades reales lleva
/// una fila de inventario apilada (el patrón ya establecido mete la cantidad en el propio nombre,
/// ej. "Leña (60)"). Necesario para el panel "Curar" (2026-08-18, varios usos a la vez): el stepper
/// de cantidad no puede dejar elegir más de lo que la jugadora lleva encima de verdad.
export function quantityOf(name: string): number {
  const match = name.match(QUANTITY_SUFFIX_REGEX)
  return match ? Number(match[1]) : 1
}

export function baseNameOf(name: string): string {
  return name.replace(QUANTITY_SUFFIX_REGEX, '').trim()
}
