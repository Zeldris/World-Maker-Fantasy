import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { checkIngredients, type IngredientStatus, type CatalogLookup } from '../../services/ingredients.js';
import { checkRequisitos, shortfallLabel } from '../../services/requisitos.js';
import { alivioForLevel } from '../../services/professionProgress.js';
import { effectiveAttributes, effectiveSecondaryAttributes } from '../../services/equipment.js';
import { normalizeSecondaryAttributes } from '../../services/secondaryAttributes.js';
import { CRAFTING_RECIPES } from '../../services/crafting.js';
import { CONSTRUCTION_RECIPES, computeBuildBlockedReason } from '../../services/construction.js';
import type { AttributeBlock } from '../../services/dice.js';

interface RecipeStatus {
  recipeKey: string;
  recipeCategory: 'crafteo' | 'construccion';
  met: boolean;
  ingredients: IngredientStatus[];
  missingRequisitos: string[];
  locationOk: boolean;
  requiredLocationName: string | null;
  /// Reglas de reino (auditoría 2026-08-13: cupo de Ayuntamiento, misma región, distancia,
  /// nivel-anterior-correcto al mejorar, un solo Ayuntamiento) — solo se comprueban cuando
  /// materiales/atributos YA se cumplen, mismo criterio que turnResolution.ts (si faltan
  /// materiales, ese sigue siendo el problema real a mostrar). null = no aplica o no bloquea.
  blockedReason: string | null;
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

    const locationSlugs = [...new Set(CRAFTING_RECIPES.map((r) => r.location).filter((s): s is string => Boolean(s)))];
    const locationRows = locationSlugs.length
      ? await prisma.location.findMany({ where: { worldId: save.worldId, slug: { in: locationSlugs } }, select: { slug: true, name: true } })
      : [];
    const locationNameBySlug = new Map(locationRows.map((l) => [l.slug, l.name]));

    const crafting: RecipeStatus[] = CRAFTING_RECIPES.map((recipe) => {
      const ingredients = checkIngredients(recipe.ingredients, inventoryRows, catalogBySlug);
      const missingRequisitos = checkRequisitos(recipe.requisitos, attributes, secondaryAttributes, alivioFor(recipe.oficio)).map(shortfallLabel);
      const locationOk = !recipe.location || save.currentLocation?.slug === recipe.location;
      return {
        recipeKey: recipe.key,
        recipeCategory: 'crafteo',
        met: ingredients.every((i) => i.met) && missingRequisitos.length === 0 && locationOk,
        ingredients,
        missingRequisitos,
        locationOk,
        requiredLocationName: recipe.location ? (locationNameBySlug.get(recipe.location) ?? recipe.location) : null,
        blockedReason: null,
      };
    });

    const activeRegion = save.currentLocation?.region ?? null;
    const construction: RecipeStatus[] = await Promise.all(
      CONSTRUCTION_RECIPES.map(async (recipe) => {
        const ingredients = checkIngredients(recipe.requirements, inventoryRows, catalogBySlug);
        const missingRequisitos = checkRequisitos(recipe.requisitos, attributes, secondaryAttributes, alivioFor(recipe.oficio)).map(shortfallLabel);
        const materialsOk = ingredients.every((i) => i.met) && missingRequisitos.length === 0;
        const blockedReason =
          materialsOk && save.currentLocation
            ? await computeBuildBlockedReason({
                db: prisma,
                saveId: save.id,
                worldId: save.worldId,
                buildRecipe: recipe,
                activeRegion,
                currentLocationRecord: { id: save.currentLocation.id },
              })
            : null;
        return {
          recipeKey: recipe.key,
          recipeCategory: 'construccion' as const,
          met: materialsOk && !blockedReason,
          ingredients,
          missingRequisitos,
          locationOk: true,
          requiredLocationName: null,
          blockedReason,
        };
      }),
    );

    return { recipes: [...crafting, ...construction] };
  });
}
