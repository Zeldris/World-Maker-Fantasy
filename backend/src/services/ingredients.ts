import type { ItemTipo } from '@prisma/client';

/// Refactor de ingredientes (2026-07-29) — sustituye el matching por PREFIJO DE NOMBRE que usaban
/// crafting.ts (`ingredientNamePrefixes`) y construction.ts (`ResourceRequirement.namePrefix`) por
/// uno real contra el catálogo: `exact` para un objeto concreto (el antídoto exige salvia del
/// polvo, no cualquier hierba) y `category` para un grupo fungible (el campamento exige "cualquier
/// piel", antes vía el hack de prefijo "Piel de").
export type IngredientMatch = { kind: 'exact'; catalogSlug: string } | { kind: 'category'; tipo: ItemTipo; category: string };

export interface IngredientRequirement {
  match: IngredientMatch;
  cantidad: number;
  /// Para narrar qué falta (reemplaza ResourceRequirement.label de construction.ts).
  label: string;
  /// Alternativa opcional (2026-08-15, petición explícita: el Saquito de arena imán "sirve como si
  /// fueran 4 montones de imán pero ocupando solo 1 slot en el inventario") — una fila que matchea
  /// `orMatch.match` cuenta como `unitsPerMatch` unidades del ingrediente normal. Resuelto ANTES de
  /// tocar el ingrediente normal (ver `planConsumption`): una alternativa que ya cubre lo necesario
  /// se prefiere entera a fraccionar unidades sueltas del ingrediente normal. Ninguna receta
  /// existente declara esto — comportamiento idéntico al de siempre para todas las demás.
  orMatch?: { match: IngredientMatch; unitsPerMatch: number };
}

export interface CatalogLookup {
  tipo: ItemTipo;
  category: string;
  /// Herramienta requerida por oficio (2026-08-17) — opcional: no todos los callers de
  /// `CatalogLookup` lo rellenan (solo hace falta donde se comprueba `CraftingRecipe.oficio`, ver
  /// `hasToolForOficio` en crafting.ts). Undefined = "sin dato", tratado igual que `[]`.
  herramientaParaOficio?: string[];
}

export interface InventoryRowLike {
  id: string;
  name: string;
  catalogSlug: string | null;
}

function matchesRow(row: InventoryRowLike, match: IngredientMatch, catalogBySlug: Map<string, CatalogLookup>): boolean {
  if (match.kind === 'exact') return row.catalogSlug === match.catalogSlug;
  const info = row.catalogSlug ? catalogBySlug.get(row.catalogSlug) : undefined;
  return !!info && info.tipo === match.tipo && info.category === match.category;
}

const QUANTITY_SUFFIX_REGEX = /\((\d+)\)\s*$/;

/// Cantidad real de una fila de inventario: el patrón ya establecido (turnResolution.ts,
/// harvest.ts, construction.ts) mete la cantidad en el propio nombre, ej. "Leña (60)". Sin
/// sufijo, unidad suelta = 1. Idéntico a construction.ts, movido aquí para que ambos motores de
/// receta compartan una sola implementación.
export function quantityOf(name: string): number {
  const match = name.match(QUANTITY_SUFFIX_REGEX);
  return match ? Number(match[1]) : 1;
}

export function baseNameOf(name: string): string {
  return name.replace(QUANTITY_SUFFIX_REGEX, '').trim();
}

/// Puro: cuántas unidades de este ingrediente lleva el jugador encima, sumando entre todas las
/// filas que matchean (una especie puede materializar varias filas en distintos momentos). Suma
/// también el equivalente de `orMatch` si la receta lo declara (ver IngredientRequirement).
export function totalQuantity(rows: InventoryRowLike[], ingredient: IngredientRequirement, catalogBySlug: Map<string, CatalogLookup>): number {
  const normal = rows.filter((r) => matchesRow(r, ingredient.match, catalogBySlug)).reduce((sum, r) => sum + quantityOf(r.name), 0);
  if (!ingredient.orMatch) return normal;
  const alt = rows.filter((r) => matchesRow(r, ingredient.orMatch!.match, catalogBySlug)).reduce((sum, r) => sum + quantityOf(r.name), 0);
  return normal + alt * ingredient.orMatch.unitsPerMatch;
}

