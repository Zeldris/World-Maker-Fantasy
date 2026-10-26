import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded, rejectIfPendingDeath, toFrontendLogEntry } from './shared.js';
import { CONSTRUCTION_RECIPES, planRecipeConsumption, baseNameOf, computeBuildBlockedReason, buildingTierFor, type ConstructionRecipe } from '../../services/construction.js';
import { constructionRecipeStatusFor, regionDelAyuntamiento, type RecipeStatus } from './recipesStatus.js';
import { checkIngredients, type CatalogLookup } from '../../services/ingredients.js';

/// Concepto de "parcela" estilo Travian/Tribal Wars (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4,
/// 2026-09-21) — hueco de construcción marcado a priori en el PNG de una zona-interior. Flujo
/// real cerrado con Álvaro: te mueves hasta estar a 1 celda de la parcela, clic en su icono abre
/// un modal con su descripción y un botón "Construir" (habilitado/deshabilitado según se cumplan
/// las condiciones, con el motivo mostrado encima si no). El botón construye DIRECTO — sin pasar
/// por /turn/narrate, sin narración de LLM (mismo criterio que "Descansar en campamento": ya se
/// sabe EXACTAMENTE qué construir y dónde, no hace falta interpretar texto libre) — con un
/// LogEntry determinista rico en datos concretos (qué, dónde, quién) en el canal WORLD (mismo
/// canal que `worldAgenda.ts` para hechos de reino/facción, no CHARACTER — esto es estado de reino,
/// no una acción narrativa libre del personaje).
///
/// Gate de "AVANZADA solo admite su recipeKeyFijo" / "BASICA admite cualquier receta candidata que
/// aplique" vive aquí, no en `computeBuildBlockedReason` (ese sigue siendo agnóstico de Parcela —
/// construir SIN pasar por una parcela, como hoy con Building.x/y libre, sigue funcionando igual).

/// Recetas candidatas para una Parcela BASICA — cualquier receta de "edificio de reino" que NO sea
/// el Ayuntamiento en sí ni el Cuartel Avanzado/sus mejoras (esas tienen sus propias reglas de
/// unicidad/región, ya cubiertas por `computeBuildBlockedReason`). Hoy solo la Choza aplica —
/// deliberadamente genérico para no tocar este archivo cuando haya más variedad de edificios.
function candidateRecipesForBasica(): ConstructionRecipe[] {
  return CONSTRUCTION_RECIPES.filter((r) => r.requiresAyuntamiento && !r.isCuartelAvanzado && !r.upgradesRecipeKey && r.key !== 'ayuntamiento');
}

