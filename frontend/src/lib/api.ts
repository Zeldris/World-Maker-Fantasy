import type {
  MetodoObtencion,
  RiesgoCazaInfo,
  AbilityEffect,
  ActiveEffect,
  AlmacenItemInfo,
  Attribute,
  AttributeBlock,
  AgendaEntryInfo,
  EntornoTemporalInfo,
  BuildingInfo,
  Clase,
  CombatExchangeInfo,
  CompanionInfo,
  CondicionFisica,
  CurrentLocationInfo,
  DestinationInfo,
  Dificultad,
  Especializacion,
  EquipSlot,
  EstacionKey,
  InitiativeRollInfo,
  InventoryItemInfo,
  ItemTipo,
  KingdomFoundedInfo,
  KingdomStatsInfo,
  LogEntry,
  LogEntryRoll,
  NpcInSceneInfo,
  SegundaTiradaInfo,
  TiradaGrupoInfo,
  CazaSigiloRoll,
  CombateGrupoLogRoll,
  IniciativaEncuentroLogRoll,
  RecoleccionLogRoll,
  HarvestSourceCandidate,
  GatheringRollInfo,
  ParcelaDetailInfo,
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
  SkillBarInfo,
  SecondaryAttributeBlock,
  SessionSummaryInfo,
  SubjectInfo,
  TerritoryInfo,
  ZonaParcelaInfo,
} from '../types'

// VITE_API_URL permite apuntar a otro backend (staging, otra máquina) sin tocar código;
// localhost:3001 sigue siendo el valor por defecto para desarrollo local.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

/// P229: el backend contestó con un error HTTP (5xx…): no es un corte de red, así que no hay nada
/// resolviéndose en segundo plano que sondear (useTurnFlow no cae al sondeo de reconexión).
export class BackendHttpError extends Error {
  readonly httpStatus: number
  constructor(httpStatus: number) {
    super(`El backend respondió ${httpStatus}`)
    this.name = 'BackendHttpError'
    this.httpStatus = httpStatus
  }
}

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

// Viaje resuelto por el grafo de ubicaciones (docs/mecanicas/12-mundo-estructurado.md § 1.4) — opaco para
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
  // Validador de "grounding" de la acción del jugador (docs/mecanicas/18-validacion-accion-jugador.md) —
  // presente cuando el backend rechazó la acción de raíz (p. ej. reclamar un arma que no lleva
  // encima) y ya persistió una frase determinista en el log. El turno queda resuelto aquí mismo:
  // no hace falta (ni se debe) llamar a /turn/narrate.
  // `harvestSuggestion` (Pieza 6d, 2026-09-03, "mundo determinista"): presente solo cuando el
  // bloqueo fue por citar una fuente real de recolección de terreno por texto libre en vez de usar
  // la habilidad — botón real que abre HarvestSelectionModal con la fuente ya priorizada.
  /// QA-73: `logEntry` es la respuesta bloqueada tal como la guardó el backend.
  blocked?: { narration: string; harvestSuggestion?: { sourceName: string }; logEntry: LogEntry }
  // Interacción con un NPC/fauna ya convaleciente o muerto, fuera de combate (docs/19-post-combate-
  // y-recompensas-mision.md pieza 2) — el turno tampoco llega a /turn/narrate aquí, pero a
  // diferencia de `blocked` no es una violación: el frontend abre el panel mecánico (Saquear/
  // Decapitar/Salir) en vez de mostrar ningún texto.
  postCombatInteraction?: PostCombatInteractionInfo
  // B29 (2026-09-29) — "Ataco al X" con la fauna nombrada en la celda del jugador o adyacente: el
  // backend ya persistió la acción y arrancó la caza (`iniciarCaza`, igual que "Cazar" en la tarjeta).
  // Mismo tratamiento de resultado que `cazarEnZona` (`handleHuntResolved`); tampoco llega a /turn/narrate.
  cazaPorTexto?: ConfirmarCazaResultado
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
  /// P164: viaje elegido en el mapa (salida o «Viajar»); el texto escrito a pie no cambia de zona.
  viajeElegido?: boolean
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
    throw new BackendHttpError(response.status)
  }

  return response.json()
}

