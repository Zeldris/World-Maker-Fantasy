import type {
  AbilityEffect,
  ActiveEffect,
  AlmacenItemInfo,
  Attribute,
  AttributeBlock,
  AgendaEntryInfo,
  EntornoTemporalInfo,
  BuildingInfo,
  CombatExchangeInfo,
  CompanionInfo,
  CondicionFisica,
  CurrentLocationInfo,
  DestinationInfo,
  Dificultad,
  EquipSlot,
  InventoryItemInfo,
  ItemTipo,
  KingdomFoundedInfo,
  KingdomStatsInfo,
  LogEntry,
  NpcInSceneInfo,
  HarvestSourceCandidate,
  GatheringRollInfo,
  HuntCandidate,
  PostCombatInteractionInfo,
  PlantillaEquipoInfo,
  ProfessionProgressInfo,
  ProfessionRecipeInfo,
  ProgressionResult,
  QuestInfo,
  RecipeStatusInfo,
  RollInfo,
  SavedActionCategory,
  SavedActionInfo,
  SecondaryAttributeBlock,
  SessionSummaryInfo,
  SubjectInfo,
  TerritoryInfo,
} from '../types'

// VITE_API_URL permite apuntar a otro backend (staging, otra máquina) sin tocar código;
// localhost:3001 sigue siendo el valor por defecto para desarrollo local.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

/// Helper compartido (auditoría 2026-07-22): antes cada función repetía a mano el mismo
/// `if (!response.ok) throw new Error(...)`, en dos variantes — una simple ("El backend
/// respondió 500") y otra que intentaba leer `body.error` primero — repetido en ~18 sitios. Esto
/// unifica ambas en la variante más informativa (siempre intenta leer `body.error` primero) sin
/// cambiar el comportamiento de ningún endpoint. Los casos genuinamente especiales (el 409 con
/// forma propia de /turn/classify, el streaming de /turn/narrate) se quedan fuera a propósito,
/// no se fuerzan a encajar aquí.
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? `El backend respondió ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export type Banda = 'instantanea' | 'corta' | 'extendida' | 'larga'

export interface ClassificationResult {
  requiereTirada: boolean
  atributo: Attribute
  dificultad: number
  razon: string
  banda: Banda
  duracionEstimadaMinutos: number
}

// Viaje resuelto por el grafo de ubicaciones (docs/12-mundo-estructurado.md § 1.4) — opaco para
// el frontend, solo se reenvía tal cual de /turn/classify a /turn/narrate.
export type TravelResolution = Record<string, unknown>

// Auditoría de rendimiento 2026-07-28 ("rascar segundos") — igual de opaco que TravelResolution:
// /turn/classify ya calculó los NPCs en escena para esta acción, y reenviarlo tal cual a
// /turn/narrate le ahorra repetir la misma consulta (roster completo del mundo + objetos) una
// segunda vez para el mismo turno.
export type NpcSceneSnapshot = Record<string, unknown>[]

export interface ClassifyResponse {
  classification: ClassificationResult
  roll?: RollInfo
  // Presente en bandas instantánea/corta — cuánto tarda la acción en la ficción.
  duracionMinutos?: number
  produccion?: string
  // Presente en bandas extendida/larga — el turno ya quedó resuelto en diferido, no hace falta narrar.
  // `duracionMinutos` (2026-07-30, petición explícita: mostrar tiempo real Y ficticio juntos en
  // la espera) — minutos de FICCIÓN que dura la acción, antes de comprimir a espera real.
  transit?: { busyUntil: string; duracionMinutos?: number | null }
  // Presente cuando la acción se resolvió como un viaje por el grafo de ubicaciones.
  travel?: TravelResolution | null
  npcsInScene?: NpcSceneSnapshot
  // Validador de "grounding" de la acción del jugador (docs/18-validacion-accion-jugador.md) —
  // presente cuando el backend rechazó la acción de raíz (p. ej. reclamar un arma que no lleva
  // encima) y ya persistió una frase determinista en el log. El turno queda resuelto aquí mismo:
  // no hace falta (ni se debe) llamar a /turn/narrate.
  blocked?: { narration: string }
  // Interacción con un NPC/fauna ya convaleciente o muerto, fuera de combate (docs/19-post-combate-
  // y-recompensas-mision.md pieza 2) — el turno tampoco llega a /turn/narrate aquí, pero a
  // diferencia de `blocked` no es una violación: el frontend abre el panel mecánico (Saquear/
  // Decapitar/Salir) en vez de mostrar ningún texto.
  postCombatInteraction?: PostCombatInteractionInfo
}

export interface BusyError {
  status: 409
  activity: string
  busyUntil: string
  duracionMinutos?: number | null
}

export interface EndedGameError {
  status: 409
  ended: true
  endedAt: string
}

/// Muerte permanente, botón Aceptar/Reintentar (2026-08-31) — distinto de `EndedGameError`: aquí
/// la partida NO ha terminado, solo está pendiente de que el jugador pulse el botón (POST
/// /saves/:id/death/resolve) antes de poder mandar ningún turno nuevo.
export interface PendingDeathError {
  status: 409
  pendingDeathResolution: true
}

/// Candado de turno (auditoría de código completa, 2026-08-07, ver turnLock.ts en el backend) —
/// distinto de `BusyError`: aquí no hay ningún `busyUntil` que contar ni nada resolviéndose en
/// segundo plano que valga la pena sondear — el turno se rechazó de raíz, nunca llegó a narrar.
/// Tratarlo con el mecanismo de reconexión (pensado para un stream cortado a mitad) haría esperar
/// minutos un resultado que nunca va a llegar.
export interface TurnLockedError {
  status: 409
  locked: true
}

export async function requestTurnClassify(params: {
  saveId: string
  action: string
  enCombate?: boolean
  /// Solapar classify con el tecleo (2026-07-19): true = precalienta el resultado en segundo
  /// plano sin persistir nada — nunca usar para un envío real del jugador.
  preview?: boolean
  /// Mecánica real de habilidades de clase (checklist 2026-07-21/22, puntos 1-2) — id de la
  /// SavedAction seleccionada en CombatModal.tsx, si la hay.
  savedActionId?: string
}): Promise<ClassifyResponse> {
  const response = await fetch(`${API_URL}/turn/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (response.status === 409) {
    const body = await response.json()
    if (body.endedAt) {
      const err: EndedGameError = { status: 409, ended: true, endedAt: body.endedAt }
      throw err
    }
    if (body.pendingDeathResolution) {
      const err: PendingDeathError = { status: 409, pendingDeathResolution: true }
      throw err
    }
    const err: BusyError = { status: 409, activity: body.activity, busyUntil: body.busyUntil, duracionMinutos: body.duracionMinutos ?? null }
    throw err
  }
  if (!response.ok) {
    throw new Error(`El backend respondió ${response.status}`)
  }

  return response.json()
}

