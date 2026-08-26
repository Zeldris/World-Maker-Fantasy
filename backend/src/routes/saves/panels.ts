import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { buildNpcInScene, scopeFor, hasPendingLoot, type NpcInScene } from '../../services/npcScene.js';
import { buildAdjacency, shortestPath, minutosConDestreza, bandaForMinutos } from '../../services/travel.js';
import type { AttributeBlock } from '../../services/dice.js';

/// Paneles de habilidades generales nuevos (2026-08-17, comentarios dejados en
/// startingAbilities.ts): "Volver al campamento", "Viajar" y "Saquear" (fuera de combate). Cada
/// uno solo LISTA candidatos — la acción real (viajar/saquear) sigue pasando por el motor de turno
/// normal (`/turn/narrate`), nunca por una mutación aparte: el frontend rellena el `promptText`
/// real de la habilidad con el destino/objetivo elegido y lo manda como cualquier otra acción, así
/// que toda la lógica de viaje (`resolveTravel`, multi-tramo real) y de saqueo (`applyLootMode`) se
/// reutiliza tal cual, sin duplicarla aquí.

/// "Volver al campamento" — campamentos ACTIVOS ya construidos (Building.recipeKey === 'campamento'),
/// con su Location real para poder nombrarlos en el texto libre que resuelve `resolveTravel`
/// (`matchDestination` ya busca en TODAS las Location del mundo, no solo las adyacentes).
export async function panelsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/saves/:id/campamentos', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

    const camps = await prisma.building.findMany({
      where: { saveId: save.id, recipeKey: 'campamento', status: 'ACTIVO', locationId: { not: null } },
      include: { location: { select: { slug: true, name: true, region: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      camps: camps
        .filter((c) => c.location)
        .map((c) => ({ locationSlug: c.location!.slug, locationName: c.location!.name, region: c.location!.region })),
    };
  });

  /// "Viajar" — sin mapa: regiones/ubicaciones ya visitadas (LocationVisit); con el mapa de las
  /// Llanuras (mismo `effectKey` que ya comprueba MapaPanel.tsx en el frontend, 'reveal-map-
  /// llanuras'), TODAS las ubicaciones de esa región, visitadas o no.
  app.get<{ Params: { id: string } }>('/saves/:id/destinos-viaje', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      select: { id: true, worldId: true, currentLocationId: true, attributes: true, inventoryItems: { select: { catalogSlug: true } } },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

    const catalogSlugs = [...new Set(save.inventoryItems.map((i) => i.catalogSlug).filter((s): s is string => Boolean(s)))];
    const ownedCatalogRows = catalogSlugs.length
      ? await prisma.itemCatalog.findMany({ where: { worldId: save.worldId, slug: { in: catalogSlugs } }, select: { effectKey: true } })
      : [];
    const hasLlanurasMap = ownedCatalogRows.some((c) => c.effectKey === 'reveal-map-llanuras');

    const visited = await prisma.locationVisit.findMany({
      where: { saveId: save.id },
      select: { location: { select: { id: true, slug: true, name: true, region: true } } },
    });
    const destinationsById = new Map(
      visited.filter((v) => v.location.id !== save.currentLocationId).map((v) => [v.location.id, v.location]),
    );

    if (hasLlanurasMap) {
      const llanuras = await prisma.location.findMany({
        where: { worldId: save.worldId, region: 'Las Llanuras del Viento Rojo' },
        select: { id: true, slug: true, name: true, region: true },
      });
      for (const loc of llanuras) {
        if (loc.id !== save.currentLocationId) destinationsById.set(loc.id, loc);
      }
    }

    // Tiempo de juego real hasta cada destino (petición explícita, 2026-08-18: "quiero que salga
    // con el tiempo de juego que nos llevaría llegar... tiempo de juego no tiempo real") — mismo
    // grafo/fórmula que ya usa `resolveTravel` de verdad al confirmar el viaje (`buildAdjacency` +
    // `shortestPath`, multi-tramo real, + `minutosConDestreza` para el ajuste por destreza) — no
    // se inventa una estimación aparte, es EXACTAMENTE lo que costaría el viaje si se confirma
    // ahora mismo. Sin `currentLocationId` (personaje en tránsito) no hay origen desde el que
    // calcular — se listan los destinos igual, solo sin tiempo. Un destino sin camino real por el
    // grafo (visitado por otro medio, o revelado por mapa pero nunca enlazado) se lista igual,
    // solo sin tiempo — nunca se oculta por esto.
    const minutosById = new Map<string, number>();
    if (save.currentLocationId && destinationsById.size > 0) {
      const links = await prisma.locationLink.findMany({ where: { from: { worldId: save.worldId } } });
      const adjacency = buildAdjacency(links);
      const attributes = save.attributes as AttributeBlock;
      for (const destId of destinationsById.keys()) {
        const path = shortestPath(adjacency, save.currentLocationId, destId);
        if (path) minutosById.set(destId, minutosConDestreza(path.totalMinutos, attributes));
      }
    }

    return {
      hasMap: hasLlanurasMap,
      destinations: [...destinationsById.values()].map((l) => {
        const minutos = minutosById.get(l.id) ?? null;
        return { locationSlug: l.slug, locationName: l.name, region: l.region, minutos, banda: minutos != null ? bandaForMinutos(minutos) : null };
      }),
    };
  });

  /// "Saquear" fuera de combate (2026-08-17) — barre la ubicación actual buscando NPCs ya
  /// convalecientes/muertos sin saquear del todo, sin exigir que el jugador los nombre uno a uno.
  /// Reutiliza `buildNpcInScene` (mismo shape que ya consume `/turn/narrate` § npcsInScene) para
  /// que el frontend pueda reenviar exactamente estos objetos al confirmar, sin reconstruirlos.
  app.get<{ Params: { id: string } }>('/saves/:id/saquear-zona', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, worldId: true, currentLocationId: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (!save.currentLocationId) return { candidates: [] };

    // Sin filtrar por `scope` en la consulta (2026-08-17, bug real en el primer intento: un
    // PRINCIPAL como "Orco enfurecido" siempre guarda `scope: ''`, independiente de la ubicación —
    // filtrar de entrada por `scope: currentLocationId` lo dejaba fuera siempre) — se filtra
    // DESPUÉS, comparando contra el scope real que le tocaría a cada NPC según su `kind`
    // (`scopeFor`, mismo criterio que usa el resto del motor): un PRINCIPAL siempre "está aquí" (es
    // único en todo el mundo), uno normal solo si `scope` coincide con la ubicación actual.
    // CONVALECIENTE deja de ser saqueable (2026-08-26, decisión explícita junto con el rediseño
    // Matar/Capturar/Clemente) — solo MUERTO. Antes se podía saquear a alguien todavía vivo.
    const states = await prisma.npcState.findMany({
      where: { saveId: save.id, condicionFisica: 'MUERTO' },
    });
    const pendientes = states.filter(hasPendingLoot);
    if (pendientes.length === 0) return { candidates: [] };

    const npcs = await prisma.npc.findMany({
      where: { id: { in: pendientes.map((s) => s.npcId) }, worldId: save.worldId },
      include: { items: { include: { item: true } } },
    });
    const npcById = new Map(npcs.map((n) => [n.id, n]));
    const candidates: NpcInScene[] = pendientes
      .map((state) => {
        const npc = npcById.get(state.npcId);
        if (!npc || scopeFor(npc.kind, save.currentLocationId) !== state.scope) return null;
        return buildNpcInScene(npc, state);
      })
      .filter((n): n is NpcInScene => !!n);
    return { candidates };
  });
}
