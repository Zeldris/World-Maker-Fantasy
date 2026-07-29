import type {
  Attribute,
  AttributeBlock,
  BuildingInfo,
  CompanionInfo,
  CondicionFisica,
  CurrentLocationInfo,
  DestinationInfo,
  Dificultad,
  DiscoveryItem,
  EquipSlot,
  InventoryItemInfo,
  ItemTipo,
  KingdomStatsInfo,
  LogEntry,
  NpcInSceneInfo,
  ProfessionProgressInfo,
  ProgressionResult,
  QuestInfo,
  RollInfo,
  SavedActionCategory,
  SavedActionInfo,
  SecondaryAttributeBlock,
  SessionSummaryInfo,
  SubjectInfo,
  TerritoryInfo,
} from '../types'

// Backend local — hardcodeado por simplicidad mientras solo se prueba en local.
// TODO: mover a variable de entorno (VITE_API_URL) cuando haga falta desplegar en algún sitio.
const API_URL = 'http://localhost:3001'

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
  transit?: { busyUntil: string }
  // Presente cuando la acción se resolvió como un viaje por el grafo de ubicaciones.
  travel?: TravelResolution | null
  // Revelado progresivo (docs/14-combate-y-muerte.md § 3.1) — 2-4 hallazgos ya decididos por el
  // backend para búsquedas/recolección genéricas de banda corta; vacío si no aplica.
  discoveries?: DiscoveryItem[]
  npcsInScene?: NpcSceneSnapshot
}

export interface BusyError {
  status: 409
  activity: string
  busyUntil: string
}

export interface EndedGameError {
  status: 409
  ended: true
  endedAt: string
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
    const err: BusyError = { status: 409, activity: body.activity, busyUntil: body.busyUntil }
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
  combateIniciado?: { npcs: NpcInSceneInfo[] } | null
  finDePartida: boolean
  // Loot/despiece/producción ya materializados en la partida (2026-07-19) — antes el inventario en
  // pantalla se quedaba desactualizado hasta recargar, porque el backend nunca los devolvía aquí.
  newInventoryItems: InventoryItemInfo[]
  /// Rework 2026-07-24 (persistencia de banners de entidad) — id real de la fila LogEntry de esta
  /// narración, para poder guardarle luego qué entidad se mostró como imagen (setLogEntryBanner).
  logEntryId: string
  /// Bug real (2026-07-25, "revisar partida"): una misión podía crearse/cerrarse de verdad este
  /// turno sin que el panel de Misiones se enterara hasta recargar la partida entera — mismo
  /// patrón ya arreglado antes para el inventario (newInventoryItems). Lista completa, no un
  /// delta (ver comentario en NarrateAndPersistResult, backend).
  quests: QuestInfo[]
  /// Rediseño del turno de combate (2026-07-28) — true cuando el backend decidió que un NPC gana
  /// la iniciativa del SIGUIENTE intercambio: la próxima acción del jugador debe tratarse como
  /// defensa a ciegas (elige una habilidad sin saber qué usará el NPC), no como ataque normal.
  esperandoDefensaJugador: boolean
}

export interface TurnNarrateHandlers {
  /// Streaming (roadmap de velocidad, 2026-07-20, punto 13): fragmento de "narration" tal cual
  /// se va generando. Puede no llamarse nunca si el intento principal falló y el backend cayó a
  /// un reintento no-streaming (ver onReset) — el resultado final en `done` sigue siendo el mismo.
  onChunk?: (delta: string) => void
  /// Hubo que descartar el texto transmitido hasta ahora (el intento 1 se coló o dio un
  /// resultado inválido) — limpiar cualquier texto parcial ya mostrado.
  onReset?: () => void
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
  },
  handlers?: TurnNarrateHandlers,
): Promise<NarrateResponse> {
  const response = await fetch(`${API_URL}/turn/narrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

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
  secondaryAttributes: SecondaryAttributeBlock
  portraitInitial: string
  fictionalDateLabel: string
  characterLog: LogEntry[]
  worldLog: LogEntry[]
  inventory: InventoryItemInfo[]
  companions: CompanionInfo[]
  level: number
  xp: number
  pendingAttributePoints: number
  kingdomName: string | null
  territories: TerritoryInfo[]
  buildings: BuildingInfo[]
  subjects: SubjectInfo[]
  transit: { activity: string; busyUntil: string } | null
  savedActions: SavedActionInfo[]
  habilidadSlots: number
  profession: string | null
  professionProgress: ProfessionProgressInfo[]
  kingdomStats: KingdomStatsInfo | null
  currentLocation: CurrentLocationInfo | null
  destinations: DestinationInfo[]
  condicionFisica: CondicionFisica
  dificultad: Dificultad
  deathCount: number
  endedAt: string | null
  quests: QuestInfo[]
  chapters: SessionSummaryInfo[]
  factionsStatus: Record<string, number>
  /// Combate pendiente reconstruido tras cualquier resincronización (bug real, 2026-07-23,
  /// "revisar partida"): antes solo viajaba en la respuesta directa de `/turn/narrate` — si el
  /// sondeo de reconexión tenía que recuperar la partida vía `getSave` en vez de recibir esa
  /// respuesta, el aviso de "Combatir" se perdía sin dejar rastro pese a que el combate sí se
  /// había calculado bien en el backend.
  combateIniciado: { npcs: NpcInSceneInfo[] } | null
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
export async function requestFlee(id: string): Promise<{ escaped: boolean; text: string }> {
  return fetchJson(`${API_URL}/saves/${id}/combat/flee`, { method: 'POST' })
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

export async function setProfession(id: string, profession: string): Promise<{ profession: string }> {
  return fetchJson(`${API_URL}/saves/${id}/profesion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profession }),
  })
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
}