export interface NarrateResponse {
  narration: {
    narration: string
    newFacts: string[]
    newItem?: { name: string; description: string } | null
    newCompanion?: { name: string; role: string; notes: string } | null
  }
  progression: ProgressionResult
  condicionFisica: CondicionFisica
  /// Fase 2 de efectos de clase (2026-08-27, indicador de combate) — AUMENTO/DEBILIDAD activos
  /// del JUGADOR tras este turno. Los de cada NPC viajan dentro de
  /// `combateIniciado.npcs[].activeEffects`, no aquí.
  activeEffects: ActiveEffect[]
  /// Estación/clima (2026-08-27, auditoría backend↔frontend + diseño/UX) — recalculado fresco
  /// cada turno, mismo criterio que `timeLabel`.
  entorno: EntornoTemporalInfo
  /// Sistema de fatiga (2026-07-29) — energía real tras este turno y su tope actual (deriva de
  /// Constitución efectiva), listos para actualizar la barra sin recalcular nada en el cliente.
  energia: number
  energiaMax: number
  /// Hora ficticia real tras ESTE turno (bug real, petición explícita 2026-08-14: "se logea mal la
  /// hora" — GameView.tsx antes solo fijaba `fictionalDate` al cargar la partida y sellaba cada
  /// entrada de log nueva con ese valor congelado el resto de la sesión en vivo, aunque el reloj
  /// real del backend sí hubiera avanzado). Úsalo para refrescar `fictionalDate` Y para sellar la
  /// entrada de log de este mismo turno, nunca el valor local ya obsoleto.
  timeLabel: string
  combateIniciado?: { npcs: NpcInSceneInfo[] } | null
  finDePartida: boolean
  /// Muerte permanente, botón Aceptar/Reintentar (2026-08-31) — true cuando este turno mató al
  /// jugador pero no agotó las vidas: el susurro de la Entidad ya está en el log, pero ningún
  /// turno nuevo puede correr hasta POST /saves/:id/death/resolve (ver GameView.tsx).
  pendingDeathResolution: boolean
  /// Bug real (2026-07-29, "si muero no hace lo que fijamos que haría" en combate): `condicionFisica`
  /// de arriba ya viene resuelta tras un respawn sobrevivible (siempre ILESO, nunca MUERTO) — este
  /// campo es la única forma real de saber que la muerte ocurrió ESTE turno, para poder cerrar el
  /// combate en curso (ver submitCombatAction en GameView.tsx).
  justDied: boolean
  // Loot/despiece/producción ya materializados en la partida (2026-07-19) — antes el inventario en
  // pantalla se quedaba desactualizado hasta recargar, porque el backend nunca los devolvía aquí.
  newInventoryItems: InventoryItemInfo[]
  /// Bug real (auditoría de código completa, 2026-08-07): crafteo/construcción SÍ borran/reducen
  /// filas reales de inventario al consumir materiales, pero el backend nunca lo comunicaba aquí —
  /// el inventario en pantalla seguía mostrando materiales ya gastados (fantasma) hasta recargar
  /// la partida entera. Mismo criterio que `newInventoryItems`.
  removedInventoryItemIds: string[]
  /// Filas que no desaparecen del todo pero cambian de nombre al consumirse solo una parte de una
  /// pila (p. ej. "Piedra (5)" → "Piedra (2)") — mismo hueco que `removedInventoryItemIds`.
  updatedInventoryItems: { id: string; name: string }[]
  /// Rework 2026-07-24 (persistencia de banners de entidad) — id real de la fila LogEntry de esta
  /// narración, para poder guardarle luego qué entidad se mostró como imagen (setLogEntryBanner).
  logEntryId: string
  /// Bug real (2026-07-25, "revisar partida"): una misión podía crearse/cerrarse de verdad este
  /// turno sin que el panel de Misiones se enterara hasta recargar la partida entera — mismo
  /// patrón ya arreglado antes para el inventario (newInventoryItems). Lista completa, no un
  /// delta (ver comentario en NarrateAndPersistResult, backend).
  quests: QuestInfo[]
  /// Notificación de misión aceptada (2026-07-31, petición explícita: "que aparezca en la
  /// narración del personaje el título de la misión y el objetivo") — a diferencia de `quests`
  /// (lista completa, sin delta), esto marca que ESTE turno creó una misión nueva. `null` en la
  /// inmensa mayoría de turnos, que no crean ninguna.
  newQuestInfo: { title: string; objetivo: string } | null
  /// Oferta de misión SIN aceptar (2026-08-26, botones Aceptar/Cancelar) — a diferencia de
  /// `newQuestInfo`, la misión NO se ha creado todavía; hace falta `aceptarMision` para eso.
  /// `null` en la inmensa mayoría de turnos.
  newQuestOfferInfo: { title: string; description: string } | null
  /// "Modo dinámico" (2026-08-27, Pieza 4 de "Dinamismo del mundo") — oferta opcional de un botón
  /// "Interactuar" al FINAL de este turno (nunca lo interrumpe). El motor ya decidió determinista
  /// el candidato; la narración de la primera vuelta ocurre al pulsar Interactuar
  /// (`POST /saves/:id/modo-dinamico/interactuar`), no aquí. `null` en la inmensa mayoría de turnos.
  dynamicModeOffer: { tipo: 'NPC' | 'FAUNA'; targetSlug: string; targetName: string } | null
  /// Notificación de misión COMPLETADA (2026-08-13) — `logEntryId`/`text` son los de la LogEntry
  /// real ya persistida por el backend (questRewardNarrationFor), para insertarla tal cual con
  /// marca visual de "misión completada" en vez de una tarjeta sintética aparte. `null` en la
  /// inmensa mayoría de turnos, que no completan ninguna.
  questCompletedInfo: { logEntryId: string; text: string; title: string; grantedItems: string[]; rewardXp: number } | null
  /// Feedback de UX (2026-08-30, petición explícita: "falta que la suma de repu o la perdida se
  /// refleje en la UX... sino el usuario ni se entera") — el delta de reputación de facción ya se
  /// aplicaba y persistía al matar/dejar convaleciente a un NPC con `faction` real, pero nunca
  /// llegaba al jugador. `null` en la inmensa mayoría de turnos.
  factionRepChange: { faction: string; delta: number; newValue: number } | null
  /// Notificación de fundación de reino (2026-08-04, "el Ayuntamiento") — solo al construir el
  /// Ayuntamiento tier 1 desde cero, nunca en una mejora. `null` en la inmensa mayoría de turnos.
  newKingdomFounded: KingdomFoundedInfo | null
  /// Compañero REALMENTE creado este turno (2026-08-04, tope de slots) — a diferencia de
  /// `narration.newCompanion` (lo que PROPUSO el modelo), esto es lo que el backend persistió de
  /// verdad. `null` si no hubo propuesta o si se rechazó por falta de hueco — el frontend debe
  /// usar este campo para actualizar la lista de compañeros, nunca `narration.newCompanion` solo.
  companionCreated: CompanionInfo | null
  /// Rediseño del turno de combate (2026-07-28) — true cuando el backend decidió que un NPC gana
  /// la iniciativa del SIGUIENTE intercambio: la próxima acción del jugador debe tratarse como
  /// defensa a ciegas (elige una habilidad sin saber qué usará el NPC), no como ataque normal.
  esperandoDefensaJugador: boolean
  /// Bug real (2026-07-29, "no sé qué ataques usa el enemigo... es poco claro el combate"): nombre
  /// real, ya resuelto, de la habilidad de ataque/defensa que el NPC acaba de usar en el
  /// intercambio de ESTE turno. null si no hubo intercambio de combate.
  npcAbilityUsed: { npcName: string; abilityName: string; rol: 'ataque' | 'defensa' } | null
  /// Mismo hueco exacto que `npcAbilityUsed` pero para el lado del jugador (revisión de partida
  /// 2026-08-08, petición explícita: "cuando seleccione una habilidad esta se refleje en la
  /// narración con su descripción"). null en texto libre sin botón o sin intercambio.
  playerAbilityUsed: { name: string; icon: string; description: string; rol: 'ataque' | 'defensa' } | null
  /// Las dos tiradas reales del intercambio de combate de ESTE turno (revisión de partida
  /// 2026-08-08, petición explícita: "que aparezca el resultado de las tiradas... qué atributo y
  /// valor sacaste tú y el del enemigo, y por qué perdiste o ganaste"). null si no hubo
  /// intercambio mecánico real este turno.
  combatExchangeDisplay: CombatExchangeInfo | null
  /// Rediseño del turno de combate (2026-07-29, "quiero que sea más claro cuando es turno de
  /// ataque... indicándome qué salió en los dados"): tirada real de iniciativa que decidió quién
  /// actúa en el PRÓXIMO intercambio. null si se forzó sin dados (aturdimiento/intimidación) o si
  /// no hubo intercambio de combate este turno.
  nextInitiativeRoll: { ganador: 'jugador' | 'npc'; jugadorTirada: number; npcTirada: number } | null
  /// Bug real (auditoría de deuda técnica 2026-08-04): construir/mejorar/fundar un edificio de
  /// verdad en la DB no se reflejaba en el mapa ni en el panel de Reino hasta recargar la partida
  /// entera — `syncFromSave` (GameView.tsx) solo se llama al cargar/reconectar, nunca tras un turno
  /// normal resuelto con éxito. Mismo criterio que `quests`: listas/valor completos, no un delta.
  territories: TerritoryInfo[]
  buildings: BuildingInfo[]
  subjects: SubjectInfo[]
  kingdomStats: KingdomStatsInfo | null
  /// deathCount/factionsStatus/professionProgress (auditoría 2026-08-06, bug real): las tres se
  /// mutan en el mismo turno (combate/decapitar/crafteo) pero no viajaban de vuelta — el contador
  /// de muertes, la pestaña Reputación y la pestaña Profesiones se quedaban con el valor de la
  /// última recarga completa hasta la siguiente. Mismo criterio que territories/buildings arriba.
  deathCount: number
  factionsStatus: Record<string, number>
  professionProgress: ProfessionProgressInfo[]
  /// Saqueo/desuello de CombatEncounter (2026-08-25, Grupo 3 § Mundo determinista, Capa 4) —
  /// especies caídas al RESOLVERSE este turno un combate múltiple real. `null` en la inmensa
  /// mayoría de turnos. El frontend lo usa solo como aviso de "hay algo nuevo que desollar" — los
  /// datos reales (qué objetos hay) se piden con `getRecolectarLocalizado(saveId, 'desollador')`,
  /// la misma ruta de siempre.
  combatEncounterLootSummary: { npcId: string; slug: string; name: string; cantidad: number }[] | null
}

export interface TurnNarrateHandlers {
  /// Streaming (roadmap de velocidad, 2026-07-20, punto 13): fragmento de "narration" tal cual
  /// se va generando. Puede no llamarse nunca si el intento principal falló y el backend cayó a
  /// un reintento no-streaming (ver onReset) — el resultado final en `done` sigue siendo el mismo.
  onChunk?: (delta: string) => void
  /// Hubo que descartar el texto transmitido hasta ahora (el intento 1 se coló o dio un
  /// resultado inválido) — limpiar cualquier texto parcial ya mostrado.
  onReset?: () => void
  /// Animación de dados en paralelo (petición explícita, 2026-08-15) — el intercambio de combate
  /// (las dos tiradas + desenlace) ya está resuelto del todo ANTES de que empiece a llegar
  /// `onChunk`, así que este evento siempre llega primero cuando hay combate — el frontend puede
  /// animar los dados mientras la narración todavía se está generando, en vez de esperar al
  /// resultado final. Nunca se llama en turnos sin intercambio de combate real. `npcName` viaja
  /// aparte (no vive dentro de `CombatExchangeInfo`) — nombre real del rival para etiquetar su
  /// dado sin esperar al `npcAbilityUsed` del resultado final.
  onExchangeResolved?: (exchange: CombatExchangeInfo, npcName: string | null) => void
}

