import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { checkIngredients, type IngredientStatus, type CatalogLookup, type InventoryRowLike } from '../../services/ingredients.js';
import { checkRequisitos, shortfallLabel } from '../../services/requisitos.js';
import { alivioForLevel } from '../../services/professionProgress.js';
import { effectiveAttributes, effectiveSecondaryAttributes } from '../../services/equipment.js';
import { normalizeSecondaryAttributes } from '../../services/secondaryAttributes.js';
import { CRAFTING_RECIPES } from '../../services/crafting.js';
import { CONSTRUCTION_RECIPES, computeBuildBlockedReason, type ConstructionRecipe } from '../../services/construction.js';
import type { AttributeBlock } from '../../services/dice.js';
import type { SecondaryAttributeBlock } from '../../services/secondaryAttributes.js';

export interface RecipeStatus {
  recipeKey: string;
  recipeCategory: 'crafteo' | 'construccion';
  met: boolean;
  ingredients: IngredientStatus[];
  missingRequisitos: string[];
  locationOk: boolean;
  /// Array añadido con el hallazgo 13 (revisar-partida-hallazgos.md 2026-09-06) — una receta
  /// puede exigir cualquiera de VARIAS ubicaciones válidas (p.ej. "recoger agua", 3 puntos de agua
  /// distintos), no solo una.
  requiredLocationName: string | string[] | null;
  /// Reglas de reino (auditoría 2026-08-13: cupo de Ayuntamiento, misma región, distancia,
  /// nivel-anterior-correcto al mejorar, un solo Ayuntamiento) — solo se comprueban cuando
  /// materiales/atributos YA se cumplen, mismo criterio que turnResolution.ts (si faltan
  /// materiales, ese sigue siendo el problema real a mostrar). null = no aplica o no bloquea.
  blockedReason: string | null;
  /// P218 — solo en recetas de construcción: lo que el panel Reino › Edificios › Construir necesita
  /// para ofrecer cada edificio sin una lista a mano en el frontend (nombre, si cuelga del
  /// Ayuntamiento y qué edificio mejora).
  name?: string;
  requiresAyuntamiento?: boolean;
  upgradesRecipeKey?: string | null;
}

/// Extraído de `recipesStatusRoutes` (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) — mismo
/// cálculo de "¿puedo construir esto AHORA MISMO?" reutilizado por `parcelas.ts` (una Parcela
/// solo necesita el status de SU receta candidata, no las de todo el catálogo). Nunca duplica el
/// criterio de "qué hace falta", solo lo expone en modo consulta — igual que antes.
export async function constructionRecipeStatusFor(params: {
  recipe: ConstructionRecipe;
  saveId: string;
  worldId: string;
  activeRegion: string | null;
  currentLocationId: string | null;
  inventoryRows: InventoryRowLike[];
  catalogBySlug: Map<string, CatalogLookup>;
  attributes: AttributeBlock;
  secondaryAttributes: SecondaryAttributeBlock;
  alivioFor: (oficio: string | null | undefined) => number;
}): Promise<RecipeStatus> {
  const { recipe, saveId, worldId, activeRegion, currentLocationId, inventoryRows, catalogBySlug, attributes, secondaryAttributes, alivioFor } = params;
  const ingredients = checkIngredients(recipe.requirements, inventoryRows, catalogBySlug);
  const missingRequisitos = checkRequisitos(recipe.requisitos, attributes, secondaryAttributes, alivioFor(recipe.oficio)).map(shortfallLabel);
  const materialsOk = ingredients.every((i) => i.met) && missingRequisitos.length === 0;
  const blockedReason =
    materialsOk && currentLocationId
      ? await computeBuildBlockedReason({
          db: prisma,
          saveId,
          worldId,
          buildRecipe: recipe,
          activeRegion,
          currentLocationRecord: { id: currentLocationId },
        })
      : null;
  return {
    recipeKey: recipe.key,
    recipeCategory: 'construccion',
    met: materialsOk && !blockedReason,
    ingredients,
    missingRequisitos,
    locationOk: true,
    requiredLocationName: null,
    blockedReason,
    name: recipe.name,
    requiresAyuntamiento: recipe.requiresAyuntamiento === true,
    upgradesRecipeKey: recipe.upgradesRecipeKey ?? null,
  };
}

