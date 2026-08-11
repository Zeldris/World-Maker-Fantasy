/// Rediseño de atributos (2026-07-29, referencia Baldur's Gate 3/D&D — mismo motor de dados y
/// tablas de XP que ya usa Tarkor): los 6 clásicos de D&D (Voluntad = Sabiduría, mismo nombre que
/// ya usaba el proyecto) + Arcano aparte, porque en el lore de Tarkor la magia es salvaje/innata,
/// no intelecto (a diferencia de D&D puro). Sigilo baja a SecondaryAttribute — ni en D&D es un
/// atributo primario, ahí es una habilidad bajo Destreza.
export type Attribute = 'fuerza' | 'destreza' | 'constitucion' | 'inteligencia' | 'voluntad' | 'carisma' | 'arcano'

export type AttributeBlock = Record<Attribute, number>

/// Atributos secundarios de PJ (sesión de diseño 2026-07-23) — nunca alimentan una tirada
/// (dice.ts), solo comprobaciones de umbral (requisitos de objetos/construcciones/oficios).
export type SecondaryAttribute =
  | 'sigilo'
  | 'magia'
  | 'poderSemilla'
  | 'moral'
  | 'resistenciaFisica'
  | 'resistenciaMagica'
  | 'resistenciaSemilla'
  | 'resistenciaFrio'
  | 'resistenciaCalor'

export type SecondaryAttributeBlock = Record<SecondaryAttribute, number>

/// Nivel de oficio (sesión de diseño 2026-07-23) — eje independiente del nivel de personaje, uno
/// por profesión practicada alguna vez (`professionId` es el `id` de data/professions.ts).
export interface ProfessionProgressInfo {
  professionId: string
  nivel: number
  xp: number
}

/// Fuente recolectable "ya localizada" o recién "explorada" (rediseño de profesiones, 2026-08-07)
/// — GET/POST /saves/:id/recolectar/:oficio[/explorar]. `disponible` es la población real del
/// mundo para esta fuente ahora mismo (tope real, no decorativo).
export interface HarvestSourceCandidate {
  sourceSlug: string
  sourceName: string
  disponible: number
  yields: { itemSlug: string; itemName: string; cantidadMaxima: number }[]
}

/// Fauna real YA LOCALIZADA en la zona (revisión de partida 2026-08-08, habilidad "Cazar") —
/// GET/POST /saves/:id/cazar[/explorar], mismo patrón en dos pasos que HarvestSourceCandidate.
/// `debil` = nivel de la presa ≤ nivel del jugador − 2, el único caso en el que elegir UNA sola
/// presa ofrece una caza limpia sin combate (ver HuntSelectionModal). `avistados` es una cantidad
/// realista para esta visita (nunca la población mundial real, que puede ser de miles) — baja sola
/// según se caza de verdad, sin ser un contador que haya que persistir aparte.
export interface HuntCandidate {
  slug: string
  name: string
  level: number
  debil: boolean
  avistados: number
}

/// Roster ESTÁTICO de recetas de oficio (rediseño de profesiones, 2026-08-07) — GET /profession-recipes,
/// independiente de partida. Habilidades > Profesiones lo cruza con `ProfessionProgressInfo` para
/// decidir qué tarjetas van bloqueadas.
export interface ProfessionRecipeInfo {
  oficio: string
  nivel: number
  recipeKey: string
  ability: {
    name: string
    icon: string
    description: string
    promptText: string
    category: SavedActionCategory
  }
}

/// Economía de Reino (sesión de diseño 2026-07-23) — null hasta que se funda el primer Territory.
export interface KingdomStatsInfo {
  poblacion: number
  felicidad: number
  comida: number
  bebida: number
  riqueza: number
  soldados: number
  trabajadores: number
  visitantes: number
}

export interface WorldTheme {
  accent300: string
  accent400: string
  accent500: string
  accent600: string
  accent2300: string
  accent2400: string
  accent2500: string
  accent2600: string
}

