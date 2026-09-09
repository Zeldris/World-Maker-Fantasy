import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { zoneMapImageUrl } from '../../lib/imageAssets.js';
import { sourceDisplayNameFor, harvestSourcesThatAreFaunaWithoutNpc } from '../../scripts/worldCatalog.js';
import { detectNpcsInScene, scopeFor } from '../../services/npcScene.js';
import { faunaMomentoDelDia } from '../../scripts/worldCatalog.js';
import { loadSessionFacts } from '../../services/worldFacts.js';
import { momentoDelDiaFor, estacionFor } from '../../services/worldClock.js';
import type { EstacionSlug } from '../../services/imagePromptContext.js';
import { zonePointColorFor, avanzarZonePointsUnPaso, type ZonePointColor } from '../../services/zonePoints.js';
import { parseAgenda, regionControlFor, type RegionControlState } from '../../services/worldAgenda.js';
import { REGION_OWNING_FACTIONS, effectiveTemperamento } from '../../services/reputation.js';
import { posicionAleatoriaEnLienzo, celdaDePixel, pixelDeCelda, calcularCamino, celdaAdyacenteOMisma, mismaCelda } from '../../services/zonaPosicion.js';
import { rejectIfEnded, rejectIfPendingDeath } from './shared.js';

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
        currentLocation: { select: { id: true, slug: true, name: true, region: true, kind: true, zonePoints: true } },
        worldState: { select: { fictionalMinutes: true, factionsStatus: true, agenda: true } },
      },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    // Punto del jugador en el mapa de Zona (2026-09-04) — null en partidas previas a esta pieza, o
    // sin nada que asignar todavía (nunca se ha resuelto una acción determinista que lo mueva).
    const jugador = save.zonaPosX != null && save.zonaPosY != null ? { x: save.zonaPosX, y: save.zonaPosY } : null;
    if (!save.currentLocation) return { disponible: false, puntos: [], dinamicos: [], jugador };

    const { zonePoints: zonePointsRaw, slug: locationSlug, name: locationName, id: locationId, region, kind } = save.currentLocation;
    const fictionalMinutes = save.worldState?.fictionalMinutes ?? 480;
    const momento = momentoDelDiaFor(fictionalMinutes);
    // Hallazgo 32 (revisar-partida-hallazgos.md 2026-09-07) — los interiores de campamento
    // (`kind: 'interior'`, ej. Karot Vekhad) no deberían tener variante de estación: bajo techo, el
    // paso de las estaciones no se nota igual que en el mapa exterior. `zoneMapImageUrl` ya admite
    // `estacion: null` con fallback en cascada (momento solo → base), así que basta con no calcularla.
    const estacion = kind === 'interior' ? null : ESTACION_A_SLUG[estacionFor(fictionalMinutes)];
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

    // Hallazgo 34 (revisar-partida-hallazgos.md 2026-09-07) — un `ZonePoint`/dinámico revelaba su
    // nombre real y su botón de Enciclopedia sin mirar si la partida ya lo descubrió, filtrando
    // información de cosas que el jugador aún no ha encontrado en la ficción. Mismo criterio real
    // ya usado en la Enciclopedia (`world.ts` § `isDiscovered`), replicado aquí — sin la excepción
    // de `nucleoJugable===false` (esos NPC nunca aparecen en escena/mapa real, ver
    // `entityDiscovery.ts`, así que no hace falta duplicarla). `entityType` no es 1:1 con
    // `ZonePoint.tipo`: NPC/FAUNA pueden resolver a `'npc'` o `'fauna'` según `Npc.kind`
    // ('PRINCIPAL' → npc, el resto → fauna, mismo criterio que la línea de `dinamicos` más abajo),
    // y RECURSO puede resolver a `'fauna'` (fuente sin ficha Npc propia, ver hallazgo 22,
    // `harvestSourcesThatAreFaunaWithoutNpc`) o `'flora'` — mismo mapeo que ya usa
    // `imageEntityTypeFor` en world.ts, sin poder reutilizarlo directo (función local no
    // exportada). EDIFICIO nunca tiene ficha en la Enciclopedia (gobernado por `Building`/
    // `construction.ts`) — siempre "descubierto" (nada que ocultar). OBJETO (dinámico "Tirar",
    // hallazgo 8) resuelve contra `entityType: 'item'`.
    const discoveredEntities = await prisma.discoveredEntity.findMany({ where: { saveId: save.id } });
    const isDiscoveredEntity = (entityType: string, entitySlug: string): boolean =>
      discoveredEntities.some((d) => d.entityType === entityType && d.entitySlug === entitySlug);
    const npcKindBySlug = new Map<string, string>();
    const descubierto = (tipo: 'FAUNA' | 'RECURSO' | 'NPC' | 'EDIFICIO' | 'OBJETO', targetSlug: string): boolean => {
      // EDIFICIO: nunca tiene ficha en la Enciclopedia. OBJETO: instancia real ya visible en el
      // suelo de ESTA partida (el propio jugador lo tiró, o ya estaba ahí) — tautológicamente "ya
      // visto" por estar en el mapa, nunca un secreto de catálogo que ocultar.
      if (tipo === 'EDIFICIO' || tipo === 'OBJETO') return true;
      if (tipo === 'RECURSO') return isDiscoveredEntity(harvestSourcesThatAreFaunaWithoutNpc.has(targetSlug) ? 'fauna' : 'flora', targetSlug);
      // FAUNA/NPC: 'PRINCIPAL' → npc, el resto → fauna — mismo criterio que la línea de `dinamicos`
      // más abajo (`n.kind === 'PRINCIPAL' ? 'NPC' : 'FAUNA'`).
      const kind = npcKindBySlug.get(targetSlug);
      return isDiscoveredEntity(kind === 'PRINCIPAL' ? 'npc' : 'fauna', targetSlug);
    };

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
    for (const n of npcFaunaZonePointIds) npcKindBySlug.set(n.slug, n.kind);
    for (const n of dinamicosCandidatos) npcKindBySlug.set(n.slug, n.kind);
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
    const dinamicos: {
      slug: string;
      nombre: string;
      tipo: 'NPC' | 'FAUNA' | 'OBJETO';
      color: ZonePointColor;
      x: number;
      y: number;
      droppedItemId?: string;
      descubierto: boolean;
    }[] = [];
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
      const tipoDinamico = n.kind === 'PRINCIPAL' ? 'NPC' : 'FAUNA';
      const yaDescubierto = descubierto(tipoDinamico, n.slug);
      dinamicos.push({
        slug: n.slug,
        nombre: yaDescubierto ? n.name : '???',
        tipo: tipoDinamico,
        color: zonePointColorFor(n.faction, factionsStatus),
        x: pos.x,
        y: pos.y,
        descubierto: yaDescubierto,
      });
    }

    // "Tirar" objetos al suelo de la Zona (2026-09-06, hallazgo 8) — instancia POR PARTIDA
    // (`DroppedItem.saveId`), posición fija desde que se tiró (nunca perezosa como NPC/fauna
    // dinámicos de arriba). `slug`/`droppedItemId` distintos a propósito: el modal de detalle
    // necesita el id real de la fila para poder recogerla, un objeto tirado no tiene slug de
    // catálogo estable (puede no tener `catalogSlug` en absoluto, si es narrativo).
    const droppedItems = await prisma.droppedItem.findMany({ where: { saveId: save.id, locationId } });
    for (const d of droppedItems) {
      dinamicos.push({ slug: d.id, nombre: d.name, tipo: 'OBJETO', color: 'SIN_FACCION', x: d.x, y: d.y, droppedItemId: d.id, descubierto: true });
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
      puntos: zonePoints.map((p) => {
        const yaDescubierto = descubierto(p.tipo, p.targetSlug);
        const nombreReal =
          p.label ??
          (p.tipo === 'RECURSO'
            ? sourceDisplayNameFor(p.targetSlug)
            : p.tipo === 'EDIFICIO'
              ? p.targetSlug
              : (npcNameBySlugZonePoint.get(p.targetSlug) ?? p.targetSlug));
        return {
          id: p.id,
          x: p.x,
          y: p.y,
          tipo: p.tipo,
          targetSlug: p.targetSlug,
          // Hallazgo 34 — nombre real solo si la partida ya lo descubrió; `'???'` cubre también un
          // `label` puesto a mano (un alias custom seguiría filtrando información real).
          nombre: yaDescubierto ? nombreReal : '???',
          cantidad: p.cantidad,
          color: zonePointColorFor(p.factionSlug, factionsStatus),
          descubierto: yaDescubierto,
        };
      }),
      dinamicos,
      jugador,
    };
  });

  /// Detecta colisión/aviso de UNA celda contra los `ZonePoint` FAUNA/NPC activos de la Location, y
  /// resuelve la oferta de Interactuar real si corresponde (2026-09-08) — extraído del bucle
  /// principal de `/zona/mover` para reutilizarlo también en el caso "camino vacío" (ver comentario
  /// de ese bloque, bug real: origen y destino ya en la misma celda nunca comprobaba nada). Única
  /// fuente de verdad de "qué hay en esta celda" — evita que los dos caminos diverjan con el tiempo.
  async function detectarEncuentroEnCelda(
    tx: Prisma.TransactionClient,
    saveId: string,
    worldId: string,
    locationId: string,
    celda: { col: number; row: number },
    factionsStatus: Record<string, number>,
    characterName: string,
    fictionalMinutes: number,
    timeLabel: string,
  ): Promise<{
    colision: { targetSlug: string; targetName: string; temperamento: string } | null;
    aviso: { targetSlug: string; targetName: string } | null;
    dynamicModeOffer: { tipo: 'FAUNA' | 'NPC'; targetSlug: string; targetName: string } | null;
    logEntry: { id: string; text: string; timeLabel: string; createdAt: string } | null;
  }> {
    const puntos = await tx.zonePoint.findMany({ where: { locationId, tipo: { in: ['FAUNA', 'NPC'] }, activo: true } });
    const npcs = puntos.length
      ? await tx.npc.findMany({ where: { worldId, slug: { in: puntos.map((p) => p.targetSlug) } }, select: { slug: true, name: true, temperamento: true, faction: true } })
      : [];
    const npcBySlug = new Map(npcs.map((n) => [n.slug, n]));

    // Doble umbral de colisión (diseño confirmado, 2026-09-08): MISMA celda = encuentro inevitable;
    // celda ADYACENTE = solo aviso previo, con margen de reacción, nunca dispara Interactuar.
    let colision: { targetSlug: string; targetName: string; temperamento: string } | null = null;
    let aviso: { targetSlug: string; targetName: string } | null = null;
    // `tipo` real de catálogo — 'FAUNA' | 'NPC' tal cual lo trae `ZonePoint.tipo`, NUNCA derivado
    // de "¿tiene fila Npc?" (bug real detectado por los tests: un `Npc` con ficha propia puede
    // seguir siendo FAUNA cazable, `kind: 'PLANTILLA'` — `npcBySlug.has(slug)` daba `true` para
    // fauna real también, mandando siempre 'NPC').
    let colisionTipo: 'FAUNA' | 'NPC' | null = null;
    for (const punto of puntos) {
      const celdaPunto = celdaDePixel({ x: punto.x, y: punto.y });
      const npc = npcBySlug.get(punto.targetSlug);
      const nombre = npc?.name ?? sourceDisplayNameFor(punto.targetSlug);
      if (mismaCelda(celda, celdaPunto)) {
        const temperamento = npc ? effectiveTemperamento(npc.temperamento, npc.faction, factionsStatus) : 'CAUTELOSO';
        colision = { targetSlug: punto.targetSlug, targetName: nombre, temperamento };
        colisionTipo = punto.tipo === 'NPC' ? 'NPC' : 'FAUNA';
        break; // Solo el primer encuentro exacto — no acumula varios a la vez.
      }
      if (!aviso && celdaAdyacenteOMisma(celda, celdaPunto)) {
        aviso = { targetSlug: punto.targetSlug, targetName: nombre };
      }
    }

    // Conexión real con Interactuar (2026-09-08, hallazgo de Álvaro: "aunque me ponga encima de
    // algo... no pasa nada") — un AGRESIVO en la MISMA celda ya fuerza combate por el camino
    // existente (Franja 3, turno de texto libre normal, sin tocar aquí); CAUTELOSO/INOFENSIVO/
    // AMIGABLE en la misma celda dispara `pendingDynamicModeOffer` real con el candidato EXACTO
    // (nunca por sorteo — la posición real ya es la señal determinista). Solo la MISMA celda
    // dispara esto (decisión confirmada con Álvaro) — el aviso a distancia se queda puramente
    // informativo para cualquier temperamento. Ninguna oferta si ya hay una en curso/pendiente.
    let dynamicModeOffer: { tipo: 'FAUNA' | 'NPC'; targetSlug: string; targetName: string } | null = null;
    let logEntry: { id: string; text: string; timeLabel: string; createdAt: string } | null = null;
    if (colision && colision.temperamento !== 'AGRESIVO') {
      const freshSave = await tx.save.findUnique({ where: { id: saveId }, select: { pendingDynamicMode: true, pendingDynamicModeOffer: true } });
      if (!freshSave?.pendingDynamicMode && !freshSave?.pendingDynamicModeOffer) {
        dynamicModeOffer = { tipo: colisionTipo!, targetSlug: colision.targetSlug, targetName: colision.targetName };
        // LogEntry real determinista (2026-09-09, hallazgo real jugando en vivo: la tarjeta de
        // oferta SIEMPRE se renderiza colgada de una LogEntry concreta — LogPanel.tsx solo lee
        // `entry.dynamicModeOffer`, nunca `Save.pendingDynamicModeOffer` directamente). El
        // movimiento en Zona no narra nada por sí mismo (a diferencia de un turno normal, que sí
        // deja su propia entrada) — sin esto, la oferta quedaba persistida en BD pero invisible en
        // el log real: el mecanismo de reconstrucción tras F5 (GameView.tsx § syncFromSave) solo
        // sabe colgarla de "la última entrada del log", que puede no tener ninguna relación con
        // este encuentro (o ya estar ocupada por otra oferta, bloqueando el enganche del todo).
        const text = colisionTipo === 'NPC' ? `${characterName} se topa con ${colision.targetName}.` : `${characterName} se topa con ${colision.targetName}, que le observa con cautela.`;
        const created = await tx.logEntry.create({
          data: { saveId, channel: 'CHARACTER', text, timeLabel, fictionalMinutes, isPlayerAction: false, isSystemMessage: true },
        });
        logEntry = { id: created.id, text, timeLabel, createdAt: created.createdAt.toISOString() };
      }
    }
    return { colision, aviso, dynamicModeOffer, logEntry };
  }

  /// Sistema de movimiento por cuadrícula (2026-09-08, "estilo Mount & Blade") — el jugador hace
  /// clic en el lienzo (`destino` en píxel), el motor calcula el camino real (`calcularCamino`,
  /// nunca coordenadas que el jugador teclee paso a paso) y avanza UN PASO por llamada — así el
  /// frontend puede animar celda a celda y detenerse en cuanto haya colisión/aviso, sin resolver
  /// todo el trayecto de golpe. El resto del mundo (ZonePoint FAUNA/NPC) avanza su propio paso a la
  /// vez (`avanzarZonePointsUnPaso`) — cuando el jugador se mueve, el mundo se mueve.
  app.post<{ Params: { id: string }; Body: { destino: { x: number; y: number } } }>('/saves/:id/zona/mover', async (request, reply) => {
    const { destino } = request.body;
    if (typeof destino?.x !== 'number' || typeof destino?.y !== 'number') {
      return reply.status(400).send({ error: 'Falta el campo: destino {x,y}' });
    }
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        worldId: true,
        endedAt: true,
        pendingDeathResolution: true,
        zonaPosX: true,
        zonaPosY: true,
        zonaCaminoPendiente: true,
        currentLocationId: true,
        currentLocation: { select: { id: true } },
        worldState: { select: { factionsStatus: true, fictionalMinutes: true, fictionalDateLabel: true } },
        characterName: true,
      },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    if (!save.currentLocationId) return reply.status(400).send({ error: 'Sin ubicación actual — no hay zona donde moverse.' });

    const factionsStatus = (save.worldState?.factionsStatus as Record<string, number> | null) ?? {};
    const posicionActual = save.zonaPosX != null && save.zonaPosY != null ? { x: save.zonaPosX, y: save.zonaPosY } : { x: 400, y: 300 };
    const celdaActual = celdaDePixel(posicionActual);

    // Camino ya en curso hacia el mismo destino (varias llamadas seguidas del frontend animando
    // paso a paso) vs. un destino NUEVO (el jugador clicó en otro sitio a mitad de camino) — en
    // ambos casos se recalcula desde la celda actual, nunca se asume que el camino persistido sigue
    // siendo válido si el jugador cambió de idea.
    const celdaDestino = celdaDePixel(destino);
    const caminoPendientePrevio = (save.zonaCaminoPendiente as { x: number; y: number }[] | null) ?? null;
    const siguePreviamenteHaciaEsteDestino =
      caminoPendientePrevio && caminoPendientePrevio.length > 0 && mismaCelda(celdaDePixel(caminoPendientePrevio[caminoPendientePrevio.length - 1]), celdaDestino);
    const caminoCeldas = siguePreviamenteHaciaEsteDestino ? caminoPendientePrevio!.map((p) => celdaDePixel(p)) : calcularCamino(celdaActual, celdaDestino);

    // Bug real (2026-09-08, reproducido jugando en vivo: "llego a la celda adyacente de Gistera,
    // clico su misma celda de nuevo, y no pasa nada") — `calcularCamino` devuelve `[]` en cuanto
    // origen y destino YA son la misma celda (su propio `while` nunca se ejecuta), y este bloque
    // devolvía `colision: null` sin más, sin comprobar NADA — aunque el jugador ya estuviera
    // parado justo encima de un NPC/fauna real. Corregido: un camino vacío también evalúa
    // colisión/aviso contra la celda ACTUAL antes de devolver (nunca se movió, pero puede que YA
    // esté colisionando o avisado, y el jugador necesita esa información para poder Interactuar).
    if (caminoCeldas.length === 0) {
      return prisma.$transaction(async (tx) => {
        const { colision, aviso, dynamicModeOffer, logEntry } = await detectarEncuentroEnCelda(
          tx,
          save.id,
          save.worldId,
          save.currentLocationId!,
          celdaActual,
          factionsStatus,
          save.characterName,
          save.worldState?.fictionalMinutes ?? 480,
          save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
        );
        if (dynamicModeOffer) {
          await tx.save.update({ where: { id: save.id }, data: { pendingDynamicModeOffer: dynamicModeOffer as unknown as Prisma.InputJsonValue } });
        }
        return { jugador: posicionActual, caminoRestante: [], colision, aviso, dynamicModeOffer, logEntry };
      });
    }

    const [siguienteCelda, ...restoCamino] = caminoCeldas;
    const nuevaPosicion = pixelDeCelda(siguienteCelda);

    const resultado = await prisma.$transaction(async (tx) => {
      // El mundo también se mueve — un paso por cada paso del jugador, ANTES de comprobar colisión
      // (mismo criterio Mount & Blade: ambos avanzan a la vez, la colisión se evalúa sobre el
      // estado ya actualizado, no sobre la posición vieja de la fauna).
      await avanzarZonePointsUnPaso(tx, save.currentLocationId!, Math.random);

      const { colision, aviso, dynamicModeOffer, logEntry } = await detectarEncuentroEnCelda(
        tx,
        save.id,
        save.worldId,
        save.currentLocationId!,
        siguienteCelda,
        factionsStatus,
        save.characterName,
        save.worldState?.fictionalMinutes ?? 480,
        save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
      );

      // Una colisión detiene el avance AQUÍ — el jugador no llega más allá del punto de encuentro,
      // y no queda camino pendiente (tiene que decidir qué hacer antes de seguir moviéndose).
      const caminoRestantePixel = colision ? [] : restoCamino.map((c) => pixelDeCelda(c));

      await tx.save.update({
        where: { id: save.id },
        data: {
          zonaPosX: nuevaPosicion.x,
          zonaPosY: nuevaPosicion.y,
          zonaCaminoPendiente: caminoRestantePixel.length > 0 ? (caminoRestantePixel as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          ...(dynamicModeOffer ? { pendingDynamicModeOffer: dynamicModeOffer as unknown as Prisma.InputJsonValue } : {}),
        },
      });

      return { jugador: nuevaPosicion, caminoRestante: caminoRestantePixel, colision, aviso, dynamicModeOffer, logEntry };
    });

    return resultado;
  });
}