/// Una entrada del diario tras la narración del turno (ver `intercambiosExtra`).
export interface LineaDelTurno {
  logEntryId: string
  text: string
  /// Del combate (fondo rojo): ataques de más y golpes gratis. Las respuestas viejas no lo traen.
  combate?: boolean
  combatExchange?: CombatExchangeInfo
  esSubidaDeNivel?: boolean
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
  /// Habilidad "Comer/Beber" (2026-09-04) — % de Hambre/Sed tras este turno, mismo criterio que
  /// `energia`/`energiaMax`: listos para actualizar las barras sin recalcular nada en el cliente.
  hambre: number
  sed: number
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
  /// Menú contextual de interacción con NPC (2026-09-06) — igual que `newQuestOfferInfo`: solo para
  /// NPC con `interactionTypes` no vacío en catálogo, al detectarse diálogo con ellos. `null` en la
  /// inmensa mayoría de turnos.
  npcInteractionOffer: { npcSlug: string; npcName: string; options: string[] } | null
  /// "Modo dinámico" (2026-08-27, Pieza 4 de "Dinamismo del mundo") — oferta opcional de un botón
  /// "Interactuar" al FINAL de este turno (nunca lo interrumpe). El motor ya decidió determinista
  /// el candidato; la narración de la primera vuelta ocurre al pulsar Interactuar
  /// (`POST /saves/:id/modo-dinamico/interactuar`), no aquí. `null` en la inmensa mayoría de turnos.
  dynamicModeOffer: { tipo: 'NPC' | 'FAUNA'; targetSlug: string; targetName: string } | null
  /// P167 (QA-27): el turno dejó respondida la oferta pacífica que había; su tarjeta pierde los botones.
  ofertaDescartada?: true
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
  /// Feedback de UX (2026-09-04, misma petición que `factionRepChange` de arriba, ver auditoría
  /// "representar siempre XP/profesión/reputación") — crafteo/construcción exitosos con oficio
  /// asignado ya subían XP/nivel de oficio de verdad, pero el delta nunca llegaba estructurado al
  /// frontend. `[]` en la inmensa mayoría de turnos, que no craftean/construyen nada con oficio.
  professionXpGains: { oficio: string; xpDelta: number; newLevel: number; leveledUp: boolean }[]
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
  /// Entradas del diario que siguen a la narración, en el orden en que se guardaron (P117/QA-70):
  /// subida de nivel, desbloqueos, ataques de más de un combate de grupo (P55), golpes gratis y brújula.
  /// Opcional: un backend viejo no lo manda.
  intercambiosExtra?: LineaDelTurno[]
  /// Rediseño del turno de combate (2026-07-29, "quiero que sea más claro cuando es turno de
  /// ataque... indicándome qué salió en los dados"): tirada real de iniciativa que decidió quién
  /// actúa en el PRÓXIMO intercambio. null si se forzó sin dados (aturdimiento/intimidación) o si
  /// no hubo intercambio de combate este turno.
  nextInitiativeRoll: InitiativeRollInfo | null
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
  /// CR-49: `esPersona` = un caído que se saquea pero no se despelleja.
  combatEncounterLootSummary: { npcId: string; slug: string; name: string; cantidad: number; esPersona?: boolean }[] | null
  /// Hallazgo 38 (revisar-partida-hallazgos.md 2026-09-07) — slug de la Location cuando ESTE turno
  /// es la primera visita real al destino de un viaje. `null` en la inmensa mayoría de turnos. El
  /// banner del log hoy lo decide el frontend por prioridad de mención en el TEXTO de la narración
  /// (`mentionedEntityBanner.ts`) — un turno de llegada que también menciona a un NPC presente
  /// perdía el banner de la Location (prioridad NPC > Location). Con esto, `buildEntityBanner`
  /// puede forzar el banner de la Location con prioridad absoluta cuando hay descubrimiento real.
  discoveredLocationSlug: string | null
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
    /// Panel "Comer/Beber" (2026-09-04) — ver el mismo campo en turnResolution.ts
    /// (NarrateAndPersistParams.hambreSedItemUses). El viejo `beberAgua` se retiró con el
    /// hallazgo 13 (revisar-partida-hallazgos.md 2026-09-06).
    hambreSedItemUses?: { itemId: string; quantity: number }[]
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

/// Fase D del hito 0.1 — entradas de "El mundo" posteriores a `desde` (id de la última WORLD que ya tiene
/// el cliente): noticias que el tick de fondo escribe mientras la partida está abierta.
/// CR-46: una expedición que el personaje puede ver en el mapa de Berig.
export interface ExpedicionEnMapa {
  id: string
  faccion: string
  oficio: string
  motivo: string | null
  origenSlug: string
  destinoSlug: string
  destinoNombre: string
  diaRegreso: number
  /// 0-1 del viaje: hasta 0,5 va, después vuelve.
  progreso: number
  delReino: boolean
  /// CR-65 (Q5): un asalto que se ve desde una Torre de vigía.
  hostil?: boolean
}

/// CR-65 (Q9): lugares que vigila la Torre de cada asentamiento.
export interface AlcanceTorre {
  asentamiento: string
  slugs: string[]
}
export async function getExpedicionesMapa(saveId: string): Promise<{ expediciones: ExpedicionEnMapa[]; alcances?: AlcanceTorre[]; campamentos?: CampamentoInfo[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/expediciones/mapa`)
}

export async function getNuevasDelMundo(saveId: string, desde: string): Promise<{ entradas: LogEntry[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/mundo/nuevas?desde=${encodeURIComponent(desde)}`)
}

/// CR-34 (34e): aceptar o rechazar la propuesta de tratado o alianza de una facción al Reino.
export async function responderPropuesta(saveId: string, propuestaId: string, acepta: boolean): Promise<{ respuesta: 'ACEPTADA' | 'RECHAZADA' }> {
  return fetchJson(`${API_URL}/saves/${saveId}/mundo/propuestas/${encodeURIComponent(propuestaId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acepta }),
  })
}

export async function requestSurroundings(params: { saveId: string }, signal?: AbortSignal): Promise<EntornoResponse> {
  return fetchJson(`${API_URL}/entorno`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
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
  /// Sistema de clases (2026-08-24) — `raza` es un slug libre de BERIG_RAZAS (berigLore.ts,
  /// backend), null si el personaje no tiene raza asignada. `clase`/`especializacion` null hasta
  /// que se fijen jugando (`PATCH /saves/:id/clase` y `/especializacion`).
  raza: string | null
  clase: Clase | null
  especializacion: Especializacion | null
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
  /// Moneda "Goirno" (2026-08-31, "Trabajador de Reino") — moneda única de Berig.
  goirnos: number
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
  /// Barras de habilidades múltiples fuera de combate (2026-09-04) — siempre al menos la barra
  /// base (slotIndex 0) de cada categoría, garantizada por el backend en lectura.
  skillBars: SkillBarInfo[]
  /// Qué barra se ve ahora mismo en el HUD del composer — null = texto libre.
  activeSkillBarId: string | null
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
  pendingDynamicModeOffer:
    | {
        tipo: 'NPC' | 'FAUNA' | 'RECURSO'
        targetSlug: string
        targetName: string
        quienInicia?: 'jugador' | 'npc'
        combateForzado?: true
        /// Grupos de fauna reales (Fase 1, 2026-09-28) — ver `MoverZonaResultado.dynamicModeOffer`.
        zonePointId?: string
        cantidad?: number
        /// Aviso de riesgo de Cazar (F9-1, 2026-09-29) — ver `RiesgoCazaInfo`, types.ts.
        riesgoCaza?: RiesgoCazaInfo
        /// Método de la fuente (RECURSO, 2026-09-29) — ver `dynamicModeOffer.metodo`, types.ts.
        metodo?: MetodoObtencion | null
      }
    | null
  /// Oferta de misión SIN aceptar todavía (bug real jugando en vivo, 2026-09-03, "misión de
  /// apertura no sobrevive a un F5") — mismo criterio exacto que `pendingDynamicModeOffer`: la
  /// tarjeta "MISIÓN PROPUESTA" reconstruida tras F5 en vez de vivir solo en `characterLog`.
  pendingQuestOfferInfo: { title: string; description: string } | null
  /// Menú contextual de interacción con NPC SIN resolver todavía (2026-09-06, "Aprender oficio"
  /// deja de depender de una habilidad suelta) — mismo criterio exacto que `pendingQuestOfferInfo`:
  /// tarjeta reconstruida tras F5 en vez de vivir solo en `characterLog`.
  pendingNpcInteractionOffer: { npcSlug: string; npcName: string; options: string[]; desdeEncuentro?: boolean } | null
  /// Ataque enemigo pendiente de defensa en el combate 1v1 clásico (bug real 2026-08-28/29,
  /// "recargar mientras el enemigo tiene la iniciativa rompe el turno"): `Save.pendingNpcAttack`
  /// ya persistía bien en el backend, pero nunca viajaba en `GET /saves/:id` — tras F5,
  /// `combatAwaitingDefense` (solo `useState` en memoria) volvía a `false` y el panel de combate
  /// mostraba el catálogo de ATAQUE en vez de DEFENSA, aunque el backend siguiera esperando una
  /// defensa de verdad. Mismo criterio que `combateIniciado`/`lastInitiativeRoll` arriba: se
  /// reconstruye en cada resincronización, no solo en la respuesta directa de `/turn/narrate`.
  esperandoDefensaJugador: boolean
  /// Elección obligatoria de especialización a nivel 10 (2026-09-01) — `true` mientras haya clase
  /// asignada, nivel ≥10 y ninguna especialización elegida todavía. Mismo criterio que
  /// `pendingDeathResolution`: mientras sea `true`, el composer normal se sustituye por el modal
  /// de especialización (ver GameView.tsx) hasta que se resuelva con `assignEspecializacion`.
  pendingEspecializacionChoice: boolean
  /// Solo presente cuando `pendingEspecializacionChoice` es `true` — una tarjeta por
  /// especialización real de la clase (`especializacionesConHuecosPara`, backend), con un resumen
  /// mecánico corto derivado de sus habilidades reales (nunca lore inventado).
  especializacionesDisponibles?: { especializacion: Especializacion; resumenMecanico: string; iconoUrl: string | null }[]
  /// Elección obligatoria de clase al empezar a jugar (2026-09-01, fix de bug real: un personaje
  /// custom se quedaba con `clase: null` para siempre — `PATCH /saves/:id/clase` existía pero
  /// ningún punto de la UI lo llamaba). `true` mientras `clase` sea `null`. Mismo criterio que
  /// `pendingEspecializacionChoice`: bloquea el composer hasta resolver.
  pendingClaseChoice: boolean
  /// Solo presente cuando `pendingClaseChoice` es `true` — filtradas por raza (clases exclusivas
  /// de raza, ver `clasesPermitidasParaRaza` en el backend), Mago excluido (sin tronco real).
  clasesDisponibles?: { clase: Clase; resumenMecanico: string; iconoUrl: string | null }[]
}

export async function getSave(id: string): Promise<SaveDetail> {
  return fetchJson(`${API_URL}/saves/${id}`)
}

/// P219 (c): condición, Hambre y Sed para el sondeo del HUD, sin la partida entera.
export async function getSupervivencia(id: string): Promise<Pick<SaveDetail, 'condicionFisica' | 'hambre' | 'sed'>> {
  return fetchJson(`${API_URL}/saves/${id}/supervivencia`)
}

export interface SaveSummary {
  id: string
  worldId: string
  worldName: string
  characterName: string
  /// Nombre editable de la partida (2026-09-06) — null = usa el título por defecto
  /// "characterName — worldName" en el frontend.
  saveName: string | null
  fictionalDate: string
  lastPlayedAt: string
  dificultad: Dificultad
  /// Versión del juego (`A.P.C-etapa+commit`) con la que se creó / se jugó por última vez —
  /// null en partidas anteriores al versionado.
  versionCreada: string | null
  versionUltimaPartida: string | null
  endedAt: string | null
}

/// CR-12 (hito 0.2) — «Ritmo del mundo» de la partida: cuánto pasa en el mundo por sí solo.
export type EstiloNarrador = 'TRANQUILO' | 'EQUILIBRADO' | 'CAOTICO'

/// CR-67: intensidad de los asaltos (nunca los quita) y cuántos manda un atacante (Fácil = la mitad).
export type IntensidadAsaltos = 'CONTENIDA' | 'NORMAL' | 'DURA'
export type TamanoAsaltos = 'FACIL' | 'NORMAL'
export interface RitmoMundo {
  estiloNarrador: EstiloNarrador
  intensidadAsaltos: IntensidadAsaltos
  tamanoAsaltos: TamanoAsaltos
}

export async function getRitmoMundo(id: string): Promise<RitmoMundo> {
  return fetchJson(`${API_URL}/saves/${id}/ritmo`)
}

export async function setRitmoMundo(id: string, cambios: Partial<RitmoMundo>): Promise<Partial<RitmoMundo>> {
  return fetchJson(`${API_URL}/saves/${id}/ritmo`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  })
}

export async function updateSaveName(id: string, saveName: string | null): Promise<{ saveName: string | null }> {
  return fetchJson(`${API_URL}/saves/${id}/name`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ saveName }),
  })
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

// Cerrar el combate al pulsar "Salir" en la pantalla de victoria/derrota (bug real 2026-09-04/05):
// sin esto, `pendingCombatNpcSlugs` seguía sucio en el backend tras Matar+Saquear, bloqueando el
// composer para siempre en la siguiente recarga. El backend valida que no quede nada pendiente de
// verdad (409 si sí) antes de vaciar el array — el frontend solo lo llama, no decide.
export async function requestCerrarCombate(id: string): Promise<void> {
  await fetchJson(`${API_URL}/saves/${id}/combat/cerrar`, { method: 'POST' })
}

// Huir antes de entrar al combate (2026-07-24) — una sola tirada determinista en el backend, sin
// IA: `escaped` decide si el frontend limpia el aviso de "Combatir" o abre el popup igualmente.
// `roll` (2026-08-30, bug real: 3 intentos seguidos narraban la misma frase fija sin ningún
// desglose) — se pinta con RollBadge, igual que cualquier otra tirada del juego.
/// QA-73: `logEntry` es la entrada que guardó el backend (la misma que se ve tras recargar).
export async function requestFlee(id: string): Promise<{ escaped: boolean; logEntry: LogEntry }> {
  return fetchJson(`${API_URL}/saves/${id}/combat/flee`, { method: 'POST' })
}

// Huir DENTRO de un combate ya iniciado (ronda de correcciones 2026-08-28, P3.2) — misma tirada
// determinista que requestFlee, pero un fallo aplica un golpe directo real (sin tirada de
// defensa): `condicionFisica` viene ya actualizada en la respuesta.
export async function requestHuirEnCurso(
  id: string,
): Promise<{ escaped: boolean; condicionFisica: string; logEntry: LogEntry }> {
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

// Elección obligatoria de especialización a nivel 10 (2026-09-01) — decisión única, el backend
// rechaza con 409 si ya hay especialización asignada; el mensaje ya llega listo para mostrar tal
// cual (ver fetchJson).
export async function assignEspecializacion(id: string, especializacion: Especializacion): Promise<{ especializacion: Especializacion }> {
  return fetchJson(`${API_URL}/saves/${id}/especializacion`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ especializacion }),
  })
}

// Elección obligatoria de clase al empezar a jugar (2026-09-01, fix de bug real: personaje custom
// se quedaba sin clase para siempre) — decisión única, mismo criterio que assignEspecializacion.
export async function assignClase(id: string, clase: Clase): Promise<{ clase: Clase }> {
  return fetchJson(`${API_URL}/saves/${id}/clase`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clase }),
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

/// Barras de habilidades múltiples fuera de combate (2026-09-04, rediseñado 2026-09-06 — hallazgo
/// 10: sin categoría propia, ver SkillBarInfo) — mismo criterio que el cinturón de combate: el
/// cliente manda el estado final ya decidido, el backend sanea y persiste.
export async function createSkillBar(id: string): Promise<SkillBarInfo> {
  return fetchJson(`${API_URL}/saves/${id}/skill-bars`, { method: 'POST' })
}

export async function updateSkillBar(id: string, barId: string, params: { name?: string; abilityNames?: string[] }): Promise<SkillBarInfo> {
  return fetchJson(`${API_URL}/saves/${id}/skill-bars/${barId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export async function deleteSkillBar(id: string, barId: string): Promise<void> {
  return fetchJson(`${API_URL}/saves/${id}/skill-bars/${barId}`, { method: 'DELETE' })
}

export async function setActiveSkillBar(id: string, skillBarId: string | null): Promise<{ activeSkillBarId: string | null }> {
  return fetchJson(`${API_URL}/saves/${id}/active-skill-bar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillBarId }),
  })
}

/// Grupos de combate (2026-09-08) — el Grupo 1 (slotIndex 0) siempre existe implícitamente con el
/// PJ a la cabeza; los demás se crean/renombran/borran igual que las barras de habilidades.
export interface CombatGroupInfo {
  slotIndex: number
  name: string
  esBase: boolean
  companions: { id: string; name: string; tipo: 'FAUNA' | 'NPC'; sourceSlug: string | null; condicionFisica: CondicionFisica | null; combatGroupSlotIndex: number }[]
}

export async function getCombatGroups(id: string): Promise<{ groups: CombatGroupInfo[] }> {
  return fetchJson(`${API_URL}/saves/${id}/combat-groups`)
}

export async function createCombatGroup(id: string): Promise<{ slotIndex: number; name: string }> {
  return fetchJson(`${API_URL}/saves/${id}/combat-groups`, { method: 'POST' })
}

export async function renameCombatGroup(id: string, slotIndex: number, name: string): Promise<{ slotIndex: number; name: string }> {
  return fetchJson(`${API_URL}/saves/${id}/combat-groups/${slotIndex}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export async function deleteCombatGroup(id: string, slotIndex: number): Promise<void> {
  return fetchJson(`${API_URL}/saves/${id}/combat-groups/${slotIndex}`, { method: 'DELETE' })
}

export async function moveCompanionToCombatGroup(id: string, companionId: string, combatGroupSlotIndex: number): Promise<{ id: string; combatGroupSlotIndex: number }> {
  return fetchJson(`${API_URL}/saves/${id}/companeros/${companionId}/grupo`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ combatGroupSlotIndex }),
  })
}

/// "Descansar en campamento" (2026-09-08) — solo disponible con un Building propio ACTIVO en la
/// Location actual (mismo criterio que fija el punto de guardado real). GET consulta visibilidad
/// sin mutar nada; POST ejecuta el salto a las 08:00 del día siguiente, guarda partida y cura hasta
/// HERIDO como techo.
export async function getDescansarCampamentoDisponible(id: string): Promise<{ disponible: boolean }> {
  return fetchJson(`${API_URL}/saves/${id}/descansar-campamento`)
}

export async function postDescansarCampamento(id: string): Promise<{ condicionFisica: CondicionFisica; timeLabel: string; logEntry: LogEntry }> {
  return fetchJson(`${API_URL}/saves/${id}/descansar-campamento`, { method: 'POST' })
}

export async function setItemSlot(id: string, itemId: string, slot: EquipSlot | null): Promise<void> {
  return fetchJson(`${API_URL}/saves/${id}/inventario/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot }),
  })
}

/// "Tirar" un objeto al suelo de la Zona actual (2026-09-06, hallazgo 8) — queda como pin en el
/// mapa de Zona (`ZonaDinamicoInfo`, tipo 'OBJETO') hasta que alguien lo recoja con
/// `recogerDroppedItem`.
export async function tirarItem(id: string, itemId: string): Promise<{ itemName: string; logEntry: { id: string; text: string; timeLabel: string; createdAt: string } }> {
  return fetchJson(`${API_URL}/saves/${id}/inventario/${itemId}/tirar`, { method: 'POST' })
}

export async function recogerDroppedItem(id: string, droppedItemId: string): Promise<{ itemName: string; logEntry: { id: string; text: string; timeLabel: string; createdAt: string } }> {
  return fetchJson(`${API_URL}/saves/${id}/dropped-items/${droppedItemId}/recoger`, { method: 'POST' })
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

/// Campos de calendario compartidos por entradas y capítulos (2026-09-04, Diario en pestañas
/// jerárquicas Año → Estación → Día) — `calendarioFor` (worldClock.ts backend) resuelve los tres
/// desde `fictionalMinutes`; `diaRelativo` es el día DENTRO de la estación (1-30), distinto del
/// `day` absoluto de partida.
interface DiarioCalendario {
  year: number
  estacion: EstacionKey
  diaRelativo: number
}

export interface DiarioEntry extends DiarioCalendario {
  kind: 'entry'
  id: string
  channel: LogEntry['channel']
  text: string
  timeLabel: string
  roll?: LogEntryRoll
  isPlayerAction?: boolean
  xpDelta?: number
  /// Desglose de `xpDelta` (UX 2026-09-01) — ver el mismo campo en `LogEntry` (types.ts).
  xpHitoDelta?: number
  xpHitoLabel?: string
  createdAt: string
  /// Día de ficción real (1-indexado, ver worldClock.ts) — absoluto de partida, distinto de
  /// `diaRelativo`. Nunca lleva banner de entidad: el Diario es solo texto por diseño.
  day: number
}

/// Capítulo con fecha real ya resuelta (2026-09-04) — antes vivía aparte, sin fecha, en `chapters`
/// (GET /saves/:id). Ahora se intercala dentro de la pestaña de Día que le corresponde.
export interface DiarioChapterEntry extends DiarioCalendario {
  kind: 'chapter'
  chapterNumber: number
  summary: string
  createdAt: string
}

export type DiarioItem = DiarioEntry | DiarioChapterEntry

export interface DiarioResponse {
  entries: DiarioItem[]
  /// Capítulos generados ANTES de que `SessionSummary` guardara `fictionalMinutes` (legado) — sin
  /// fecha real, no se les inventa una Año/Día falso, se muestran aparte.
  unplacedChapters: SessionSummaryInfo[]
}

/// Historial completo de la partida, agrupado por día de ficción (rework 2026-07-24: "el log de
/// personaje solo muestre 24h... si quieres verlo todo vendrá clasificado por días en el diario").
/// Fetch aparte y solo bajo demanda (se llama al abrir la pestaña Diario) — GET /saves/:id ya no
/// carga esto para no sobrecargar la petición que se repite en cada carga de partida.
export async function getDiario(saveId: string): Promise<DiarioResponse> {
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
  /// P172: `factionRepChange`, si alguien del bando dueño te vio llevártelo (su aviso, como en un turno).
  logEntry: { id: string; text: string; timeLabel: string; createdAt: string; roll?: RecoleccionLogRoll; factionRepChange?: { faction: string; delta: number; newValue: number } } | null
  /// Fase 10 (2026-09-29) — segunda tirada de tier alto por objeto afectado (también dentro de
  /// `logEntry.roll.segundas`); llega aunque `logEntry` sea null (todas las segundas fallaron).
  segundasTiradas?: SegundaTiradaInfo[]
  /// P161 (QA-27): energía tras recolectar, si recuperó algo con el rato que pasó.
  energia?: number
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
/// P164: `montura` (CR-57): sin ella, la lista se ve pero no se puede ir directo (`motivoSinMontura`).
export async function getDestinosViaje(saveId: string): Promise<{ hasMap: boolean; montura?: boolean; motivoSinMontura?: string; destinations: TravelDestinationInfo[] }> {
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

/// Grupo 3 § Mundo determinista, Capa 1 (2026-08-25, docs/rpgtarkor/lore-mundo/mundo-determinista.md) — zonas
/// navegables, prototipo en una sola zona. `disponible: false` cuando la Location actual no tiene
/// ningún ZonePoint sembrado todavía (el resto de zonas, hasta que se repita el prototipo) —
/// el frontend debe ocultar el panel en ese caso, no mostrarlo vacío.
export interface ZonePointInfo {
  id: string
  x: number
  y: number
  tipo: 'FAUNA' | 'RECURSO' | 'NPC' | 'EDIFICIO'
  targetSlug: string
  /// Hallazgo 34 (revisar-partida-hallazgos.md 2026-09-07) — `'???'` en vez del nombre real cuando
  /// `!descubierto` (backend ya lo resuelve, cruzando `DiscoveredEntity`).
  nombre: string
  /// Instancia viva (2026-08-27, Pieza 3 de "Dinamismo del mundo") — cuántos individuos reales
  /// representa este punto (agrupación por población regional real vía `WorldPopulation`), y su
  /// color por reputación con `factionSlug` (verde/amarillo/rojo; sin facción = naranja; RECURSO,
  /// que nunca tiene facción por diseño, = gris (`INERTE`), no naranja — 2026-09-09, ver
  /// `zonePointColorFor`, backend).
  cantidad: number
  color: 'ALIADO' | 'NEUTRO' | 'ENEMIGO' | 'SIN_FACCION' | 'INERTE'
  /// P176 (QA-27): de quién es (solo los edificios).
  faccion?: string
  /// Hallazgo 34 (2026-09-07) — false si la partida todavía no lo ha descubierto en la ficción
  /// (`DiscoveredEntity`); el modal de detalle debe ocultar "Ver en la Enciclopedia" en ese caso,
  /// aunque exista ficha real. `EDIFICIO` siempre `true` (nunca tiene ficha que ocultar).
  descubierto: boolean
  /// ZON-50/ZON-33 (hito 0.2): te perseguiría si te acercas (agresivo o enemigo por tu reputación).
  /// Solo viene a true si ya está descubierto (decisión de la usuaria: lo desconocido sorprende).
  hostil?: boolean
  /// ZON-53: su patrulla (puntos del lienzo, en bucle), solo si ya está descubierto.
  ruta?: { x: number; y: number }[]
  /// ZON-58/ZON-16: recurso recolectado aquí hace poco o sin población (se ve agotado), y nivel de
  /// oficio que pide si el tuyo no llega (candado). Solo en recursos ya descubiertos.
  agotado?: boolean
  nivelRequerido?: number
  /// Compañero de fauna con nombre propio (auditoría de lore 2026-09-13, C10 — "los compañeros de
  /// npc deben formar un mismo punto en el mapa de zona... se mueven como 1"). Presente solo en
  /// puntos `tipo: 'NPC'` cuyo dueño tiene un `Npc.companionOfNpcSlug` apuntándole — el companion
  /// EN SÍ nunca tiene `ZonePoint` propio (backend lo resuelve por el slug inverso). El frontend
  /// pinta un icono de grupo distinto y abre un modal de desglose en vez del modal normal de un
  /// solo NPC cuando este campo está presente.
  companion?: { slug: string; nombre: string }
  /// P106 (QA-27): objetivo de una misión activa (aunque siga sin descubrir).
  objetivoMision?: boolean
}
/// NPCs presentados de forma determinista (2026-08-26, "no aparecen en la zona y sí tienen que
/// salir") — a diferencia de `ZonePointInfo` (catálogo fijo, con posición real curada), estos
/// vienen de lo que la propia partida va estableciendo (`detectNpcsInScene`).
export interface ZonaDinamicoInfo {
  slug: string
  nombre: string
  tipo: 'NPC' | 'FAUNA' | 'OBJETO' | 'CADAVER'
  /// Color por reputación con la facción del NPC (2026-09-04) — mismo criterio y mismos valores que
  /// `ZonePointInfo.color` (`zonePointColorFor`, backend), para que la lista "Presentes ahora" deje
  /// de usar un punto marrón fijo sin relación con el resto del mapa. `INERTE` (2026-09-09) solo lo
  /// usa `tipo: 'OBJETO'` (un objeto tirado nunca tiene facción por diseño) — `NPC`/`FAUNA` aquí
  /// siguen cayendo en `SIN_FACCION` como siempre.
  color: 'ALIADO' | 'NEUTRO' | 'ENEMIGO' | 'SIN_FACCION' | 'INERTE'
  /// Punto del jugador en el mapa de Zona (2026-09-04) — a diferencia de `ZonePointInfo` (posición
  /// curada a mano), esta se asigna de forma aleatoria/aproximada la primera vez que el NPC/fauna
  /// aparece en escena (backend, `posicionAleatoriaEnLienzo`) y persiste mientras siga presente —
  /// ya no es solo texto, se pinta como pin real en el mapa (ver `ZonePointShape` en `ZonaPanel.tsx`).
  x: number
  y: number
  /// "Tirar" objetos al suelo de la Zona (2026-09-06, hallazgo 8) — solo presente cuando
  /// `tipo === 'OBJETO'`; id real de la fila para poder recogerla (a diferencia de NPC/fauna, un
  /// objeto tirado no tiene slug de catálogo estable).
  droppedItemId?: string
  /// Cadáveres en el mapa (Fase 5, 2026-09-28) — solo presente cuando `tipo === 'CADAVER'`.
  cadaver?: { npcSlug: string; nombre: string; saqueable: boolean; desollable: boolean }
  /// Hallazgo 34 (2026-09-07) — mismo criterio que `ZonePointInfo.descubierto`. `OBJETO` siempre
  /// `true` (instancia real ya visible en el suelo de esta partida, nunca un secreto de catálogo).
  descubierto: boolean
}
/// Control regional (2026-08-27, Pieza 5 de "Dinamismo del mundo") — derivado en caliente de
/// `WorldState.agenda`, sin logo real todavía (placeholder de texto en el frontend mientras se
/// generan los assets). `null` si la región no tiene dueño de lore conocido.
export interface RegionControlInfo {
  estado: 'NEUTRAL_O_DUENO_ORIGINAL' | 'EN_DISPUTA' | 'CONQUISTADA'
  duenoActual: string
  agresor?: string
}
/// Icono de salida de región (2026-09-17, petición explícita de Álvaro: "cada salida debe estar
/// ubicada en su posición correcta hacia el camino que se indica en el mapa... al pulsarlo saca un
/// modal con la imagen de la zona (si ya la habías descubierto) y una descripción (breve si no la
/// conoces, larga si ya la descubriste)... con un botón Viajar") — una por cada `LocationLink` real
/// que conecta con la Location actual, posicionada en el borde del lienzo según la dirección
/// cardinal real entre ambas (backend, `salidasDeRegionPara`, zona.ts).
export interface ZonaSalidaInfo {
  locationId: string
  slug: string
  nombre: string
  x: number
  y: number
  /// Locations no usan la Enciclopedia de 3 fases (`DiscoveredEntity`) — usan el sistema binario
  /// `LocationVisit` ya existente: `true` = alguna partida... no, ESTA partida ya estuvo ahí.
  visitada: boolean
  /// Frase corta curada a mano (`Location.teaser`) — se muestra solo mientras `!visitada`. `null`
  /// si esa Location todavía no tiene teaser curado en el catálogo (fallback de texto genérico en
  /// el modal, nunca bloquea el render).
  teaser: string | null
  /// Descripción real de `Location.description` — solo presente (no `null`) si `visitada`, nunca
  /// revela contenido de un sitio no explorado.
  description: string | null
  /// Igual que `description`: solo presente si `visitada`.
  imageUrl: string | null
  /// Umbral de proximidad (2026-09-20, petición explícita de Álvaro: "al estar a una celda si
  /// pulsas el icono saca el modal para poder darle a viajar") — mismo criterio que la colisión con
  /// NPC/fauna/recursos: misma celda o cualquiera de las 8 vecinas de la posición real del jugador
  /// (`zonaPosX/Y`). `true` sin posición de jugador conocida (fallback permisivo).
  alcanzable: boolean
  /// QA-27 (P7): puerta de una zona interior — `ENTRAR` desde fuera, `SALIR` desde dentro.
  puerta?: 'ENTRAR' | 'SALIR'
  /// P115 (QA-27): minutos de camino hasta el destino.
  minutos?: number
  /// P115: el destino tiene nombre para la jugadora (ya estuvo o lleva el mapa de la región).
  conocida?: boolean
}

export interface ZonaResponse {
  disponible: boolean
  /// P185 (QA-27): casillas por las que no se pasa (muros, empalizadas), para la ruta prevista.
  muros?: { col: number; row: number }[]
  locationSlug?: string
  locationName?: string
  /// Mapa pintado a mano de fondo (entityType 'zona'/sizeProfile 'mapa') — el botón que lo genera
  /// vive en Enciclopedia > Localización (DetailModal.tsx), no aquí; este panel solo lo muestra.
  imageUrl?: string | null
  regionControl?: RegionControlInfo | null
  /// CR-63 (63e): viajeros de paso por esta zona, en su celda.
  viajeros?: { id: string; nombre: string; x: number; y: number }[]
  puntos: ZonePointInfo[]
  dinamicos: ZonaDinamicoInfo[]
  /// Punto del jugador en el mapa de Zona (2026-09-04) — se mueve solo por acciones deterministas
  /// (viajar/cazar/recolectar/combatir/hablar/construir/huir), nunca interpretando narración
  /// libre. `null` = partida previa a esta pieza, o sin nada que asignar todavía.
  /// ZON-32: minuto de ficción actual (para la hora de llegada de la ruta prevista).
  fictionalMinutes?: number
  jugador: { x: number; y: number } | null
  salidas: ZonaSalidaInfo[]
  /// Icono de parcela (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) — solo relleno en las
  /// zonas-interior de Capital/Cuartel Avanzado; `[]` en el resto del mundo.
  parcelas: ZonaParcelaInfo[]
  /// CR-40 (40g): tablón de avisos de este lugar, si lo hay. `faccion` null = el del Reino.
  tablon?: { buildingId: string; nombre: string; faccion: string | null } | null
}
export async function getZona(saveId: string): Promise<ZonaResponse> {
  return fetchJson(`${API_URL}/saves/${saveId}/zona`)
}

/// Detalle bajo demanda de una parcela (2026-09-21) — se pide al abrir su modal, mismo criterio
/// que el resto del panel (el mapa solo pinta iconos con lo mínimo).
export async function getParcela(saveId: string, parcelaId: string): Promise<ParcelaDetailInfo> {
  return fetchJson(`${API_URL}/saves/${saveId}/parcelas/${parcelaId}`)
}

/// Construir DIRECTO en una parcela (2026-09-21) — sin /turn/narrate, sin LLM (mismo criterio que
/// "Descansar en campamento": ya se sabe exactamente qué y dónde). El backend devuelve el
/// `Building` real creado y el `LogEntry` determinista del evento; el caller decide si refresca
/// `getZona`/`getSave` tras la llamada.
export async function construirEnParcela(saveId: string, parcelaId: string, recipeKey: string): Promise<{ building: BuildingInfo; logEntry: LogEntry }> {
  return fetchJson(`${API_URL}/saves/${saveId}/parcelas/${parcelaId}/construir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipeKey }),
  })
}