export interface World {
  id: string
  name: string
  tagline: string
  synopsis: string
  tone: string
  lethality: 'baja' | 'media' | 'alta'
  factions: string[]
  cover: string
  theme: WorldTheme
}

export interface Character {
  id: string
  name: string
  archetype: string
  origin: string
  motivation: string
  attributes: AttributeBlock
  isPregenerated: boolean
  portraitInitial: string
  /// Intro narrativa propia de este personaje pregenerado (2026-07-28, petición explícita) para
  /// las 2 primeras entradas de log (canal personaje/mundo) al empezar una partida nueva con él —
  /// ausente en personajes sin intro propia o custom, cae a la plantilla genérica (GameView.tsx).
  introCharacterText?: string
  introWorldText?: string
}

export type LogChannel = 'character' | 'world'

export interface RollInfo {
  attribute: Attribute
  value: number
  /// Dado 1d20 en crudo (el backend ya lo manda dentro de este mismo objeto) — desglose real en
  /// RollBadge.tsx: 2026-07-24, "25 Destreza Éxito" no decía si fue un buen dado o buena estadística.
  roll: number
  difficulty: number
  result: number
  success: boolean
  /// Grados de éxito (2026-07-19) — opcional porque tiradas persistidas antes de este cambio no
  /// lo tienen; el badge cae de vuelta a solo éxito/fallo en ese caso.
  gradoExito?: 'claro' | 'con_coste' | 'fallo'
}

/// Un lado del intercambio de combate (revisión de partida 2026-08-08, petición explícita: "que
/// aparezca el resultado de las tiradas... indicando qué atributo y valor sacaste tú y el del
/// enemigo, y por qué perdiste o ganaste la tirada"). Mismo shape que `RollInfo` + `valorEfectivo`
/// (el valor de atributo YA con el multiplicador de la rueda de debilidades aplicado — distinto
/// del `value` crudo, que es el que se ve en la ficha de personaje).
export interface CombatExchangeSideInfo extends RollInfo {
  valorEfectivo: number
}

export type CombatExchangeOutcome = 'defensor_contragolpea' | 'ataque_falla' | 'parada_en_seco' | 'golpes_mutuos' | 'golpe_normal' | 'golpe_pleno'

/// Las dos tiradas reales de un intercambio de combate de ESTE turno (backend, combatExchange.ts
/// § CombatExchangeDisplay) — `atacanteEsJugador` es necesario porque quién ataca y quién defiende
/// cambia turno a turno según la iniciativa, el frontend no puede asumirlo.
export interface CombatExchangeInfo {
  atacanteEsJugador: boolean
  atacante: CombatExchangeSideInfo
  defensor: CombatExchangeSideInfo
  resultado: CombatExchangeOutcome
}

/// Banner de elemento citado bajo la narración (petición explícita de la usuaria, 2026-07-24) —
/// forma mínima y autocontenida a propósito (nunca importa `EnciclopediaLinkTarget`/`DetailTarget`
/// de components/DetailModal.tsx: crearía un import circular, ya que ese módulo importa tipos de
/// aquí). `name` es la clave real: al hacer clic se vuelve a resolver el target completo contra el
/// índice de la Enciclopedia por nombre, en vez de guardar aquí una copia que podría desincronizarse.
export interface MentionedEntityBanner {
  name: string
  icon: string
  imageUrl: string
}

