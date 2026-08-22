/// Fórmula de tirada — decisión de mecánicas 1 (docs/06-decisiones-mecanicas.md).
///
/// Rediseño de atributos (2026-07-29, "sigue baldurs gate 3 y D&D para próximas referencias, que
/// son juegos que coinciden más con lo que estamos creando" — el motor de Tarkor ya usa dados y
/// tablas de XP de D&D 5e, así que su set de habilidades es la referencia que de verdad encaja,
/// no GW2/WoW): los 6 clásicos de D&D (Fuerza/Destreza/Constitución/Inteligencia/Sabiduría/
/// Carisma), con Voluntad en vez de "Sabiduría" (mismo concepto, nombre que ya usaba el
/// proyecto) + Arcano aparte — en el lore propio de Tarkor la magia "nace del origen salvaje e
/// incontrolado de la Semilla... nunca fue diseñada ni domesticada por nadie", no es lo mismo que
/// Inteligencia (memoria/lógica) como en D&D puro. Sigilo baja a SecondaryAttribute (no es un
/// atributo primario ni en D&D — ahí es una habilidad bajo Destreza).
export type Attribute = 'fuerza' | 'destreza' | 'constitucion' | 'inteligencia' | 'voluntad' | 'carisma' | 'arcano'
export type AttributeBlock = Record<Attribute, number>

/// Grados de éxito (docs/08-acciones-por-tiempo.md § 5, roadmap 2026-07-19 — pendiente desde el
/// diseño original, nunca implementado): misma tirada de siempre, lectura en tres zonas en vez de
/// binaria — no añade ninguna llamada nueva, es leer distinto el mismo número.
export type GradoExito = 'claro' | 'con_coste' | 'fallo'

export interface RollResult {
  attribute: Attribute
  value: number
  roll: number
  result: number
  difficulty: number
  /// true para 'claro' y 'con_coste' (la acción se completa en ambos) — se mantiene por
  /// compatibilidad con todo el código que ya solo mira éxito/fallo (XP, materialización de
  /// loot/despiece/producción...); gradoExito es la lectura más rica, solo para narrar.
  success: boolean
  gradoExito: GradoExito
}

export function gradoExitoFor(result: number, difficulty: number): GradoExito {
  if (result >= difficulty + 5) return 'claro'
  if (result >= difficulty) return 'con_coste'
  return 'fallo'
}

export function rollCheck(attributes: AttributeBlock, attribute: Attribute, difficulty: number): RollResult {
  const value = attributes[attribute]
  const roll = Math.floor(Math.random() * 20) + 1
  const result = roll + Math.floor(value / 2)
  const gradoExito = gradoExitoFor(result, difficulty)
  return { attribute, value, roll, result, difficulty, success: gradoExito !== 'fallo', gradoExito }
}

/// Percepción pasiva (remodelado de atributos secundarios, 2026-08-22) — mismo criterio que D&D
/// (10 + modificador de Sabiduría, sin tirada): vigilancia de fondo, nunca una tirada activa.
/// Voluntad es el equivalente de Sabiduría del proyecto (ver comentario de `Attribute` arriba),
/// así que se deriva de ahí en vez de guardar un campo propio en `secondaryAttributes.ts`.
export function percepcionPasivaFor(voluntad: number): number {
  return 10 + Math.floor(voluntad / 2)
}

/// Tirada de Explorar/Desollar (rediseño de recolección, 2026-08-22, petición explícita: "para los
/// recursos que obtenemos por región cuando exploras, hay que añadirle una tirada visual... segun
/// tu tirada tienes 1. la probabilidad de que el objeto salga en el listado 2. La probabilidad
/// segun lo que has sacado de que aparezca mas cantidad de ese item"). Deliberadamente SEPARADA de
/// `rollCheck`/`gradoExitoFor` — nunca se toca la fórmula de combate para esto. `bonusOficio` es
/// `alivioForLevel` del nivel de oficio (professionProgress.ts), el equivalente D&D de bono de
/// competencia: subir de nivel el oficio ya sube esta tirada, sin inventar un número nuevo.
///
/// Suerte da VENTAJA, nunca un modificador numérico (así es como D&D trata la suerte de verdad:
/// rasgo Lucky de Halfling / dote Lucky = repetir tirada o tirar con ventaja, jamás sumar un bonus
/// fijo como haría un atributo primario) — confirmado explícitamente con la usuaria tras revisar
/// el precedente real, y a propósito NUNCA tocando `rollCheck`: los atributos secundarios se
/// remodelaron (commit `1080c90`) precisamente para separarlos de toda tirada de combate, Suerte
/// con ventaja solo pesa aquí. Umbral y toda la escala de dificultad/cantidad son cifras de
/// partida, ajustables tras jugarlo — no un cierre definitivo.
export const SUERTE_VENTAJA_UMBRAL = 12

export interface GatheringRollResult {
  attribute: Attribute
  value: number
  bonusOficio: number
  /// Un elemento si no hubo ventaja, dos (los dos d20 tirados) si sí la hubo — el frontend anima
  /// ambos y tacha el descartado.
  rolls: number[]
  usedRoll: number
  result: number
  advantage: boolean
}

export function rollGathering(
  attributes: AttributeBlock,
  attribute: Attribute,
  bonusOficio: number,
  suerte: number,
  random: () => number = Math.random,
): GatheringRollResult {
  const value = attributes[attribute]
  const advantage = suerte >= SUERTE_VENTAJA_UMBRAL
  const rollOnce = () => Math.floor(random() * 20) + 1
  const rolls = advantage ? [rollOnce(), rollOnce()] : [rollOnce()]
  const usedRoll = Math.max(...rolls)
  const result = usedRoll + Math.floor(value / 2) + bonusOficio
  return { attribute, value, bonusOficio, rolls, usedRoll, result, advantage }
}

export type GradoRecurso = 'fallo' | 'con_coste' | 'claro'

/// Mismos tres tramos que `gradoExitoFor` (margen +5 = claro), pero como tipo propio: un recurso
/// que "falla" aquí no es un fallo narrativo de la acción, solo no aparece este intento — mezclarlo
/// con `GradoExito`/`success` de combate confundiría ambos sistemas.
export function gradoForRecurso(result: number, dificultad: number): GradoRecurso {
  if (result >= dificultad + 5) return 'claro'
  if (result >= dificultad) return 'con_coste'
  return 'fallo'
}

/// Dificultad de un recurso = 10 + su tier de `ItemCatalog` (1-7 en la práctica, omitido = 1 común
/// — mismo default que ya usa `requisitos.ts` para tier ausente). Reutiliza un campo que ya existía
/// para equipo/requisitos en vez de añadir uno nuevo por recurso.
export function dificultadForTier(tier: number | null | undefined): number {
  return 10 + (tier ?? 1)
}

/// `con_coste` da la mitad (redondeo arriba, mínimo 1 — nunca 0 si el recurso sí apareció),
/// `claro` da el máximo de siempre (`HarvestYield.cantidad`).
export function cantidadForGrado(grado: GradoRecurso, cantidadMaxima: number): number {
  if (grado === 'fallo') return 0
  if (grado === 'con_coste') return Math.max(1, Math.ceil(cantidadMaxima / 2))
  return cantidadMaxima
}