/// Deshabilitar en Habilidades/Enciclopedia las recetas que ya conoces pero no puedes craftear o
/// construir AHORA MISMO (2026-08-13, petición explícita: "que salgan deshabilitadas si no
/// cumples las condiciones... el hover con la información que saque los recursos necesarios y
/// cuántos tienes... tipo 5/10, y en la propia enciclopedia también") — a diferencia de
/// `professionRecipes` (GET /profession-recipes, estático, independiente de partida), esto SÍ
/// depende del inventario/atributos/ubicación reales de ESTA partida, así que vive bajo /saves/:id
/// como el resto de estado por partida. Reutiliza tal cual la misma lógica de comprobación que
/// turnResolution.ts usa al craftear/construir de verdad (ingredients.ts/requisitos.ts) — nunca se
/// duplica el criterio de "qué hace falta", solo se expone en modo consulta.
export async function recipesStatusRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/saves/:id/recipes-status', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: { inventoryItems: true, professionProgress: true, currentLocation: { select: { id: true, slug: true, region: true } } },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    const inventoryRows = save.inventoryItems.map((i) => ({ id: i.id, name: i.name, catalogSlug: i.catalogSlug }));
    const catalogSlugs = [...new Set(inventoryRows.map((i) => i.catalogSlug).filter((s): s is string => Boolean(s)))];
    const catalogRows = catalogSlugs.length
      ? await prisma.itemCatalog.findMany({ where: { worldId: save.worldId, slug: { in: catalogSlugs } }, select: { slug: true, tipo: true, category: true } })
      : [];
    const catalogBySlug = new Map<string, CatalogLookup>(catalogRows.map((c) => [c.slug, { tipo: c.tipo, category: c.category }]));

    const equippedItems = save.inventoryItems.filter((i) => i.slot !== null);
    const attributes = effectiveAttributes(save.attributes as AttributeBlock, equippedItems);
    const secondaryAttributes = effectiveSecondaryAttributes(normalizeSecondaryAttributes(save.secondaryAttributes), equippedItems);
    const oficioNivelById = new Map(save.professionProgress.map((p) => [p.professionId, p.nivel]));
    const alivioFor = (oficio: string | null | undefined) => (oficio ? alivioForLevel(oficioNivelById.get(oficio) ?? 1) : 0);

    const locationSlugs = [...new Set(CRAFTING_RECIPES.flatMap((r) => (Array.isArray(r.location) ? r.location : r.location ? [r.location] : [])))];
    const locationRows = locationSlugs.length
      ? await prisma.location.findMany({ where: { worldId: save.worldId, slug: { in: locationSlugs } }, select: { slug: true, name: true } })
      : [];
    const locationNameBySlug = new Map(locationRows.map((l) => [l.slug, l.name]));

    const crafting: RecipeStatus[] = CRAFTING_RECIPES.map((recipe) => {
      const ingredients = checkIngredients(recipe.ingredients, inventoryRows, catalogBySlug);
      const missingRequisitos = checkRequisitos(recipe.requisitos, attributes, secondaryAttributes, alivioFor(recipe.oficio)).map(shortfallLabel);
      const locationOk = !recipe.location || (Array.isArray(recipe.location) ? recipe.location.includes(save.currentLocation?.slug ?? '') : save.currentLocation?.slug === recipe.location);
      const requiredLocationName = !recipe.location
        ? null
        : Array.isArray(recipe.location)
          ? recipe.location.map((slug) => locationNameBySlug.get(slug) ?? slug)
          : (locationNameBySlug.get(recipe.location) ?? recipe.location);
      return {
        recipeKey: recipe.key,
        recipeCategory: 'crafteo',
        met: ingredients.every((i) => i.met) && missingRequisitos.length === 0 && locationOk,
        ingredients,
        missingRequisitos,
        locationOk,
        requiredLocationName,
        blockedReason: null,
      };
    });

    const activeRegion = save.currentLocation?.region ?? null;
    const construction: RecipeStatus[] = await Promise.all(
      // P218 (decisión de la usuaria, 2026-10-19): una receta con `raza` de otra raza que la del
      // personaje no se lista (misma comparación directa de slugs de BERIG_RAZAS que el resto del
      // backend con `Save.raza`). Sin `raza` en la receta, o personaje sin raza, siguen visibles.
      // Solo filtra lo mostrado: el comando de texto no se toca (no está limitado por raza).
      CONSTRUCTION_RECIPES.filter((recipe) => !recipe.raza || !save.raza || recipe.raza === save.raza).map((recipe) =>
        constructionRecipeStatusFor({
          recipe,
          saveId: save.id,
          worldId: save.worldId,
          activeRegion,
          currentLocationId: save.currentLocation?.id ?? null,
          inventoryRows,
          catalogBySlug,
          attributes,
          secondaryAttributes,
          alivioFor,
        }),
      ),
    );

    return { recipes: [...crafting, ...construction] };
  });
}