export interface LogEntry {
  id: string
  channel: LogChannel
  text: string
  timeLabel: string
  roll?: RollInfo
  isPlayerAction?: boolean
  createdAt: string
  xpDelta?: number
  /// Marca la entrada de "sube a nivel N" (roadmap de animaciones 2026-07-20) para que LogPanel
  /// le dé su propio marco/gema/barrido en vez de tratarla como una narración más.
  isLevelUp?: boolean
  /// Imagen del elemento más relevante citado en esta narración (banner real de la Enciclopedia),
  /// si había alguno con imagen subida y no se enseñó hace poco — ver lib/mentionedEntityBanner.ts.
  /// Resuelto en cliente: o bien recién calculado en esta misma sesión, o bien reconstruido a
  /// partir de `entityBannerType`/`entityBannerSlug` (lo que sí viene persistido del backend) en
  /// cuanto la Enciclopedia termina de cargar tras un `syncFromSave`.
  entityBanner?: MentionedEntityBanner
  /// Referencia persistida (rework 2026-07-24) de qué entidad se mostró como banner — puesta por
  /// GET /saves/:id para las entradas ya guardadas; nunca se usa directamente para pintar, solo
  /// para reconstruir `entityBanner` al cargar (ver GameView.tsx).
  entityBannerType?: string
  entityBannerSlug?: string
  /// Rediseño de la vista de combate (2026-07-28) — marca si esta entrada se generó durante un
  /// turno de combate; LogPanel la pinta con fondo/borde rojo en vez del estilo normal.
  combate?: boolean
  /// Bug real (2026-07-29, "no sé qué ataques usa el enemigo... es poco claro el combate"): nombre
  /// real de la habilidad de ataque/defensa que el NPC usó en el intercambio de ESTE turno, para
  /// que LogPanel lo muestre como badge estructurado en vez de depender de que la prosa del
  /// narrador la mencione.
  npcAbilityUsed?: { npcName: string; abilityName: string; rol: 'ataque' | 'defensa' }
  /// Mismo hueco exacto que `npcAbilityUsed` pero para el lado del jugador (revisión de partida
  /// 2026-08-08, petición explícita: "cuando seleccione una habilidad esta se refleje en la
  /// narración con su descripción, para que así sepamos que usamos y la respuesta a ese uso").
  playerAbilityUsed?: { name: string; icon: string; description: string; rol: 'ataque' | 'defensa' }
  /// Las dos tiradas reales de este intercambio de combate — ver `CombatExchangeInfo`. Presente
  /// solo si hubo intercambio mecánico real este turno.
  combatExchange?: CombatExchangeInfo
  /// Notificación de misión aceptada (2026-07-31, petición explícita: "que aparezca en la
  /// narración del personaje el título de la misión y el objetivo") — presente solo en el turno
  /// EXACTO en que se crea una misión nueva; LogPanel la pinta con fondo/borde amarillo y una
  /// tarjeta con el título+objetivo, en vez del estilo normal.
  newQuest?: { title: string; objetivo: string }
  /// Eventos de viaje interactivos (2026-08-05) — marca el aviso determinista de que un viaje
  /// largo se interrumpió antes de llegar al destino pedido; LogPanel la pinta con fondo/borde
  /// ámbar, mismo criterio que `combate` (rojo) y `newQuest` (amarillo).
  travelInterrupted?: boolean
}

export type EquipSlot =
  | 'CASCO'
  | 'CAMISA'
  | 'ARMADURA_SUPERIOR'
  | 'GUANTES'
  | 'ARMADURA_INFERIOR'
  | 'ACCESORIO'
  | 'BOTAS'
  | 'ARMA_PRINCIPAL'
  | 'ARMA_SECUNDARIA'
  | 'ANILLO_1'
  | 'ANILLO_2'
  | 'CINTURON'
  | 'CONSUMIBLE_1'
  | 'CONSUMIBLE_2'
  | 'CONSUMIBLE_3'
  | 'CONSUMIBLE_4'
  | 'CONSUMIBLE_5'
  | 'CONSUMIBLE_6'
  // 3 ranuras de cosmético puro (2026-08-03) — sustituyen a ABALORIO, ver equipment.prisma /
  // equipSlots.ts. 1:1 exactas, sin familia compartida.
  | 'COSMETICO_ESPALDA'
  | 'COSMETICO_CABEZA'
  | 'COSMETICO_CINTURA'

