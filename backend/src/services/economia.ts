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

// ═══════════════════════════════════════════════════════════════════════════
// § 4.4 Mercado regulado (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md, 2026-09-21) — precio DINÁMICO derivado
// de stock real, sin ningún tick de oferta/demanda simulado aparte (grounding real X4:
// "automatic pricing means that a station will automatically lower the ware price the more wares
// in stock, and vice versa" — mucho stock = barato al vender/caro al comprar, poco stock = al
// revés). El precio BASE que este factor escala es `ItemCatalog.valorGoirnos` (el valor FINAL ya
// curado a mano en `worldCatalog.ts`, no `valorGoirnosBaseFor` recalculado de bruto — ese sigue
// siendo solo el punto de partida que se ajustó contra lore/rareza real, el mercado debe cobrar
// el precio de catálogo de verdad, curado).
// ═══════════════════════════════════════════════════════════════════════════

/// Umbral de stock "normal" — por encima de este número, más stock ya no abarata más (tope real,
/// nunca precio 0); por debajo, escasez real empieza a encarecer. Cifra de partida, ajustable
/// jugando como el resto de constantes del proyecto — ni tan bajo que 2 unidades ya disparen el
/// precio al techo, ni tan alto que haga falta almacenar cientos de unidades para notar el efecto.
export const STOCK_NORMAL = 10;
/// Factor mínimo (mucho stock, comprando muy barato/vendiendo muy barato) y máximo (stock casi
/// agotado, comprando muy caro/vendiendo muy caro) — banda 0.5x-2x sobre el precio base, mismo
/// criterio de "cifra de partida ajustable" que el resto.
const FACTOR_MIN = 0.5;
const FACTOR_MAX = 2;

/// Puro — factor multiplicativo sobre `valorGoirnosBaseFor` según `cantidadDisponible` (el stock
/// de quien VENDE: el Almacén de una Faction cuando el jugador compra, el Almacén del jugador
/// cuando vende). Curva simple: `STOCK_NORMAL` unidades da factor 1 (precio base tal cual), 0
/// unidades da `FACTOR_MAX` (escasez real, caro), `STOCK_NORMAL * 2` o más da `FACTOR_MIN` (sobra,
/// barato) — interpolación lineal entre esos 3 puntos, acotada a la banda.
export function factorPrecioPorStock(cantidadDisponible: number): number {
  if (cantidadDisponible <= 0) return FACTOR_MAX;
  if (cantidadDisponible >= STOCK_NORMAL * 2) return FACTOR_MIN;
  if (cantidadDisponible === STOCK_NORMAL) return 1;
  if (cantidadDisponible < STOCK_NORMAL) {
    // Interpola entre (0, FACTOR_MAX) y (STOCK_NORMAL, 1).
    const progreso = cantidadDisponible / STOCK_NORMAL;
    return FACTOR_MAX - progreso * (FACTOR_MAX - 1);
  }
  // Interpola entre (STOCK_NORMAL, 1) y (STOCK_NORMAL*2, FACTOR_MIN).
  const progreso = (cantidadDisponible - STOCK_NORMAL) / STOCK_NORMAL;
  return 1 - progreso * (1 - FACTOR_MIN);
}

/// Puro — precio final de UNA unidad, redondeado al Goirno entero más cercano (mínimo 1 Goirno
/// para cualquier item con valor base > 0, nunca 0 por redondeo hacia abajo de un valor base bajo
/// con mucho stock — un objeto con valor real sigue costando algo, por poco stock que "sobre").
export function precioDinamico(valorBase: number, cantidadDisponible: number): number {
  if (valorBase <= 0) return 0;
  return Math.max(1, Math.round(valorBase * factorPrecioPorStock(cantidadDisponible)));
}
