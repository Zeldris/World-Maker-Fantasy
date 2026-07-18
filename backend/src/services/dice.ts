/// Fórmula de tirada — decisión de mecánicas 1 (docs/06-decisiones-mecanicas.md).
export type Attribute = 'fuerza' | 'destreza' | 'sigilo' | 'voluntad' | 'carisma' | 'arcano'
export type AttributeBlock = Record<Attribute, number>

export interface RollResult {
  attribute: Attribute
  value: number
  roll: number
  result: number
  difficulty: number
  success: boolean
}

export function rollCheck(attributes: AttributeBlock, attribute: Attribute, difficulty: number): RollResult {
  const value = attributes[attribute]
  const roll = Math.floor(Math.random() * 20) + 1
  const result = roll + Math.floor(value / 2)
  return { attribute, value, roll, result, difficulty, success: result >= difficulty }
}
