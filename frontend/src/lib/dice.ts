import type { Attribute, AttributeBlock, RollInfo } from '../types'

export function rollCheck(attributes: AttributeBlock, attribute: Attribute, difficulty = 12): RollInfo {
  const die = Math.floor(Math.random() * 20) + 1
  const value = attributes[attribute]
  const result = die + Math.floor(value / 2)
  return {
    attribute,
    value,
    difficulty,
    result,
    success: result >= difficulty,
  }
}

export const attributeLabels: Record<Attribute, string> = {
  fuerza: 'Fuerza',
  destreza: 'Destreza',
  sigilo: 'Sigilo',
  voluntad: 'Voluntad',
  carisma: 'Carisma',
  arcano: 'Arcano',
}