/// Categorización mecánica de objetos (2026-07-29) — ver itemTaxonomy.ts (backend). RECURSO: se
/// recoge/caza/tala/mina directo de la naturaleza. MATERIAL: sale de un proceso de crafteo.
/// EQUIPABLE/CONSUMIBLE/NARRATIVO: los de siempre, ahora agrupados bajo un bucket mecánico.
export type ItemTipo = 'RECURSO' | 'MATERIAL' | 'EQUIPABLE' | 'CONSUMIBLE' | 'NARRATIVO' | 'ESPECIAL'

export interface InventoryItemInfo {
  id: string
  name: string
  description: string
  origin?: string
  slot: EquipSlot | null
  /// Mapa de bonificadores (2026-08-03, sustituye al par statBonusAttribute/statBonusAmount — un
  /// solo par no dejaba a un objeto sumar, p.ej., fuerza Y defensa a la vez). 'defensa' incluido
  /// junto a los 7 atributos jugables, mismo criterio que el backend (equipment.ts). 'inventorySlots'
  /// (2026-08-07, rediseño de profesiones) — bonus de cosméticos a la capacidad de inventario.
  statBonuses: Partial<Record<Attribute | 'defensa' | 'inventorySlots', number>> | null
  /// Sesión de diseño 2026-07-23: slug de ItemCatalog de origen (null en objetos narrativos
  /// sueltos), nivel de rareza/dificultad (1-5, 1 = común), y mínimos de atributo para equiparlo
  /// — el backend ya rechaza el PATCH de equipar si no se cumplen (ver lib/api.ts, setItemSlot).
  catalogSlug?: string | null
  /// Ranura de equipo real del catálogo (2026-07-30, "categorizar por ranura para que no pueda
  /// poner un casco en los pies") — null en objetos narrativos sin categorizar (permisivo, ver
  /// `isCompatibleWithSlot`, equipSlots.ts) o sin catalogSlug.
  equipSlot?: EquipSlot | null
  tier?: number
  requisitos?: Partial<Record<Attribute | SecondaryAttribute, number>>
  /// Categorización mecánica (2026-07-29) — ausente en objetos narrativos sueltos sin
  /// catalogSlug (la IA los inventa sobre la marcha, sin fila de catálogo que consultar).
  tipo?: ItemTipo
  category?: string
  /// Solo si `tipo: 'ESPECIAL'` (2026-08-03) — clave estable que un sistema concreto del
  /// frontend consulta (p.ej. MapaPanel.tsx) y texto explicando el efecto, para mostrar en un
  /// sitio propio y diferenciado de `description`.
  effectKey?: string | null
  effectDescription?: string | null
  /// Imagen real de la Enciclopedia para este objeto (petición explícita de la usuaria,
  /// 2026-07-24: "las imágenes no salen" al ver un objeto desde Inventario/Equipo) — solo
  /// presente si `catalogSlug` existe y hay un banner subido de verdad (ver imageAssets.ts).
  imageUrls?: { thumbnail: string | null; banner: string | null }
}

export interface CompanionInfo {
  id: string
  name: string
  role: string
  notes: string
}

export type TerritoryControl = 'RECLAMADO' | 'DISPUTADO' | 'CONSOLIDADO' | 'PERDIDO'
export type BuildingStatus = 'EN_CONSTRUCCION' | 'ACTIVO' | 'DANADO' | 'ABANDONADO'

export interface TerritoryInfo {
  id: string
  name: string
  region?: string | null
  description: string
  control: TerritoryControl
  population: number
}

/// Notificación de fundación de reino (2026-08-04, "el Ayuntamiento") — solo al construir el
/// Ayuntamiento tier 1 desde cero, nunca en una mejora.
export interface KingdomFoundedInfo {
  title: string
  region: string
  outcome: 'SIN_DUENO' | 'PACIFICA' | 'CONFLICTO'
  /// "Maktor" precargado si el personaje es Gorhorn, si no null (formulario en blanco).
  suggestedName: string | null
  /// true solo para Gorhorn — el campo de nombre del popup queda bloqueado.
  nameLocked: boolean
}