/// Sistema de movimiento por cuadrícula (2026-09-08, "estilo Mount & Blade") — un clic en el lienzo
/// pide el destino real en píxel; el backend calcula el camino y avanza UN PASO por llamada (el
/// motor decide el camino, nunca el jugador clica celda a celda) — así se puede animar y detener en
/// cuanto haya `colision`/`aviso`. `caminoRestante.length > 0` = quedan pasos, seguir llamando con
/// el MISMO `destino` original para continuar el mismo trayecto.
export interface MoverZonaResultado {
  jugador: { x: number; y: number }
  caminoRestante: { x: number; y: number }[]
  /// Umbral único (2026-09-17, antes había un "aviso" a distancia separado que solo mostraba un
  /// mensaje sin abrir nada — eliminado por petición explícita de Álvaro: "si estás a una casilla
  /// de un elemento" ya debe abrir Interactuar) — celda ADYACENTE o MISMA celda disparan `colision`.
  colision: { targetSlug: string; targetName: string; temperamento: string } | null
  /// Conexión real con Interactuar (2026-09-08) — colisión contra un NPC/fauna (o encuentro con un
  /// RECURSO, sin `colision`) dispara esta oferta real (`pendingDynamicModeOffer` en el backend);
  /// `null` sin encuentro o si ya había otra oferta/conversación en curso. `combateForzado` (desde
  /// 2026-09-20) marca un AGRESIVO/ENEMIGO: la oferta abre el árbol de combate/huida.
  dynamicModeOffer:
    | {
        tipo: 'FAUNA' | 'NPC' | 'RECURSO'
        targetSlug: string
        targetName: string
        quienInicia: 'jugador' | 'npc'
        combateForzado?: true
        /// Grupos de fauna reales (Fase 1, 2026-09-28) — id del `ZonePoint` colisionado (ausente
        /// para un dinámico sin `ZonePoint` propio) y cuántos individuos representa AHORA MISMO
        /// (1 para NPC/RECURSO/dinámicos, puede ser >1 para un grupo de FAUNA real).
        zonePointId?: string
        cantidad?: number
        /// Aviso de riesgo de Cazar (F9-1, 2026-09-29) — ver `RiesgoCazaInfo`, types.ts.
        riesgoCaza?: RiesgoCazaInfo
        /// Método de la fuente (RECURSO, 2026-09-29) — ver `dynamicModeOffer.metodo`, types.ts.
        metodo?: MetodoObtencion | null
      }
    | null
  /// LogEntry real determinista del encuentro (2026-09-09, hallazgo real jugando en vivo: la
  /// tarjeta de oferta SIEMPRE se renderiza colgada de una LogEntry concreta — sin esto la oferta
  /// quedaba persistida en BD pero invisible en el log). Presente solo junto a `dynamicModeOffer`,
  /// `null` en cualquier otro caso. Shape mínimo (no el `LogEntry` completo del frontend, que
  /// exige `channel` — el caller construye la entrada final combinando esto con `dynamicModeOffer`).
  logEntry: { id: string; text: string; timeLabel: string; createdAt: string; roll?: IniciativaEncuentroLogRoll } | null
  /// Sincronización real del mundo con el jugador (2026-09-09, bug real jugando en vivo: "los
  /// elementos se mueven, pero no con animación de movimiento como yo ni a la vez que muevo yo") —
  /// posiciones YA actualizadas de los `ZonePoint` FAUNA/NPC que dieron su propio paso este mismo
  /// turno (`avanzarZonePointsUnPaso`, backend), para que el frontend pueda animarlos en el mismo
  /// ritmo que su propio marcador en vez de quedarse con el snapshot viejo hasta el próximo
  /// refetch completo. `[]` cuando el jugador no avanzó (camino vacío) — el mundo no da un paso si
  /// el jugador tampoco lo da.
  zonePointsMovidos: { id: string; x: number; y: number }[]
  /// `true` si este paso descartó una oferta pacífica que seguía sin responder (2026-09-28 —
  /// alejarse andando equivale a ignorarla); el frontend retira su tarjeta del log.
  ofertaDescartada?: boolean
  /// P135: este paso es el último del trayecto (también cuando un encuentro lo para en él).
  llegado?: boolean
  /// F9-2 (2026-09-29) — reloj tras el paso (1 min/paso); ausente si el camino estaba vacío.
  fictionalMinutes?: number
  fictionalDateLabel?: string
  /// P161 (QA-27): energía tras el paso, si la recuperó (el HUD no la refrescaba al andar).
  energia?: number
}
export async function moverEnZona(saveId: string, destino: { x: number; y: number }): Promise<MoverZonaResultado> {
  return fetchJson(`${API_URL}/saves/${saveId}/zona/mover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destino }),
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// Grupo 3 § Compañeros y supervivencia (2026-08-25, docs/rpgtarkor/sistemas-reino/companeros-y-supervivencia.md)
// ═══════════════════════════════════════════════════════════════════════════

export interface CapturableCandidate {
  npcSlug: string
  name: string
  tipo: 'FAUNA' | 'NPC'
}
export async function getCapturables(saveId: string): Promise<{ candidates: CapturableCandidate[]; tieneCuerdas: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/capturables`)
}
/// Rediseño de captura (2026-08-28, docs/rpgtarkor/sistemas-reino/companeros-y-supervivencia.md) — atar ya no
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
): Promise<{
  npcSlug: string
  tipo: 'FAUNA' | 'NPC'
  inventoryItemId: string
  capturaExpiraAtMinutes: number | null
  /// Punto del jugador en el mapa de Zona no se toca aquí (fuera de alcance) — solo la reputación
  /// de facción (2026-09-04, decisión final desde CONVALECIENTE, ver FACTION_REP_CAPTURE_DELTA en
  /// backend) y el LogEntry breve que ahora la acompaña (antes Capturar era silencioso).
  logEntry: { id: string; text: string; timeLabel: string; createdAt: string }
  factionRepChange: { faction: string; delta: number; newValue: number } | null
  /// Títulos de misión ACTIVA que siguen apuntando a este NPC (2026-09-15) — Capturar tampoco las
  /// cierra (deja al NPC vivo), mismo criterio que `dejarVivir`. `[]` si ninguna.
  misionesPendientes: string[]
}> {
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

/// "Aprender oficio de un Maestro" (2026-08-31, "Trabajador de Reino") — mismo patrón que Entregar,
/// un solo paso (solo hay que elegir con quién, no "qué").
export interface AprenderOficioMaestro {
  npcSlug: string
  name: string
  professionId: string
  costeGoirnos: number
  yaAprendido: boolean
  puedeAprender: boolean
  motivoBloqueo: string | null
}
export async function getAprenderOficioMaestros(saveId: string): Promise<{ maestros: AprenderOficioMaestro[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/aprender-oficio`)
}
export async function postAprenderOficio(saveId: string, npcSlug: string): Promise<{ professionId: string; logEntry: LogEntry }> {
  return fetchJson(`${API_URL}/saves/${saveId}/npc/${npcSlug}/aprender-oficio`, { method: 'POST' })
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
): Promise<{
  npcSlug: string
  logEntry: { id: string; text: string; timeLabel: string; createdAt: string }
  /// Reputación de facción (2026-09-04, decisión final desde CONVALECIENTE, ver
  /// FACTION_REP_MERCY_DELTA en backend) — antes solo Matar/Clemente en combate 1v1 clásico
  /// aplicaban esto de forma indirecta (y demasiado pronto, ver el bug real que motivó esta pieza).
  factionRepChange: { faction: string; delta: number; newValue: number } | null
  /// Títulos de misión ACTIVA que siguen apuntando a este NPC (2026-09-15, hallazgo real jugando
  /// en vivo: "Acabar con X" seguía ACTIVA sin ningún aviso tras perdonarle la vida) — Clemente NO
  /// las cierra (solo la MUERTE real lo hace, decisión de 2026-08-31), esto es solo para avisar al
  /// jugador de que el objetivo sigue vivo y esas misiones siguen abiertas. `[]` si ninguna.
  misionesPendientes: string[]
}> {
  return fetchJson(`${API_URL}/saves/${saveId}/combat/dejar-vivir/${npcSlug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId }),
  })
}