export async function requestTurnNarrate(
  params: {
    saveId: string
    action: string
    classification: ClassificationResult
    roll?: RollInfo
    travel?: TravelResolution | null
    enCombate?: boolean
    /// Mismo id que en requestTurnClassify — turnResolution.ts lo usa para gatear
    /// REMATE/ATURDIMIENTO/INTIMIDACION/AGUANTE.
    savedActionId?: string
    /// Auditoría de rendimiento 2026-07-28 — el mismo `npcsInScene` que devolvió
    /// requestTurnClassify para esta acción, reenviado tal cual (ver NpcSceneSnapshot).
    npcsInScene?: NpcSceneSnapshot
    /// Saqueo selectivo (petición explícita, 2026-07-30) — ver el mismo campo en turnResolution.ts.
    lootItemNames?: string[]
    /// Rediseño de combate (2026-08-09) — ver el mismo campo en turnResolution.ts
    /// (NarrateAndPersistParams.isItemUse).
    isItemUse?: boolean
    /// Panel "Curar" con varios objetos/usos a la vez (petición explícita, 2026-08-18) — ver el
    /// mismo campo en turnResolution.ts (NarrateAndPersistParams.healItemUses). Lista ORDENADA —
    /// el orden en que se seleccionaron los objetos cambia el resultado real.
    healItemUses?: { itemId: string; quantity: number }[]
  },
  handlers?: TurnNarrateHandlers,
): Promise<NarrateResponse> {
  const response = await fetch(`${API_URL}/turn/narrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (response.status === 409) {
    const body = await response.json()
    if (body.endedAt) {
      const err: EndedGameError = { status: 409, ended: true, endedAt: body.endedAt }
      throw err
    }
    if (body.pendingDeathResolution) {
      const err: PendingDeathError = { status: 409, pendingDeathResolution: true }
      throw err
    }
    if (body.locked) {
      const err: TurnLockedError = { status: 409, locked: true }
      throw err
    }
  }
  if (!response.ok) {
    throw new Error(`El backend respondió ${response.status}`)
  }
  if (!response.body) {
    // No debería pasar en un navegador moderno, pero sin body no hay stream que leer.
    return response.json()
  }

  type StreamEvent =
    | { type: 'chunk'; text: string }
    | { type: 'reset' }
    | { type: 'error'; message: string }
    | { type: 'exchange'; exchange: CombatExchangeInfo; npcName: string | null }
    | ({ type: 'done' } & NarrateResponse)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: NarrateResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line) {
        const event = JSON.parse(line) as StreamEvent
        if (event.type === 'chunk') {
          handlers?.onChunk?.(event.text)
        } else if (event.type === 'reset') {
          handlers?.onReset?.()
        } else if (event.type === 'error') {
          throw new Error(event.message)
        } else if (event.type === 'exchange') {
          handlers?.onExchangeResolved?.(event.exchange, event.npcName)
        } else {
          const { type: _type, ...rest } = event
          result = rest
        }
      }
      newlineIndex = buffer.indexOf('\n')
    }
  }

  if (!result) {
    throw new Error('El backend cerró la conexión sin completar la narración.')
  }
  return result
}

export interface EntornoResponse {
  description: string
  /// Rework 2026-07-24 (persistencia de banners de entidad): id real de la fila LogEntry creada
  /// (o reutilizada, si el mundo no ha avanzado desde la última vez) para poder guardarle luego
  /// qué entidad se mostró como imagen.
  logEntryId: string
}

export async function requestSurroundings(params: { saveId: string }): Promise<EntornoResponse> {
  return fetchJson(`${API_URL}/entorno`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export interface CreateSaveParams {
  worldSlug: string
  pregeneratedCharacterId?: string
  characterName: string
  characterArchetype: string
  characterOrigin: string
  characterMotivation: string
  attributes: AttributeBlock
  portraitInitial: string
  introCharacterText: string
  introWorldText: string
  dificultad?: Dificultad
}

export async function createSave(params: CreateSaveParams): Promise<{ id: string }> {
  return fetchJson(`${API_URL}/saves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export interface SaveDetail {
  id: string
  worldSlug: string
  worldName: string
  characterName: string
  characterArchetype: string
  characterOrigin: string
  characterMotivation: string
  attributes: AttributeBlock
  /// Bonus de equipo por atributo jugable, SIN sumar la base (2026-08-14) — `attributes` de
  /// arriba ya es el base puro; esto permite pintar la barra en dos tramos (claro=base,
  /// oscuro=equipo) en vez de solo el total ya sumado.
  attributeBonuses: Partial<AttributeBlock>
  secondaryAttributes: SecondaryAttributeBlock
  portraitInitial: string
  fictionalDateLabel: string
  characterLog: LogEntry[]
  worldLog: LogEntry[]
  /// Log de Reino (2026-08-17) — canal alternable con `worldLog` en el frontend, nunca los dos a
  /// la vez (ver LogPanel/GameView.tsx).
  kingdomLog: LogEntry[]
  inventory: InventoryItemInfo[]
  companions: CompanionInfo[]
  level: number
  xp: number
  pendingAttributePoints: number
  kingdomName: string | null
  territories: TerritoryInfo[]
  buildings: BuildingInfo[]
  subjects: SubjectInfo[]
  /// Grupo 3 § Compañeros y supervivencia (2026-08-25) — Almacén de Reino/Plantillas (§6-7) y
  /// Hambre/Sed del propio personaje (§5, derivadas en vivo, igual que Comida/Agua de compañero).
  almacenItems: AlmacenItemInfo[]
  plantillasEquipo: PlantillaEquipoInfo[]
  hambre: number
  sed: number
  transit: { activity: string; busyUntil: string; duracionMinutos?: number | null } | null
  savedActions: SavedActionInfo[]
  habilidadSlots: number
  /// "Cinturón de combate" (2026-08-28, pendiente 2026-08-27 punto 3) — nombres de las habilidades
  /// de combate NO genéricas activas AHORA MISMO, ya resueltas por el backend (saneado + "todas
  /// activas" por defecto si nunca se configuró) — solo estas + las 3 genéricas se ofrecen para
  /// pulsar en CombatPanel.tsx durante un enfrentamiento.
  activeCombatAbilityNames: string[]
  professionProgress: ProfessionProgressInfo[]
  kingdomStats: KingdomStatsInfo | null
  currentLocation: CurrentLocationInfo | null
  destinations: DestinationInfo[]
  condicionFisica: CondicionFisica
  /// Fase 2 de efectos de clase (2026-08-27, indicador de combate) — AUMENTO/DEBILIDAD activos
  /// del JUGADOR ahora mismo, sobreviven a recargar la partida.
  activeEffects: ActiveEffect[]
  /// Estación/clima (2026-08-27, auditoría backend↔frontend + diseño/UX).
  entorno: EntornoTemporalInfo
  /// WorldState.agenda (2026-08-27, auditoría backend↔frontend + diseño/UX § 2.3) — solo aquí
  /// (no en NarrateResponse): avanza en el tick de fondo, no dentro de un turno en vivo.
  worldAgenda: AgendaEntryInfo[]
  /// Sistema de fatiga (2026-07-29) — `energia` es el valor real; `energiaMax` ya viene derivado
  /// de Constitución efectiva (con equipo), listo para pintar la barra sin recalcular nada aquí.
  energia: number
  energiaMax: number
  dificultad: Dificultad
  deathCount: number
  endedAt: string | null
  /// Muerte permanente, botón Aceptar/Reintentar (2026-08-31) — true si esta partida se cargó/
  /// recargó a mitad de una muerte pendiente de resolver (ver PendingDeathError arriba).
  pendingDeathResolution: boolean
  quests: QuestInfo[]
  chapters: SessionSummaryInfo[]
  factionsStatus: Record<string, number>
  /// Combate pendiente reconstruido tras cualquier resincronización (bug real, 2026-07-23,
  /// "revisar partida"): antes solo viajaba en la respuesta directa de `/turn/narrate` — si el
  /// sondeo de reconexión tenía que recuperar la partida vía `getSave` en vez de recibir esa
  /// respuesta, el aviso de "Combatir" se perdía sin dejar rastro pese a que el combate sí se
  /// había calculado bien en el backend.
  combateIniciado: { npcs: NpcInSceneInfo[] } | null
  /// "Modo dinámico" en curso, reconstruido tras cualquier resincronización (checklist frontend
  /// 2026-08-27, A.3 — mismo criterio que `combateIniciado` arriba): antes solo viajaba en la
  /// respuesta directa de `/modo-dinamico/interactuar`/`/responder` — recargar con una conversación
  /// abierta la hacía desaparecer sin dejar rastro, aunque el backend la siguiera guardando en
  /// `Save.pendingDynamicMode`. Incluye la última narración/opciones ya narradas, para reabrir el
  /// modal exacto sin volver a llamar al LLM.
  pendingDynamicMode: { tipo: 'NPC' | 'FAUNA'; targetSlug: string; targetName: string; vuelta: number; narration: string; opciones: string[] } | null
  /// Oferta de modo dinámico SIN aceptar todavía (bug real 2026-08-28, "no sobrevive a una
  /// recarga") — mismo criterio que `pendingDynamicMode` arriba, un escalón antes: el botón
  /// "Interactuar"/"Ignorar" en sí, reconstruido tras F5 en vez de vivir solo en `characterLog`.
  pendingDynamicModeOffer: { tipo: 'NPC' | 'FAUNA'; targetSlug: string; targetName: string } | null
  /// Ataque enemigo pendiente de defensa en el combate 1v1 clásico (bug real 2026-08-28/29,
  /// "recargar mientras el enemigo tiene la iniciativa rompe el turno"): `Save.pendingNpcAttack`
  /// ya persistía bien en el backend, pero nunca viajaba en `GET /saves/:id` — tras F5,
  /// `combatAwaitingDefense` (solo `useState` en memoria) volvía a `false` y el panel de combate
  /// mostraba el catálogo de ATAQUE en vez de DEFENSA, aunque el backend siguiera esperando una
  /// defensa de verdad. Mismo criterio que `combateIniciado`/`lastInitiativeRoll` arriba: se
  /// reconstruye en cada resincronización, no solo en la respuesta directa de `/turn/narrate`.
  esperandoDefensaJugador: boolean
}

export async function getSave(id: string): Promise<SaveDetail> {
  return fetchJson(`${API_URL}/saves/${id}`)
}

export interface SaveSummary {
  id: string
  worldId: string
  worldName: string
  characterName: string
  fictionalDate: string
  lastPlayedAt: string
  dificultad: Dificultad
  endedAt: string | null
}

export async function restartSave(
  id: string,
  intro?: { introCharacterText?: string; introWorldText?: string },
): Promise<{ id: string }> {
  return fetchJson(`${API_URL}/saves/${id}/restart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(intro ?? {}),
  })
}

/// Muerte permanente, botón Aceptar/Reintentar (2026-08-31) — se llama al pulsar el botón que
/// GameView.tsx muestra mientras `pendingDeathResolution` es true. `restartedTotal` distingue si
/// tocó reaparecer en el punto de guardado (progreso intacto) o reiniciar la partida entera (sin
/// punto de guardado ni tutorial superado) — GameView.tsx usa esto para decidir si sincroniza el
/// estado en el sitio o navega de vuelta al selector, mismo criterio que "Reiniciar" ya usa hoy.
export async function resolveDeath(id: string): Promise<{ restartedTotal: boolean; respawnLocationId?: string | null }> {
  return fetchJson(`${API_URL}/saves/${id}/death/resolve`, { method: 'POST' })
}

// Pausar/reanudar la partida (roadmap 2026-07-20: "quiero que la partida se pause si salgo de
// ella"). `pauseSave` se llama al salir de GameView (desmontaje o beforeunload) — usa sendBeacon
// cuando está disponible porque es lo único fiable en beforeunload (un fetch normal se puede
// cancelar a media petición si la pestaña ya se está cerrando). `resumeSave` se llama al volver a
// entrar; el backend alarga el tránsito activo exactamente lo que ha durado la pausa.
export function pauseSave(id: string): void {
  const url = `${API_URL}/saves/${id}/pause`
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([], { type: 'text/plain' }))
  } else {
    fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
  }
}

export async function resumeSave(id: string): Promise<void> {
  await fetch(`${API_URL}/saves/${id}/resume`, { method: 'POST' })
}

export async function cancelTransit(id: string): Promise<void> {
  return fetchJson(`${API_URL}/saves/${id}/transit/cancel`, { method: 'POST' })
}

// Huir antes de entrar al combate (2026-07-24) — una sola tirada determinista en el backend, sin
// IA: `escaped` decide si el frontend limpia el aviso de "Combatir" o abre el popup igualmente.
// `roll` (2026-08-30, bug real: 3 intentos seguidos narraban la misma frase fija sin ningún
// desglose) — se pinta con RollBadge, igual que cualquier otra tirada del juego.
export async function requestFlee(id: string): Promise<{ escaped: boolean; text: string; roll: RollInfo }> {
  return fetchJson(`${API_URL}/saves/${id}/combat/flee`, { method: 'POST' })
}

// Huir DENTRO de un combate ya iniciado (ronda de correcciones 2026-08-28, P3.2) — misma tirada
// determinista que requestFlee, pero un fallo aplica un golpe directo real (sin tirada de
// defensa): `condicionFisica` viene ya actualizada en la respuesta.
export async function requestHuirEnCurso(
  id: string,
): Promise<{ escaped: boolean; text: string; condicionFisica: string; roll: RollInfo }> {
  return fetchJson(`${API_URL}/saves/${id}/combat/huir-en-curso`, { method: 'POST' })
}

export async function spendAttributePoint(
  id: string,
  attribute: Attribute,
): Promise<{ attributes: AttributeBlock; pendingAttributePoints: number }> {
  return fetchJson(`${API_URL}/saves/${id}/attribute-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attribute }),
  })
}