export interface IngredientStatus {
  label: string;
  tienes: number;
  necesitas: number;
  met: boolean;
}

// Deshabilitar recetas ya desbloqueadas si faltan materiales (2026-08-13, petición explícita: "que
// salgan deshabilitadas si no cumples las condiciones... el hover con la información que saque los
// recursos necesarios y cuántos tienes... tipo 5/10"). A diferencia de `totalQuantity`/`checkRecipe`
// (que solo dicen qué FALTA), esto devuelve TODOS los ingredientes con su "tienes/necesitas" — hace
// falta el conteo también de los que ya cumples, para el "5/5" del hover, no solo de los que no.
export function checkIngredients(
  requirements: IngredientRequirement[],
  rows: InventoryRowLike[],
  catalogBySlug: Map<string, CatalogLookup>,
): IngredientStatus[] {
  return requirements.map((req) => {
    const tienes = totalQuantity(rows, req, catalogBySlug);
    return { label: req.label, tienes, necesitas: req.cantidad, met: tienes >= req.cantidad };
  });
}

export interface ConsumptionPlan {
  deleteIds: string[];
  updateRemainder: { id: string; newQuantity: number } | null;
}

/// Puro: decide exactamente qué filas borrar y cuál actualizar con el remanente (si sobra) para
/// consumir `ingredient.cantidad` unidades ya confirmadas como disponibles — no toca la base de
/// datos, misma lógica exacta que construction.ts ya tenía, solo con el nuevo predicado de match.
/// Con `orMatch`, se gasta primero de la alternativa (una fila ya completa se prefiere a fraccionar
/// el ingrediente normal) y solo se recurre al normal con lo que sobre de necesidad — nunca se
/// tocan ambos a la vez: o la alternativa cubre entera la necesidad (y aquí termina), o se agota
/// entera y el resto se resuelve igual que siempre contra el ingrediente normal.
export function planConsumption(
  rows: InventoryRowLike[],
  ingredient: IngredientRequirement,
  catalogBySlug: Map<string, CatalogLookup>,
): ConsumptionPlan {
  const deleteIds: string[] = [];
  let updateRemainder: ConsumptionPlan['updateRemainder'] = null;
  let remaining = ingredient.cantidad;

  if (ingredient.orMatch) {
    const { match: altMatch, unitsPerMatch } = ingredient.orMatch;
    const altRows = rows.filter((r) => matchesRow(r, altMatch, catalogBySlug));
    for (const row of altRows) {
      if (remaining <= 0) break;
      const rowQty = quantityOf(row.name);
      const rowUnits = rowQty * unitsPerMatch;
      if (rowUnits <= remaining) {
        deleteIds.push(row.id);
        remaining -= rowUnits;
      } else {
        const wholeNeeded = Math.ceil(remaining / unitsPerMatch);
        if (wholeNeeded >= rowQty) {
          deleteIds.push(row.id);
        } else {
          updateRemainder = { id: row.id, newQuantity: rowQty - wholeNeeded };
        }
        remaining = 0;
      }
    }
  }

  if (remaining > 0) {
    const matching = rows.filter((r) => matchesRow(r, ingredient.match, catalogBySlug));
    for (const row of matching) {
      if (remaining <= 0) break;
      const q = quantityOf(row.name);
      if (q <= remaining) {
        deleteIds.push(row.id);
        remaining -= q;
      } else {
        updateRemainder = { id: row.id, newQuantity: q - remaining };
        remaining = 0;
      }
    }
  }

  return { deleteIds, updateRemainder };
}
