import type { ItemCatalogInput } from '../scripts/worldCatalog.js';

/// Sistema de moneda "Goirno" (2026-08-31, moneda única de Berig acuñada por los Goirntes,
/// aceptada también por orcos y Nabieus — estos últimos aceptan trueque si el jugador no lleva
/// Goirnos encima, los Goirntes prefieren cobrar en su propia moneda). Primer consumidor real:
/// "aprender un oficio de un NPC" (10 Goirnos o trueque equivalente); el resto de comercio futuro
/// (compra/venta, tasación de saqueo) se apoya en el mismo valor base.
///
/// Función pura (mismo estilo que professionProgress.ts/weaponAbilities.ts, sin Prisma) que
/// calcula el valor ORIENTATIVO de un item de catálogo a partir de datos ya existentes (`tipo`,
/// `tier`, `statBonuses`, `curaEnergia`, `curaHasta`) — nunca un número inventado sin dato real
/// detrás, mismo criterio que el resto del proyecto. El valor final que vive en
/// `ItemCatalogInput.valorGoirnos` parte de este cálculo pero puede AJUSTARSE a mano contra el
/// lore real (rareza de `lugarOrigen`, objetos codiciados por su `description`, reliquias no
/// vendibles) — ver worldCatalog.ts para el valor final ya ajustado de cada item.
///
/// `tier` omitido cuenta como 1 en todo el catálogo (mismo default que `ItemCatalog.tier` en
/// schema.prisma) — replicado aquí en vez de importar el default de Prisma porque esta función es
/// puro TypeScript sin Prisma de por medio.
function tierOrDefault(tier: number | undefined): number {
  return tier ?? 1;
}

/// RECURSO (materia prima cruda, nunca se fabrica): tabla fija por tier, no una fórmula lineal —
/// un recurso tier 5 (p.ej. fercaneo, "casi imposible de encontrar") vale bastante más que 5x un
/// tier 1, la rareza de encontrarlo pesa más que su tier nominal.
const RECURSO_BASE_BY_TIER: Record<number, number> = { 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 };

/// Tiers por encima de 5 existen en el catálogo real (yerreo/hiyerro/melena-cola-ferike/
/// esquirla-celeste-caida llegan hasta tier 9) aunque la tabla orientativa original solo cubría
/// 1-5 — se extrapola la misma progresión creciente (aprox. +5 por tramo, redondeado al alza) en
/// vez de dejar sin valor cualquier tier > 5, y esos casos concretos se revisan a mano de todos
/// modos contra su lore (ver worldCatalog.ts).
function recursoBase(tier: number): number {
  if (tier <= 5) return RECURSO_BASE_BY_TIER[tier] ?? RECURSO_BASE_BY_TIER[1];
  return RECURSO_BASE_BY_TIER[5] + (tier - 5) * 5;
}

/// MATERIAL (procesado, ya pasó por un oficio — lingotes/bloques/vigas/piezas): más caro que su
/// recurso crudo de origen, coherente con que alguien ya invirtió trabajo de oficio en él.
function materialBase(tier: number): number {
  return tier * 3;
}

/// CONSUMIBLE: base por tier + energía que restaura + cuánto rompe el tope de curación.
function consumibleBase(item: ItemCatalogInput): number {
  const tier = tierOrDefault(item.tier);
  let valor = tier * 2;
  if (item.curaEnergia) {
    valor += Math.floor(item.curaEnergia / 5);
  }
  if (item.curaHasta) {
    const extraPorTope: Record<'GRAVE' | 'HERIDO' | 'ILESO', number> = { GRAVE: 5, HERIDO: 10, ILESO: 20 };
    valor += extraPorTope[item.curaHasta];
  }
  return valor;
}

/// EQUIPABLE: base por tier + 2 Goirnos por cada punto de bonus mecánico (statBonuses, incluida
/// 'defensa') — un arma/armadura mecánicamente mejor vale más, mismo criterio de "nunca inventar
/// poder sin dato real detrás" que el resto del catálogo.
function equipableBase(item: ItemCatalogInput): number {
  const tier = tierOrDefault(item.tier);
  let valor = tier * 5;
  if (item.statBonuses) {
    const sumaBonuses = Object.values(item.statBonuses).reduce((acc: number, v) => acc + (v ?? 0), 0);
    valor += sumaBonuses * 2;
  }
  return valor;
}

/// Valor económico BASE en Goirnos, calculado con la fórmula determinista según `tipo`. NARRATIVO
/// y ESPECIAL (23 items del catálogo) no tienen fórmula — objetos de lore, trofeos, documentos y
/// efectos especiales cuyo valor (o su no-venta, ver items con `valorGoirnos: 0` en
/// worldCatalog.ts) se decide caso por caso contra su `description`/lore real, nunca por cálculo.
/// Esta función devuelve 0 para ambos como punto de partida explícito, no un placeholder olvidado.
export function valorGoirnosBaseFor(item: ItemCatalogInput): number {
  const tier = tierOrDefault(item.tier);
  switch (item.tipo) {
    case 'RECURSO':
      return recursoBase(tier);
    case 'MATERIAL':
      return materialBase(tier);
    case 'CONSUMIBLE':
      return consumibleBase(item);
    case 'EQUIPABLE':
      return equipableBase(item);
    case 'NARRATIVO':
    case 'ESPECIAL':
      return 0;
    default:
      return 0;
  }
}
