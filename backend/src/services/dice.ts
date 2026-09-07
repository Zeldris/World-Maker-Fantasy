/// Fórmula de tirada — decisión de mecánicas 1 (docs/06-decisiones-mecanicas.md).
///
/// Rediseño de atributos (2026-07-29, "sigue baldurs gate 3 y D&D para próximas referencias, que
/// son juegos que coinciden más con lo que estamos creando" — el motor de Tarkor ya usa dados y
/// tablas de XP de D&D 5e, así que su set de habilidades es la referencia que de verdad encaja,
/// no GW2/WoW): los 6 clásicos de D&D (Fuerza/Destreza/Constitución/Inteligencia/Sabiduría/
/// Carisma), con Voluntad en vez de "Sabiduría" (mismo concepto, nombre que ya usaba el
/// proyecto) + Magia aparte (renombrado desde "Arcano" el 2026-09-01, ver
/// docs/rpgtarkor/clases.md § Atributo Magia) — en el lore propio de Tarkor la magia "nace del
/// origen salvaje e incontrolado de la Semilla... nunca fue diseñada ni domesticada por nadie",
/// no es lo mismo que Inteligencia (memoria/lógica) como en D&D puro. Sigilo baja a
/// SecondaryAttribute (no es un atributo primario ni en D&D — ahí es una habilidad bajo Destreza).
export type Attribute = 'fuerza' | 'destreza' | 'constitucion' | 'inteligencia' | 'voluntad' | 'carisma' | 'magia'
export type AttributeBlock = Record<Attribute, number>

/// Grados de éxito (docs/08-acciones-por-tiempo.md § 5, roadmap 2026-07-19 — llegó a tener un
/// tercer grado, 'con_coste', retirado el 2026-09-07 tras el hallazgo 15/19b de
/// revisar-partida-hallazgos.md: era puramente cosmético en combate/acciones libres — el
/// desenlace real de un intercambio ya se decide por el margen antes de que este campo se
/// asignara, así que "con coste" solo añadía una etiqueta que a veces contradecía el resultado
/// real (ej. "Gana Gorhorn" + "Éxito con coste" a la vez). GradoRecurso (más abajo, recolección)
/// SÍ tiene un tercer grado con efecto real y queda fuera de este cambio a propósito.
export type GradoExito = 'claro' | 'fallo'

export interface RollResult {
  attribute: Attribute
  value: number
  roll: number
  result: number
  difficulty: number
  /// Redundante con `gradoExito !== 'fallo'` desde el 2026-09-07 (ver comentario de GradoExito)
  /// — se mantiene por compatibilidad con todo el código que ya solo mira éxito/fallo (XP,
  /// materialización de loot/despiece/producción...).
  success: boolean
  gradoExito: GradoExito
}

export function gradoExitoFor(result: number, difficulty: number): GradoExito {
  return result >= difficulty ? 'claro' : 'fallo'
}

export function rollCheck(attributes: AttributeBlock, attribute: Attribute, difficulty: number): RollResult {
  const value = attributes[attribute]
  const roll = Math.floor(Math.random() * 20) + 1
  const result = roll + Math.floor(value / 2)
  const gradoExito = gradoExitoFor(result, difficulty)
  return { attribute, value, roll, result, difficulty, success: gradoExito !== 'fallo', gradoExito }
}

/// D&D real: 'ventaja' tira 2d20 y se queda con el mejor, 'desventaja' con el peor — NUNCA un
/// modificador numérico plano (mismo criterio ya confirmado con la usuaria para `rollGathering`,
/// ver `SUERTE_VENTAJA_UMBRAL` más abajo). Extraído (2026-08-28, pasivas raciales — ver
/// combatExchange.ts § rollSide) para que combate y recolección compartan la misma primitiva en
/// vez de reimplementar el mismo "tira 1 o 2 dados, elige el extremo que toque" cada vez.
export type RollMode = 'normal' | 'ventaja' | 'desventaja'

export interface D20RollResult {
  /// Un elemento si 'normal', dos (los dos d20 tirados) si 'ventaja'/'desventaja' — el frontend
  /// anima ambos y tacha el descartado, mismo criterio ya usado en `GatheringRollResult.rolls`.
  rolls: number[]
  usedRoll: number
}

export function rollD20(mode: RollMode, random: () => number = Math.random): D20RollResult {
  const rollOnce = () => Math.floor(random() * 20) + 1
  if (mode === 'normal') {
    const roll = rollOnce()
    return { rolls: [roll], usedRoll: roll }
  }
  const rolls = [rollOnce(), rollOnce()]
  const usedRoll = mode === 'ventaja' ? Math.max(...rolls) : Math.min(...rolls)
  return { rolls, usedRoll }
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

/// Tirada opuesta (Grupo 3 § Compañeros y supervivencia, 2026-08-25, ver
/// docs/rpgtarkor/companeros-y-supervivencia.md § 2/3: "eliges un atributo tuyo, compite contra el
/// atributo propio de esa especie/NPC") — deliberadamente SEPARADA de `rollCheck`/`rollGathering`,
/// mismo criterio que ambas: nunca tocar la fórmula de combate para esto, aunque la forma d20 +
/// mitad de atributo sea la misma. Empate (margen 0) lo gana la resistencia, no el jugador — mismo
/// criterio que `combatExchange.ts` (`margen > 0` para tener éxito, nunca `>= 0`).
export interface OpposedRollResult {
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

export function rollOpposed(
  playerAttributes: AttributeBlock,
  playerAttribute: Attribute,
  resistenciaAttributes: AttributeBlock,
  resistenciaAttribute: Attribute,
  random: () => number = Math.random,
): OpposedRollResult {
  const rollOnce = () => Math.floor(random() * 20) + 1
  const playerValue = playerAttributes[playerAttribute]
  const playerRoll = rollOnce()
  const playerResult = playerRoll + Math.floor(playerValue / 2)
  const resistenciaValue = resistenciaAttributes[resistenciaAttribute]
  const resistenciaRoll = rollOnce()
  const resistenciaResult = resistenciaRoll + Math.floor(resistenciaValue / 2)
  const margen = playerResult - resistenciaResult
  return {
    playerAttribute,
    playerValue,
    playerRoll,
    playerResult,
    resistenciaAttribute,
    resistenciaValue,
    resistenciaRoll,
    resistenciaResult,
    margen,
    gano: margen > 0,
  }
}