export interface BuildingInfo {
  id: string
  territoryId?: string | null
  /// Dónde se plantó de verdad (2026-08-04, "el campamento" — primera construcción anclada al
  /// mapa) — null si es una construcción libre del modelo sin Location conocida.
  locationId?: string | null
  /// Clave de ConstructionRecipe ('campamento'/'choza'/'ayuntamiento'...) si vino de una receta
  /// fija — null para construcciones libres. Decide qué icono mostrar en el mapa. El Ayuntamiento
  /// SIEMPRE guarda 'ayuntamiento' aquí sin importar el tier — mejorarlo no cambia esta clave.
  recipeKey?: string | null
  /// Nivel del Ayuntamiento (1/2/3 = pequeño/mediano/grande, 2026-08-04) — null para el resto.
  tier?: number | null
  name: string
  kind: string
  status: BuildingStatus
  description: string
}

export interface SubjectInfo {
  id: string
  territoryId?: string | null
  name: string
  role: string
  notes: string
}

export interface SessionSummaryInfo {
  chapterNumber: number
  summary: string
}

export type QuestStatus = 'ACTIVA' | 'COMPLETADA' | 'FALLIDA'

export interface QuestInfo {
  id: string
  title: string
  description: string
  status: QuestStatus
  /// Frase corta y accionable de qué hay que hacer (2026-07-25) — null en misiones creadas antes
  /// de este campo, o en las que el modelo propone en juego (todavía sin objetivo estructurado).
  objetivo: string | null
  /// Recompensa estática, nunca decidida por el modelo (2026-07-25) — null/[] si no se ha
  /// definido ninguna para esta misión.
  rewardXp: number | null
  rewardItems: string[]
  /// Slug de la Location donde marcar el objetivo en el mapa (punto 3 del diseño de Gistera Koh,
  /// 2026-07-23) — resuelto en el backend desde `targetLocationId` o, si la misión apunta a un
  /// NPC en vez de a un sitio, desde su `homeLocationSlug`. Null si no hay objetivo geográfico
  /// conocido todavía.
  targetLocationSlug: string | null
}

/// 'profesion' (2026-08-07) — habilidades de oficio desbloqueadas por nivel, su propia pestaña
/// "Profesiones" en el panel de Habilidades (ver HabilidadesPanel.tsx), distinta de "Generales".
export type SavedActionCategory = 'combate' | 'general' | 'profesion'