export async function createSavedAction(
  id: string,
  params: { name: string; promptText: string; icon: string; description: string; category: SavedActionCategory },
): Promise<SavedActionInfo> {
  return fetchJson(`${API_URL}/saves/${id}/habilidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export async function updateSavedAction(
  id: string,
  habilidadId: string,
  params: { name: string; promptText: string; icon: string; description: string },
): Promise<SavedActionInfo> {
  return fetchJson(`${API_URL}/saves/${id}/habilidades/${habilidadId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export async function deleteSavedAction(id: string, habilidadId: string): Promise<void> {
  return fetchJson(`${API_URL}/saves/${id}/habilidades/${habilidadId}`, { method: 'DELETE' })
}

/// "Cinturón de combate" (2026-08-28, pendiente 2026-08-27 punto 3) — reemplaza la lista completa
/// en el orden recibido; la respuesta es la lista YA saneada por el backend (fuente de verdad real).
export async function setActiveCombatAbilities(id: string, names: string[]): Promise<{ activeCombatAbilityNames: string[] }> {
  return fetchJson(`${API_URL}/saves/${id}/combat-abilities`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names }),
  })
}

export async function setItemSlot(id: string, itemId: string, slot: EquipSlot | null): Promise<void> {
  return fetchJson(`${API_URL}/saves/${id}/inventario/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot }),
  })
}

/// Persiste qué entidad se mostró como banner bajo una narración (rework 2026-07-24) — el frontend
/// ya decidió cuál mostrar (mentionedEntityBanner.ts); esto solo guarda esa decisión para que
/// sobreviva a una recarga dentro de la ventana de 24h que devuelve GET /saves/:id. Fire-and-forget
/// desde el llamador: si falla, la imagen simplemente no sobrevive a una recarga, nada más grave.
export async function setLogEntryBanner(saveId: string, logEntryId: string, entityType: string, entitySlug: string): Promise<void> {
  return fetchJson(`${API_URL}/saves/${saveId}/log/${logEntryId}/entity-banner`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityType, entitySlug }),
  })
}

export interface DiarioEntry {
  id: string
  channel: LogEntry['channel']
  text: string
  timeLabel: string
  roll?: RollInfo
  isPlayerAction?: boolean
  xpDelta?: number
  createdAt: string
  /// Día de ficción real (1-indexado, ver worldClock.ts) — para agrupar el registro completo por
  /// día en vez de una lista plana (petición explícita, 2026-07-24). Nunca lleva banner de
  /// entidad: el Diario es solo texto por diseño.
  day: number
}

/// Historial completo de la partida, agrupado por día de ficción (rework 2026-07-24: "el log de
/// personaje solo muestre 24h... si quieres verlo todo vendrá clasificado por días en el diario").
/// Fetch aparte y solo bajo demanda (se llama al abrir la pestaña Diario) — GET /saves/:id ya no
/// carga esto para no sobrecargar la petición que se repite en cada carga de partida.
export async function getDiario(saveId: string): Promise<DiarioEntry[]> {
  return fetchJson(`${API_URL}/saves/${saveId}/diario`)
}

/// Roster estático de recetas de oficio (rediseño de profesiones, 2026-08-07) — independiente de
/// partida, se pide una vez al cargar Habilidades > Profesiones.
export async function getProfessionRecipes(): Promise<ProfessionRecipeInfo[]> {
  return fetchJson(`${API_URL}/profession-recipes`)
}

/// Cuánto tienes de cada ingrediente de las recetas ya conocidas, EN ESTA PARTIDA (2026-08-13) —
/// a diferencia de getProfessionRecipes (estático), depende del inventario/atributos/ubicación
/// reales, así que se recarga cada vez que el inventario cambia (ver GameView.tsx).
export async function getRecipesStatus(saveId: string): Promise<{ recipes: RecipeStatusInfo[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/recipes-status`)
}

/// Pop-up de recolección (rediseño de profesiones, 2026-08-07) — "ya localizado en la zona".
/// `roll` (rediseño de recolección, 2026-08-22) solo viene relleno para desollador: no hay
/// "Explorar" propio para desuello (los cadáveres ya están en escena), así que la tirada visible
/// se calcula aquí mismo — reabrir el panel vuelve a tirar, simplificación consciente (ver
/// backend recolectar.ts).
export async function getRecolectarLocalizado(
  saveId: string,
  oficio: string,
): Promise<{ sources: HarvestSourceCandidate[]; puedeExplorar: boolean; enCooldown?: boolean; roll?: GatheringRollInfo }> {
  return fetchJson(`${API_URL}/saves/${saveId}/recolectar/${oficio}`)
}

/// Botón "Explorar" del pop-up — determinista en QUÉ hay (WorldPopulation/terreno/región), pero
/// desde el rediseño de recolección (2026-08-22) su margen sobre la dificultad de cada recurso
/// decide si aparece y con cuánta cantidad — `roll` solo falta si no había ningún candidato real
/// que tirar (nada que descubrir, ni con suerte).
export async function explorarRecolectar(
  saveId: string,
  oficio: string,
): Promise<{ sources: HarvestSourceCandidate[]; enCooldown?: boolean; roll?: GatheringRollInfo }> {
  return fetchJson(`${API_URL}/saves/${saveId}/recolectar/${oficio}/explorar`, { method: 'POST' })
}

/// Confirmar selección del pop-up de recolección (cantidades parciales, no todo-o-nada).
export async function confirmarRecoleccion(
  saveId: string,
  selections: { sourceSlug: string; itemSlug: string; cantidad: number }[],
): Promise<{
  items: InventoryItemInfo[]
  updatedItems: { id: string; name: string }[]
  /// Registro escrito determinista de lo recolectado (petición explícita, 2026-08-07: "un texto
  /// de narración que no dependa de la AI") — null si la petición no consiguió nada de verdad
  /// (capacidad llena, cooldown, población agotada a mitad de camino).
  logEntry: { id: string; text: string; timeLabel: string; createdAt: string } | null
}> {
  return fetchJson(`${API_URL}/saves/${saveId}/recolectar/confirmar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selections }),
  })
}

/// Sugerencias de próxima acción bajo demanda (petición explícita, 2026-08-15) — botón junto a
/// "Actuar", llamada aparte del turno normal (ver comentario de cabecera de `generateSuggestions`,
/// backend narrador.ts). Sin body: el backend reúne el contexto (log reciente + NPCs en escena) él
/// solo a partir del `saveId`.
export async function requestSuggestions(saveId: string): Promise<{ suggestions: string[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/suggestions`, { method: 'POST' })
}