/// "Matar" un CONVALECIENTE (2026-09-05, bug real: la decisión solo vivía en React,
/// `combatNpcStates`/`targetedForKill` — se perdía al recargar) — solo marca la decisión en
/// `NpcState.targetedForKill`, no resuelve nada por sí mismo (el remate real sigue siendo un
/// intercambio normal, riesgo real). Solo combate 1v1 clásico por ahora.
export async function requestMatar(saveId: string, npcSlug: string): Promise<void> {
  await fetchJson(`${API_URL}/saves/${saveId}/combat/matar/${npcSlug}`, { method: 'POST' })
}

export interface TameoPendiente {
  npcSlug: string
  name: string
  tipo: 'FAUNA' | 'NPC'
  felicidad: number
  umbral: number
  atributoResistencia: Attribute | null
  enJaula: boolean
  /// CR-55 (Q3): es ganado y puede ir a un corral en vez de ser compañero.
  alCorral?: boolean
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
/// CR-55 (Q3): el animal domesticado va a un corral del Ganadero de su especie (o a uno vacío).
export async function postAlCorral(saveId: string, npcSlug: string): Promise<{ ganadoId: string; buildingId: string; sexo: 'M' | 'F' }> {
  return fetchJson(`${API_URL}/saves/${saveId}/tameo-pendientes/${npcSlug}/al-corral`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}

/// CR-55: Reino › Corrales.
export type EtapaAnimal = 'CRIA' | 'JOVEN' | 'ADULTO' | 'VEJEZ'
export interface AnimalDeCorral {
  id: string
  sexo: 'M' | 'F'
  edadDias: number
  etapa: EtapaAnimal
  diasParaSiguiente: number | null
  /// CR-56 (Q4): la jugadora Domadora puede llevárselo como compañero.
  puedeLlevar?: boolean
}
export interface CorralInfo {
  id: string
  name: string
  escalon: number
  plazas: number
  especie: string | null
  especieNombre: string | null
  /// CR-56 (Q3): corral de guardia (sus animales defienden el Reino).
  guardia?: boolean
  animales: AnimalDeCorral[]
  ganaderos: { id: string; name: string }[]
  /// Q10: producción media al día con sus ganaderos.
  produccionDia: { slug: string; nombre: string; porDia: number }[]
}
export interface CorralesInfo {
  forraje: number
  huecoForraje: number
  forrajeDia: number
  diasSinComer: number
  diasSinBeber: number
  /// CR-56 (Q4): compañeros animales que pueden volver al corral.
  fueraDelCorral?: { id: string; name: string }[]
  corrales: CorralInfo[]
}
// CR-63 (63d): Reino › Partidas — partidas de caza y captura.
export interface PartidaInfo {
  id: string
  tipo: 'CAZA' | 'CAPTURA' | 'ATAQUE' | 'ATAQUE_ASENTAMIENTO'
  estado: 'IDA' | 'TRABAJANDO' | 'VUELTA' | 'TERMINADO'
  especie: string | null
  especieNombre: string | null
  ubicacion: string
  destino: string
  permanente: boolean
  miembros: string[]
  carga: { piezas?: number; capturados?: number; resumen?: string } | null
  /// Día en que volvió a casa (solo las que ya terminaron).
  vueltaDia?: number | null
}
export interface OpcionesPartida {
  origen: { id: string; name: string } | null
  /// `sinArma`: sin arma no sale (Q3 de CR-63, como un soldado).
  cazadores: { id: string; name: string; sinArma?: boolean }[]
  /// Nombres de los cazadores que están fuera con una partida.
  cazadoresFuera?: string[]
  grupos: { slotIndex: number; nombre: string; companeros: { id: string; name: string }[] }[]
  destinos: { id: string; name: string; region: string; especies: { slug: string; name: string; cantidad: number; capturable: boolean }[] }[]
}
/// CR-50 (Q7): un campamento de bandidos que conoces.
export interface CampamentoInfo {
  id: string
  lugar: string
  slug: string
  region: string
  grupo: string
  cabecilla: string
  gente: number
}
export async function getPartidas(saveId: string): Promise<{ partidas: PartidaInfo[]; opciones: OpcionesPartida; campamentos?: CampamentoInfo[]; guerreros?: { id: string; name: string; rol: string }[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/partidas`)
}
export async function postLanzarPartida(
  saveId: string,
  p: { tipo: 'CAZA' | 'CAPTURA'; especie: string; destinoLocationId: string; companionIds: string[]; subjectIds: string[]; permanente: boolean },
): Promise<{ ok: boolean; id: string }> {
  return fetchJson(`${API_URL}/saves/${saveId}/partidas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
}
export async function postOrdenPartida(saveId: string, viajeroId: string, accion: 'parar' | 'volver' | 'destino', destinoLocationId?: string): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/partidas/${viajeroId}/orden`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, destinoLocationId }) })
}

// CR-63 (63e, Q9): viajeros de paso donde está el personaje.
export interface ViajeroAqui {
  id: string
  propia: boolean
  quien: string
  tipo: string
  que: string
  estado: 'IDA' | 'TRABAJANDO' | 'VUELTA'
  gente: number
  piezas: number
}
export async function getViajerosAqui(saveId: string): Promise<{ viajeros: ViajeroAqui[]; vendibles?: { id: string; name: string; precio: number }[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/viajeros/aqui`)
}
export async function postPreguntarViajero(saveId: string, viajeroId: string): Promise<{ ok: boolean; lineas: string[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/viajeros/${viajeroId}/preguntar`, { method: 'POST' })
}
export async function postVenderAViajero(saveId: string, viajeroId: string, itemId: string): Promise<{ ok: boolean; precio: number }> {
  return fetchJson(`${API_URL}/saves/${saveId}/viajeros/${viajeroId}/vender`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId }) })
}
export async function postComprarAViajero(saveId: string, viajeroId: string): Promise<{ ok: boolean; items: string[]; precio: number }> {
  return fetchJson(`${API_URL}/saves/${saveId}/viajeros/${viajeroId}/comprar`, { method: 'POST' })
}

export async function getCorrales(saveId: string): Promise<CorralesInfo> {
  return fetchJson(`${API_URL}/saves/${saveId}/corrales`)
}
export async function postEntregarForraje(saveId: string, catalogSlug: string): Promise<{ entregados: number; forraje: number }> {
  return fetchJson(`${API_URL}/saves/${saveId}/forraje/entregar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ catalogSlug }),
  })
}
export async function postLlevarConsigo(saveId: string, ganadoId: string): Promise<{ companionId: string }> {
  return fetchJson(`${API_URL}/saves/${saveId}/ganado/${ganadoId}/llevar`, { method: 'POST' })
}
export async function postDevolverAlCorral(saveId: string, companionId: string): Promise<{ buildingId: string }> {
  return fetchJson(`${API_URL}/saves/${saveId}/companeros/${companionId}/al-corral`, { method: 'POST' })
}
export async function postSacrificar(saveId: string, ganadoId: string): Promise<{ comida: number; almacen: Record<string, number>; perdido: number }> {
  return fetchJson(`${API_URL}/saves/${saveId}/ganado/${ganadoId}/sacrificar`, { method: 'POST' })
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
export async function fijarRolReinoCompanion(saveId: string, companionId: string, rolReino: string | null): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/companeros/${companionId}/rol-reino`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rolReino }),
  })
}
/// CR-53 (hito 0.3): la economía de supervivencia del Reino (agua, topes, tesoro y sueldos).
export interface EconomiaReino {
  /// P279: comida en el almacén, lo que producen y comen al día y por qué se mueve (o no).
  comida?: number
  bebida?: number
  comidaProduccionDia?: number
  comidaConsumoDia?: number
  bocasDetalle?: { civiles: number; soldados: number; visitantes: number }
  motivosComida?: string[]
  aguaDia: number
  bocas: number
  topeComida: number
  topeBebida: number
  topeMateriales: number
  materiales: number
  sueldosSemana: number
  /// CR-58: desgaste semanal del equipo y lo que falta.
  equipoGoirnos?: number
  equipoMateriales?: number
  sinHerramienta?: number
  sinArma?: number
  tesoro: number
  bolsa: number
  diasSinCobrar: number
  diasSed: number
  diasHambre: number
}

export async function getEconomiaReino(saveId: string): Promise<EconomiaReino> {
  return fetchJson(`${API_URL}/saves/${saveId}/reino/economia`)
}

/// Positivo: de la bolsa al tesoro; negativo: del tesoro a la bolsa.
export async function traspasarTesoro(saveId: string, cantidad: number): Promise<{ ok: boolean; bolsa: number; tesoro: number }> {
  return fetchJson(`${API_URL}/saves/${saveId}/reino/tesoro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cantidad }),
  })
}