export interface EnciclopediaItemInfo {
  slug: string
  name: string
  category: string
  /// Categorización mecánica (2026-07-29) — ver itemTaxonomy.ts (backend) / ItemTipo (types.ts).
  tipo: ItemTipo
  description: string
  statBonusAttribute: string | null
  statBonusAmount: number | null
  /// Medidas físicas y lugar de origen (2026-07-22, "para los objetos sus medidas y su lugar de
  /// origen") — texto libre, null cuando el objeto no tiene un origen especial.
  dimensiones: string | null
  lugarOrigen: string | null
  /// Nivel de rareza/dificultad (1-5) y mínimos de atributo del PJ para equiparlo (sesión de
  /// diseño 2026-07-23) — null/undefined en objetos tier 1 sin requisito real.
  tier?: number
  requisitos?: Partial<Record<string, number>> | null
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
  /// propias (categorizadas). Flora/mineral sin Npc propio no tiene ninguno de los tres.
  attributes?: AttributeBlock | null
  ataqueNatural?: string | null
  habilidadesRaciales?: { icon: string; name: string; description: string; categoria: 'ataque' | 'defensa' | 'utilidad'; preferredAttribute: Attribute }[]
  ataqueBase: EnciclopediaAtaqueBase | null
}

export interface EnciclopediaLocationInfo {
  slug: string
  name: string
  region: string
  kind: string
  description: string
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
  /// Enciclopedia progresiva (2026-07-23) — gateado por `LocationVisit` (visita física real), no
  /// por mención en narración, eje independiente del resto de tipos.
  discovered: boolean
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
  /// Rediseño de la vista de combate (2026-07-28) — única habilidad racial, compartida por toda
  /// la raza (no por individuo). Un NPC humanoide con `raza` igual a este `slug` la muestra en su
  /// ficha de combate.
  habilidadRacial: { icon: string; name: string; description: string; preferredAttribute: Attribute }
}

export interface EnciclopediaPersonajeInfo {
  slug: string
  name: string
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
  /// Rediseño del turno de combate (2026-07-28) — "tipo" de la habilidad para la rueda de
  /// debilidades (attributeWheel.ts, backend) y su color en la UI.
  preferredAttribute: Attribute
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
  ability: EnciclopediaAbilityInfo
}

// Guerrero y Cazador (2026-07-22, separadas en dos clases con árbol propio): ya no lleva
// `startingAbilities` — el kit personal de Gorhorn (Furia de Maktor/Piel de Guerra) no pertenece a
// ninguna de las dos clases genéricas, se expone aparte en `EnciclopediaResponse.startingAbilities`.
export interface EnciclopediaClassInfo {
  name: string
  description: string
  unlocks: EnciclopediaClassUnlock[]
}

export interface EnciclopediaConstructionRequirement {
  namePrefix: string
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
  requirements: EnciclopediaConstructionRequirement[]
  imagePrompts: EnciclopediaImagePrompts
  imageUrls: EnciclopediaImageUrls
}

export interface EnciclopediaResponse {
  npcs: EnciclopediaNpcInfo[]
  items: EnciclopediaItemInfo[]
  faunaFlora: EnciclopediaFaunaFloraInfo[]
  locations: EnciclopediaLocationInfo[]
  razas: EnciclopediaRazaInfo[]
  personajes: EnciclopediaPersonajeInfo[]
  /// Kit de combate personal del protagonista (2026-07-22) — separado de `classes`, ver comentario
  /// en `EnciclopediaClassInfo`.
  startingAbilities: EnciclopediaAbilityInfo[]
  classes: EnciclopediaClassInfo[]
  constructionRecipes: EnciclopediaConstructionRecipe[]
}

/// `saveId` (2026-07-23, enciclopedia progresiva) — gatea NPCs/fauna/flora/objetos/lugares por lo
/// ya descubierto en ESTA partida; sin él, todo sale `discovered: true` (comportamiento de
/// siempre, p.ej. si algún día se navega el catálogo fuera del contexto de una partida concreta).
export async function getEnciclopedia(worldSlug: string, saveId?: string | null): Promise<EnciclopediaResponse> {
  const query = saveId ? `?saveId=${encodeURIComponent(saveId)}` : ''
  return fetchJson(`${API_URL}/world/${worldSlug}/enciclopedia${query}`)
}

export type ImagePromptEntityType = 'npc' | 'item' | 'fauna' | 'ability' | 'raza' | 'personaje' | 'location' | 'construccion'
/// 'thumbnail' = icono cuadrado de la cuadrícula (EntryCard), 'banner' = MediaSlot ancho del
/// detalle (~3:1, medido contra la UI real) — ver imagePromptGenerator.ts en el backend.
export type ImagePromptSizeProfile = 'thumbnail' | 'banner'

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