export async function parcelasRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string; parcelaId: string } }>('/saves/:id/parcelas/:parcelaId', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: { inventoryItems: true, professionProgress: true },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

    const parcela = await prisma.parcela.findUnique({
      where: { id: request.params.parcelaId },
      include: { location: { select: { id: true, region: true, name: true } }, building: { select: { id: true, name: true, status: true } } },
    });
    if (!parcela) return reply.status(404).send({ error: 'Parcela no encontrada' });

    if (parcela.buildingId) {
      // Ya ocupada — no hay nada que construir aquí, el frontend muestra el edificio existente en
      // vez del botón "Construir".
      return { parcela: { id: parcela.id, tipo: parcela.tipo, x: parcela.x, y: parcela.y }, ocupada: true, building: parcela.building, candidates: [] };
    }

    const inventoryRows = save.inventoryItems.map((i) => ({ id: i.id, name: i.name, catalogSlug: i.catalogSlug }));
    const catalogSlugs = [...new Set(inventoryRows.map((i) => i.catalogSlug).filter((s): s is string => Boolean(s)))];
    const catalogRows = catalogSlugs.length
      ? await prisma.itemCatalog.findMany({ where: { worldId: save.worldId, slug: { in: catalogSlugs } }, select: { slug: true, tipo: true, category: true } })
      : [];
    const catalogBySlug = new Map<string, CatalogLookup>(catalogRows.map((c) => [c.slug, { tipo: c.tipo, category: c.category }]));

    // AVANZADA: una sola candidata, la fija de la parcela. BASICA: todas las que apliquen — el
    // jugador elige cuál construir de entre las que SÍ cumple.
    const candidateRecipes =
      parcela.tipo === 'AVANZADA'
        ? CONSTRUCTION_RECIPES.filter((r) => r.key === parcela.recipeKeyFijo)
        : candidateRecipesForBasica();

    const regionAyuntamiento = await regionDelAyuntamiento(save.id);
    const candidates: RecipeStatus[] = await Promise.all(
      candidateRecipes.map((recipe) =>
        constructionRecipeStatusFor({
          recipe,
          saveId: save.id,
          worldId: save.worldId,
          activeRegion: parcela.location.region,
          currentLocationId: parcela.locationId,
          inventoryRows,
          catalogBySlug,
          regionAyuntamiento,
        }),
      ),
    );

    return {
      parcela: { id: parcela.id, tipo: parcela.tipo, x: parcela.x, y: parcela.y, locationName: parcela.location.name },
      ocupada: false,
      building: null,
      candidates,
    };
  });

  app.post<{ Params: { id: string; parcelaId: string }; Body: { recipeKey: string } }>(
    '/saves/:id/parcelas/:parcelaId/construir',
    async (request, reply) => {
      const { recipeKey } = request.body;
      const save = await prisma.save.findUnique({
        where: { id: request.params.id },
        include: { inventoryItems: true, professionProgress: true, worldState: { select: { fictionalDateLabel: true, fictionalMinutes: true } } },
      });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const parcela = await prisma.parcela.findUnique({
        where: { id: request.params.parcelaId },
        include: { location: { select: { id: true, region: true, name: true } } },
      });
      if (!parcela) return reply.status(404).send({ error: 'Parcela no encontrada' });
      if (parcela.buildingId) return reply.status(400).send({ error: 'Esta parcela ya tiene un edificio construido' });

      // AVANZADA solo admite SU receta fija — nunca lo que el body proponga si no coincide.
      if (parcela.tipo === 'AVANZADA' && recipeKey !== parcela.recipeKeyFijo) {
        return reply.status(400).send({ error: `Esta parcela solo admite construir: ${parcela.recipeKeyFijo}` });
      }
      const buildRecipe = CONSTRUCTION_RECIPES.find((r) => r.key === recipeKey);
      if (!buildRecipe) return reply.status(400).send({ error: `Receta desconocida: ${recipeKey}` });
      if (parcela.tipo === 'BASICA' && !candidateRecipesForBasica().some((r) => r.key === recipeKey)) {
        return reply.status(400).send({ error: 'Esa receta no puede construirse en una parcela básica' });
      }

      const inventoryRows = save.inventoryItems.map((i) => ({ id: i.id, name: i.name, catalogSlug: i.catalogSlug }));
      const catalogSlugs = [...new Set(inventoryRows.map((i) => i.catalogSlug).filter((s): s is string => Boolean(s)))];
      const catalogRows = catalogSlugs.length
        ? await prisma.itemCatalog.findMany({ where: { worldId: save.worldId, slug: { in: catalogSlugs } }, select: { slug: true, tipo: true, category: true } })
        : [];
      const catalogBySlug = new Map<string, CatalogLookup>(catalogRows.map((c) => [c.slug, { tipo: c.tipo, category: c.category }]));

      const ingredients = checkIngredients(buildRecipe.requirements, inventoryRows, catalogBySlug);
      if (!ingredients.every((i) => i.met)) {
        return reply.status(400).send({ error: 'Todavía no tienes los materiales necesarios' });
      }
      const blockedReason = await computeBuildBlockedReason({
        db: prisma,
        saveId: save.id,
        worldId: save.worldId,
        buildRecipe,
        activeRegion: parcela.location.region,
        currentLocationRecord: { id: parcela.locationId },
      });
      if (blockedReason) return reply.status(400).send({ error: blockedReason });

      const plans = planRecipeConsumption(buildRecipe, inventoryRows, catalogBySlug);
      if (!plans) return reply.status(409).send({ error: 'Los materiales cambiaron justo ahora — vuelve a intentarlo' });

      const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
      const fictionalMinutes = save.worldState?.fictionalMinutes ?? 0;
      // Rico en datos concretos (petición explícita de Álvaro: "que se refleje... un mensaje
      // determinista que concrete bien todos los datos que sean posibles") — qué se construyó,
      // dónde exactamente, quién lo hizo, mismo criterio que el resto de LogEntry deterministas
      // del proyecto (STAGE_FACTS de worldAgenda.ts, "Descansar en campamento").
      const text = `${save.characterName} ha terminado de construir ${buildRecipe.name} en ${parcela.location.name}.`;

      const result = await prisma.$transaction(async (tx) => {
        for (const plan of plans) {
          if (plan.deleteIds.length > 0) {
            await tx.inventoryItem.deleteMany({ where: { id: { in: plan.deleteIds } } });
          }
          if (plan.updateRemainder) {
            const row = inventoryRows.find((r) => r.id === plan.updateRemainder!.id);
            if (row) {
              await tx.inventoryItem.update({
                where: { id: plan.updateRemainder.id },
                data: { name: `${baseNameOf(row.name)} (${plan.updateRemainder.newQuantity})` },
              });
            }
          }
        }
        const building = await tx.building.create({
          data: {
            saveId: save.id,
            locationId: parcela.locationId,
            recipeKey: buildRecipe.key,
            name: buildRecipe.name,
            kind: buildRecipe.key,
            description: buildRecipe.description,
            status: 'ACTIVO',
            tier: buildingTierFor(buildRecipe) ?? undefined,
            x: parcela.x,
            y: parcela.y,
          },
        });
        await tx.parcela.update({ where: { id: parcela.id }, data: { buildingId: building.id } });
        const logEntry = await tx.logEntry.create({
          data: { saveId: save.id, channel: 'WORLD', text, timeLabel, fictionalMinutes, isSystemMessage: true },
        });
        return { building, logEntry };
      });

      return { building: result.building, logEntry: toFrontendLogEntry(result.logEntry) };
    },
  );
}
