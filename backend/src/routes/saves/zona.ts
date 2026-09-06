import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { zoneMapImageUrl } from '../../lib/imageAssets.js';
import { sourceDisplayNameFor } from '../../scripts/worldCatalog.js';
import { detectNpcsInScene, scopeFor } from '../../services/npcScene.js';
import { faunaMomentoDelDia } from '../../scripts/worldCatalog.js';
import { loadSessionFacts } from '../../services/worldFacts.js';
import { momentoDelDiaFor, estacionFor } from '../../services/worldClock.js';
import type { EstacionSlug } from '../../services/imagePromptContext.js';
import { zonePointColorFor, type ZonePointColor } from '../../services/zonePoints.js';
import { parseAgenda, regionControlFor, type RegionControlState } from '../../services/worldAgenda.js';
import { REGION_OWNING_FACTIONS } from '../../services/reputation.js';
import { posicionAleatoriaEnLienzo } from '../../services/zonaPosicion.js';

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
        zonaPosX: true,
        zonaPosY: true,
        currentLocation: { select: { id: true, slug: true, name: true, region: true, zonePoints: true } },
        worldState: { select: { fictionalMinutes: true, factionsStatus: true, agenda: true } },
      },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    // Punto del jugador en el mapa de Zona (2026-09-04) — null en partidas previas a esta pieza, o
    // sin nada que asignar todavía (nunca se ha resuelto una acción determinista que lo mueva).
    const jugador = save.zonaPosX != null && save.zonaPosY != null ? { x: save.zonaPosX, y: save.zonaPosY } : null;
    if (!save.currentLocation) return { disponible: false, puntos: [], dinamicos: [], jugador };

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
    const zonePointsActivos = zonePointsRaw.filter((p) => p.activo);

    // NPCs presentados en escena de forma determinista (2026-08-26, bug/hueco real señalado
    // jugando: "no aparecen en la zona y sí tienen que salir" — Gistera Koh como perseguidora, o
    // un NPC de interrupción de la Capa 2/3, nunca tenían marcador aquí porque `ZonePoint` es solo
    // el catálogo FIJO precargado de la zona, nunca lo que la partida va descubriendo). Mismo
    // mecanismo que decide `npcsInScene` en cada turno (`detectNpcsInScene`), pero sin acción de
    // turno real (`action: ''`) — aquí solo importa lo que los HECHOS DE SESIÓN ya establecen como
    // presente, no lo que un turno concreto mencione de pasada.
    const sessionFacts = await loadSessionFacts(save.id);
    const npcsInScene = await detectNpcsInScene({
      action: '',
      worldId: save.worldId,
      sessionFacts,
      saveId: save.id,
      currentLocationId: locationId,
      fictionalMinutes,
    });
    const zonePointSlugs = new Set(zonePointsActivos.map((p) => p.targetSlug));
    const dinamicosCandidatos = npcsInScene.filter((n) => n.condicionFisica !== 'MUERTO' && !zonePointSlugs.has(n.slug));

    // Punto del jugador en el mapa de Zona (2026-09-04) — `NpcState` de TODOS los NPC/fauna
    // implicados hoy en el mapa (dinámicos + los `ZonePoint` reales de tipo NPC/FAUNA), una sola
    // query batch, para resolver a la vez: (a) asignación perezosa de posición a un dinámico nunca
    // visto antes, (b) filtro de "ausente por combate ganado" (6h de ficción o cambio de zona).
    const npcFaunaZonePointSlugs = zonePointsActivos.filter((p) => p.tipo === 'FAUNA' || p.tipo === 'NPC').map((p) => p.targetSlug);
    const npcFaunaZonePointIds =
      npcFaunaZonePointSlugs.length > 0
        ? (await prisma.npc.findMany({ where: { worldId: save.worldId, slug: { in: npcFaunaZonePointSlugs } }, select: { id: true, slug: true, name: true, kind: true } }))
        : [];
    const npcIdBySlugZonePoint = new Map(npcFaunaZonePointIds.map((n) => [n.slug, n.id]));
    const npcNameBySlugZonePoint = new Map(npcFaunaZonePointIds.map((n) => [n.slug, n.name]));
    const npcStateKeys = [
      ...dinamicosCandidatos.map((n) => ({ npcId: n.id, scope: scopeFor(n.kind, locationId) })),
      ...npcFaunaZonePointIds.map((n) => ({ npcId: n.id, scope: scopeFor(n.kind, locationId) })),
    ];
    const npcStates = npcStateKeys.length
      ? await prisma.npcState.findMany({
          where: { saveId: save.id, OR: npcStateKeys.map((k) => ({ npcId: k.npcId, scope: k.scope })) },
        })
      : [];
    const npcStateByKey = new Map(npcStates.map((s) => [`${s.npcId}|${s.scope}`, s]));

    // Ausente por combate ganado (regla 4b): dentro de la ventana de 6h Y sin cambiar de Location
    // desde que se marcó — ambas condiciones a la vez (mismo `zonaLocationId`), coherente con la
    // regla de la usuaria ("desaparecerán hasta que cambies de zona y vuelvas, o pasen 6h").
    const estaAusente = (state: { zonaAusenteHastaMinutes: number | null; zonaLocationId: string | null } | undefined): boolean =>
      !!state && state.zonaAusenteHastaMinutes != null && state.zonaLocationId === locationId && state.zonaAusenteHastaMinutes > fictionalMinutes;

    // Bug real jugando en vivo (2026-09-06, "fauna diurna y nocturna mezclada siendo de día") —
    // `faunaMomentoDelDia` ya filtraba a los NPC/fauna DINÁMICOS (sin ZonePoint, ver
    // `detectNpcsInScene`), pero un `ZonePoint` de tipo FAUNA sembrado a mano en el catálogo se
    // mostraba siempre, de día o de noche, sin pasar por este filtro.
    const zonePoints = zonePointsActivos.filter((p) => {
      if (p.tipo !== 'FAUNA' && p.tipo !== 'NPC') return true;
      const momentoRequerido = faunaMomentoDelDia[p.targetSlug];
      if (momentoRequerido && momentoRequerido !== momento) return false;
      const npcId = npcIdBySlugZonePoint.get(p.targetSlug);
      if (!npcId) return true;
      const npc = npcFaunaZonePointIds.find((n) => n.id === npcId)!;
      return !estaAusente(npcStateByKey.get(`${npcId}|${scopeFor(npc.kind, locationId)}`));
    });

    // Asignación perezosa de posición (2026-09-04, "punto del jugador" — regla 3 explícita de la
    // usuaria): primera vez que un NPC/fauna SIN `ZonePoint` real aparece en escena determinista,
    // recibe una posición aleatoria válida en el lienzo — persiste mientras siga en escena en esta
    // misma Location. Asignar en la LECTURA (no en la escritura del turno) porque `detectNpcsInScene`
    // se calcula de forma independiente en ambos sitios — así ningún NPC mencionado solo por
    // `sessionFacts` (sin que la acción del turno lo toque) se queda sin posición nunca asignada.
    const ocupadas: { x: number; y: number }[] = zonePointsActivos.map((p) => ({ x: p.x, y: p.y }));
    const dinamicos: { slug: string; nombre: string; tipo: 'NPC' | 'FAUNA'; color: ZonePointColor; x: number; y: number }[] = [];
    for (const n of dinamicosCandidatos) {
      const scope = scopeFor(n.kind, locationId);
      const key = `${n.id}|${scope}`;
      let state = npcStateByKey.get(key);
      if (estaAusente(state)) continue;

      let pos = state?.zonaPosX != null && state?.zonaPosY != null && state.zonaLocationId === locationId ? { x: state.zonaPosX, y: state.zonaPosY } : null;
      if (!pos) {
        pos = posicionAleatoriaEnLienzo(ocupadas);
        await prisma.npcState.upsert({
          where: { saveId_npcId_scope: { saveId: save.id, npcId: n.id, scope } },
          create: { saveId: save.id, npcId: n.id, scope, zonaPosX: pos.x, zonaPosY: pos.y, zonaLocationId: locationId },
          update: { zonaPosX: pos.x, zonaPosY: pos.y, zonaLocationId: locationId },
        });
      }
      ocupadas.push(pos);
      dinamicos.push({ slug: n.slug, nombre: n.name, tipo: n.kind === 'PRINCIPAL' ? 'NPC' : 'FAUNA', color: zonePointColorFor(n.faction, factionsStatus), x: pos.x, y: pos.y });
    }

    if (zonePoints.length === 0) {
      // `disponible` mira `zonePointsActivos` (datos sembrados reales), no `zonePoints` (ya
      // filtrado por ausencia, 2026-09-04) — un ZonePoint real que está temporalmente ausente por
      // combate ganado no debe leerse como "esta ubicación nunca tuvo zona explorable".
      return {
        disponible: dinamicos.length > 0 || zonePointsActivos.length > 0,
        puntos: [],
        dinamicos,
        locationSlug,
        locationName,
        imageUrl: zoneMapImageUrl(locationSlug, momento, estacion),
        regionControl,
        jugador,
      };
    }

    // Nombres reales de catálogo para cada punto — FAUNA/NPC resuelven contra Npc.name (si el
    // punto tiene `label` propio, ese manda; si no, cae al nombre real, nunca al slug crudo).
    // EDIFICIO no tiene fila `Npc` propia (gobernado por `Building`/`construction.ts`, fuera del
    // alcance de esta pieza) — solo `label` o el slug crudo, mismo criterio que `zonePointsSummaryFor`.
    // Reutiliza `npcNameBySlugZonePoint` (ya cargado arriba para el filtro de ausencia) en vez de
    // repetir la misma query.

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
              : (npcNameBySlugZonePoint.get(p.targetSlug) ?? p.targetSlug)),
        cantidad: p.cantidad,
        color: zonePointColorFor(p.factionSlug, factionsStatus),
      })),
      dinamicos,
      jugador,
    };
  });
}
