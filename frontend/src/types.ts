export type Attribute = 'fuerza' | 'destreza' | 'sigilo' | 'voluntad' | 'carisma' | 'arcano'

export type AttributeBlock = Record<Attribute, number>

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
}

export type LogChannel = 'character' | 'world'

export interface RollInfo {
  attribute: Attribute
  value: number
  difficulty: number
  result: number
  success: boolean
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
}

export interface InventoryItemInfo {
  id: string
  name: string
  description: string
  origin?: string
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

export type SavedActionCategory = 'combate' | 'general'

export interface SavedActionInfo {
  id: string
  name: string
  promptText: string
  icon: string
  description: string
  isStarting: boolean
  category: SavedActionCategory
}

/// Un "adjunto" combinable en el composer — una habilidad o un objeto de inventario que el
/// jugador ha marcado, mostrado como chip no editable junto al texto libre.
export type ComposerAttachment =
  | { type: 'ability'; ability: SavedActionInfo }
  | { type: 'item'; item: InventoryItemInfo }

export interface ProgressionResult {
  xpDelta: number
  newXp: number
  newLevel: number
  leveledUp: boolean
  attributePointsGained: number
}