/// Habilidad "Cazar" (revisión de partida 2026-08-08) — fauna YA LOCALIZADA en la zona ahora
/// mismo, para el pop-up de selección (HuntSelectionModal). `puedeExplorar` = no hay nada
/// localizado todavía en esta visita, mismo patrón de dos pasos que recolección.
export async function getCazarCandidatos(saveId: string): Promise<{ candidates: HuntCandidate[]; puedeExplorar: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/cazar`)
}

/// Paneles nuevos (2026-08-17, comentarios de startingAbilities.ts): "Volver al campamento",
/// "Viajar" y "Saquear" fuera de combate — cada uno solo LISTA candidatos, la acción real sigue
/// pasando por el turno normal (ver comentario de cabecera de panels.ts).
export interface CampInfo {
  locationSlug: string
  locationName: string
  region: string
}
export async function getCampamentos(saveId: string): Promise<{ camps: CampInfo[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/campamentos`)
}

export interface TravelDestinationInfo {
  locationSlug: string
  locationName: string
  region: string
  /// Tiempo de juego real hasta este destino por el grafo de viaje (petición explícita,
  /// 2026-08-18: "tiempo de juego que nos llevaría llegar... no tiempo real") — ya ajustado a
  /// destreza, mismo cálculo exacto que usaría `resolveTravel` de verdad al confirmar el viaje.
  /// `null` si el destino no tiene camino real por el grafo desde donde estás ahora (visitado por
  /// otro medio, o revelado por mapa pero nunca enlazado) — se lista igual, solo sin tiempo.
  minutos: number | null
  banda: 'corta' | 'extendida' | 'larga' | null
}
export async function getDestinosViaje(saveId: string): Promise<{ hasMap: boolean; destinations: TravelDestinationInfo[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/destinos-viaje`)
}

/// Candidato de "Saquear zona" — igual que `NpcInSceneInfo` pero con `items` (el backend manda el
/// `NpcInScene` completo, ver panels.ts § buildNpcInScene; el modal solo necesita nombre/cantidad
/// de cada objeto para las casillas de selección).
export interface LootZoneCandidate extends NpcInSceneInfo {
  items: { name: string; cantidad: number }[]
}
export async function getSaquearZona(saveId: string): Promise<{ candidates: LootZoneCandidate[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/saquear-zona`)
}

/// Grupo 3 § Mundo determinista, Capa 1 (2026-08-25, docs/rpgtarkor/mundo-determinista.md) — zonas
/// navegables, prototipo en una sola zona. `disponible: false` cuando la Location actual no tiene
/// ningún ZonePoint sembrado todavía (el resto de zonas, hasta que se repita el prototipo) —
/// el frontend debe ocultar el panel en ese caso, no mostrarlo vacío.
export interface ZonePointInfo {
  id: string
  x: number
  y: number
  tipo: 'FAUNA' | 'RECURSO' | 'NPC' | 'EDIFICIO'
  targetSlug: string
  nombre: string
  /// Instancia viva (2026-08-27, Pieza 3 de "Dinamismo del mundo") — cuántos individuos reales
  /// representa este punto (agrupación por población regional real vía `WorldPopulation`), y su
  /// color por reputación con `factionSlug` (verde/amarillo/rojo; sin facción = naranja).
  cantidad: number
  color: 'ALIADO' | 'NEUTRO' | 'ENEMIGO' | 'SIN_FACCION'
}
/// NPCs presentados de forma determinista (2026-08-26, "no aparecen en la zona y sí tienen que
/// salir") — a diferencia de `ZonePointInfo` (catálogo fijo, con posición real curada), estos
/// vienen de lo que la propia partida va estableciendo (`detectNpcsInScene`), sin ninguna
/// posición en el mapa — el panel los lista aparte, nunca como pin.
export interface ZonaDinamicoInfo {
  slug: string
  nombre: string
  tipo: 'NPC' | 'FAUNA'
}
/// Control regional (2026-08-27, Pieza 5 de "Dinamismo del mundo") — derivado en caliente de
/// `WorldState.agenda`, sin logo real todavía (placeholder de texto en el frontend mientras se
/// generan los assets). `null` si la región no tiene dueño de lore conocido.
export interface RegionControlInfo {
  estado: 'NEUTRAL_O_DUENO_ORIGINAL' | 'EN_DISPUTA' | 'CONQUISTADA'
  duenoActual: string
  agresor?: string
}
export interface ZonaResponse {
  disponible: boolean
  locationSlug?: string
  locationName?: string
  /// Mapa pintado a mano de fondo (entityType 'zona'/sizeProfile 'mapa') — el botón que lo genera
  /// vive en Enciclopedia > Localización (DetailModal.tsx), no aquí; este panel solo lo muestra.
  imageUrl?: string | null
  regionControl?: RegionControlInfo | null
  puntos: ZonePointInfo[]
  dinamicos: ZonaDinamicoInfo[]
}
export async function getZona(saveId: string): Promise<ZonaResponse> {
  return fetchJson(`${API_URL}/saves/${saveId}/zona`)
}

/// Botón "Explorar" del pop-up de caza — determinista, sin gastar turno, pero con una tirada real
/// de qué se encuentra: puede no salir nada, igual que explorar en busca de recursos.
export async function explorarCaza(saveId: string): Promise<{ candidates: HuntCandidate[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/cazar/explorar`, { method: 'POST' })
}

// ═══════════════════════════════════════════════════════════════════════════
// Grupo 3 § Compañeros y supervivencia (2026-08-25, docs/rpgtarkor/companeros-y-supervivencia.md)
// ═══════════════════════════════════════════════════════════════════════════

export interface CapturableCandidate {
  npcSlug: string
  name: string
  tipo: 'FAUNA' | 'NPC'
}
export async function getCapturables(saveId: string): Promise<{ candidates: CapturableCandidate[]; tieneCuerdas: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/capturables`)
}
/// Rediseño de captura (2026-08-28, docs/rpgtarkor/captura-rediseno-2026-08-28.md) — atar ya no
/// asigna una Jaula directamente: la captura se materializa como InventoryItem en tránsito
/// (`inventoryItemId`), que el jugador deposita en una Jaula más tarde (`postDepositarCaptura`).
/// `participantId` (2026-08-29, bug real "la tarjeta MATAR/CLEMENTE reaparece tras recargar en
/// combate múltiple") — dentro de un CombatEncounter real, identifica al individuo CONCRETO de un
/// grupo (`combatKeyFor`, ver useCombatFlow.ts): sin él, el backend no puede distinguir cuál de 2+
/// individuos del mismo Npc de catálogo se está atando. `undefined` = combate 1v1 clásico o
/// solitario, mismo comportamiento de siempre.
export async function postCapturar(
  saveId: string,
  npcSlug: string,
  participantId?: string,
): Promise<{ npcSlug: string; tipo: 'FAUNA' | 'NPC'; inventoryItemId: string; capturaExpiraAtMinutes: number | null }> {
  return fetchJson(`${API_URL}/saves/${saveId}/capturar/${npcSlug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId }),
  })
}

/// Entregar un objeto a un NPC (2026-08-31) — mismo patrón que Capturar: mutación 100%
/// determinista sin narración de por medio, endpoint dedicado propio. `items` son objetos NO
/// equipados del inventario real; `npcs` son NPCs vivos ya conocidos en esta ubicación.
export interface EntregableNpc {
  npcSlug: string
  name: string
}
export async function getEntregables(
  saveId: string,
): Promise<{ items: { id: string; name: string; description: string }[]; npcs: EntregableNpc[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/entregables`)
}
export async function postEntregar(
  saveId: string,
  npcSlug: string,
  itemId: string,
): Promise<{ npcSlug: string; itemName: string; logEntry: LogEntry }> {
  return fetchJson(`${API_URL}/saves/${saveId}/entregar/${npcSlug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId }),
  })
}

/// Deposita una captura EN EL INVENTARIO (`InventoryItem.capturaNpcId` no null) en una Jaula con
/// hueco — solo fauna tiene edificio de destino hoy (NPC espera la Celda de Retención, pausada).
export async function postDepositarCaptura(saveId: string, itemId: string): Promise<{ ok: true; jaulaBuildingId: string }> {
  return fetchJson(`${API_URL}/saves/${saveId}/capturas/${itemId}/depositar`, { method: 'POST' })
}

/// Suelta/libera una captura TODAVÍA EN EL INVENTARIO (antes de depositar) — disponible en
/// cualquier momento. Distinto de `postSoltarTameo` (abajo), que suelta una captura YA depositada.
export async function postSoltarCaptura(saveId: string, itemId: string): Promise<{ ok: true }> {
  return fetchJson(`${API_URL}/saves/${saveId}/capturas/${itemId}/soltar`, { method: 'POST' })
}

/// CONVALECIENTE deja de ser "victoria automática" (2026-08-26) — "Dejarlo vivir" saca al NPC del
/// combate activo (deja de ser objetivo) sin tocar su condicionFisica, que se queda CONVALECIENTE
/// de verdad. Determinista, sin pasar por el turno narrado — mismo criterio que `postCapturar`.
/// `participantId` — mismo motivo/criterio que `postCapturar` de arriba.
export async function dejarVivir(
  saveId: string,
  npcSlug: string,
  participantId?: string,
): Promise<{ npcSlug: string; logEntry: { id: string; text: string; timeLabel: string; createdAt: string } }> {
  return fetchJson(`${API_URL}/saves/${saveId}/combat/dejar-vivir/${npcSlug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId }),
  })
}