export interface SavedActionInfo {
  id: string
  name: string
  promptText: string
  icon: string
  description: string
  isStarting: boolean
  /// Habilidad racial/de arma resincronizada sola (2026-07-29, sistema de habilidades por arma) —
  /// igual que `isStarting`, nunca editable/borrable a mano (ver DetailModal.tsx), pero se
  /// actualiza al cambiar de equipo o subir de nivel en vez de ser fija de por vida.
  isDynamic: boolean
  category: SavedActionCategory
  /// SOLO frontend, nunca viene del backend (rediseño de profesiones, 2026-08-07) — resuelto en
  /// GameView.tsx cruzando esta habilidad contra ProfessionRecipeInfo[] (GET /profession-recipes)
  /// por `name` cuando category === 'profesion', para poder enlazar a su entrada de Enciclopedia
  /// (`crafteo:${recipeKey}`) desde DetailModal.tsx. Undefined si no hay receta que enlazar.
  recipeKey?: string
  /// Rediseño del turno de combate (2026-07-28) — "tipo" para la rueda de debilidades (backend)
  /// y el color del chip (UI). Null en habilidades 'general' o en partidas de antes de este campo.
  preferredAttribute: Attribute | null
  /// Sistema de fatiga (2026-07-29) — coste de energía fijo por tramo. Ver CombatPanel.tsx.
  energyCost: number
  /// Rediseño 2026-07-31 — energía que RECUPERA usar esta habilidad en un intercambio real
  /// (Defenderse=10/Esquivar=5); 0 en el resto, incluido Ataque Básico (que solo cuesta).
  energyRegen: number
  /// Rediseño 2026-07-31 (petición explícita: "ataque básico no es una habilidad como las demás,
  /// ni defenderse ni esquivar... son acciones que tienen todos los personajes") — marca los 3
  /// genéricos (Ataque Básico/Defenderse/Esquivar) para su propio bloque en la UI, separado de las
  /// habilidades reales (de clase/raciales/de arma). Sustituye a la vieja heurística
  /// `energyCost === 0` (dejó de servir en cuanto Ataque Básico pasó a costar 5).
  isGeneric: boolean
  /// Rediseño 2026-07-31 — habilidad real por categoría de arma (p.ej. "Tajo Horizontal" del
  /// hacha) colapsada en una sola tarjeta por llevar la MISMA categoría en las dos manos — mejor
  /// dificultad al usarla (backend), nunca un segundo golpe real. Ver CombatPanel.tsx.
  dualWield: boolean
  /// Rediseño de combate (2026-08-09) — 'ataque' (único rol que hace daño incondicional al
  /// conectar), 'defensa' (nunca hace daño) o 'utilidad' (reactiva/condicionada al rival, ver
  /// CombatExchangeBadge.tsx y el backend). Null en habilidades 'general' o partidas antiguas.
  rol: 'ataque' | 'defensa' | 'utilidad' | null
}

export type CondicionFisica = 'ILESO' | 'HERIDO' | 'GRAVE' | 'INCAPACITADO' | 'MUERTO'
export type Dificultad = 'NOVATO' | 'MEDIO' | 'AVANZADO'

export interface DiscoveryItem {
  itemCatalogSlug: string
  name: string
  cantidad: number
}

export interface NpcInSceneInfo {
  slug: string
  name: string
  // Estado real de NpcState al empezar este combate (2026-07-19) — evita que el popup asuma
  // siempre ILESO/sin saquear para un NPC que ya venía herido o saqueado de un encuentro anterior.
  condicionFisica: CondicionFisica
  saqueado: boolean
  // Saqueo parcial (2026-07-31) — nombres de objeto ya copiados al inventario de este NPC en esta
  // partida, para que el modal de saqueo pueda dejar de ofrecer lo que ya te llevaste.
  lootedItemNames: string[]
  // Rediseño de combate (2026-08-09, "Analizar rival") — gatea si CombatPanel.tsx § EnemyFicha
  // muestra el atributo recomendado contra este rival. Sin analizar, la ficha no muestra nada.
  analizado: boolean
}

/// Un enlace de objeto/habilidad estilo World of Warcraft, insertado dentro del propio texto
/// libre del composer (no como adjunto aparte): chip no editable con icono + nombre, tooltip con
/// la descripción al pasar el ratón. Ver ChatComposer.tsx.
export interface ComposerChip {
  icon: string
  label: string
  description?: string
  /// Texto real que se manda al backend al serializar (ver ChatComposer.tsx) — por defecto, si no
  /// se da, se usa `label`. Necesario para habilidades: el chip muestra el nombre corto ("Furia de
  /// Maktor"), pero lo que debe leer el modelo es el `promptText` completo de la acción, no el
  /// nombre (bug real encontrado 2026-07-21: sin esto, usar cualquier habilidad mandaba solo su
  /// nombre entre comillas, sin ninguna descripción de la acción física).
  value?: string
}

export interface CurrentLocationInfo {
  id: string
  slug: string
  name: string
  region: string
  description: string
}

export interface DestinationInfo {
  locationId: string
  slug: string
  name: string
  minutos: number
}

export interface ProgressionResult {
  xpDelta: number
  newXp: number
  newLevel: number
  leveledUp: boolean
  attributePointsGained: number
}
