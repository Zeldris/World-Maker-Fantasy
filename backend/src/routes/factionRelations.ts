import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

/// GET de relaciones entre facciones NPC (hueco A, rediseño de frontend 2026-09-21,
/// docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.3) — hasta ahora no existía ninguna vía de LISTAR
/// `FactionRelation[]`, solo `espiarFactionRelation` (una relación concreta a la vez, vía
/// diplomacia). Dominio propio (no `world.ts`, que ya es grande y esto no es exactamente
/// Enciclopedia) — filtra a facciones de CATÁLOGO (`Faction.saveId: null`, nunca la del jugador,
/// mismo criterio ya documentado en el schema de `FactionRelation`) y gatea por descubrimiento:
/// solo relaciones donde AMBAS facciones estén en `DiscoveredEntity` de esa `saveId` (nunca revela
/// geopolítica de facciones que el jugador no ha oído mencionar todavía). Mismo criterio de
/// "isDiscovered mínimo" que `world.ts` — sin `saveId`, todo visible (catálogo fuera de partida).
export async function factionRelationsRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string }; Querystring: { saveId?: string } }>(
    '/world/:slug/faction-relations',
    async (request, reply) => {
      const world = await prisma.world.findUnique({ where: { slug: request.params.slug }, select: { id: true } });
      if (!world) return reply.status(404).send({ error: 'Mundo no encontrado' });

      const { saveId } = request.query;
      const [relations, discoveredEntities] = await Promise.all([
        prisma.factionRelation.findMany({
          where: { worldId: world.id, sourceFaction: { saveId: null }, targetFaction: { saveId: null } },
          include: {
            sourceFaction: { select: { slug: true, name: true, raza: true } },
            targetFaction: { select: { slug: true, name: true, raza: true } },
          },
        }),
        saveId ? prisma.discoveredEntity.findMany({ where: { saveId, entityType: 'faction' } }) : Promise.resolve([]),
      ]);

      const isDiscovered = (slug: string): boolean => !saveId || discoveredEntities.some((d) => d.entitySlug === slug);

      const visibles = relations
        .filter((r) => isDiscovered(r.sourceFaction.slug) && isDiscovered(r.targetFaction.slug))
        .map((r) => ({
          sourceFactionSlug: r.sourceFaction.slug,
          sourceFactionName: r.sourceFaction.name,
          sourceRaza: r.sourceFaction.raza,
          targetFactionSlug: r.targetFaction.slug,
          targetFactionName: r.targetFaction.name,
          targetRaza: r.targetFaction.raza,
          type: r.type,
          presion: r.presion,
          stage: r.stage,
          maxStage: r.maxStage,
        }));

      return { relations: visibles };
    },
  );
}
