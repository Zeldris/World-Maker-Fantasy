import { professionLevelForXp, alivioForLevel } from './professionProgress.js';
import type { CraftingRecipe } from './crafting.js';
import type { InventoryRowLike, CatalogLookup, IngredientRequirement } from './ingredients.js';
import { totalQuantity } from './ingredients.js';

/// Panel de Reino real (docs/rpgtarkor/mundo-vivo-x4.md § 4.4-ter, 2026-09-21) — TICK puro de
/// `OrdenProduccion`, hermano de `kingdomTick.ts` (mismo criterio: determinista, cero IA, aplicado
/// una vez por día de ficción cruzado desde el MISMO bloque `if (diasCruzados > 0)` de
/// turnResolution.ts). Cubre TANTO recolección (receta sin `ingredients`) como crafteo (receta con
/// `ingredients`) con el mismo modelo — verificado con `WebSearch` real contra Bellwright y X4
/// Foundations antes de decidir (ver el documento): en ambos juegos es el mismo tipo de nodo, solo
/// cambia si la receta tiene input o no.
///
/// Decisión explícita de Álvaro ("en el reino yo no cuento, yo fabrico aparte... como en
/// Bellwright"): el jugador NUNCA es candidato a "trabajador libre" de este tick — solo los
/// `Companion` con `rolReino` y `buildingId` asignados a un `Building` concreto. El nivel de oficio
/// que decide si un trabajador "sabe" producir una receta es el de `ProfessionProgress.companionId`
/// (nunca el del jugador) — un `Companion` sin fila de `ProfessionProgress` para ese `oficio` se
/// trata como nivel 1 (igual que `professionLevelForXp(0) === 1`, mismo criterio que ya usa el
/// crafteo del jugador).

export interface TrabajadorReino {
  companionId: string;
  /// Record<professionId, xp> — solo las profesiones que este trabajador ya practicó alguna vez
  /// (mismo shape disperso que `ProfessionProgress`, no una fila por cada oficio posible).
  xpPorOficio: Record<string, number>;
}

export interface OrdenProduccionInput {
  id: string;
  recipeKey: string;
  modo: 'unico' | 'reponer';
  limite: number | null;
  prioridad: number;
  cantidadProducidaAcumulada: number;
  activa: boolean;
}

export type ResultadoOrden =
  | { ordenId: string; resultado: 'PRODUCIDA'; companionId: string; resultCatalogSlug: string | undefined; resultCantidad: number; ingredientesConsumidos: IngredientRequirement[] }
  | { ordenId: string; resultado: 'ALMACEN_LLENO' }
  | { ordenId: string; resultado: 'SIN_TRABAJADOR_CON_NIVEL' }
  | { ordenId: string; resultado: 'SIN_MATERIA_PRIMA' }
  | { ordenId: string; resultado: 'ORDEN_COMPLETADA' }
  | { ordenId: string; resultado: 'RECETA_DESCONOCIDA' };

/// Puro: nivel de oficio real de un trabajador para `professionId` — 1 si nunca lo practicó (mismo
/// fallback que `professionLevelForXp(0)`), nunca null/undefined.
export function nivelOficioDeTrabajador(trabajador: TrabajadorReino, professionId: string): number {
  return professionLevelForXp(trabajador.xpPorOficio[professionId] ?? 0);
}

/// Puro: ¿este trabajador tiene nivel de oficio suficiente para el `tier` de la receta? Mismo
/// criterio que ya usa el crafteo del jugador (`alivioForLevel`, professionProgress.ts) pero SOLO
/// mirando nivel de oficio — a propósito, sin `checkRequisitos` de atributos: decisión explícita de
/// Álvaro, el gate de un trabajador de Reino es su nivel de oficio, no sus atributos de personaje
/// (un `Companion` de Reino puede no tener `attributes` rellenos en absoluto).
///
/// `alivioForLevel` resta al mínimo EXIGIDO (mismo uso que `checkRequisitos`, requisitos.ts) —
/// nivel 1 (alivio 0) ya cubre tier 1 sin ayuda, tal como cualquier receta tier 1 no pide oficio
/// real para el jugador tampoco.
export function trabajadorPuedeProducir(trabajador: TrabajadorReino, recipe: CraftingRecipe): boolean {
  if (!recipe.oficio) return true;
  const nivel = nivelOficioDeTrabajador(trabajador, recipe.oficio);
  const tierRequerido = recipe.tier ?? 1;
  return tierRequerido <= Math.max(1, alivioForLevel(nivel) + 1);
}

/// Puro: si el resultado de la receta ya alcanzó su tope en `AlmacenLimite` (undefined/null =
/// sin tope, decisión explícita de Álvaro como default). `cantidadActual` es lo que ya hay
/// depositado de ese `catalogSlug` en el Almacén de Reino.
export function almacenAlTope(cantidadActual: number, limite: number | null | undefined): boolean {
  if (limite == null) return false;
  return cantidadActual >= limite;
}

/// Puro: ¿hay en el Almacén de Reino (`almacenRows`) suficiente de CADA ingrediente que pide la
/// receta? Reutiliza `totalQuantity` de `ingredients.ts` tal cual (mismo matcher `exact`/
/// `category`/`orMatch` que ya usa el crafteo del jugador) — receta sin `ingredients` (recolección
/// pura, ver § 4.4-ter) siempre cumple, `every` de un array vacío es `true`.
export function tieneIngredientesEnAlmacen(recipe: CraftingRecipe, almacenRows: InventoryRowLike[], catalogBySlug: Map<string, CatalogLookup>): boolean {
  return recipe.ingredients.every((ing) => totalQuantity(almacenRows, ing, catalogBySlug) >= ing.cantidad);
}

