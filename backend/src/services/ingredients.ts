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
}

export interface CatalogLookup {
  tipo: ItemTipo;
  category: string;
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
/// filas que matchean (una especie puede materializar varias filas en distintos momentos).
export function totalQuantity(rows: InventoryRowLike[], ingredient: IngredientRequirement, catalogBySlug: Map<string, CatalogLookup>): number {
  return rows.filter((r) => matchesRow(r, ingredient.match, catalogBySlug)).reduce((sum, r) => sum + quantityOf(r.name), 0);
}

export interface ConsumptionPlan {
  deleteIds: string[];
  updateRemainder: { id: string; newQuantity: number } | null;
}

/// Puro: decide exactamente qué filas borrar y cuál actualizar con el remanente (si sobra) para
/// consumir `ingredient.cantidad` unidades ya confirmadas como disponibles — no toca la base de
/// datos, misma lógica exacta que construction.ts ya tenía, solo con el nuevo predicado de match.
export function planConsumption(
  rows: InventoryRowLike[],
  ingredient: IngredientRequirement,
  catalogBySlug: Map<string, CatalogLookup>,
): ConsumptionPlan {
  const matching = rows.filter((r) => matchesRow(r, ingredient.match, catalogBySlug));
  const deleteIds: string[] = [];
  let remaining = ingredient.cantidad;
  let updateRemainder: ConsumptionPlan['updateRemainder'] = null;
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
  return { deleteIds, updateRemainder };
}
