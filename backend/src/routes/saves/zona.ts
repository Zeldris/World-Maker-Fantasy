import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { zoneMapImageUrl } from '../../lib/imageAssets.js';
import { sourceDisplayNameFor } from '../../scripts/worldCatalog.js';
import { detectNpcsInScene } from '../../services/npcScene.js';
import { loadSessionFacts } from '../../services/worldFacts.js';
import { momentoDelDiaFor, estacionFor } from '../../services/worldClock.js';
import type { EstacionSlug } from '../../services/imagePromptContext.js';
import { zonePointColorFor } from '../../services/zonePoints.js';
import { parseAgenda, regionControlFor, type RegionControlState } from '../../services/worldAgenda.js';
import { REGION_OWNING_FACTIONS } from '../../services/reputation.js';

/// Día/noche/estación (2026-08-27) — la vista Zona ya conoce el reloj real de la partida
/// (`WorldState.fictionalMinutes`), así que elige sola qué variante mostrar en vez de un selector
/// manual (eso solo tiene sentido en la Enciclopedia, donde se navega fuera de una partida
/// concreta). `Estacion` de Prisma es MAYÚSCULA (`estacionFor`); el slug de archivo es minúscula
/// (mismo convenio que el resto de sufijos de imagen) — este mapa hace ese único ajuste.
const ESTACION_A_SLUG: Record<string, EstacionSlug> = { PRIMAVERA: 'primavera', VERANO: 'verano', OTONO: 'otono', INVIERNO: 'invierno' };

/// Grupo 3 § Mundo determinista (docs/rpgtarkor/mundo-determinista.md, 2026-08-25) — Capa 1: zonas
/// navegables, PROTOTIPO en una sola zona (La Hondonada del Eco). Deliberadamente ACOTADO: solo
/// expone DÓNDE vive algo dentro de la zona actual, de forma estructurada, en vez de que el
/// jugador solo pueda saberlo si la prosa se lo cuenta bien — no cambia todavía cómo se resuelve
/// cazar/recolectar/combate (eso es trabajo de las Capas 2-3 del documento, sobre esta base).
export async function zonaRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/saves/:id/zona', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        worldId: true,
        currentLocation: { select: { id: true, slug: true, name: true, region: true, zonePoints: true } },
        worldState: { select: { fictionalMinutes: true, factionsStatus: true, agenda: true } },
      },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (!save.currentLocation) return { disponible: false, puntos: [], dinamicos: [] };

    const { zonePoints: zonePointsRaw, slug: locationSlug, name: locationName, id: locationId, region } = save.currentLocation;
    const fictionalMinutes = save.worldState?.fictionalMinutes ?? 480;
    const momento = momentoDelDiaFor(fictionalMinutes);
    const estacion = ESTACION_A_SLUG[estacionFor(fictionalMinutes)];
    const factionsStatus = (save.worldState?.factionsStatus as Record<string, number> | null) ?? {};
    // Control regional (2026-08-27, Pieza 5 de "Dinamismo del mundo") — lógica sin logos todavía
    // (placeholder de texto en el frontend), derivada en caliente de `agenda` ya persistida, sin
    // migración de schema. `null` si la región no tiene dueño de lore conocido (mismo criterio que
    // `resolveFoundingOutcome`, reputation.ts).
    const duenoOriginal = REGION_OWNING_FACTIONS[region]?.[0] ?? null;
    const regionControl: RegionControlState | null = duenoOriginal
      ? regionControlFor(region, parseAgenda(save.worldState?.agenda), duenoOriginal)
      : null;
    // Instancia viva (2026-08-27, Pieza 3 de "Dinamismo del mundo") — solo puntos `activo` se
    // muestran; `recalcularZonePointsDeLocation` (turnResolution.ts) ya decide cantidad/actividad
    // real en cada turno, aquí solo se lee lo que ya está persistido.
    const zonePoints = zonePointsRaw.filter((p) => p.activo);

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
      fictionalMinutes,
    });
    const zonePointSlugs = new Set(zonePoints.map((p) => p.targetSlug));
    const dinamicos = npcsInScene
      .filter((n) => n.condicionFisica !== 'MUERTO' && !zonePointSlugs.has(n.slug))
      .map((n) => ({ slug: n.slug, nombre: n.name, tipo: (n.kind === 'PRINCIPAL' ? 'NPC' : 'FAUNA') as 'NPC' | 'FAUNA' }));

    if (zonePoints.length === 0) {
      return {
        disponible: dinamicos.length > 0,
        puntos: [],
        dinamicos,
        locationSlug,
        locationName,
        imageUrl: zoneMapImageUrl(locationSlug, momento, estacion),
        regionControl,
      };
    }

    // Nombres reales de catálogo para cada punto — FAUNA/NPC resuelven contra Npc.name (si el
    // punto tiene `label` propio, ese manda; si no, cae al nombre real, nunca al slug crudo).
    // EDIFICIO no tiene fila `Npc` propia (gobernado por `Building`/`construction.ts`, fuera del
    // alcance de esta pieza) — solo `label` o el slug crudo, mismo criterio que `zonePointsSummaryFor`.
    const faunaNpcSlugs = zonePoints.filter((p) => p.tipo === 'FAUNA' || p.tipo === 'NPC').map((p) => p.targetSlug);
    const npcRows = faunaNpcSlugs.length
      ? await prisma.npc.findMany({ where: { worldId: save.worldId, slug: { in: faunaNpcSlugs } }, select: { slug: true, name: true } })
      : [];
    const npcNameBySlug = new Map(npcRows.map((n) => [n.slug, n.name]));

    return {
      disponible: true,
      locationSlug,
      locationName,
      imageUrl: zoneMapImageUrl(locationSlug, momento, estacion),
      regionControl,
      puntos: zonePoints.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        tipo: p.tipo,
        targetSlug: p.targetSlug,
        nombre:
          p.label ??
          (p.tipo === 'RECURSO'
            ? sourceDisplayNameFor(p.targetSlug)
            : p.tipo === 'EDIFICIO'
              ? p.targetSlug
              : (npcNameBySlug.get(p.targetSlug) ?? p.targetSlug)),
        cantidad: p.cantidad,
        color: zonePointColorFor(p.factionSlug, factionsStatus),
      })),
      dinamicos,
    };
  });
}
