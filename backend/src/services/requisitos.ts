import type { Attribute, AttributeBlock } from './dice.js';
import type { SecondaryAttribute, SecondaryAttributeBlock } from './secondaryAttributes.js';

/// Umbral compartido por objetos y construcciones (sesión de diseño 2026-07-23) — "Craftable":
/// tier + requisitos + oficio opcional. Comparación pura `atributo_pj >= requisito`, cero IA,
/// reutilizada tanto por crafting.ts (objetos) como construction.ts (edificios) para no duplicar
/// la misma lógica de comprobación dos veces.
export type RequisitoAttribute = Attribute | SecondaryAttribute;
export type Requisitos = Partial<Record<RequisitoAttribute, number>>;

export interface RequisitoShortfall {
  atributo: RequisitoAttribute;
  tienes: number;
  necesitas: number;
}

/// Puro: qué atributos no llegan al mínimo exigido — vacío si se cumplen todos (o si no hay
/// requisitos). `alivio` (nivel de oficio, sección 3 del diseño) resta al mínimo exigido SOLO
/// cuando el caller lo pasa explícitamente — nunca se aplica solo, nunca toca la fórmula de
/// tirada (dice.ts), solo este umbral.
export function checkRequisitos(
  requisitos: Requisitos | undefined,
  attributes: AttributeBlock,
  secondaryAttributes: SecondaryAttributeBlock,
  alivio = 0,
): RequisitoShortfall[] {
  if (!requisitos) return [];
  const shortfalls: RequisitoShortfall[] = [];
  for (const entry of Object.entries(requisitos) as [RequisitoAttribute, number][]) {
    const [atributo, necesitaBase] = entry;
    const necesitas = Math.max(0, necesitaBase - alivio);
    const tienes = atributo in attributes ? attributes[atributo as Attribute] : secondaryAttributes[atributo as SecondaryAttribute];
    if (tienes < necesitas) shortfalls.push({ atributo, tienes, necesitas });
  }
  return shortfalls;
}

/// Texto de una carencia para inyectar en la narración (mismo criterio que `RequirementShortfall`
/// de construction.ts para materiales) — p.ej. "fuerza 10/12".
export function shortfallLabel(s: RequisitoShortfall): string {
  return `${s.atributo} ${s.tienes}/${s.necesitas}`;
}
