import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { zoneMapImageUrl, imageUrlsFor } from '../../lib/imageAssets.js';
import { sourceDisplayNameFor } from '../../scripts/worldCatalog.js';
import { detectNpcsInScene } from '../../services/npcScene.js';
import { loadSessionFacts } from '../../services/worldFacts.js';

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
    if (!save.currentLocation) return { disponible: false, puntos: [], dinamicos: [] };

    const { zonePoints, slug: locationSlug, name: locationName, id: locationId } = save.currentLocation;

    // NPCs presentados en escena de forma determinista (2026-08-26, bug/hueco real señalado
    // jugando: "no aparecen en la zona y sí tienen que salir" — Gistera Koh como perseguidora, o
    // un NPC de interrupción de la Capa 2/3, nunca tenían marcador aquí porque `ZonePoint` es solo
    // el catálogo FIJO precargado de la zona, nunca lo que la partida va descubriendo). Mismo
    // mecanismo que decide `npcsInScene` en cada turno (`detectNpcsInScene`), pero sin acción de
    // turno real (`action: ''`) — aquí solo importa lo que los HECHOS DE SESIÓN ya establecen como
    // presente, no lo que un turno concreto mencione de pasada. Sin posición curada en el mapa (a
    // diferencia de `ZonePoint`), así que el frontend los lista aparte, nunca como pin — mismo
    // criterio honesto que el resto de "mundo determinista": no fingir un dato que no existe.
    const sessionFacts = await loadSessionFacts(save.id);
    const npcsInScene = await detectNpcsInScene({
      action: '',
      worldId: save.worldId,
      sessionFacts,
      saveId: save.id,
      currentLocationId: locationId,
    });
    const zonePointSlugs = new Set(zonePoints.map((p) => p.targetSlug));
    const dinamicos = npcsInScene
      .filter((n) => n.condicionFisica !== 'MUERTO' && !zonePointSlugs.has(n.slug))
      .map((n) => ({ slug: n.slug, nombre: n.name, tipo: (n.kind === 'PRINCIPAL' ? 'NPC' : 'FAUNA') as 'NPC' | 'FAUNA' }));

    // Imágenes propias de Zona (2026-08-26, petición explícita: "banner, uno icono y otro una
    // zona a modo de mapa dibujado... pintada y clara") — `entityType: 'zona'` separado de
    // `'location'` (la Enciclopedia ya tiene su propio banner/miniatura fotorrealista de esta
    // misma ubicación; aquí el estilo es cartografía pintada a mano, ver imagePromptGenerator.ts §
    // ENTITY_TYPE_STYLE.zona, que ya aplica a los 3 perfiles de talla, no solo a 'mapa').
    const imagePromptRows = await prisma.imagePrompt.findMany({
      where: { worldId: save.worldId, entityType: 'zona', entitySlug: locationSlug },
    });
    const imagePrompts = {
      thumbnail: imagePromptRows.find((p) => p.sizeProfile === 'thumbnail')?.prompt ?? null,
      banner: imagePromptRows.find((p) => p.sizeProfile === 'banner')?.prompt ?? null,
      mapa: imagePromptRows.find((p) => p.sizeProfile === 'mapa')?.prompt ?? null,
    };
    const imageUrls = imageUrlsFor('zona', locationSlug);

    if (zonePoints.length === 0) {
      return {
        disponible: dinamicos.length > 0,
        puntos: [],
        dinamicos,
        locationSlug,
        locationName,
        imageUrl: zoneMapImageUrl(locationSlug),
        imageUrls,
        imagePrompts,
      };
    }

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
      imageUrls,
      imagePrompts,
      puntos: zonePoints.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        tipo: p.tipo,
        targetSlug: p.targetSlug,
        nombre: p.label ?? (p.tipo === 'RECURSO' ? sourceDisplayNameFor(p.targetSlug) : (npcNameBySlug.get(p.targetSlug) ?? p.targetSlug)),
      })),
      dinamicos,
    };
  });
}
