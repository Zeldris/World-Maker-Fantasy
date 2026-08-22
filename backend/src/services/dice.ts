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