/// REI-118 (hito 0.3): un súbdito como persona y las camas del Reino (compañeros y súbditos comparten cupo).
export interface SubditoInfo {
  id: string
  name: string
  role: string
  rol: 'trabajador' | 'soldado' | 'vigia' | 'cazador' | 'visitante'
  pueblo: string | null
  genero: string | null
  edad: number | null
  adulto: boolean
  felicidad: number
  origen: string
  territoryId: string | null
  linaje: { nombre: string; tipo: string } | null
  /// REI-120: nombre de su pareja (si tiene) y crías que han tenido.
  pareja?: string | null
  crias?: number
  /// CR-61 (61c): su tarea si es trabajador (sin tarea, recolector).
  tarea?: TareaSubdito
  /// Casa de obras (P277): nivel de oficio de constructor (1-9); da velocidad (los tiers los abre la Casa de obras).
  nivelConstructor?: number
}

export type TareaSubdito = 'recolector' | 'pescador' | 'cocinero' | 'ganadero' | 'fibrero' | 'constructor'

export interface CamasReino {
  total: number
  companeros: number
  subditos: number
  libres: number
  /// P220a: camas temporales del Ayuntamiento (solo súbditos) y cuántos súbditos viven en ellas.
  temporales?: number
  enAyuntamiento?: number
  libresSubditos?: number
}

/// P220b: un requisito para que llegue alguien, con su estado y su cifra.
export interface RequisitoLlegada {
  clave: 'cama' | 'comida' | 'agua' | 'felicidad'
  nombre: string
  cumple: boolean
  cifra: string
  motivo: string
}

/// REI-119: quien espera en la puerta del Reino a que lo aceptes o lo rechaces.
export interface CandidatoLlegada extends SubditoInfo {
  deDonde: string | null
  hastaMinutes: number | null
}

/// REI-121 / REI-54: quien se fue o murió en la última semana.
export interface SalidaSubdito {
  id: string
  name: string
  estado: 'SE_FUE' | 'MUERTO'
  motivo: string
  cuando: number | null
}

export async function getSubditos(saveId: string): Promise<{ ahora?: number; subditos: SubditoInfo[]; camas: CamasReino; danados?: { id: string; name: string; camas: number; cocina: boolean }[]; candidatos?: CandidatoLlegada[]; salidas?: SalidaSubdito[]; requisitosLlegada?: RequisitoLlegada[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/subditos`)
}

export async function responderLlegada(saveId: string, subjectId: string, acepta: boolean): Promise<{ ok: boolean; name?: string }> {
  return fetchJson(`${API_URL}/saves/${saveId}/subditos/${subjectId}/llegada`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acepta }),
  })
}

export async function cambiarRolSubdito(saveId: string, subjectId: string, rol: string): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/subjects/${subjectId}/rol`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rol }),
  })
}

export async function cambiarTareaSubdito(saveId: string, subjectId: string, tarea: TareaSubdito): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/subjects/${subjectId}/tarea`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tarea }),
  })
}

export async function asignarPlantillaSubject(saveId: string, subjectId: string, plantillaEquipoId: string | null): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/subjects/${subjectId}/plantilla`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plantillaEquipoId }),
  })
}

/// Producción de Reino estilo Bellwright (hueco D, rediseño 2026-09-21, docs/rpgtarkor/
/// mundo-vivo-x4.md § 4.4-ter) — trabajador↔edificio, sin filtrado de receta por tipo de edificio
/// (decisión confirmada: el motor real solo mira nivel de oficio, nunca el `Building`).
export async function asignarCompanionABuilding(saveId: string, companionId: string, buildingId: string | null): Promise<{ ok: boolean; companion: { id: string; buildingId: string | null } }> {
  return fetchJson(`${API_URL}/saves/${saveId}/companeros/${companionId}/asignar-edificio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ buildingId }),
  })
}

export interface OrdenProduccionInfo {
  id: string
  buildingId: string
  recipeKey: string
  modo: 'unico' | 'reponer'
  limite: number | null
  prioridad: number
  cantidadProducidaAcumulada: number
  activa: boolean
}

export async function getOrdenesProduccion(saveId: string, buildingId: string): Promise<{ ordenes: OrdenProduccionInfo[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/edificios/${buildingId}/ordenes`)
}

/// Recetas que un edificio puede producir según su oficio (P-3, decisión de Álvaro, 2026-09-29).
/// `oficio` null = edificio sin oficio, sin filtro.
export async function getRecetasProduccionEdificio(saveId: string, buildingId: string): Promise<{ oficio: string | null; recipeKeys: string[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/edificios/${buildingId}/recetas-produccion`)
}

export async function crearOrdenProduccion(
  saveId: string,
  buildingId: string,
  params: { recipeKey: string; modo?: 'unico' | 'reponer'; limite?: number | null; prioridad?: number },
): Promise<{ ok: boolean; orden: OrdenProduccionInfo }> {
  return fetchJson(`${API_URL}/saves/${saveId}/edificios/${buildingId}/ordenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export async function actualizarOrdenProduccion(
  saveId: string,
  ordenId: string,
  params: { prioridad?: number; limite?: number | null; activa?: boolean },
): Promise<{ ok: boolean; orden: OrdenProduccionInfo }> {
  return fetchJson(`${API_URL}/saves/${saveId}/ordenes/${ordenId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export async function borrarOrdenProduccion(saveId: string, ordenId: string): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/ordenes/${ordenId}`, { method: 'DELETE' })
}

export interface AlmacenLimiteInfo {
  catalogSlug: string
  limite: number | null
}

export async function getAlmacenLimites(saveId: string): Promise<{ limites: AlmacenLimiteInfo[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/almacen-limites`)
}

export async function setAlmacenLimite(saveId: string, catalogSlug: string, limite: number | null): Promise<{ ok: boolean; catalogSlug: string; limite: number | null }> {
  return fetchJson(`${API_URL}/saves/${saveId}/almacen-limites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ catalogSlug, limite }),
  })
}

/// Diplomacia y Mercado (Fase 3, 2026-09-21, docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.4) — las rutas de
/// backend ya existían y funcionaban (reino.ts), pero sin ningún cliente en el frontend hasta ahora.
export interface DiplomaciaResultado {
  ok: true
  accion: 'negociar' | 'sabotear' | 'espiar'
  targetFaction: string
  hechoDeMundo: string | null
  /// Solo presente en `accion: 'espiar'` — nunca mueve presión, es la única vía real por la que el
  /// jugador ve el estado de una FactionRelation.
  presion?: number
  type?: 'NEUTRAL' | 'TENSION' | 'GUERRA' | 'ALIANZA' | 'TRATADO_COMERCIAL'
  /// Etapa narrativa de la relación (0-4, `stageForPresion` en factionRelations.ts): 0 hasta 59 de
  /// presión, luego una cada 10 puntos. Solo en `espiar`.
  stage?: number
  /// REI-116 (hito 0.1, roadmap-front-reino.md R4) — el backend ya los mandaba y el front los
  /// ignoraba: XP de oficio "diplomático" ganada por el compañero (solo al negociar con éxito; 0 si
  /// no) y su nivel resultante. Ausentes en `espiar`.
  xpGanada?: number
  nivelDiplomatico?: number
}

export async function postDiplomacia(
  saveId: string,
  params: { companionId: string; targetFactionSlug: string; accion: 'negociar' | 'sabotear' | 'espiar' },
): Promise<DiplomaciaResultado> {
  return fetchJson(`${API_URL}/saves/${saveId}/reino/diplomacia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export interface MercadoItemInfo {
  almacenItemId: string
  name: string
  catalogSlug: string
  stock: number
  precio: number
}

export async function getMercado(saveId: string, targetFactionSlug: string): Promise<{ ok: boolean; tratado: boolean; items: MercadoItemInfo[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/reino/mercado/${targetFactionSlug}`)
}