export interface TameoPendiente {
  npcSlug: string
  name: string
  tipo: 'FAUNA' | 'NPC'
  felicidad: number
  umbral: number
  atributoResistencia: Attribute | null
  enJaula: boolean
}
export async function getTameoPendientes(saveId: string): Promise<{ pendientes: TameoPendiente[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/tameo-pendientes`)
}

export interface OpposedRollInfo {
  playerAttribute: Attribute
  playerValue: number
  playerRoll: number
  playerResult: number
  resistenciaAttribute: Attribute
  resistenciaValue: number
  resistenciaRoll: number
  resistenciaResult: number
  margen: number
  gano: boolean
}
export async function postIntentarTameo(
  saveId: string,
  npcSlug: string,
  attribute: Attribute,
): Promise<{ roll: OpposedRollInfo; felicidad: number; umbral: number; umbralCompletado: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/tameo-pendientes/${npcSlug}/intentar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attribute }),
  })
}
export async function postConfirmarTameo(saveId: string, npcSlug: string): Promise<{ companion: CompanionInfo }> {
  return fetchJson(`${API_URL}/saves/${saveId}/tameo-pendientes/${npcSlug}/confirmar`, { method: 'POST' })
}
export async function postSoltarTameo(saveId: string, npcSlug: string): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/tameo-pendientes/${npcSlug}/soltar`, { method: 'POST' })
}

/// Equipo de compañero (§6) — mismo patrón que `setItemSlot` (equipo del jugador), scopeado a un
/// `companionId` concreto.
export async function setCompanionItemSlot(
  saveId: string,
  companionId: string,
  itemId: string,
  slot: EquipSlot | null,
): Promise<{ id: string; slot: EquipSlot | null; companionId: string | null }> {
  return fetchJson(`${API_URL}/saves/${saveId}/companeros/${companionId}/equipo/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot }),
  })
}

/// Almacén de Reino (§7).
export async function depositarEnAlmacen(saveId: string, itemId: string): Promise<{ ok: boolean; autoEquipados: number }> {
  return fetchJson(`${API_URL}/saves/${saveId}/almacen/depositar/${itemId}`, { method: 'POST' })
}
export async function retirarDeAlmacen(saveId: string, almacenItemId: string): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/almacen/retirar/${almacenItemId}`, { method: 'POST' })
}

/// Plantillas de equipo (§7).
export async function crearPlantilla(
  saveId: string,
  params: { name: string; rol: string; personalizada?: boolean; slots: PlantillaEquipoInfo['slots']; prioridad?: number },
): Promise<PlantillaEquipoInfo> {
  return fetchJson(`${API_URL}/saves/${saveId}/plantillas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}
export async function borrarPlantilla(saveId: string, plantillaId: string): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/plantillas/${plantillaId}`, { method: 'DELETE' })
}
export async function asignarPlantillaCompanion(saveId: string, companionId: string, plantillaEquipoId: string | null, rolReino?: string): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/companeros/${companionId}/plantilla`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plantillaEquipoId, rolReino }),
  })
}
export async function asignarPlantillaSubject(saveId: string, subjectId: string, plantillaEquipoId: string | null): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/subjects/${subjectId}/plantilla`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plantillaEquipoId }),
  })
}

/// Confirmar selección del pop-up de caza. Con una única presa débil puede resolverse sin combate
/// (`resuelveSinCombate: true`, ver `combate`) — en cualquier otro caso (varias presas, una sola
/// no lo bastante débil, o la propia tirada de caza limpia falla) esta llamada NO abre combate ni
/// toca nada de la partida: solo devuelve `actionText`, que el llamador debe mandar por el turno
/// normal (`handleSubmit` en GameView.tsx) para que la narración real sea quien lo abra — decisión
/// explícita de la usuaria: "cazar sí que fuerza una narración cuando eliges objetivos y esa
/// narración inicia el combate".
/// `cantidades` (caza en grupo, 2026-08-13, petición explícita: "el jugador primero debe marcar
/// contra cuantos quiere combatir") — cuántos individuos de CADA especie quiere comprometer al
/// combate, solo relevante para especies con `avistados > 1`; el backend tira un dado sobre esto
/// (puede salir algo distinto, ver `groupVarianceClause`), nunca es un número garantizado.
export async function confirmarCaza(
  saveId: string,
  slugs: string[],
  cantidades?: Record<string, number>,
): Promise<
  | { resuelveSinCombate: true; exito: true; combate: { npcs: NpcInSceneInfo[] }; logEntry: { id: string; text: string; timeLabel: string; createdAt: string } }
  | { resuelveSinCombate: false; exito: false | null; actionText: string }
> {
  return fetchJson(`${API_URL}/saves/${saveId}/cazar/confirmar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slugs, cantidades }),
  })
}


/// Fundación de reino (2026-08-04) — el popup que se abre al terminar de construir el Ayuntamiento
/// (tier 1) manda aquí el formulario. Bloqueo de nombre para Gorhorn verificado en el backend, no
/// solo aquí (ver reino.ts).
export async function fundarReino(id: string, kingdomName: string, description?: string): Promise<{ kingdomName: string }> {
  return fetchJson(`${API_URL}/saves/${id}/reino/fundar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kingdomName, description }),
  })
}

/// Botones Aceptar/Cancelar cuando un NPC ofrece una misión (2026-08-26) — materializa de verdad
/// la `Quest` que el turno solo ofreció (`newQuestOfferInfo`), determinista, sin pasar por Ollama.
export async function aceptarMision(
  saveId: string,
  title: string,
  description: string,
): Promise<{
  quest: { id: string; title: string; objetivo: string | null }
  alreadyExisted: boolean
  logEntry?: { id: string; text: string; timeLabel: string; createdAt: string }
}> {
  return fetchJson(`${API_URL}/saves/${saveId}/quests/aceptar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  })
}

/// "Modo dinámico" (2026-08-27, Pieza 4 de "Dinamismo del mundo") — resultado de una vuelta,
/// idéntico en `interactuar` (primera vuelta) y `responder` (siguientes): narración ya redactada
/// por el motor + `opciones` deterministas para que el jugador elija (nunca texto libre dentro del
/// modo dinámico), y `cierra` marca si esta vuelta ya resuelve la interacción.
export interface DynamicModeTurno {
  narration: string
  opciones: string[]
  cierra: boolean
  vuelta: number
  timeLabel: string
}

export async function interactuarModoDinamico(saveId: string, tipo: 'NPC' | 'FAUNA', targetSlug: string, targetName: string): Promise<DynamicModeTurno> {
  return fetchJson(`${API_URL}/saves/${saveId}/modo-dinamico/interactuar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, targetSlug, targetName }),
  })
}

export async function responderModoDinamico(saveId: string, respuesta: string): Promise<DynamicModeTurno> {
  return fetchJson(`${API_URL}/saves/${saveId}/modo-dinamico/responder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ respuesta }),
  })
}

export async function ignorarModoDinamico(saveId: string): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/modo-dinamico/ignorar`, { method: 'POST' })
}

export async function deleteSave(id: string): Promise<void> {
  return fetchJson(`${API_URL}/saves/${id}`, { method: 'DELETE' })
}

export async function listSaves(): Promise<SaveSummary[]> {
  return fetchJson(`${API_URL}/saves`)
}

export interface WorldLocationInfo {
  id: string
  slug: string
  name: string
  region: string
  kind: string
  description: string
  aliases: string[]
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
  /// Siempre true aquí — este endpoint (grafo del mapa) no gatea por enciclopedia progresiva, el
  /// mapa ya tiene su propia "niebla de guerra" por posesión del objeto "Mapa de las Llanuras".
  discovered: boolean
}

export interface WorldLocationLinkInfo {
  fromSlug: string
  toSlug: string
  minutosBase: number
  terreno: string
  riesgo: string | null
}

export interface WorldLocationsResponse {
  locations: WorldLocationInfo[]
  links: WorldLocationLinkInfo[]
}

/// Prompt de generación de imagen en inglés (roadmap 2026-07-21/22, punto 7) — dos perfiles de
/// talla independientes (thumbnail = icono cuadrado de la cuadrícula, banner = MediaSlot ancho
/// del detalle), cada uno null hasta que se genera (bajo demanda, 1 a 1, o con
/// npm run seed-image-prompts).
export interface EnciclopediaImagePrompts {
  thumbnail: string | null
  banner: string | null
}

// Imagen real subida a mano (checklist 2026-07-21/22, punto 7 — sustituye al prompt de texto una
// vez generada de verdad): rutas relativas que sirve el backend (@fastify/static, prefijo
// /images/) — usar resolveImageUrl() antes de ponerlas en un <img src>, nunca a pelo.
export interface EnciclopediaImageUrls {
  thumbnail: string | null
  banner: string | null
}

// Variantes por sexo (2026-07-22, petición explícita: "para fauna, npcs... con los símbolos de
// macho y hembra") — solo presente en fauna de verdad, NPC de tipo PLANTILLA genéricos, y razas a
// nivel general; nunca en flora/mineral ni en individuos únicos con nombre propio (ya tienen un
// sexo fijo en su lore). Mismo patrón que EnciclopediaRazaVariante: cada sexo combina con la
// descripción general de la entidad en el frontend, nunca la sustituye.
export interface EnciclopediaSexoVariante {
  sexo: 'macho' | 'hembra'
  rasgoFisico: string
  description: string
  /// Medida corporal aproximada en cm y edad máxima en años (2026-07-22, "que indique casi medidas
  /// exactas... en la enciclopedia podemos añadir a cada entrada su edad maxima, altura maxima") —
  /// cifras absolutas, nunca comparadas entre macho y hembra.
  medidaCm: number
  edadMaxima: number
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
}

