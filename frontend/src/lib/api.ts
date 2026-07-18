import type {
  Attribute,
  AttributeBlock,
  BuildingInfo,
  CompanionInfo,
  InventoryItemInfo,
  LogEntry,
  ProgressionResult,
  RollInfo,
  SavedActionCategory,
  SavedActionInfo,
  SubjectInfo,
  TerritoryInfo,
} from '../types'

// Backend local — hardcodeado por simplicidad mientras solo se prueba en local.
// TODO: mover a variable de entorno (VITE_API_URL) cuando haga falta desplegar en algún sitio.
const API_URL = 'http://localhost:3001'

export type Banda = 'instantanea' | 'corta' | 'extendida' | 'larga'

export interface ClassificationResult {
  requiereTirada: boolean
  atributo: Attribute
  dificultad: number
  razon: string
  banda: Banda
  duracionEstimadaMinutos: number
}

export interface ClassifyResponse {
  classification: ClassificationResult
  roll?: RollInfo
  // Presente en bandas instantánea/corta — cuánto tarda la acción en la ficción.
  duracionMinutos?: number
  produccion?: string
  // Presente en bandas extendida/larga — el turno ya quedó resuelto en diferido, no hace falta narrar.
  transit?: { busyUntil: string }
}

export interface BusyError {
  status: 409
  activity: string
  busyUntil: string
}

export async function requestTurnClassify(params: { saveId: string; action: string }): Promise<ClassifyResponse> {
  const response = await fetch(`${API_URL}/turn/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (response.status === 409) {
    const body = await response.json()
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
}

export async function requestTurnNarrate(params: {
  saveId: string
  action: string
  classification: ClassificationResult
  roll?: RollInfo
}): Promise<NarrateResponse> {
  const response = await fetch(`${API_URL}/turn/narrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`El backend respondió ${response.status}`)
  }

  return response.json()
}

export interface EntornoResponse {
  description: string
  event: string
}

export async function requestSurroundings(params: { saveId: string }): Promise<EntornoResponse> {
  const response = await fetch(`${API_URL}/entorno`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`El backend respondió ${response.status}`)
  }

  return response.json()
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
}

export async function createSave(params: CreateSaveParams): Promise<{ id: string }> {
  const response = await fetch(`${API_URL}/saves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`El backend respondió ${response.status}`)
  }

  return response.json()
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
}

export async function getSave(id: string): Promise<SaveDetail> {
  const response = await fetch(`${API_URL}/saves/${id}`)

  if (!response.ok) {
    throw new Error(`El backend respondió ${response.status}`)
  }

  return response.json()
}

export interface SaveSummary {
  id: string
  worldId: string
  worldName: string
  characterName: string
  fictionalDate: string
  lastPlayedAt: string
}

export async function restartSave(id: string): Promise<{ id: string }> {
  const response = await fetch(`${API_URL}/saves/${id}/restart`, { method: 'POST' })

  if (!response.ok) {
    throw new Error(`El backend respondió ${response.status}`)
  }

  return response.json()
}

export async function spendAttributePoint(
  id: string,
  attribute: Attribute,
): Promise<{ attributes: AttributeBlock; pendingAttributePoints: number }> {
  const response = await fetch(`${API_URL}/saves/${id}/attribute-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attribute }),
  })

  if (!response.ok) {
    throw new Error(`El backend respondió ${response.status}`)
  }

  return response.json()
}

export async function createSavedAction(
  id: string,
  params: { name: string; promptText: string; icon: string; description: string; category: SavedActionCategory },
): Promise<SavedActionInfo> {
  const response = await fetch(`${API_URL}/saves/${id}/habilidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? `El backend respondió ${response.status}`)
  }

  return response.json()
}

export async function deleteSavedAction(id: string, habilidadId: string): Promise<void> {
  const response = await fetch(`${API_URL}/saves/${id}/habilidades/${habilidadId}`, { method: 'DELETE' })

  if (!response.ok) {
    throw new Error(`El backend respondió ${response.status}`)
  }
}

export async function setProfession(id: string, profession: string): Promise<{ profession: string }> {
  const response = await fetch(`${API_URL}/saves/${id}/profesion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profession }),
  })

  if (!response.ok) {
    throw new Error(`El backend respondió ${response.status}`)
  }

  return response.json()
}

export async function deleteSave(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/saves/${id}`, { method: 'DELETE' })

  if (!response.ok) {
    throw new Error(`El backend respondió ${response.status}`)
  }
}

export async function listSaves(): Promise<SaveSummary[]> {
  const response = await fetch(`${API_URL}/saves`)

  if (!response.ok) {
    throw new Error(`El backend respondió ${response.status}`)
  }

  return response.json()
}