export async function postMercadoComprar(saveId: string, targetFactionSlug: string, almacenItemId: string): Promise<{ ok: boolean; precio: number; item: string; targetFaction: string }> {
  return fetchJson(`${API_URL}/saves/${saveId}/reino/mercado/comprar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetFactionSlug, almacenItemId }),
  })
}

export async function postMercadoVender(saveId: string, targetFactionSlug: string, almacenItemId: string): Promise<{ ok: boolean; precio: number; item: string; targetFaction: string }> {
  return fetchJson(`${API_URL}/saves/${saveId}/reino/mercado/vender`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetFactionSlug, almacenItemId }),
  })
}

/// CR-47 (47d): el Mercado del Reino — órdenes permanentes y caravanas.
export interface OrdenComercioInfo {
  id: string
  catalogSlug: string
  nombre: string
  tipo: 'COMPRA' | 'VENTA'
  umbral: number
  lote: number
  factionSlug: string | null
}
export interface CaravanaInfo {
  id: string
  tipo: 'COMPRA' | 'VENTA'
  nombre: string
  faccion: string
  unidades: number
  traidas: number
  riqueza: number
  status: 'EN_CAMINO' | 'VOLVIENDO' | 'TERMINADA' | 'ASALTADA'
  diaRegreso: number
}
export interface ComercioInfo {
  reino: boolean
  mercado: boolean
  /// P287 — hay un Mercado pero está dañado.
  mercadoDanado?: boolean
  socios: { slug: string; name: string }[]
  objetos: { slug: string; name: string }[]
  ordenes: OrdenComercioInfo[]
  caravanas: CaravanaInfo[]
}

export async function getComercio(saveId: string): Promise<ComercioInfo> {
  return fetchJson(`${API_URL}/saves/${saveId}/reino/comercio`)
}

export async function postOrdenComercio(
  saveId: string,
  orden: { catalogSlug: string; tipo: 'COMPRA' | 'VENTA'; umbral: number; lote: number; factionSlug: string | null },
): Promise<{ orden: OrdenComercioInfo }> {
  return fetchJson(`${API_URL}/saves/${saveId}/reino/comercio/ordenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orden),
  })
}

export async function deleteOrdenComercio(saveId: string, ordenId: string): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/reino/comercio/ordenes/${ordenId}`, { method: 'DELETE' })
}

/// Relaciones entre facciones NPC (Fase 4, 2026-09-21, docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.3) —
/// nunca la facción del jugador, solo facciones de catálogo entre sí. `worldSlug` es el `slug` de
/// `World`, no confundir con un slug de Faction.
export interface FactionRelationInfo {
  sourceFactionSlug: string
  sourceFactionName: string
  sourceRaza: string
  targetFactionSlug: string
  targetFactionName: string
  targetRaza: string
  type: 'NEUTRAL' | 'TENSION' | 'GUERRA' | 'ALIANZA' | 'TRATADO_COMERCIAL'
  presion: number
  stage: number
  maxStage: number
}

export async function getFactionRelations(worldSlug: string, saveId?: string): Promise<{ relations: FactionRelationInfo[] }> {
  const query = saveId ? `?saveId=${saveId}` : ''
  return fetchJson(`${API_URL}/world/${worldSlug}/faction-relations${query}`)
}

/// Resultado de la caza desde la zona (`cazarEnZona`, más abajo). Con una única presa débil puede
/// resolverse sin combate (`resuelveSinCombate: true`, ver `combate`) — en cualquier otro caso
/// (varias presas, una sola no lo bastante débil, o la propia tirada de caza limpia falla) esta
/// llamada NO abre combate ni toca nada de la partida: solo devuelve `actionText`, que el llamador
/// debe mandar por el turno normal (`handleSubmit` en GameView.tsx) para que la narración real sea
/// quien lo abra — decisión explícita de la usuaria: "cazar sí que fuerza una narración cuando
/// eliges objetivos y esa narración inicia el combate".
export type ConfirmarCazaResultado =
  | { resuelveSinCombate: true; exito: true; combate: { npcs: NpcInSceneInfo[] }; logEntry: { id: string; text: string; timeLabel: string; createdAt: string; roll?: CazaSigiloRoll }; cazaLimpia?: CazaSigiloRoll }
  | ({
      resuelveSinCombate: false
      exito: false | null
      actionText: string
      /// P90/P130: lo que sale en el diario como acción de la jugadora; `null` en una emboscada.
      accionEnDiario?: string | null
      /// Cuántos del grupo entran al combate (d6 por especie) + LogEntry de sistema con esas tiradas
      /// y la iniciativa de cada combatiente (combate múltiple).
      tiradasGrupo?: TiradaGrupoInfo[]
    } & (
      | {
          /// Fase 10 (2026-09-29) — caza sigilosa fallida (d100 contra la probabilidad real). QA-73: el
          /// backend la guarda siempre y viaja en `logEntry`, con `roll.kind` = 'caza-sigilo'.
          cazaLimpia: CazaSigiloRoll
          logEntry: { id: string; text: string; timeLabel: string; createdAt: string; roll: CazaSigiloRoll }
        }
      | { cazaLimpia?: undefined; logEntry?: { id: string; text: string; timeLabel: string; createdAt: string; roll: CombateGrupoLogRoll } }
    ))

/// Cazar desde la tarjeta de encuentro de zona (Fase 2, 2026-09-28,
/// `plan-mecanicas-por-zona-2026-09-28.md`) — caza EXACTAMENTE el grupo con el que se ha
/// colisionado en el mapa (`entry.dynamicModeOffer.zonePointId`), nunca por sorteo de población
/// regional como el viejo botón suelto "Cazar" (`confirmarCaza`, que la Fase 4 retira). Misma forma
/// de respuesta que `confirmarCaza` — el llamador reutiliza el mismo tratamiento de resultado
/// (`handleHuntResolved`, GameView.tsx).
export async function cazarEnZona(saveId: string, zonePointId: string): Promise<ConfirmarCazaResultado> {
  return fetchJson(`${API_URL}/saves/${saveId}/zona/cazar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zonePointId }),
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
  // Bug real (2026-09-04, auditoría "representar siempre XP/profesión/reputación"): el backend
  // (routes/saves/quests.ts) ya concede +100 XP real y devuelve este campo cuando la misión del
  // Orco Enfurecido nace ya COMPLETADA (NPC ya derrotado antes de aceptar), pero el tipo de este
  // endpoint ni siquiera lo declaraba — se descartaba en silencio, sin chip ni actualización del
  // XP visible hasta recargar la partida.
  questCompletedInfo: { logEntryId: string; text: string; title: string; grantedItems: string[]; rewardXp: number } | null
  /// QA-54: la recompensa de `questCompletedInfo`, lista para el inventario (P32).
  newInventoryItems?: InventoryItemInfo[]
}> {
  return fetchJson(`${API_URL}/saves/${saveId}/quests/aceptar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  })
}

/// Botón "Cancelar" de la tarjeta "MISIÓN PROPUESTA" (bug real jugando en vivo, 2026-09-03, "misión
/// de apertura no sobrevive a un F5") — la oferta ahora se persiste al proponerse
/// (`pendingQuestOfferInfo`), así que cancelar debe limpiarla de verdad en el backend, no solo
/// localmente en React, o reaparece tras recargar.
export async function cancelarMision(saveId: string): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/quests/cancelar`, { method: 'POST' })
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
  /// Bug real 2026-09-09 ("Interactuar" con Gistera Koh la dejaba huérfana del motor determinista,
  /// sin generar nunca su oferta de misión) — solo llega no-nulo cuando `cierra` es true y el NPC
  /// tiene un gancho de misión propio (hoy solo Gistera Koh/"Acabar con el Orco Enfurecido"), mismo
  /// shape que `TurnResult.newQuestOfferInfo`.
  newQuestOfferInfo?: { title: string; description: string } | null
  /// Gistera Koh, aceptación real (2026-09-09, bug real jugando en vivo — Álvaro: "al acabar de
  /// interactuar me sale para aceptar la misión otra vez... como ya aceptamos esto no debería
  /// salir... solo un log al final") — a diferencia de `newQuestOfferInfo` (pide una SEGUNDA
  /// confirmación por botones), esto llega cuando la Quest YA se creó de verdad dentro del propio
  /// guion determinista (el jugador ya aceptó eligiendo "Aceptar ayudarla" en la conversación) —
  /// el frontend solo debe mostrar la confirmación, nunca un botón adicional que pulsar.
  questAceptada?: {
    quest: { id: string; questSlug: string | null; title: string; objetivo: string | null }
    alreadyExisted: boolean
    logEntry: { id: string; text: string; timeLabel: string; createdAt: string } | null
    questCompletedInfo: { logEntryId: string; text: string; title: string; grantedItems: string[]; rewardXp: number } | null
    /// QA-54: la recompensa de `questCompletedInfo`, lista para el inventario (P32).
    newInventoryItems?: InventoryItemInfo[]
  } | null
  /// AGRESIVO/ENEMIGO desde Interactuar (2026-09-20) — llega cuando el encuentro se resuelve en
  /// combate directo (el NPC vio primero al jugador, o el jugador eligió "Combatir" tras verlo él
  /// primero). Mismo shape que `TurnResult.combateIniciado`/`combateEnGrupo`; `cierra` siempre
  /// viene `true` cuando esto llega — no hay más vueltas de modo dinámico que jugar.
  combate?: { npcs: NpcInSceneInfo[] } | null
  /// Agresivo en grupo (Fase 2, 2026-09-28) — llega en vez de `combate` cuando el encuentro forzado
  /// es un grupo real de FAUNA (`cantidad > 1`, ver `iniciarCaza`/`services/caza.ts`): el backend ya
  /// creó el `CombatEncounter` múltiple, este texto se manda por el turno normal
  /// (`handleSubmit`, GameView.tsx) para que la narración real lo abra — mismo criterio EXACTO que
  /// `ConfirmarCazaResultado.actionText` (caza en grupo desde el viejo botón suelto).
  actionText?: string
  /// P90/P130: lo que sale en el diario como acción de la jugadora; `null` en una emboscada.
  accionEnDiario?: string | null
  /// Fase 10 (2026-09-29) — con `actionText` de grupo: tiradas de cuántos entran + LogEntry de
  /// sistema (`combateGrupoLogEntry`) con esas tiradas y la iniciativa del combate múltiple.
  tiradasGrupo?: TiradaGrupoInfo[]
  combateGrupoLogEntry?: { id: string; text: string; timeLabel: string; createdAt: string; roll: CombateGrupoLogRoll }
}

export async function interactuarModoDinamico(
  saveId: string,
  tipo: 'NPC' | 'FAUNA',
  targetSlug: string,
  targetName: string,
  /// "¿Quién ve a quién primero?" (2026-09-17) — reenvía lo que ya trajo `dynamicModeOffer` de la
  /// colisión de Zona, mismo criterio que `tipo`/`targetSlug`/`targetName` (el backend no vuelve a
  /// recalcularlo aquí). `undefined` en el resto de orígenes de oferta (turno normal de texto
  /// libre, sin colisión de Zona) — el backend cae al framing de siempre sin este dato.
  quienInicia?: 'jugador' | 'npc',
  /// AGRESIVO/ENEMIGO (2026-09-20) — reenvía `dynamicModeOffer.combateForzado` tal cual, mismo
  /// criterio que `quienInicia`. `undefined` para el resto (nunca hay combate directo posible).
  combateForzado?: boolean,
  /// Agresivo en grupo (Fase 2, 2026-09-28) — reenvía `dynamicModeOffer.zonePointId`/`cantidad`
  /// tal cual (el grupo exacto con el que se ha colisionado); con `cantidad > 1` el backend abre
  /// combate múltiple en vez del 1v1 clásico.
  zonePointId?: string,
  cantidad?: number,
): Promise<DynamicModeTurno> {
  return fetchJson(`${API_URL}/saves/${saveId}/modo-dinamico/interactuar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, targetSlug, targetName, quienInicia, combateForzado, zonePointId, cantidad }),
  })
}

export async function responderModoDinamico(saveId: string, respuesta: string): Promise<DynamicModeTurno> {
  return fetchJson(`${API_URL}/saves/${saveId}/modo-dinamico/responder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ respuesta }),
  })
}