// Rediseño de la vista de combate (2026-07-28) — calculada en el backend (baseAttack.ts) a partir
// del arma equipada/loadout (si la hay) o del `ataqueNatural` de la fauna; nunca recalculada en el
// frontend, que no tiene acceso al loadout crudo de un NPC.
export interface EnciclopediaAtaqueBase {
  icon: string
  name: string
  description: string
  preferredAttribute: Attribute
}

export interface EnciclopediaNpcInfo {
  slug: string
  name: string
  kind: 'PRINCIPAL' | 'PLANTILLA'
  role: string
  faction: string | null
  level: number
  bio: string
  aliases: string[]
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
  variantesSexo?: EnciclopediaSexoVariante[]
  /// Enciclopedia progresiva (2026-07-23) — true si ya se mencionó en narración/new_facts de
  /// esta partida; siempre true cuando la consulta no lleva `saveId` (sin partida que gatear).
  discovered: boolean
  /// Rediseño de la vista de combate (2026-07-28) — bloque de atributos crudo (nivel/fuerza/
  /// destreza/etc, mostrado como cifras reales en la ficha de enemigo, petición explícita de la
  /// usuaria). `raza`/`clase` referencian los catálogos de habilidades ya existentes
  /// (`razas`/`classes` de este mismo `EnciclopediaResponse`) — null/undefined si el NPC no
  /// encaja en ninguno (social/no combatiente).
  attributes: AttributeBlock
  raza?: string | null
  clase?: string | null
  ataqueBase: EnciclopediaAtaqueBase
  /// Loadout saqueable (petición explícita, 2026-07-30: "que pueda marcar los objetos que me
  /// quiero quedar") — mismo dato crudo de NpcItem, contenido de catálogo (no depende de la
  /// partida), para que el modal de saqueo sepa de antemano qué lleva encima cada NPC.
  items: { name: string; cantidad: number; notas: string | null }[]
  /// Auditoría de Enciclopedia (2026-08-27) — probabilidades de interacción del sistema de
  /// compañeros y supervivencia (companionSupervivencia.ts), antes invisibles para el jugador.
  /// undefined cuando ninguna está calibrada (>0), para no añadir ruido al resto de NPCs.
  interaccion?: EnciclopediaInteraccion
}

export interface EnciclopediaInteraccion {
  comerciablePct: number
  reclutablePct: number
  domesticablePct: number
  capturablePct: number
  cortejablePct: number
  atributoResistencia: string | null
}

export interface EnciclopediaItemInfo {
  slug: string
  name: string
  /// Formas cortas/coloquiales de referirse al objeto (2026-07-30, auditoría "revisar partida" —
  /// linkability) — mismo campo que NPC/fauna, para que el texto clicable (enciclopediaIndex.ts)
  /// no dependa de que la narración use el nombre EXACTO y completo de catálogo.
  aliases: string[]
  category: string
  /// Categorización mecánica (2026-07-29) — ver itemTaxonomy.ts (backend) / ItemTipo (types.ts).
  tipo: ItemTipo
  description: string
  /// Mapa de bonificadores (2026-08-03, sustituye al par statBonusAttribute/statBonusAmount).
  statBonuses: Partial<Record<string, number>> | null
  /// Medidas físicas y lugar de origen (2026-07-22, "para los objetos sus medidas y su lugar de
  /// origen") — texto libre, null cuando el objeto no tiene un origen especial.
  dimensiones: string | null
  lugarOrigen: string | null
  /// Nivel de rareza/dificultad (1-5) y mínimos de atributo del PJ para equiparlo (sesión de
  /// diseño 2026-07-23) — null/undefined en objetos tier 1 sin requisito real.
  tier?: number
  requisitos?: Partial<Record<string, number>> | null
  /// Solo en `tipo: 'ESPECIAL'` (2026-08-03) — clave estable que un sistema concreto del frontend
  /// consulta (p.ej. MapaPanel.tsx) y texto explicando el efecto, para mostrar aparte de
  /// `description`. Ver comentario de ambos campos en schema.prisma (backend).
  effectKey?: string | null
  effectDescription?: string | null
  /// Auditoría de Enciclopedia (2026-08-27) — prefijos de oficio (sin raza/región, p.ej.
  /// "curtidor"/"desollador") para los que este objeto cuenta como herramienta requerida.
  herramientaParaOficio: string[]
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
  /// Enciclopedia progresiva (2026-07-23) — mencionado en narración O visto ya en el inventario.
  discovered: boolean
}

export interface EnciclopediaFaunaFloraInfo {
  sourceSlug: string
  sourceName: string
  aliases: string[]
  /// Mecánica real (ver harvest.ts): solo true si existe Npc con ficha de combate — no usar esto
  /// para decidir el icono/etiqueta de fauna vs flora, ver `esFauna`.
  cazable: boolean
  /// Bug real (2026-07-22): antes se usaba `cazable` como proxy de "es un animal" — Espina del
  /// Viento/Cornante/Sombra de Kroj son fauna de verdad sin ficha de combate propia, así que
  /// salían mal categorizados como flora/material. `esFauna` es la señal correcta para el icono.
  esFauna: boolean
  /// Zona de origen (2026-07-29, colapsables de fauna/flora por zona) — null si no hay ninguna
  /// señal real de región (fauna itinerante sin hogar fijo, o un lugarOrigen sin región reconocible).
  region: string | null
  /// Descripción física real (bio del Npc si es fauna cazable, o de harvestSourceDescriptions
  /// si es flora/mineral sin Npc propio) — null solo si de verdad no hay ninguna todavía.
  description: string | null
  yields: { itemName: string; cantidad: number; condicion: string | null }[]
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
  variantesSexo?: EnciclopediaSexoVariante[]
  /// Enciclopedia progresiva (2026-07-23) — true si ya se mencionó en narración/new_facts de
  /// esta partida.
  discovered: boolean
  /// Rediseño de la vista de combate (2026-07-28) — solo presentes si `cazable` (hay Npc real
  /// detrás): bloque de atributos, frase de ataque natural y hasta 6 habilidades raciales
  /// propias (categorizadas). Flora/mineral sin Npc propio no tiene ninguno de los cuatro.
  /// `level` (2026-07-29, indicador de dificultad antes de Combatir) — mismo campo que ya tenía
  /// `EnciclopediaNpcInfo`, para poder calcular la diferencia de nivel también contra fauna.
  level?: number | null
  attributes?: AttributeBlock | null
  ataqueNatural?: string | null
  habilidadesRaciales?: { icon: string; name: string; description: string; categoria: 'ataque' | 'defensa' | 'utilidad'; preferredAttribute: Attribute }[]
  ataqueBase: EnciclopediaAtaqueBase | null
  /// Auditoría de Enciclopedia (2026-08-27) — mismo campo que EnciclopediaNpcInfo, solo presente
  /// si `cazable` (hay Npc real detrás) y alguna probabilidad está calibrada.
  interaccion?: EnciclopediaInteraccion
}

// Día/noche/estación (2026-08-27, docs/rpgtarkor/imagenes-prompts.md) — a diferencia de
// EnciclopediaSexoVariante, sin texto curado: las 8 combinaciones son siempre las mismas para
// cualquier Location, el backend solo agrega imagePrompts/imageUrls propios de cada una.
// `mapaImagePrompt`/`mapaImageUrl` son el mapa de Zona de ESA combinación (entityType 'zona',
// sizeProfile 'mapa'), expuesto aquí junto al resto porque comparten el mismo selector en el modal.
export interface EnciclopediaTiempoVariante {
  momento: 'dia' | 'noche'
  estacion: 'primavera' | 'verano' | 'otono' | 'invierno'
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
  mapaImagePrompt: string | null
  mapaImageUrl: string | null
}

export interface EnciclopediaLocationInfo {
  slug: string
  name: string
  aliases: string[]
  region: string
  kind: string
  description: string
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
  /// Enciclopedia progresiva (2026-07-23) — gateado por `LocationVisit` (visita física real), no
  /// por mención en narración, eje independiente del resto de tipos.
  discovered: boolean
  /// Undefined en respuestas más ligeras que no traen esta sección (p.ej. `WorldLocationInfo` del
  /// mapa general, ver MapaPanel.tsx) — solo la Enciclopedia completa la rellena siempre.
  variantesTiempo?: EnciclopediaTiempoVariante[]
}

// Razas y personajes jugables de Berig (2026-07-22) — contenido estático servido por el backend
// (ver berigLore.ts) para que puedan tener prompts de imagen igual que NPCs/objetos/fauna.
export interface EnciclopediaRazaVariante {
  slug: string
  name: string
  shortLabel: string
  rasgoFisico: string
  description: string
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
  /// Sexo CRUZADO con esta variante regional (2026-07-22, "sí, cruzar para Orcos") — presente solo
  /// en las variantes de Orcos hoy; cada combinación región+sexo tiene su propia imagen.
  variantesSexo?: EnciclopediaSexoVariante[]
}

export interface EnciclopediaRazaInfo {
  slug: string
  name: string
  icon: string
  rasgoFisico: string
  rasgoCaracter: string
  description: string
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
  /// Variantes regionales (2026-07-22, "al pulsar orcos aun pudiese elegir el tipo según la
  /// región") — presente solo en Orcos hoy; cada variante tiene su propia imagen independiente.
  variantes?: EnciclopediaRazaVariante[]
  /// Sexo a nivel de RAZA GENERAL (2026-07-22) — eje independiente de `variantes` (región), nunca
  /// cruza con ella: no existe "Orcos de las Llanuras, macho" como combinación propia.
  variantesSexo?: EnciclopediaSexoVariante[]
  /// Rediseño de atributos (2026-07-29, tope de 10 habilidades de combate): 2 habilidades
  /// raciales por raza — una de ataque y una de defensa, compartidas por toda la raza (no por
  /// individuo). Un NPC humanoide con `raza` igual a este `slug` las muestra en su ficha de combate.
  habilidadesRaciales: {
    ataque: { icon: string; name: string; description: string; preferredAttribute: Attribute }
    defensa: { icon: string; name: string; description: string; preferredAttribute: Attribute }
  }
}