/// Puro: un solo tick de reparto por prioridad para TODAS las órdenes activas de un `Building` en
/// un día. Bellwright "Job Priorities": menor `prioridad` se sirve antes; un trabajador que ya
/// produjo en este tick no vuelve a contarse para otra orden del mismo Building en el mismo tick
/// (una asignación por trabajador por tick, nunca duplicado).
///
/// `recipesByKey`/`cantidadAlmacenPorSlug`/`limitePorSlug`/`almacenRows`/`catalogBySlug` son
/// inputs ya resueltos por el caller (turnResolution.ts) desde `CRAFTING_RECIPES`/`AlmacenItem`/
/// `AlmacenLimite`/`ItemCatalog` — esta función es pura, no toca Prisma. `almacenRows` y
/// `cantidadAlmacenPorSlug` SE MUTAN (mismo criterio que el resto de ticks deterministas del
/// proyecto que devuelven el resultado ya aplicado) para que una orden posterior en el mismo tick
/// vea el consumo/producción de las anteriores — el caller solo necesita traducir el array de
/// `ResultadoOrden` devuelto a escrituras reales de Prisma, no recalcular nada.
export function tickOrdenesProduccion(
  ordenes: OrdenProduccionInput[],
  trabajadores: TrabajadorReino[],
  recipesByKey: Map<string, CraftingRecipe>,
  cantidadAlmacenPorSlug: Map<string, number>,
  limitePorSlug: Map<string, number | null>,
  almacenRows: InventoryRowLike[],
  catalogBySlug: Map<string, CatalogLookup>,
): ResultadoOrden[] {
  const resultados: ResultadoOrden[] = [];
  const trabajadoresLibres = new Set(trabajadores.map((t) => t.companionId));
  const ordenesActivas = ordenes.filter((o) => o.activa).sort((a, b) => a.prioridad - b.prioridad);
  // Consumo simulado en memoria: cada ingrediente gastado por una orden reduce lo disponible para
  // la siguiente orden del mismo tick (dos órdenes no pueden gastar la misma unidad de materia
  // prima dos veces). Se borran las filas más antiguas primero (orden de `almacenRows` tal cual
  // llega, mismo criterio FIFO implícito que `planConsumption` de ingredients.ts).
  let rowsRestantes = almacenRows;

  for (const orden of ordenesActivas) {
    const recipe = recipesByKey.get(orden.recipeKey);
    if (!recipe) {
      resultados.push({ ordenId: orden.id, resultado: 'RECETA_DESCONOCIDA' });
      continue;
    }

    // 'unico' con límite ya alcanzado: la orden debería haberse desactivado sola, pero protege de
    // una carrera entre ticks (mismo criterio defensivo que planCraftConsumption en crafting.ts).
    if (orden.modo === 'unico' && orden.limite != null && orden.cantidadProducidaAcumulada >= orden.limite) {
      resultados.push({ ordenId: orden.id, resultado: 'ORDEN_COMPLETADA' });
      continue;
    }
    if (orden.limite != null && orden.cantidadProducidaAcumulada >= orden.limite) continue;

    // Pieza que cierra el sistema (petición explícita de Álvaro, sesión anterior): el tope de
    // Almacén se conecta con las prioridades — si ya está lleno, esta orden se salta SIN gastar
    // trabajador, y el reparto sigue con la siguiente orden de prioridad disponible.
    if (recipe.resultCatalogSlug) {
      const limiteAlmacen = limitePorSlug.get(recipe.resultCatalogSlug);
      const cantidadActual = cantidadAlmacenPorSlug.get(recipe.resultCatalogSlug) ?? 0;
      if (almacenAlTope(cantidadActual, limiteAlmacen)) {
        resultados.push({ ordenId: orden.id, resultado: 'ALMACEN_LLENO' });
        continue;
      }
    }

    if (!tieneIngredientesEnAlmacen(recipe, rowsRestantes, catalogBySlug)) {
      resultados.push({ ordenId: orden.id, resultado: 'SIN_MATERIA_PRIMA' });
      continue;
    }

    const trabajadorAsignado = trabajadores.find((t) => trabajadoresLibres.has(t.companionId) && trabajadorPuedeProducir(t, recipe));
    if (!trabajadorAsignado) {
      resultados.push({ ordenId: orden.id, resultado: 'SIN_TRABAJADOR_CON_NIVEL' });
      continue;
    }

    trabajadoresLibres.delete(trabajadorAsignado.companionId);
    if (recipe.resultCatalogSlug) {
      cantidadAlmacenPorSlug.set(recipe.resultCatalogSlug, (cantidadAlmacenPorSlug.get(recipe.resultCatalogSlug) ?? 0) + (recipe.resultCantidad ?? 1));
    }
    // Consumir del Almacén simulado (FIFO simple, sin fraccionar — AlmacenItem es 1 fila = 1
    // unidad, a diferencia de InventoryItem, nunca hace falta `updateRemainder`).
    for (const ing of recipe.ingredients) {
      let restante = ing.cantidad;
      rowsRestantes = rowsRestantes.filter((row) => {
        if (restante <= 0) return true;
        const matchExact = ing.match.kind === 'exact' && row.catalogSlug === ing.match.catalogSlug;
        const matchCategory = ing.match.kind === 'category' && catalogBySlug.get(row.catalogSlug ?? '')?.category === ing.match.category;
        if (matchExact || matchCategory) {
          restante -= 1;
          return false;
        }
        return true;
      });
    }
    resultados.push({
      ordenId: orden.id,
      resultado: 'PRODUCIDA',
      companionId: trabajadorAsignado.companionId,
      resultCatalogSlug: recipe.resultCatalogSlug,
      resultCantidad: recipe.resultCantidad ?? 1,
      ingredientesConsumidos: recipe.ingredients,
    });
  }

  return resultados;
}