/// `targetSlug` (P150): la oferta sin abrir que se ignora; sin él, se limpia lo que haya (salir de una
/// conversación en curso).
export async function ignorarModoDinamico(saveId: string, targetSlug?: string): Promise<{
  ok: boolean
  /// Franja 0 (2026-09-15, hallazgo real jugando en vivo: "cerrar Interactuar no deja rastro en
  /// el log") — el backend ya creaba este LogEntry al salir de una conversación en curso, pero
  /// nunca lo devolvía; el caller lo insertaba a ciegas sin él. `null` cuando no había nada que
  /// resumir (ignorar una oferta sin llegar a abrirla).
  logEntry: { id: string; text: string; timeLabel: string; createdAt: string } | null
}> {
  return fetchJson(`${API_URL}/saves/${saveId}/modo-dinamico/ignorar`, {
    method: 'POST',
    ...(targetSlug ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetSlug }) } : {}),
  })
}

/// "Interactuar" sobre RECURSO (2026-09-08, "Ver qué hay en la zona") — a diferencia de NPC/FAUNA
/// (conversación de vueltas), resuelve la recolección real de una sola llamada: tirada + inventario
/// + LogEntry, sin abrir DynamicModeModal. Ver dynamicModeRecurso.ts (backend).
export interface DynamicModeRecursoResultado {
  exito: boolean
  narration: string
  abilityName?: string
  /// Fase 10 (2026-09-29) — tirada de Explorar (también en el fallo) y segundas tiradas de tier alto.
  roll?: GatheringRollInfo
  segundasTiradas?: SegundaTiradaInfo[]
  items?: InventoryItemInfo[]
  updatedItems?: { id: string; name: string }[]
  logEntry: { id: string; text: string; timeLabel: string; createdAt: string; fictionalMinutes: number; roll?: RecoleccionLogRoll; factionRepChange?: { faction: string; delta: number; newValue: number } }
  /// P161 (QA-27): energía tras recolectar, si recuperó algo.
  energia?: number
}

export async function interactuarModoDinamicoRecurso(saveId: string, targetSlug: string): Promise<DynamicModeRecursoResultado> {
  return fetchJson(`${API_URL}/saves/${saveId}/modo-dinamico/recurso/${targetSlug}`, { method: 'POST' })
}

/// Menú contextual de interacción con NPC (2026-09-06) — `accion` le dice a GameView.tsx qué modal/
/// flujo abrir a continuación, reutilizando siempre uno ya existente (ninguna mecánica nueva nace
/// aquí, ver npcInteraction.ts en backend).
export type NpcInteractionAccion =
  | { accion: 'ABRIR_APRENDER_OFICIO' }
  | { accion: 'ABRIR_RECLUTAR' }
  /// `desdeEncuentro` (P142): el menú salió de la tarjeta del mapa; el combate sale de ese encuentro.
  | { accion: 'FORZAR_COMBATE'; npcSlug: string; desdeEncuentro?: boolean }
  /// P142: «Charlar» en el menú abierto desde el mapa abre la escena libre de ese encuentro.
  | { accion: 'CHARLAR' }
  | { accion: 'MOSTRAR_OFERTA_MISION' }
  | { accion: 'CERRAR' }
  /// CR-12 — «Ayudar» a un malherido: la entrada del registro que lo cuenta.
  | { accion: 'AYUDADO'; logEntry: LogEntry }
  /// CR-18 (18c): «¿Qué se cuenta?»; la frase del NPC (las noticias llegan a «El mundo»).
  | { accion: 'CONTADO'; logEntry: LogEntry }
  /// CR-40 (40f) — «¿Tienes trabajo?»: la misión personal que propone el NPC, o que no tiene nada.
  | { accion: 'OFERTA_TRABAJO'; npcName: string; aviso: AvisoMisionInfo }
  | { accion: 'SIN_TRABAJO'; texto: string }
  /// CR-32: proponer que se una o que te informe; la entrada lleva la tirada de Carisma.
  | { accion: 'PROPUESTA'; logEntry: LogEntry; unido: boolean }

/// P178 (QA-27): ficha de un edificio del mapa (de quién es, cómo está, quién lo lleva y qué ofrece).
export interface FichaEdificio {
  zonePointId: string
  nombre: string
  descripcion: string | null
  nivel: number | null
  faccion: string | null
  estado: string
  detallesEstado: string[]
  encargado: { slug: string; nombre: string; aqui: boolean } | null
  ofrece: { label: string; disponible: boolean; motivo?: string }[]
}

export async function getFichaEdificio(saveId: string, zonePointId: string): Promise<FichaEdificio> {
  return fetchJson(`${API_URL}/saves/${saveId}/zona/edificio/${zonePointId}`)
}

/// P178: «Interactuar» junto a un edificio: el menú de quien lo lleva, o por qué no lo hay.
export async function interactuarEdificio(
  saveId: string,
  zonePointId: string,
): Promise<{ menu: { npcSlug: string; npcName: string; options: string[]; desdeEncuentro: false }; logEntry: LogEntry } | { menu: null; motivo: string }> {
  return fetchJson(`${API_URL}/saves/${saveId}/zona/edificio/${zonePointId}/interactuar`, { method: 'POST' })
}

/// P142: menú fijo del NPC del encuentro del mapa; `null` si no tiene (se abre la escena libre).
export async function abrirMenuNpc(saveId: string, npcSlug: string): Promise<{ menu: { npcSlug: string; npcName: string; options: string[]; desdeEncuentro: true } | null }> {
  return fetchJson(`${API_URL}/saves/${saveId}/npc-interaction/${npcSlug}/abrir`, { method: 'POST' })
}

export async function chooseNpcInteraction(saveId: string, npcSlug: string, opcion: string): Promise<NpcInteractionAccion> {
  return fetchJson(`${API_URL}/saves/${saveId}/npc-interaction/${npcSlug}/elegir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opcion }),
  })
}

export async function deleteSave(id: string): Promise<void> {
  return fetchJson(`${API_URL}/saves/${id}`, { method: 'DELETE' })
}

/// Versión del backend (`GET /version`) — se compara con la del build del frontend para que un
/// desajuste sea visible.
export async function getServerVersion(): Promise<string> {
  const { version } = await fetchJson<{ version: string }>(`${API_URL}/version`)
  return version
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
  /// Asentamientos (2026-08-31) — mismo campo que `EnciclopediaLocationInfo`, ver ahí.
  asentamiento?: {
    iconoPrompt: string | null
    iconoUrl: string | null
  }
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
/// Enciclopedia en 3 fases (2026-09-08, rediseño de Álvaro: "no descubierto, citado o avistado")
/// — sustituye el binario `discovered` para NPC/fauna/item/historia (Location y el grafo del mapa
/// siguen con su propio eje aparte, gateado por `LocationVisit`/posesión del mapa, sin tocar).
/// 'NO_DESCUBIERTO': todo con interrogaciones. 'CITADO': mencionado en narración/lore, solo
/// nombre+región visibles, sin imagen. 'DESCUBIERTO': ficha completa, visto en escena o
/// desbloqueado por un objeto de lore específico.
export type DiscoveryFase = 'NO_DESCUBIERTO' | 'CITADO' | 'DESCUBIERTO'

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
  /// 3 fases (2026-09-08) — ver DiscoveryFase. Coexiste con `discovered` (no lo sustituye, 6+
  /// consumidores ya lo usan tal cual): `discovered` sigue siendo `fase !== 'NO_DESCUBIERTO'`.
  fase: DiscoveryFase
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
  /// 3 fases (2026-09-08) — ver DiscoveryFase. Poseerlo en inventario siempre da DESCUBIERTO;
  /// solo mencionado sin poseerlo se queda en CITADO.
  fase: DiscoveryFase
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
  /// 3 fases (2026-09-08) — ver DiscoveryFase. Fauna realmente presente en escena este turno ->
  /// DESCUBIERTO directo; flora nunca tiene fila de "presencia en escena" por este camino, se
  /// queda en CITADO como mucho (pendiente el disparador de "interactuar en la misma casilla" del
  /// rediseño de movimiento en Zona).
  fase: DiscoveryFase
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
  /// Géneros de fauna/flora (2026-09-04, docs/rpgtarkor/lore-mundo/genesis.md § Florial/Ferios/Tarkor) —
  /// mutuamente excluyentes según `esFauna`, nunca los dos a la vez. String suelto (no enum
  /// cerrado en el frontend) porque el backend puede añadir géneros nuevos sin requerir un
  /// despliegue sincronizado de ambos lados.
  faunaCategoria: string | null
  /// CR-56 (Q1): para qué sirve la especie domesticada (vacío si no se domestica).
  usos?: string[]
  floraCategoria: string | null
  /// Roster de habilidades DE LA CATEGORÍA con su nivel de desbloqueo (2026-09-15, cierre de
  /// deuda técnica — `faunaCategoria` en sí ya llegaba desde 2026-09-04, pero el roster que
  /// desbloquea nunca se exponía). Vacío para flora/mineral y para fauna sin categoría asignada.
  faunaCategoriaUnlocks: { level: number; ability: EnciclopediaAbilityInfo }[]
  /// Vínculo Companion↔dueño (auditoría de contenido de Enciclopedia, 2026-09-15) — `null` para
  /// la inmensa mayoría de fauna (suelta, sin dueño); solo Gisoki/Gogorath lo tienen hoy.
  companionOfNpc: { slug: string; name: string } | null
}

// Día/noche/estación (2026-08-27, docs/rpgtarkor/items-y-catalogo/imagenes-prompts.md) — a diferencia de
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
  /// Asentamientos (2026-08-31, "las ciudades deben tener prompt de mapa como la zona y de icono,
  /// no de banner") — icono en vez de banner. El mapa ya se ofrecía para cualquier Location vía
  /// `variantesTiempo`/`mapaImagePrompt` (entityType 'zona'), no duplicado aquí. Undefined para el
  /// resto de Locations (hitos, cruces...), que siguen usando `imageUrls`/`imagePrompts` normales.
  asentamiento?: {
    iconoPrompt: string | null
    iconoUrl: string | null
  }
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
  /// Id de professions.ts ('herrero-orcos-llanuras'/'alquimista-orcos-llanuras'/'carpintero-orcos-
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
  /// Líder de GOBIERNO (§ 7.2, docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md, 2026-09-21) — null = sin líder real
  /// sembrado todavía en el catálogo (nunca inventado en servicio).
  liderNpc: { slug: string; name: string } | null
  discovered: boolean
  /// 3 fases (2026-09-08) — ver DiscoveryFase. Una facción nunca tiene "presencia en escena"
  /// propia: siempre CITADO como mucho (nunca 'DESCUBIERTO' aquí hoy), expuesto solo por
  /// coherencia de shape con el resto de secciones.
  fase: DiscoveryFase
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
  /// 3 fases (2026-09-08) — ver DiscoveryFase. Hereda la MISMA fase del objeto físico que la
  /// desbloqueó (tenerlo en la mano da DESCUBIERTO directo, solo mención da CITADO).
  fase: DiscoveryFase
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

/// Enciclopedia § "Reputación" (auditoría de contenido de Enciclopedia, 2026-09-15) — mismo patrón
/// exacto que EnciclopediaCombateInfo: contenido estático, sin gateo de descubrimiento.
export interface EnciclopediaReputacionInfo {
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
  reputacion: EnciclopediaReputacionInfo[]
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
export type ImagePromptEntityType =
  | 'npc'
  | 'item'
  | 'fauna'
  | 'ability'
  | 'raza'
  | 'personaje'
  | 'location'
  | 'construccion'
  | 'faction'
  | 'historia'
  | 'crafteo'
  | 'zona'
  | 'clase'
  | 'especializacion'
/// 'thumbnail' = icono cuadrado de la cuadrícula (EntryCard), 'banner' = MediaSlot ancho del
/// detalle (~3:1, medido contra la UI real), 'mapa' = fondo del panel Zona (800x600, solo
/// entityType 'zona'), 'icono' (2026-08-31) = emblema plano cuadrado (512x512, hoy solo
/// asentamientos, entityType 'location') — ver imagePromptGenerator.ts en el backend.
export type ImagePromptSizeProfile = 'thumbnail' | 'banner' | 'mapa' | 'icono'

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

// ─── Libro de Sucesos, vista de administración (CR-4, hito 0.2) ───────────────────────────────
export type FamiliaSuceso = 'CLIMA' | 'NATURAL' | 'VIDA_MUERTE' | 'DIPLOMACIA' | 'FACCION' | 'ECONOMIA' | 'REINO' | 'JUGADOR' | 'LORE' | 'SISTEMA'

export interface SucesoLibro {
  id: string
  tipo: string
  familia: FamiliaSuceso
  fictionalMinutes: number
  fecha: string
  regionSlug: string | null
  importancia: number
  origen: 'JUGADOR' | 'MUNDO' | 'MOTOR' | 'IA_PROPUESTA'
  texto: string
  textoNarrado: string | null
  actores: { entidadTipo: string; entidadId: string; papel: string }[]
  causaIds: string[]
  efectoIds: string[]
}

export interface LibroDeSucesos {
  personaje: string
  total: number
  sucesos: SucesoLibro[]
  hayMas: boolean
}

export async function getLibroDeSucesos(
  saveId: string,
  filtros: { familia?: FamiliaSuceso | null; importanciaMin?: number; antesDe?: string; limite?: number } = {},
): Promise<LibroDeSucesos> {
  const params = new URLSearchParams()
  if (filtros.familia) params.set('familia', filtros.familia)
  if (filtros.importanciaMin) params.set('importanciaMin', String(filtros.importanciaMin))
  if (filtros.antesDe) params.set('antesDe', filtros.antesDe)
  if (filtros.limite) params.set('limite', String(filtros.limite))
  const qs = params.toString()
  return fetchJson(`${API_URL}/saves/${saveId}/libro${qs ? `?${qs}` : ''}`)
}

// ─────────────────────────── CR-40 (40g): misiones secundarias del motor ───────────────────────────

/// Recompensa por tabla de una misión del motor (`cronista/misiones.ts`).
export interface RecompensaMision {
  xp: number
  goirnos: number
  reputacion: number
  reputacionAlFallar: number
  reputacionConEnemiga: number
}

/// Un aviso a la vista en un tablón o en boca de un NPC.
export interface AvisoMisionInfo {
  id: string
  titulo: string
  descripcion: string
  tipo?: string
  faccion?: string
  recompensa: RecompensaMision
  retiraEn?: number
}

export async function getAvisosTablon(saveId: string, buildingId: string): Promise<{ tablon: { buildingId: string; nombre: string; faccion: string | null }; avisos: AvisoMisionInfo[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/tablones/${encodeURIComponent(buildingId)}`)
}

