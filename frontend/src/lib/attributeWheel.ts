import type { Attribute } from '../types'

/// Puerto del backend (backend/src/services/attributeWheel.ts) — mismo duplicado a propósito ya
/// usado en este proyecto para funciones puras pequeñas (ver totalInventoryUnits/
/// inventoryCapacityFor, sesión 2026-08-08) en vez de exponer un endpoint solo para esto. Aquí
/// SOLO la parte pura del multiplicador de tipo (rediseño de combate, 2026-08-09, "Analizar
/// rival") — sin `effectiveAttributeValue`/tiradas, que son cosa del backend.
const ATTRIBUTE_RING: Attribute[] = ['fuerza', 'destreza', 'inteligencia', 'magia', 'constitucion', 'voluntad', 'carisma']

function ringForwardSteps(a: Attribute, b: Attribute): number {
  const ring = ATTRIBUTE_RING
  const iA = ring.indexOf(a)
  const iB = ring.indexOf(b)
  return (iB - iA + ring.length) % ring.length
}

function ringDistance(a: Attribute, b: Attribute): number {
  const forward = ringForwardSteps(a, b)
  return Math.min(forward, ATTRIBUTE_RING.length - forward)
}

const TYPE_MULTIPLIER_BY_DISTANCE: Record<number, number> = { 1: 1.5, 2: 1.15, 3: 1 }

/// Mismo cálculo que `typeMultiplierFor` (backend), fijo al árbol 'ataque' (los dos árboles usan
/// hoy la misma magnitud, ver comentario del backend) — es el único que necesita "Analizar rival".
/// Solo premia, nunca penaliza (rediseño 2026-08-15, ver el mismo comentario largo en el backend):
/// el lado en desventaja de tipo se queda en 1 (neutro), nunca en `1 / magnitude`.
function typeMultiplierFor(tipoPropio: Attribute, tipoRival: Attribute): number {
  if (tipoPropio === tipoRival) return 1
  const distance = ringDistance(tipoPropio, tipoRival)
  const magnitude = TYPE_MULTIPLIER_BY_DISTANCE[distance] ?? 1
  if (magnitude === 1) return 1
  const forward = ringForwardSteps(tipoPropio, tipoRival)
  const tipoPropioGana = forward > ATTRIBUTE_RING.length - forward
  return tipoPropioGana ? magnitude : 1
}

/// "Analizar rival" (rediseño de combate, 2026-08-09) — qué atributo propio conviene usar contra
/// este rival concreto. Heurística simple ("ataca su punto fuerte por su ángulo débil", más fácil
/// de explicar en la UI que una media ponderada de los 7): el atributo del RIVAL con el valor más
/// alto decide el "objetivo", y se elige el atributo PROPIO con mejor multiplicador de tipo contra
/// ese objetivo.
export function recommendedAttributeAgainst(playerAttributes: Record<Attribute, number>, enemyAttributes: Record<Attribute, number>): Attribute {
  const attrs = Object.keys(playerAttributes) as Attribute[]
  const enemyHighest = attrs.reduce((best, a) => (enemyAttributes[a] > enemyAttributes[best] ? a : best), attrs[0])
  return attrs.reduce((best, a) => (typeMultiplierFor(a, enemyHighest) > typeMultiplierFor(best, enemyHighest) ? a : best), attrs[0])
}