export interface EnciclopediaPersonajeInfo {
  slug: string
  name: string
  aliases?: string[]
  raza: string
  icon: string
  personalidad: string
  facultades: string
  historia: string
  voz: string
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
}

export interface EnciclopediaAbilityInfo {
  name: string
  icon: string
  description: string
  promptText: string
  category: 'combate' | 'general'
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
  /// Rediseño del turno de combate (2026-07-28) — "tipo" de la habilidad para el árbol de
  /// ventajas (attributeWheel.ts, backend) y su color en la UI.
  preferredAttribute: Attribute
  /// Bono fijo de atributo/efecto mecánico real (2026-08-30, bug: "las descripciones no muestran
  /// el efecto real") — ya viajaban en el JSON de esta ruta desde siempre (spread `...u.ability`
  /// en `world.ts` § `buildClassesSection`, backend), solo faltaba declararlos aquí para poder
  /// leerlos con tipos. Solo habilidades de CLASE los llevan — las raciales/genéricas no tienen
  /// ningún efecto mecánico más allá del atributo (`berigLore.ts`, diseño real, no una omisión).
  attributeBonus?: number
  effects?: AbilityEffect[]
}

/// Antepone el origen real del backend a una ruta relativa de imagen (p.ej. "/images/fauna/x.png")
/// — las EnciclopediaXxxInfo.imageUrls llegan siempre relativas porque las sirve @fastify/static,
/// no Vite. Null pasa a través tal cual, para poder encadenar `resolveImageUrl(x.imageUrls.banner)`
/// sin comprobar null antes en cada sitio de uso.
export function resolveImageUrl(path: string | null): string | null {
  return path ? `${API_URL}${path}` : null
}

export interface EnciclopediaClassUnlock {
  level: number
  /// Especialización dentro de la clase (2026-08-24, Grupo 3 § Sistema de clases) — el backend ya
  /// lo enviaba (buildClassesSection, world.ts), pero faltaba en este tipo. null hasta nivel 10
  /// (habilidades comunes a toda la clase); a partir de ahí, cada habilidad pertenece a una de las
  /// varias especializaciones posibles de esa clase (ver auditoría de Enciclopedia, 2026-08-27).
  especializacion: string | null
  ability: EnciclopediaAbilityInfo
}

// Guerrero y Cazador (2026-07-22, separadas en dos clases con árbol propio).
export interface EnciclopediaClassInfo {
  name: string
  description: string
  unlocks: EnciclopediaClassUnlock[]
}

export interface EnciclopediaConstructionRequirement {
  label: string
  cantidad: number
}

export interface EnciclopediaConstructionRecipe {
  key: string
  name: string
  description: string
  /// Slug de raza ('orcos'/'goirntes'/'nabieus'/'faerus') dueña de esta construcción, o null si
  /// es común a cualquiera (2026-07-23, "tiene que haber construcciones por raza... el campamento
  /// va a ser la construcción básica y común").
  raza: string | null
  /// Id de professions.ts, o null si no requiere oficio (Campamento, Ayuntamiento — "cualquiera
  /// puede intentarlo, no hace falta un gremio"). Sumado 2026-08-13 junto con `tier`: Habilidades
  /// ahora solo muestra lo ya desbloqueado, así que este es el único sitio que enseña el requisito
  /// de nivel de las recetas todavía bloqueadas.
  oficio: string | null
  /// Nivel de `oficio` que hace falta, o null si `oficio` es null.
  tier: number | null
  requirements: EnciclopediaConstructionRequirement[]
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
}

export interface EnciclopediaCraftingRecipe {
  key: string
  name: string
  description: string
  /// Id de professions.ts ('herrero-orco-llanuras'/'alquimista-orcos-llanuras'/'carpintero-orcos-
  /// llanuras'...), o null si está al alcance de cualquiera sin oficio (2026-08-06, sección
  /// "Crafteo" — mismo eje que `raza` en Construcciones, pero por oficio en vez de por raza).
  oficio: string | null
  /// Nivel de `oficio` que hace falta, o null si `oficio` es null. Sumado 2026-08-13, mismo motivo
  /// que en EnciclopediaConstructionRecipe (arriba).
  tier: number | null
  /// Mismo shape que EnciclopediaConstructionRequirement (backend: IngredientRequirement
  /// compartido entre crafting.ts/construction.ts) — reutilizado tal cual, no duplicado.
  requirements: EnciclopediaConstructionRequirement[]
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
}

export interface EnciclopediaFaccionInfo {
  slug: string
  name: string
  raza: string
  description: string
  discovered: boolean
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
}

export interface EnciclopediaHistoriaInfo {
  slug: string
  title: string
  era: 'comun' | 'semillas'
  /// null en era 'semillas' (mítica, sin fechar) — con año en era 'comun', usado para agrupar en
  /// bloques de 500 años.
  year: number | null
  requiresTranslation: boolean
  discovered: boolean
  /// Computado en el backend: discovered && (!requiresTranslation || traductor descubierto).
  unlocked: boolean
  /// null si !unlocked — el backend nunca manda el texto real sin desbloquear (2026-08-06,
  /// mecanismo "escrito en el idioma de las Semillas").
  text: string | null
  /// Igual que `text`: { thumbnail: null, banner: null } mientras !unlocked — ni el prompt ni la
  /// imagen viajan antes de tiempo (mostrar una escena sería otra forma de fugar el contenido).
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
}

/// Enciclopedia § "Combate" (2026-08-15, petición explícita: "expliquemos con claridad las
/// mecánicas de las tiradas y cómo funcionan los combates") — mismo patrón que Razas/Clases:
/// contenido estático, sin gateo de descubrimiento (documentación de reglas, no lore secreto).
export interface EnciclopediaCombateInfo {
  slug: string
  icon: string
  title: string
  text: string
}

export interface EnciclopediaResponse {
  npcs: EnciclopediaNpcInfo[]
  items: EnciclopediaItemInfo[]
  faunaFlora: EnciclopediaFaunaFloraInfo[]
  locations: EnciclopediaLocationInfo[]
  razas: EnciclopediaRazaInfo[]
  personajes: EnciclopediaPersonajeInfo[]
  classes: EnciclopediaClassInfo[]
  constructionRecipes: EnciclopediaConstructionRecipe[]
  craftingRecipes: EnciclopediaCraftingRecipe[]
  factions: EnciclopediaFaccionInfo[]
  historia: EnciclopediaHistoriaInfo[]
  combate: EnciclopediaCombateInfo[]
}

/// `saveId` (2026-07-23, enciclopedia progresiva) — gatea NPCs/fauna/flora/objetos/lugares por lo
/// ya descubierto en ESTA partida; sin él, todo sale `discovered: true` (comportamiento de
/// siempre, p.ej. si algún día se navega el catálogo fuera del contexto de una partida concreta).
export async function getEnciclopedia(worldSlug: string, saveId?: string | null): Promise<EnciclopediaResponse> {
  const query = saveId ? `?saveId=${encodeURIComponent(saveId)}` : ''
  return fetchJson(`${API_URL}/world/${worldSlug}/enciclopedia${query}`)
}

// 'faction'/'historia' (2026-08-06) — mismo literal que el backend, ver imagePromptGenerator.ts.
// 'zona' (2026-08-26) — imágenes propias del panel Zona (banner/miniatura/mapa pintados a mano),
// separadas del banner/miniatura fotorrealista que la misma ubicación ya tiene bajo 'location'.
export type ImagePromptEntityType = 'npc' | 'item' | 'fauna' | 'ability' | 'raza' | 'personaje' | 'location' | 'construccion' | 'faction' | 'historia' | 'crafteo' | 'zona'
/// 'thumbnail' = icono cuadrado de la cuadrícula (EntryCard), 'banner' = MediaSlot ancho del
/// detalle (~3:1, medido contra la UI real), 'mapa' = fondo del panel Zona (800x600, solo
/// entityType 'zona') — ver imagePromptGenerator.ts en el backend.
export type ImagePromptSizeProfile = 'thumbnail' | 'banner' | 'mapa'

export interface ImagePromptResult {
  prompt: string
  provider: string
  cached: boolean
}

/// Genera (o recupera de caché) el prompt de imagen de UNA entidad y UN perfil de talla concretos
/// — bajo demanda, 1 a 1 (checklist 2026-07-21/22, punto 7: "no que genere todos los prompts a la
/// vez"). Como mucho una llamada real a un proveedor cloud por invocación. `regenerate` (petición
/// explícita de la usuaria, 2026-07-22): salta el caché y sobrescribe el prompt existente con la
/// info actual de esa entrada — para cuando el lore cambió después de generarlo la primera vez.
export async function requestImagePrompt(
  worldSlug: string,
  entityType: ImagePromptEntityType,
  entitySlug: string,
  sizeProfile: ImagePromptSizeProfile,
  regenerate?: boolean,
): Promise<ImagePromptResult> {
  return fetchJson(`${API_URL}/world/${worldSlug}/image-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityType, entitySlug, sizeProfile, regenerate }),
  })
}

export async function getWorldLocations(worldSlug: string): Promise<WorldLocationsResponse> {
  return fetchJson(`${API_URL}/world/${worldSlug}/locations`)
}