/// CR-18 (18d): un bando del tablón (lo oficial de su región y su facción de los últimos días).
export interface BandoInfo {
  sucesoId: string
  texto: string
  /// Minuto de ficción en que pasó.
  pasoEn: number
}

/// Lee los bandos de un tablón (y los apunta como sabidos).
export async function leerBandosTablon(saveId: string, buildingId: string): Promise<{ bandos: BandoInfo[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/tablones/${encodeURIComponent(buildingId)}/bandos/leer`, { method: 'POST' })
}

export async function aceptarAviso(saveId: string, avisoId: string): Promise<{ questId: string; title: string }> {
  return fetchJson(`${API_URL}/saves/${saveId}/misiones/avisos/${encodeURIComponent(avisoId)}/aceptar`, { method: 'POST' })
}

export async function entregarMision(saveId: string, questId: string): Promise<{ status: string; progreso: number; cantidad: number | null }> {
  return fetchJson(`${API_URL}/saves/${saveId}/misiones/${encodeURIComponent(questId)}/entregar`, { method: 'POST' })
}

export async function abandonarMision(saveId: string, questId: string): Promise<{ status: string }> {
  return fetchJson(`${API_URL}/saves/${saveId}/misiones/${encodeURIComponent(questId)}/abandonar`, { method: 'POST' })
}

// ─────────────────────────── Leyendas de la partida (CR-19/CR-20, hito 0.2) ───────────────────────────

/// INT-2: la importancia nunca se enseña como número.
export type NivelLeyenda = 'NORMAL' | 'DESTACADO' | 'GRAVE'

export interface ActorLeyenda {
  tipo: string
  id: string
  nombre: string
  papel: string
}

/// Un suceso que el personaje sabe. Un rumor llega sin detalles (sin actores, fecha, lugar ni causas).
export interface EntradaLeyenda {
  sucesoId: string
  tipo: string
  familia: FamiliaSuceso
  nivel: NivelLeyenda
  texto: string
  rumor: boolean
  via: 'TESTIGO' | 'OIDAS' | 'NPC' | 'BANDO' | 'ALIADA'
  /// Minuto de ficción en que lo supo.
  sabidoEn: number
  region: string | null
  cuando: number | null
  fecha: string | null
  lugar: { id: string; nombre: string } | null
  actores: ActorLeyenda[]
  /// Causas que el personaje también sabe (INT-3).
  causas: string[]
}

/// `siguiente` (si hay más) es el cursor para pedir las más antiguas.
export async function getLeyendas(saveId: string, params: { familia?: FamiliaSuceso; cursor?: string } = {}): Promise<{ entradas: EntradaLeyenda[]; hayMas: boolean; siguiente: string | null }> {
  const q = new URLSearchParams()
  if (params.familia) q.set('familia', params.familia)
  if (params.cursor) q.set('cursor', params.cursor)
  const qs = q.toString()
  return fetchJson(`${API_URL}/saves/${saveId}/leyendas${qs ? `?${qs}` : ''}`)
}

/// CR-20 (20b): sección «En tu partida» de una ficha de la Enciclopedia (npc, faction o location).
export async function getLeyendasFicha(saveId: string, ficha: 'npc' | 'faction' | 'location', slug: string): Promise<{ entradas: EntradaLeyenda[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/leyendas/ficha/${ficha}/${encodeURIComponent(slug)}`)
}

/// Lo que el personaje sabe de una entidad (ficha «En tu partida»).
export async function getLeyendasEntidad(saveId: string, tipo: string, entidadId: string): Promise<{ entradas: EntradaLeyenda[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/leyendas/entidad/${encodeURIComponent(tipo)}/${encodeURIComponent(entidadId)}`)
}

/// CR-14 (hito 0.3): título ganado por el personaje, con el porqué.
export interface EtiquetaInfo {
  clave: string
  texto: string
  activa: boolean
  desdeMinutes: number
  porque: string | null
}

export async function getEtiquetas(saveId: string): Promise<{ etiquetas: EtiquetaInfo[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/etiquetas`)
}

/// CR-17 (hito 0.3): una historia en marcha (o ya cerrada) que el personaje conoce.
export interface HiloInfo {
  id: string
  patron: 'VENGANZA' | 'ASCENSO' | 'CAIDA' | 'DEUDA' | 'RIVALIDAD' | 'REDENCION'
  abierto: boolean
  tension: number
  resumen: string
  abiertoEn: number
  cerradoEn: number | null
}

export async function getHilos(saveId: string): Promise<{ hilos: HiloInfo[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/leyendas/hilos`)
}

/// CR-52 (hito 0.3): una familia (apellido) o un rastro faerus que conoce el personaje.
export interface MiembroLinaje {
  id: string
  tipo: 'NPC' | 'SUBDITO' | 'PERSONAJE'
  nombre: string
  vivo: boolean
  padreId: string | null
  madreId: string | null
}

export interface LinajeInfo {
  id: string
  nombre: string
  tipo: 'APELLIDO' | 'RASTRO'
  pueblo: string
  propio: boolean
  miembros: MiembroLinaje[]
  historia: EntradaLeyenda[]
}

export async function getLinajes(saveId: string): Promise<{ linajes: LinajeInfo[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/leyendas/linajes`)
}

/// CR-42 (hito 0.3): «¿Qué se sabe en tu tierra?» a un compañero.
export async function preguntarTierraCompanero(saveId: string, companionId: string): Promise<{ frase: string; contadas: number }> {
  return fetchJson(`${API_URL}/saves/${saveId}/companeros/${companionId}/tierra`, { method: 'POST' })
}

// CR-65 (65f): Reino › Defensa.
export interface ModuloDefensaInfo {
  id: string
  modulo: 'empalizada' | 'torre-vigia' | 'armeria' | 'barracon'
  nombre: string
  escalon: number
  golpes: number
  caida: boolean
  /// P296: dañado (no cuenta hasta repararlo).
  danado?: boolean
  equiposMilicia: number
}
export interface AsentamientoDefensa {
  id: string
  nombre: string
  capital: boolean
  region: string
  locationId: string
  modulos: ModuloDefensaInfo[]
  guarnicion: { id: string; nombre: string; rol: 'soldado' | 'vigia' }[]
  efecto: { cobertura: number; radioTramos: number; bonoAltura: number; equiposMilicia: number; plazasGuarnicion: number; bonoMoral: number; aguante: number }
}
export interface AvistamientoInfo {
  asentamientoId: string
  asentamiento: string
  viajeroId: string
  quien: string
  gente: number
  tramos: number
  /// P295: por qué llamar a la milicia no serviría ahora.
  sinMilicia?: string
}
/// `danados`: Ayuntamiento o Cuartel dañados (P284), que no defienden hasta repararlos.
export async function getDefensa(saveId: string): Promise<{ asentamientos: AsentamientoDefensa[]; avistados: AvistamientoInfo[]; danados?: { id: string; nombre: string }[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/defensa`)
}
export async function postGuarnicion(saveId: string, subjectId: string, asentamientoId: string): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/defensa/guarnicion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subjectId, asentamientoId }) })
}
export async function postEquiposMilicia(saveId: string, armeriaId: string, cantidad: number): Promise<{ ok: boolean; comprados: number }> {
  return fetchJson(`${API_URL}/saves/${saveId}/defensa/armeria/${armeriaId}/equipos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cantidad }) })
}
export async function postLlamarMilicia(saveId: string, asentamientoId: string): Promise<{ ok: boolean; armados: number }> {
  return fetchJson(`${API_URL}/saves/${saveId}/defensa/${asentamientoId}/milicia`, { method: 'POST' })
}
/// P284/P296/P301: repara un edificio dañado (mitad de su coste en materiales del Almacén).
export async function postRepararEdificio(saveId: string, buildingId: string): Promise<{ ok: boolean; coste: number }> {
  return fetchJson(`${API_URL}/saves/${saveId}/edificios/${buildingId}/reparar`, { method: 'POST' })
}

/// Casa de obras (P277/P284): la Casa, sus constructores y la cola de obras y reparaciones.
export interface ObraEnCola {
  id: string
  tipo: 'CONSTRUIR' | 'REPARAR'
  nombre: string
  tier: number
  dias: number
  diasHechos: number
  /// Por qué no avanza («🔒N: …», faltan materiales…); null = avanza.
  aviso: string | null
}
export interface CasaDeObrasInfo {
  casa: { nivel: number; tierMaximo: number; plazas: number } | null
  constructores: { id: string; name: string; nivel: number }[]
  cola: ObraEnCola[]
}
export async function getObras(saveId: string): Promise<CasaDeObrasInfo> {
  return fetchJson(`${API_URL}/saves/${saveId}/obras`)
}
export async function postObra(saveId: string, encargo: { recipeKey: string } | { buildingId: string }): Promise<{ ok: boolean; id: string }> {
  return fetchJson(`${API_URL}/saves/${saveId}/obras`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(encargo) })
}
export async function deleteObra(saveId: string, obraId: string): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/obras/${obraId}`, { method: 'DELETE' })
}
export async function putOrdenObras(saveId: string, ids: string[]): Promise<{ ok: boolean }> {
  return fetchJson(`${API_URL}/saves/${saveId}/obras/orden`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
}

// CR-50 (50d): manda una partida a por un campamento de bandidos.
export async function postAtacarCampamento(saveId: string, campamentoId: string, p: { companionIds: string[]; subjectIds: string[] }): Promise<{ ok: boolean; id: string }> {
  return fetchJson(`${API_URL}/saves/${saveId}/campamentos/${campamentoId}/atacar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
}

// CR-37 (37c): guerra con el Reino.
export interface EnemigaInfo {
  id: string
  nombre: string
  relacion: 'GUERRA' | 'TENSION'
  presion: number
}
/// CR-59 (P286): vasallajes de la partida (Reino › Diplomacia).
export interface VasallajeInfo {
  vasalloSlug: string
  vasalloNombre: string
  senorSlug: string
  senorNombre: string
  deuda: number
  deudaPorPatrulla: number
  sobreprecioArmas: number
  patrullaGuerreros: number
  proximaRevision: number | null
  rotoEn: number | null
  motivoRuptura: string | null
}
export async function getVasallajes(saveId: string): Promise<{ vasallajes: VasallajeInfo[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/reino/vasallajes`)
}
export async function getGuerra(saveId: string): Promise<{ enemigas: EnemigaInfo[] }> {
  return fetchJson(`${API_URL}/saves/${saveId}/guerra`)
}
export async function postTributo(saveId: string, factionId: string, goirnos: number): Promise<{ ok: boolean; pagado: number; relacion: string }> {
  return fetchJson(`${API_URL}/saves/${saveId}/guerra/${factionId}/tributo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goirnos }) })
}
export async function postAtacarAsentamiento(saveId: string, factionId: string, p: { companionIds: string[]; subjectIds: string[] }): Promise<{ ok: boolean; id: string }> {
  return fetchJson(`${API_URL}/saves/${saveId}/guerra/${factionId}/atacar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
}
