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
  /// Notificación de misión aceptada (2026-07-31, petición explícita: "que aparezca en la
  /// narración del personaje el título de la misión y el objetivo") — presente solo en el turno
  /// EXACTO en que se crea una misión nueva; LogPanel la pinta con fondo/borde amarillo y una
  /// tarjeta con el título+objetivo, en vez del estilo normal.
  newQuest?: { title: string; objetivo: string }
}

export type EquipSlot =
  | 'CASCO'
  | 'ABALORIO'
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

/// Categorización mecánica de objetos (2026-07-29) — ver itemTaxonomy.ts (backend). RECURSO: se
/// recoge/caza/tala/mina directo de la naturaleza. MATERIAL: sale de un proceso de crafteo.
/// EQUIPABLE/CONSUMIBLE/NARRATIVO: los de siempre, ahora agrupados bajo un bucket mecánico.
export type ItemTipo = 'RECURSO' | 'MATERIAL' | 'EQUIPABLE' | 'CONSUMIBLE' | 'NARRATIVO'

export interface InventoryItemInfo {
  id: string
  name: string
  description: string
  origin?: string
  slot: EquipSlot | null
  statBonusAttribute: Attribute | null
  statBonusAmount: number | null
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

export interface BuildingInfo {
  id: string
  territoryId?: string | null
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

export type SavedActionCategory = 'combate' | 'general'

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
