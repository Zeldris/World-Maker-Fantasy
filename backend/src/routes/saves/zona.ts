import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { zoneMapImageUrl } from '../../lib/imageAssets.js';
import { sourceDisplayNameFor } from '../../scripts/worldCatalog.js';

/// Grupo 3 § Mundo determinista (docs/rpgtarkor/mundo-determinista.md, 2026-08-25) — Capa 1: zonas
/// navegables, PROTOTIPO en una sola zona (La Hondonada del Eco). Deliberadamente ACOTADO: solo
/// expone DÓNDE vive algo dentro de la zona actual, de forma estructurada, en vez de que el
/// jugador solo pueda saberlo si la prosa se lo cuenta bien — no cambia todavía cómo se resuelve
/// cazar/recolectar/combate (eso es trabajo de las Capas 2-3 del documento, sobre esta base).
export async function zonaRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/saves/:id/zona', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      select: { id: true, worldId: true, currentLocation: { select: { id: true, slug: true, name: true, zonePoints: true } } },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (!save.currentLocation) return { disponible: false, puntos: [] };

    const { zonePoints, slug: locationSlug, name: locationName } = save.currentLocation;
    if (zonePoints.length === 0) return { disponible: false, puntos: [] };

    // Nombres reales de catálogo para cada punto — FAUNA/NPC resuelven contra Npc.name (si el
    // punto tiene `label` propio, ese manda; si no, cae al nombre real, nunca al slug crudo).
    const faunaNpcSlugs = zonePoints.filter((p) => p.tipo === 'FAUNA' || p.tipo === 'NPC').map((p) => p.targetSlug);
    const npcRows = faunaNpcSlugs.length
      ? await prisma.npc.findMany({ where: { worldId: save.worldId, slug: { in: faunaNpcSlugs } }, select: { slug: true, name: true } })
      : [];
    const npcNameBySlug = new Map(npcRows.map((n) => [n.slug, n.name]));

    return {
      disponible: true,
      locationSlug,
      locationName,
      imageUrl: zoneMapImageUrl(locationSlug),
      puntos: zonePoints.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        tipo: p.tipo,
        targetSlug: p.targetSlug,
        nombre: p.label ?? (p.tipo === 'RECURSO' ? sourceDisplayNameFor(p.targetSlug) : (npcNameBySlug.get(p.targetSlug) ?? p.targetSlug)),
      })),
    };
  });
}
