import { entityTypeDeSerVivo, FUENTES_DE_CATALOGO } from '../../services/entityDiscovery.js';
import type { FastifyInstance } from 'fastify';
import { posicionEnZona, viajerosAqui } from '../../services/viajerosCruce.js';
import { tablonEnLugar } from '../../services/cronista/tablones.js';
import { Prisma, type MetodoObtencion } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { zoneMapImageUrl } from '../../lib/imageAssets.js';
import { sourceDisplayNameFor, harvestSourcesThatAreFaunaWithoutNpc } from '../../scripts/worldCatalog.js';
import { detectNpcsInScene, scopeFor, hasPendingLoot } from '../../services/npcScene.js';
import { loadSessionFacts } from '../../services/worldFacts.js';
import { recordEntityDiscoveries } from '../../services/entityDiscovery.js';
import { sumarEnergiaPasiva } from '../../services/energiaPasiva.js';
import { harvestAbilityForMetodo, matchesOficioPrefix, metodoPrincipalDeFuente } from '../../services/harvestAbilities.js';
import { RECOLECCION_COOLDOWN_MS } from './recolectar.js';
import { momentoDelDiaFor, estacionFor, advanceFictionalMinutes, formatFictionalDate } from '../../services/worldClock.js';

/// B2 (2026-09-28) — minutos ficticios que cuesta cada paso real por la cuadrícula de la zona.
const MINUTOS_POR_PASO_ZONA = 1;
import type { EstacionSlug } from '../../services/imagePromptContext.js';
import { faccionMasComun, ZONAS_DE_INICIO,
  zonePointColorFor,
  avanzarZonePointsUnPaso,
  asegurarZonePointsDePartida,
  zonePointVisiblePara,
  zonePointActivoAhora,
  zonePointNpcMuertoParaSiempre,
  questSlugsAceptadosPara,
  recalcularZonePointsDeLocation,
  type ZonePointColor,
} from '../../services/zonePoints.js';
import { aNombre, conIndefinido, pluralDeEspecie, nombreEnFrase, nombreOcultoPorRaza } from '../../services/dynamicMode.js';
import { parseAgenda, regionControlActual, type RegionControlState } from '../../services/worldAgenda.js';
import { REGION_OWNING_FACTIONS, effectiveTemperamento } from '../../services/reputation.js';
import { LIENZO_ANCHO, LIENZO_ALTO, posicionAleatoriaEnLienzo, celdaLibreEnEspiral, claveCelda, celdaDePixel, pixelDeCelda, calcularCamino, celdaAdyacenteOMisma, mismaCelda, tirarQuienIniciaEncuentro, type Celda, type IniciativaEncuentroLogRoll } from '../../services/zonaPosicion.js';
import { rejectIfEnded, rejectIfPendingDeath } from './shared.js';
import { createInFlightClaimSet } from '../../lib/inFlightClaimSet.js';
import { iniciarCaza, type CazaTarget } from '../../services/caza.js';
import { riesgoDeCaza, type RiesgoCazaInfo } from '../../services/cazaRiesgo.js';
import type { AttributeBlock } from '../../services/dice.js';
import { posicionesDeSalidasDeZona, celdasDeEntrada, enRadioSeguro } from '../../services/entradasZona.js';
import { effectiveAttributes } from '../../services/equipment.js';
import { minutosConDestreza } from '../../services/travel.js';
import { ambitoFacciones } from '../../services/mundoPartida.js';
import { etiquetasActivas } from '../../services/cronista/etiquetas.js';
import { conRencor, npcsConRencor } from '../../services/cronista/recuerdos.js';
import { enGraciaTrasRenacer } from '../../services/death.js';

/// Candado de "movimiento en curso" (hallazgo 45, revisar-partida-hallazgos.md, 2026-09-15) —
/// mismo patrón que `turnLock.ts`/`chapterSummary.ts` (`createInFlightClaimSet`), pero con
/// caducidad mucho más corta: `/zona/mover` no llama a ningún LLM (a diferencia de `/turn/narrate`,
/// candado de 5 min), es una escritura rápida de Postgres — 10s de margen basta de sobra para
/// cubrir el peor caso de latencia real sin dejar la partida bloqueada mucho tiempo si algo se
/// cuelga. El frontend ya se protege a sí mismo (`ZonaPanel.tsx`, `movimientoTokenRef`) contra que
/// EL MISMO cliente se solape consigo mismo animando el trayecto paso a paso — este candado cubre
/// el caso que el frontend no puede: dos peticiones concurrentes REALES (doble pestaña, reintento
/// de red con la original todavía viva en el servidor) leyendo `zonaPosX/Y`/`zonaCaminoPendiente`
/// antes de que ninguna escriba, cada una calculando su propio "siguiente paso" desde la misma
/// posición de partida.
const zonaMoverClaims = createInFlightClaimSet<string>(10_000);

/// AGRESIVO/ENEMIGO — el encuentro corta el paso (`combateForzado`), nunca es una oferta que se pueda
/// dejar pasar ni silenciar por `Save.zonaUltimoEncuentro`.
function esTemperamentoHostil(temperamento: string): boolean {
  return temperamento === 'AGRESIVO' || temperamento === 'ENEMIGO';
}

/// Extraído para poder derivar el tipo exacto de `save` que recibe `resolverMovimientoEnZona`
/// (`Prisma.SaveGetPayload<{ select: typeof SAVE_SELECT_PARA_MOVER }>`) sin repetir el `select` ni
/// caer en `any`/en el tipo genérico completo de `Save` (que no reflejaría este `select` acotado).
const SAVE_SELECT_PARA_MOVER = {
  id: true,
  worldId: true,
  endedAt: true,
  pendingDeathResolution: true,
  zonaPosX: true,
  zonaPosY: true,
  zonaCaminoPendiente: true,
  zonaUltimoEncuentro: true,
  pendingDynamicModeOffer: true,
  pendingNpcInteractionOffer: true,
  currentLocationId: true,
  currentLocation: { select: { id: true } },
  worldState: { select: { factionsStatus: true, fictionalMinutes: true, fictionalDateLabel: true } },
  characterName: true,
  // "¿Quién ve a quién primero?" (2026-09-17) — Destreza del jugador para `quienIniciaEncuentro`.
  attributes: true,
  // QA-27 (P3): con el equipo puesto, igual que la huida y el combate (`effectiveAttributes`).
  inventoryItems: { where: { slot: { not: null } }, select: { statBonuses: true } },
  // F9-1 (decisión de Álvaro, 2026-09-29): nivel del jugador para el aviso de riesgo de la tarjeta Cazar.
  level: true,
} satisfies Prisma.SaveSelect;

/// Día/noche/estación (2026-08-27) — la vista Zona ya conoce el reloj real de la partida
/// (`WorldState.fictionalMinutes`), así que elige sola qué variante mostrar en vez de un selector
/// manual (eso solo tiene sentido en la Enciclopedia, donde se navega fuera de una partida
/// concreta). `Estacion` de Prisma es MAYÚSCULA (`estacionFor`); el slug de archivo es minúscula
/// (mismo convenio que el resto de sufijos de imagen) — este mapa hace ese único ajuste.
const ESTACION_A_SLUG: Record<string, EstacionSlug> = { PRIMAVERA: 'primavera', VERANO: 'verano', OTONO: 'otono', INVIERNO: 'invierno' };

/// Icono de parcela en el mapa de Zona (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) — una
/// por cada `Parcela` sembrada en la Location actual (solo zonas-interior de Capital/Cuartel
/// Avanzado tienen alguna; el resto de zonas del mundo siempre devuelven `[]`, mismo criterio de
/// "disponible: false si no hay nada" que el resto del panel). Shape mínimo para pintar el icono y
/// decidir si abrir "detalle de edificio ya construido" o "detalle de hueco vacío" — el contenido
/// real (candidatas, `blockedReason`) se pide aparte, bajo demanda, vía `GET
/// /saves/:id/parcelas/:parcelaId` (mismo criterio que `ZonaSalidaInfo`: el mapa solo pinta iconos,
/// el modal de detalle hace su propia llamada).
export interface ZonaParcelaInfo {
  id: string;
  x: number;
  y: number;
  tipo: 'BASICA' | 'AVANZADA';
  /// Ya construido aquí — el frontend pinta el icono/nombre del edificio real en vez de un hueco
  /// vacío, y el modal de detalle no ofrece "Construir".
  building: { id: string; name: string; status: string } | null;
}

export interface ZonaSalidaInfo {
  locationId: string;
  slug: string;
  nombre: string;
  x: number;
  y: number;
  visitada: boolean;
  teaser: string | null;
  description: string | null;
  imageUrl: string | null;
  /// Umbral de proximidad (2026-09-20, petición explícita de Álvaro: "la salida de una zona debe
  /// estar representada en el mapa con un icono y al estar a una celda si pulsas el icono saca el
  /// modal para poder darle a viajar") — antes el icono se podía clicar y "Viajar" desde CUALQUIER
  /// punto del mapa, sin comparar nunca contra la posición real del jugador (`salidas` nunca se leía
  /// en `POST /zona/mover`, el cruce real pasaba por un sistema de texto libre totalmente
  /// desacoplado del movimiento por cuadrícula). Mismo criterio EXACTO que la colisión con NPC/
  /// fauna/recursos (`celdaAdyacenteOMisma`) — misma celda o cualquiera de las 8 vecinas. `true` si
  /// no hay posición de jugador conocida todavía (fallback permisivo aquí, a diferencia del resto
  /// del motor: una partida sin `zonaPosX/Y` no debería quedar sin poder viajar nunca).
  alcanzable: boolean;
  /// QA-27 (P7): `ENTRAR` si lleva a una zona interior (dentro de esta), `SALIR` si es la puerta de
  /// un interior hacia fuera; sin el campo, una salida normal de región.
  puerta?: 'ENTRAR' | 'SALIR';
  /// P115 (QA-27): minutos de camino hasta el destino; P132: con la Destreza, como el viaje real.
  minutos: number;
  /// P115: el destino tiene nombre para la jugadora (ya estuvo, o lleva el mapa de la región — mismo
  /// criterio que la brújula, `compassNarrationText`).
  conocida: boolean;
}

/// Iconos de salida de región (2026-09-17, petición explícita de Álvaro: "cada salida debe estar
/// ubicada en su posición correcta hacia el camino que se indica en el mapa... si está al sur para
/// ir a Pilares Rotos, pues la salida al sur") — una por cada `LocationLink` real que conecta la
/// Location actual con otra, posicionada en el borde del lienzo según la dirección cardinal REAL
/// entre ambas (`cardinalDirectionBetween`, mismo cálculo ya usado por la Aguja de Cardo Brújula y
/// por `fijarEntradaAZona` al llegar a una zona nueva — no se inventa un criterio nuevo).
/// `puntoDeEntradaParaDireccion` se usa SIN invertir (a diferencia de `direccionDeEntrada`, que sí
/// invierte porque calcula el borde de LLEGADA a la zona destino): aquí es el borde de SALIDA de
/// la zona actual, en la misma dirección hacia la que se viaja.
///
/// `null` si la Location actual o la conectada no tienen coordenadas reales (`x`/`y` opcionales de
/// catálogo, ver `LocationInput`) — nunca inventa una dirección, mismo criterio de "falla cerrado"
/// que el resto de usos de estas coordenadas.
///
/// Visitada/no visitada (2026-09-17) — Locations NO usan la Enciclopedia de 3 fases
/// (`DiscoveredEntity`), usan el sistema binario `LocationVisit` ya existente: una fila = ya
/// estuvo ahí. `teaser`/`description`/`imageUrl` solo se calculan de verdad si ya la visitó (el
/// caller/frontend decide cuál mostrar); si no, se devuelven de todos modos para que el modal
/// pueda mostrar el teaser SIN pedir una segunda llamada — pero `imageUrl` siempre `null` sin
/// visitar (nunca revela la imagen real de un sitio no explorado).
async function salidasDeRegionPara(
  saveId: string,
  worldId: string,
  location: { id: string; x: number | null; y: number | null },
  jugador: { x: number; y: number } | null,
  /// P132 (QA-27): atributos con el equipo puesto, los mismos con que `turn.ts` resuelve el viaje.
  attributes: AttributeBlock | null,
): Promise<ZonaSalidaInfo[]> {
  const links = await prisma.locationLink.findMany({
    where: { OR: [{ fromId: location.id }, { toId: location.id }] },
    select: {
      minutosBase: true,
      from: { select: { id: true, slug: true, name: true, x: true, y: true, teaser: true, description: true, kind: true } },
      to: { select: { id: true, slug: true, name: true, x: true, y: true, teaser: true, description: true, kind: true } },
    },
  });
  if (links.length === 0) return [];
  const conectadas = links.map((l) => (l.from.id === location.id ? l.to : l.from));
  // QA-27 (P7): un interior no tiene coordenadas de mundo — sus salidas son puertas (ver
  // `puertasInterior.ts`): desde dentro, todas a la puerta de abajo; desde fuera, junto al edificio.
  const esInterior = location.x == null || location.y == null;
  const interiores = esInterior ? conectadas : conectadas.filter((c) => c.kind === 'interior' && (c.x == null || c.y == null));
  const visitas = await prisma.locationVisit.findMany({
    where: { saveId, locationId: { in: conectadas.map((c) => c.id) } },
    select: { locationId: true },
  });
  const visitadasIds = new Set(visitas.map((v) => v.locationId));
  // P132: la duración del viaje de verdad (`minutosConDestreza`), no la base del enlace.
  const minutosPorDestino = new Map(links.map((l) => [l.from.id === location.id ? l.to.id : l.from.id, (attributes ? minutosConDestreza(l.minutosBase, attributes) : l.minutosBase)]));
  const llevaMapa = !!(await prisma.inventoryItem.findFirst({ where: { saveId, catalogSlug: 'mapa-de-las-llanuras' }, select: { id: true } }));

  const celdaJugador = jugador ? celdaDePixel(jugador) : null;
  // Rumbo real, no sector cardinal (2026-09-28, ver `posicionesDeSalidas`, zonaPosicion.ts): antes
  // varios destinos del mismo octante quedaban apilados en el mismo píxel. Puertas y rumbos, en
  // `posicionesDeSalidasDeZona` (lo comparte el radio seguro de las entradas, P116).
  const conCoordenadas = esInterior ? [] : conectadas.filter((d): d is typeof d & { x: number; y: number } => d.x != null && d.y != null);
  const posiciones = await posicionesDeSalidasDeZona(prisma, saveId, location, conectadas);
  const salidas: ZonaSalidaInfo[] = [];
  interiores.forEach((destino) => {
    const punto = posiciones.get(destino.id)!;
    const visitada = visitadasIds.has(destino.id);
    salidas.push({
      locationId: destino.id,
      slug: destino.slug,
      nombre: destino.name,
      x: punto.x,
      y: punto.y,
      visitada,
      teaser: destino.teaser,
      description: visitada ? destino.description : null,
      imageUrl: visitada ? zoneMapImageUrl(destino.slug) : null,
      alcanzable: celdaJugador ? celdaAdyacenteOMisma(celdaJugador, celdaDePixel(punto)) : true,
      puerta: esInterior ? 'SALIR' : 'ENTRAR',
      minutos: minutosPorDestino.get(destino.id) ?? 0,
      conocida: true,
    });
  });
  for (const destino of conCoordenadas) {
    const punto = posiciones.get(destino.id)!;
    const visitada = visitadasIds.has(destino.id);
    const alcanzable = celdaJugador ? celdaAdyacenteOMisma(celdaJugador, celdaDePixel(punto)) : true;
    salidas.push({
      locationId: destino.id,
      slug: destino.slug,
      nombre: destino.name,
      x: punto.x,
      y: punto.y,
      visitada,
      teaser: destino.teaser,
      description: visitada ? destino.description : null,
      imageUrl: visitada ? zoneMapImageUrl(destino.slug) : null,
      alcanzable,
      minutos: minutosPorDestino.get(destino.id) ?? 0,
      conocida: visitada || llevaMapa,
    });
  }
  return salidas;
}

/// Grupo 3 § Mundo determinista (docs/rpgtarkor/lore-mundo/mundo-determinista.md, 2026-08-25) — Capa 1: zonas
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
        currentLocation: { select: { id: true, slug: true, name: true, region: true, kind: true, x: true, y: true } },
        worldState: { select: { fictionalMinutes: true, factionsStatus: true, agenda: true } },
        // ZON-58: nivel de oficio para el candado de los recursos.
        professionProgress: { select: { professionId: true, nivel: true } },
        // P132: los minutos de cada salida, con la Destreza (y el equipo) como el viaje real.
        attributes: true,
        inventoryItems: { where: { slot: { not: null } }, select: { statBonuses: true } },
      },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    // Punto del jugador en el mapa de Zona (2026-09-04) — null en partidas previas a esta pieza, o
    // sin nada que asignar todavía (nunca se ha resuelto una acción determinista que lo mueva).
    const jugador = save.zonaPosX != null && save.zonaPosY != null ? { x: save.zonaPosX, y: save.zonaPosY } : null;
    if (!save.currentLocation) return { disponible: false, puntos: [], dinamicos: [], jugador, salidas: [], parcelas: [] };

    const { slug: locationSlug, name: locationName, id: locationId, region, kind } = save.currentLocation;
    // Fase 5 (B1): filas VIVAS de esta partida (clonadas de la plantilla al entrar la primera vez).
    let zonePointsRaw = await asegurarZonePointsDePartida(prisma, save.id, locationId);
    const fictionalMinutes = save.worldState?.fictionalMinutes ?? 480;
    const momento = momentoDelDiaFor(fictionalMinutes);
    // Primer reparto de grupos de fauna (Fase 1, 2026-09-28, `plan-mecanicas-por-zona-2026-09-28.md`)
    // — hasta ahora `recalcularZonePointsDeLocation` solo se disparaba al resolver un turno de texto
    // libre (`turnResolution.ts`); una partida recién creada que abre el mapa sin escribir nada
    // vería el ×20 sin repartir hasta su primer turno. `lastUpdatedAtMinutes` null en cualquier
    // FAUNA de esta Location es la señal de "nunca recalculado todavía" (mismo criterio que
    // `proximaCantidadPara`).
    // P88 (QA-27): en una zona de inicio, la fauna hostil vuelve a su guarida también al abrir el mapa
    // (una partida con el reparto viejo lo ve sin tener que escribir un turno).
    if (zonePointsRaw.some((p) => p.tipo === 'FAUNA' && p.lastUpdatedAtMinutes == null) || ZONAS_DE_INICIO.has(locationSlug)) {
      await recalcularZonePointsDeLocation(prisma, save.worldId, save.id, locationId, region, fictionalMinutes);
      zonePointsRaw = await prisma.zonePoint.findMany({ where: { saveId: save.id, locationId } });
    }
    // Hallazgo 32 (revisar-partida-hallazgos.md 2026-09-07) — los interiores de campamento
    // (`kind: 'interior'`, ej. Ketg'lukar) no deberían tener variante de estación: bajo techo, el
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
      ? await regionControlActual(prisma, await ambitoFacciones(prisma, save.id), region, parseAgenda(save.worldState?.agenda), duenoOriginal)
      : null;
    // Fase G del 0.1 (hallazgo G25): Diplomacia dice que una facción se descubre «hablando con sus
    // NPC o visitando su territorio», pero estar en «Territorio de Clan Serhu» no descubría nada —
    // con un reino recién fundado no había con quién negociar. Estar en la zona cuenta como
    // visitarla: la facción que la controla queda CITADA (mismo nivel que la cascada de un NPC).
    if (regionControl?.duenoActual) {
      const faccionDuena = await prisma.faction.findFirst({ where: { worldId: save.worldId, name: regionControl.duenoActual, saveId: null }, select: { slug: true } });
      if (faccionDuena) {
        await prisma.discoveredEntity.upsert({
          where: { saveId_entityType_entitySlug: { saveId: save.id, entityType: 'faction', entitySlug: faccionDuena.slug } },
          create: { saveId: save.id, entityType: 'faction', entitySlug: faccionDuena.slug },
          update: {},
        });
      }
    }
    // Instancia viva (2026-08-27, Pieza 3 de "Dinamismo del mundo") — solo puntos `activo` se
    // muestran; `recalcularZonePointsDeLocation` (turnResolution.ts) ya decide cantidad/actividad
    // real en cada turno, aquí solo se lee lo que ya está persistido.
    //
    // Gate de aparición narrativa (2026-09-09, ver `zonePointVisiblePara`, zonePoints.ts) — el Orco
    // Enfurecido (`ZonePoint` incondicional de catálogo) no debe pintarse en el mapa hasta que la
    // misión de Gistera esté aceptada: "justo cuando Gistera te da la misión el Orco entra en la
    // zona por primera vez" (Álvaro, jugando en vivo).
    const questSlugsAceptados = await questSlugsAceptadosPara(prisma, save.id);
    const zonePointsActivos = zonePointsRaw.filter((p) => p.activo && zonePointVisiblePara(p.targetSlug, questSlugsAceptados));

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
      // P134 (QA-27): la misma regla que al guardar el descubrimiento (`entityTypeDeSerVivo`).
      return isDiscoveredEntity(entityTypeDeSerVivo(targetSlug, FUENTES_DE_CATALOGO), targetSlug);
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
    // P24 y P51 (QA-27): una fauna ya vista en la partida se salta el filtro de lugar de
    // `detectNpcsInScene` (bien para el turno), y si los hechos de sesión la nombran salía «presente
    // ahora» en cualquier zona: un Guchapo cazado en el Pozo aparecía en la Hondonada o en las Agujas.
    // En el mapa, quien no es un personaje único solo está en su lugar de origen (o si no tiene).
    const fueraDeSuSitio = (n: { kind: string; homeLocationSlug: string | null }) => n.kind !== 'PRINCIPAL' && !!n.homeLocationSlug && n.homeLocationSlug !== locationSlug;
    const dinamicosCandidatos = npcsInScene.filter((n) => n.condicionFisica !== 'MUERTO' && !zonePointSlugs.has(n.slug) && !fueraDeSuSitio(n));

    // Punto del jugador en el mapa de Zona (2026-09-04) — `NpcState` de TODOS los NPC/fauna
    // implicados hoy en el mapa (dinámicos + los `ZonePoint` reales de tipo NPC/FAUNA), una sola
    // query batch, para resolver a la vez: (a) asignación perezosa de posición a un dinámico nunca
    // visto antes, (b) filtro de "ausente por combate ganado" (6h de ficción o cambio de zona).
    const npcFaunaZonePointSlugs = zonePointsActivos.filter((p) => p.tipo === 'FAUNA' || p.tipo === 'NPC').map((p) => p.targetSlug);
    // Compañero de fauna con nombre propio (auditoría de lore 2026-09-13, C10 — "los compañeros de
    // npc deben formar un mismo punto en el mapa de zona... se mueven como 1"): el companion NUNCA
    // tiene ZonePoint propio (un solo punto real por dueño, sin duplicar movimiento en la
    // cuadrícula) — se resuelve aquí mismo (batch único, no una query aparte: dos llamadas
    // independientes a `prisma.npc.findMany` rompían el mock por `mockResolvedValueOnce` de
    // zona.test.ts), buscando también por el slug INVERSO (`companionOfNpcSlug` apuntando a
    // cualquiera de los dueños de este mapa) y filtrando en memoria qué filas son "dueño real de
    // este ZonePoint" vs. "companion de alguno de ellos".
    const npcFaunaZonePointRows =
      npcFaunaZonePointSlugs.length > 0
        ? await prisma.npc.findMany({
            where: {
              worldId: save.worldId,
              OR: [{ slug: { in: npcFaunaZonePointSlugs } }, { companionOfNpcSlug: { in: npcFaunaZonePointSlugs } }],
            },
            // CR-7: `npcStates` muertos en esta partida fuera de escena (expedición de facción).
            select: { id: true, slug: true, name: true, kind: true, companionOfNpcSlug: true, muertoEnMundo: true, temperamento: true, faction: true, npcStates: { where: { saveId: save.id, muerto: true }, select: { id: true } } },
          })
        : [];
    const npcFaunaZonePointIds = npcFaunaZonePointRows.filter((n) => npcFaunaZonePointSlugs.includes(n.slug));
    const npcIdBySlugZonePoint = new Map(npcFaunaZonePointIds.map((n) => [n.slug, n.id]));
    const npcNameBySlugZonePoint = new Map(npcFaunaZonePointIds.map((n) => [n.slug, n.name]));
    // P106 (QA-27): los NPC objetivo de una misión activa llevan su marca en el mapa (aunque sigan sin
    // descubrir: «???» y sin marca, nada decía que era el objetivo).
    const objetivosDeMision = new Set(
      (await prisma.quest.findMany({ where: { saveId: save.id, status: 'ACTIVA', targetNpcId: { not: null } }, select: { targetNpcId: true } })).map((q) => q.targetNpcId!),
    );
    // P107 (QA-27): `ZonePoint.factionSlug` casi nunca está relleno; la facción es la del propio NPC.
    const npcFactionBySlugZonePoint = new Map(npcFaunaZonePointIds.map((n) => [n.slug, n.faction]));
    // P139 (QA-27): un edificio sin facción propia es de la facción de la gente que vive aquí (la más
    // común entre los NPC de la zona): la Herrería del Clan Serhu salía «sin facción».
    const faccionesDeLaZona = zonePointsActivos.filter((p) => p.tipo === 'NPC').map((p) => npcFactionBySlugZonePoint.get(p.targetSlug)).filter((f): f is string => !!f);
    const faccionDeLosEdificios = faccionMasComun(faccionesDeLaZona);
    // ZON-50/ZON-33 (hito 0.2): quién te perseguiría (misma regla que la persecución de
    // `avanzarZonePointsUnPaso`: temperamento efectivo según tu reputación con su facción).
    // CR-16: y quien te guarda rencor por lo que le hiciste.
    const rencoresZona = await npcsConRencor(prisma, save.id, npcFaunaZonePointIds.map((n) => n.id), save.worldState?.fictionalMinutes ?? 0);
    const hostilBySlugZonePoint = new Map(
      npcFaunaZonePointIds.map((n) => [n.slug, esTemperamentoHostil(conRencor(effectiveTemperamento(n.temperamento, n.faction, factionsStatus), rencoresZona.has(n.id)))]),
    );
    for (const n of npcFaunaZonePointIds) npcKindBySlug.set(n.slug, n.kind);
    const companionsByOwnerSlug = new Map(
      npcFaunaZonePointRows.filter((n) => n.companionOfNpcSlug).map((c) => [c.companionOfNpcSlug!, { slug: c.slug, nombre: c.name }]),
    );
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

    // Muerte permanente de un NPC único (`kind: 'PRINCIPAL'`) con `ZonePoint` propio — ver
    // `zonePointNpcMuertoParaSiempre`, zonePoints.ts. A diferencia de `estaAusente` (ventana de 6h),
    // esto nunca caduca: un Orco Enfurecido derrotado no debe volver a pintarse en el mapa jamás.
    const estaMuertoParaSiempre = (kind: string, state: { condicionFisica: string } | undefined): boolean =>
      zonePointNpcMuertoParaSiempre(kind, state?.condicionFisica);

    // Bug real jugando en vivo (2026-09-06, "fauna diurna y nocturna mezclada siendo de día") —
    // `faunaMomentoDelDia` ya filtraba a los NPC/fauna DINÁMICOS (sin ZonePoint, ver
    // `detectNpcsInScene`), pero un `ZonePoint` de tipo FAUNA sembrado a mano en el catálogo se
    // mostraba siempre, de día o de noche, sin pasar por este filtro. `zonePointActivoAhora`
    // (zonePoints.ts) centraliza este mismo criterio para colisión/movimiento también (ver
    // comentario ahí — bug real 2026-09-17: sin esto, un Kirelon "invisible" de día seguía
    // persiguiendo/colisionando igualmente).
    const zonePoints = zonePointsActivos.filter((p) => {
      if (p.tipo !== 'FAUNA' && p.tipo !== 'NPC') return true;
      if (!zonePointActivoAhora(p.targetSlug, momento)) return false;
      const npcId = npcIdBySlugZonePoint.get(p.targetSlug);
      if (!npcId) return true;
      const npc = npcFaunaZonePointIds.find((n) => n.id === npcId)!;
      const state = npcStateByKey.get(`${npcId}|${scopeFor(npc.kind, locationId)}`);
      if (estaMuertoParaSiempre(npc.kind, state)) return false;
      // Muerto de mundo o en esta partida (intercepción de expedición de facción): nunca se pinta,
      // sea del `kind` que sea.
      if (npc.muertoEnMundo || (npc.npcStates?.length ?? 0) > 0) return false;
      // Grupos de fauna reales (Fase 2, 2026-09-28) — bug real encontrado en pruebas: `NpcState` es
      // UNO por especie y Location (`scopeFor`), así que abatir UN individuo de un grupo marcaba
      // `zonaAusenteHastaMinutes` en esa única fila, y este filtro ocultaba TODOS los `ZonePoint`
      // de esa especie (~12 grupos) durante 6h por culpa de un solo individuo caído. Con grupos
      // reales la ausencia ya la representa el propio descuento de `cantidad` del punto (ver
      // `iniciarCaza`/`descontarZonePointCaza`, services/caza.ts) — así que `estaAusente` solo debe
      // seguir ocultando un NPC de identidad única (`kind === 'PRINCIPAL'`, sin grupo posible).
      return npc.kind !== 'PRINCIPAL' || !estaAusente(state);
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
      tipo: 'NPC' | 'FAUNA' | 'OBJETO' | 'CADAVER';
      color: ZonePointColor;
      x: number;
      y: number;
      droppedItemId?: string;
      descubierto: boolean;
      cadaver?: { npcSlug: string; nombre: string; saqueable: boolean; desollable: boolean };
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
        color: zonePointColorFor(n.faction, factionsStatus, tipoDinamico),
        x: pos.x,
        y: pos.y,
        descubierto: yaDescubierto,
      });
    }

    // Cadáveres en el mapa (Fase 5, 2026-09-28, `plan-mecanicas-por-zona-2026-09-28.md`) — un NPC/
    // fauna MUERTO con botín o despiece pendiente (`hasPendingLoot`, mismo criterio que
    // `saquear-zona` y `carcassCandidatesFor`) se pinta donde cayó. La posición vive en
    // `NpcState.zonaPosX/Y` + `zonaLocationId` (la misma que ya usan los dinámicos vivos: un NPC
    // dinámico muere donde estaba). Si no tiene posición en esta Location (fauna de un `ZonePoint`,
    // caza limpia...), se asigna aquí de forma perezosa — mismo criterio que los dinámicos de arriba
    // — en la celda libre más cercana al jugador, que es donde acaba de pelear: `GET /zona` siempre
    // se pide al abrir el mapa, antes de poder dar ningún paso.
    // Fase 9 (2026-09-29): también los caídos de un grupo (`groupDefeated`), cuyo `condicionFisica`
    // refleja al siguiente individuo vivo — mismo criterio que Desollar (`carcassCandidatesFor`).
    const muertos = await prisma.npcState.findMany({ where: { saveId: save.id, OR: [{ condicionFisica: 'MUERTO' }, { groupDefeated: { gt: 0 } }] } });
    const muertosPendientes = (muertos ?? []).filter((st) => st.condicionFisica === 'MUERTO' || st.groupDefeated > 0).filter(hasPendingLoot).filter((st) => st.zonaLocationId == null || st.zonaLocationId === locationId);
    if (muertosPendientes.length > 0) {
      const npcsMuertos = await prisma.npc.findMany({
        where: { id: { in: muertosPendientes.map((st) => st.npcId) }, worldId: save.worldId },
        select: { id: true, slug: true, name: true, kind: true, ataqueNatural: true, _count: { select: { items: true } } },
      });
      const npcMuertoById = new Map(npcsMuertos.map((n) => [n.id, n]));
      const desollables = new Set(
        (
          await prisma.harvestYield.findMany({
            where: { worldId: save.worldId, metodoObtencion: 'CAZA', sourceSlug: { in: npcsMuertos.map((n) => n.slug) } },
            select: { sourceSlug: true },
          })
        ).map((r) => r.sourceSlug),
      );
      const celdasOcupadas = new Set(ocupadas.map((o) => claveCelda(celdaDePixel(o))));
      if (jugador) celdasOcupadas.add(claveCelda(celdaDePixel(jugador)));
      for (const st of muertosPendientes) {
        const npc = npcMuertoById.get(st.npcId);
        if (!npc || scopeFor(npc.kind, locationId) !== st.scope) continue;
        let pos = st.zonaPosX != null && st.zonaPosY != null && st.zonaLocationId === locationId ? { x: st.zonaPosX, y: st.zonaPosY } : null;
        if (!pos) {
          const origen = celdaDePixel(jugador ?? { x: LIENZO_ANCHO / 2, y: LIENZO_ALTO / 2 });
          pos = pixelDeCelda(celdaLibreEnEspiral(origen, celdasOcupadas));
          await prisma.npcState.update({ where: { id: st.id }, data: { zonaPosX: pos.x, zonaPosY: pos.y, zonaLocationId: locationId } });
        }
        celdasOcupadas.add(claveCelda(celdaDePixel(pos)));
        ocupadas.push(pos);
        const desollable = npc.ataqueNatural !== null && desollables.has(npc.slug);
        dinamicos.push({
          slug: `cadaver:${npc.slug}`,
          nombre: `Cadáver de ${npc.name}`,
          tipo: 'CADAVER',
          color: 'INERTE',
          x: pos.x,
          y: pos.y,
          descubierto: true,
          // Saquear solo si hay algo: un humanoide (lleva Goirnos, B27) o un NPC con objetos de catálogo;
          // la fauna sin objetos solo se desuella.
          cadaver: { npcSlug: npc.slug, nombre: npc.name, saqueable: npc.ataqueNatural === null || (npc._count?.items ?? 0) > 0, desollable },
        });
      }
    }

    // "Tirar" objetos al suelo de la Zona (2026-09-06, hallazgo 8) — instancia POR PARTIDA
    // (`DroppedItem.saveId`), posición fija desde que se tiró (nunca perezosa como NPC/fauna
    // dinámicos de arriba). `slug`/`droppedItemId` distintos a propósito: el modal de detalle
    // necesita el id real de la fila para poder recogerla, un objeto tirado no tiene slug de
    // catálogo estable (puede no tener `catalogSlug` en absoluto, si es narrativo).
    const droppedItems = await prisma.droppedItem.findMany({ where: { saveId: save.id, locationId } });
    for (const d of droppedItems) {
      // INERTE (2026-09-09, mismo criterio que RECURSO en zonePointColorFor) — un objeto tirado al
      // suelo nunca tiene facción por diseño (nunca `SIN_FACCION`, ese naranja es para
      // NPC/FAUNA/EDIFICIO independientes que SÍ podrían tener dueño).
      dinamicos.push({ slug: d.id, nombre: d.name, tipo: 'OBJETO', color: 'INERTE', x: d.x, y: d.y, droppedItemId: d.id, descubierto: true });
    }

    // Iconos de salida de región (2026-09-17) — calculado una vez, lo necesitan ambos `return` de
    // aquí en adelante (con o sin ZonePoint sembrado, una zona SIEMPRE puede tener salidas reales).
    const salidas = await salidasDeRegionPara(save.id, save.worldId, save.currentLocation, jugador, save.attributes ? effectiveAttributes(save.attributes as AttributeBlock, save.inventoryItems ?? []) : null);

    // Iconos de parcela (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) — calculado una vez,
    // igual que `salidas`. Solo las zonas-interior de Capital/Cuartel Avanzado tienen filas reales
    // (`[]` en el resto del mundo); esas mismas zonas-interior nacen SIN ZonePoint sembrado, así
    // que `disponible` de abajo también mira `parcelas.length`, no solo `dinamicos`/`zonePointsActivos`.
    const parcelasRaw = await prisma.parcela.findMany({
      where: { locationId },
      include: { building: { select: { id: true, name: true, status: true } } },
    });
    // CR-40 (40g): tablón de avisos de este lugar, si lo hay (botón en el panel de zona).
    const tablon = await tablonEnLugar(prisma, save.id, locationId);
    const parcelas: ZonaParcelaInfo[] = parcelasRaw.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      tipo: p.tipo,
      building: p.building ? { id: p.building.id, name: p.building.name, status: p.building.status } : null,
    }));

    if (zonePoints.length === 0) {
      // `disponible` mira `zonePointsActivos` (datos sembrados reales), no `zonePoints` (ya
      // filtrado por ausencia, 2026-09-04) — un ZonePoint real que está temporalmente ausente por
      // combate ganado no debe leerse como "esta ubicación nunca tuvo zona explorable". `parcelas`
      // se suma al criterio (2026-09-21): una zona-interior recién creada no tiene ZonePoint ni
      // dinámicos todavía, pero SÍ tiene parcelas reales que mostrar.
      return {
        disponible: dinamicos.length > 0 || zonePointsActivos.length > 0 || parcelas.length > 0,
        puntos: [],
        dinamicos,
        locationSlug,
        locationName,
        imageUrl: zoneMapImageUrl(locationSlug, momento, estacion),
        regionControl,
        jugador,
        salidas,
        parcelas,
        tablon,
      };
    }

    // Nombres reales de catálogo para cada punto — FAUNA/NPC resuelven contra Npc.name (si el
    // punto tiene `label` propio, ese manda; si no, cae al nombre real, nunca al slug crudo).
    // EDIFICIO no tiene fila `Npc` propia (gobernado por `Building`/`construction.ts`, fuera del
    // alcance de esta pieza) — solo `label` o el slug crudo, mismo criterio que `zonePointsSummaryFor`.
    // Reutiliza `npcNameBySlugZonePoint` (ya cargado arriba para el filtro de ausencia) en vez de
    // repetir la misma query.

    // ZON-58 / ZON-16 (hito 0.2): estado de los recursos del mapa, con las mismas reglas que Recolectar:
    // agotado si se recolectó aquí hace menos del enfriamiento o ya no queda población; candado si
    // hasta lo más sencillo que da pide más nivel del oficio que lo recolecta.
    const recursoSlugs = [...new Set(zonePoints.filter((p) => p.tipo === 'RECURSO').map((p) => p.targetSlug))];
    const estadoRecurso = new Map<string, { agotado: boolean; nivelRequerido?: number }>();
    if (recursoSlugs.length > 0) {
      const [yields, poblaciones] = await Promise.all([
        prisma.harvestYield.findMany({ where: { worldId: save.worldId, sourceSlug: { in: recursoSlugs } }, select: { sourceSlug: true, metodoObtencion: true, item: { select: { tier: true } } } }),
        prisma.worldPopulation.findMany({ where: { saveId: save.id, targetType: 'RECURSO', targetSlug: { in: recursoSlugs } }, select: { targetSlug: true, poblacion: true, lastHarvestedAt: true, lastHarvestedLocationId: true } }),
      ]);
      const corte = Date.now() - RECOLECCION_COOLDOWN_MS;
      for (const slug of recursoSlugs) {
        const filas = yields.filter((y) => y.sourceSlug === slug);
        const pob = poblaciones.find((q) => q.targetSlug === slug);
        const enfriando = !!pob?.lastHarvestedAt && pob.lastHarvestedAt.getTime() > corte && pob.lastHarvestedLocationId === locationId;
        const agotado = enfriando || (pob !== undefined && pob.poblacion <= 0);
        const metodo = metodoPrincipalDeFuente(filas.map((f) => f.metodoObtencion));
        const oficio = metodo && metodo !== 'PASIVO' ? harvestAbilityForMetodo(metodo)?.oficio : undefined;
        let nivelRequerido: number | undefined;
        if (oficio && filas.length > 0) {
          const nivel = Math.max(1, ...(save.professionProgress ?? []).filter((pp) => matchesOficioPrefix(pp.professionId, oficio)).map((pp) => pp.nivel));
          const minimo = Math.min(...filas.map((f) => f.item.tier ?? 1));
          if (minimo > nivel) nivelRequerido = minimo;
        }
        estadoRecurso.set(slug, { agotado, ...(nivelRequerido ? { nivelRequerido } : {}) });
      }
    }

    return {
      disponible: true,
      // ZON-32 (hito 0.2): hora de ficción actual, para la hora de llegada de la ruta prevista.
      fictionalMinutes: save.worldState?.fictionalMinutes ?? 480,
      locationSlug,
      locationName,
      imageUrl: zoneMapImageUrl(locationSlug, momento, estacion),
      regionControl,
      // CR-63 (63e): los viajeros de paso por aquí, en su celda.
      viajeros: (await viajerosAqui(prisma, save.id)).map((v) => ({ id: v.id, nombre: `${v.propia ? 'Tu ' : ''}${v.que}${v.propia ? '' : ` (${v.quien})`}`, ...posicionEnZona(v.id) })),
      // P159 (QA-27): orden estable (por id, que sale en orden de creación). Sin orden, Postgres devolvía
      // al final la fila recién actualizada y la lista saltaba al recolectar.
      puntos: [...zonePoints].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((p) => {
        const yaDescubierto = descubierto(p.tipo, p.targetSlug);
        // P152 (QA-27): la fauna se nombra por su especie, como en la tarjeta del encuentro; la etiqueta
        // del catálogo («Charca de Guchapos») describía el sitio y la misma especie salía con dos nombres.
        const nombreReal =
          (p.tipo === 'FAUNA' ? npcNameBySlugZonePoint.get(p.targetSlug) : undefined) ??
          p.label ??
          (p.tipo === 'RECURSO'
            ? sourceDisplayNameFor(p.targetSlug)
            : p.tipo === 'EDIFICIO'
              ? p.targetSlug
              : (npcNameBySlugZonePoint.get(p.targetSlug) ?? p.targetSlug));
        const companion = p.tipo === 'NPC' ? companionsByOwnerSlug.get(p.targetSlug) : undefined;
        const faccionDelPunto = p.factionSlug ?? npcFactionBySlugZonePoint.get(p.targetSlug) ?? (p.tipo === 'EDIFICIO' ? faccionDeLosEdificios : null);
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
          // P107: la facción se ve aunque no se sepa quién es (como los dinámicos de arriba y en X4,
          // donde el color de la facción se ve antes de escanear); el nombre sigue oculto.
          color: zonePointColorFor(faccionDelPunto, factionsStatus, p.tipo),
          // P176 (QA-27): de quién es un edificio; el color solo decía cómo te ve su bando («Neutro»).
          ...(p.tipo === 'EDIFICIO' && faccionDelPunto ? { faccion: faccionDelPunto } : {}),
          descubierto: yaDescubierto,
          ...(objetivosDeMision.has(npcIdBySlugZonePoint.get(p.targetSlug) ?? '') ? { objetivoMision: true } : {}),
          // Compañero de fauna con nombre propio (C10, 2026-09-13) — presente solo si este NPC es
          // dueño de un companion; mismo criterio de `yaDescubierto` que el resto del punto (el
          // dueño no descubierto no debe filtrar el nombre real del companion).
          companion: companion ? { slug: companion.slug, nombre: yaDescubierto ? companion.nombre : '???' } : undefined,
          // ZON-50/ZON-33/ZON-53 (decisión de la usuaria, ronda de Z-D): la amenaza y la patrulla solo
          // de lo ya descubierto; lo desconocido sigue sorprendiendo.
          hostil: yaDescubierto && (hostilBySlugZonePoint.get(p.targetSlug) ?? false),
          ruta: yaDescubierto && Array.isArray(p.ruta) && p.ruta.length > 1 ? (p.ruta as { x: number; y: number }[]) : undefined,
          // ZON-58 / ZON-16: agotado o con candado (solo recursos ya descubiertos).
          ...(p.tipo === 'RECURSO' && yaDescubierto ? estadoRecurso.get(p.targetSlug) : {}),
        };
      }),
      dinamicos,
      jugador,
      salidas,
      parcelas,
      tablon,
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
    // "¿Quién ve a quién primero?" (2026-09-17) — Destreza del jugador, `Save.attributes` ya cargado
    // por el caller. Ver `quienIniciaEncuentro`, zonaPosicion.ts.
    destrezaJugador: number,
    // Último encuentro ya ofrecido en ESTA Location (`Save.zonaUltimoEncuentro`, 2026-09-28) — ese
    // objetivo se salta mientras siga en el radio de la celda; `null` = no saltar nada (el caller
    // pasa `null` también cuando el jugador pulsa su propia casilla: petición explícita).
    ultimoEncuentroSlug: string | null,
    // Nivel del jugador (`Save.level`) — solo para `riesgoCaza` de la oferta FAUNA (F9-1).
    nivelJugador: number,
    // P143: celda a la que se camina; `null` = pulsar la propia casilla (petición explícita).
    celdaDestino: { col: number; row: number } | null = null,
    // Celdas de las entradas ya calculadas en este paso (P116); si no, se calculan aquí.
    entradasConocidas?: Celda[],
  ): Promise<{
    /// `true` si el objetivo de `ultimoEncuentroSlug` sigue en el radio de `celda` — el caller solo
    /// limpia `Save.zonaUltimoEncuentro` cuando esto es `false` (el jugador ya salió de su radio).
    ultimoEncuentroSigueCerca: boolean;
    colision: { targetSlug: string; targetName: string; temperamento: string } | null;
    dynamicModeOffer:
      | {
          tipo: 'FAUNA' | 'NPC' | 'RECURSO';
          targetSlug: string;
          targetName: string;
          aQuien?: string;
          quienInicia: 'jugador' | 'npc';
          combateForzado?: true;
          /// Grupos de fauna reales (Fase 1, 2026-09-28) — id del `ZonePoint` colisionado, ausente
          /// para un dinámico sin `ZonePoint` propio (`detectNpcsInScene`/sessionFacts). Fase 2
          /// (`POST /saves/:id/zona/cazar`) lo usa para exigir que se caza EXACTAMENTE lo que se
          /// tiene delante, nunca por sorteo.
          zonePointId?: string;
          /// Cuántos individuos representa este encuentro AHORA MISMO — 1 para NPC/RECURSO/
          /// dinámicos (nunca se agrupan), puede ser >1 para un grupo de FAUNA real.
          cantidad?: number;
          /// Aviso de riesgo de la tarjeta "Cazar" (F9-1, decisión de Álvaro, 2026-09-29) — solo FAUNA
          /// no forzada con `ZonePoint`; ver `riesgoDeCaza` (cazaRiesgo.ts). Solo avisa, no cambia reglas.
          riesgoCaza?: RiesgoCazaInfo;
          /// P124: plural del nombre para un grupo de FAUNA (`pluralDeEspecie`).
          nombrePlural?: string;
          /// Método de obtención de la fuente (RECURSO, 2026-09-29) — el frontend lo usa para el verbo del
          /// botón del modal de detalle ("Talar"/"Minar"/…). Ausente en ofertas antiguas persistidas y en
          /// NPC/FAUNA; `null` si la fuente no tiene ningún yield (ver `metodoPrincipalDeFuente`).
          metodo?: MetodoObtencion | null;
        }
      | null;
    logEntry: { id: string; text: string; timeLabel: string; createdAt: string; roll?: IniciativaEncuentroLogRoll } | null;
    /// B7 (2026-09-28): recurso visto que el jugador todavía no sabe aprovechar — solo se registra
    /// como descubrimiento (sin oferta); el caller lo guarda como "último encuentro" para no repetir
    /// el aviso a cada paso mientras siga cerca.
    avistadoSinOferta?: { targetSlug: string };
  }> {
    const puntosCrudos = await tx.zonePoint.findMany({ where: { saveId, locationId, tipo: { in: ['FAUNA', 'NPC'] }, activo: true } });
    // Gate de aparición narrativa (ver `zonePointVisiblePara`, zonePoints.ts) — un `ZonePoint` cuya
    // misión de desbloqueo (p.ej. el Orco Enfurecido/Gistera) todavía no se aceptó no puede forzar
    // colisión/aviso: narrativamente no está en la zona todavía, aunque su fila de catálogo exista.
    //
    // Fauna diurna/nocturna (2026-09-17, bug real: "está apareciendo un kirelon todo el rato que no
    // se está representando con icono... y sin abrir combate" — un Kirelon nocturno, invisible de
    // día en `GET /zona`, seguía colisionando aquí igualmente porque esta función no conocía
    // `faunaMomentoDelDia`. Ver `zonePointActivoAhora`, zonePoints.ts).
    const momentoColision = momentoDelDiaFor(fictionalMinutes);
    const questSlugsAceptadosColision = await questSlugsAceptadosPara(tx, saveId);
    const puntos = puntosCrudos.filter(
      (p) => zonePointVisiblePara(p.targetSlug, questSlugsAceptadosColision) && zonePointActivoAhora(p.targetSlug, momentoColision),
    );
    const npcs = puntos.length
      ? await tx.npc.findMany({
          where: { worldId, slug: { in: puntos.map((p) => p.targetSlug) } },
          select: { id: true, slug: true, name: true, temperamento: true, faction: true, kind: true, attributes: true, level: true, raza: true, genero: true, articulo: true, muertoEnMundo: true, npcStates: { where: { saveId, muerto: true }, select: { id: true } } },
        })
      : [];
    const npcBySlug = new Map(npcs.map((n) => [n.slug, n]));
    // Muerte permanente de un NPC único con `ZonePoint` propio (ver `zonePointNpcMuertoParaSiempre`,
    // zonePoints.ts — bug real jugando: "al vencer al orco... no desaparecía correctamente") — mismo
    // criterio que ya aplica `GET /zona` al pin del mapa, aplicado aquí también a la colisión real
    // (antes esta función ni siquiera consultaba `NpcState`, así que un Orco derrotado seguía
    // colisionando para siempre).
    const npcStatesColision = npcs.length
      ? await tx.npcState.findMany({ where: { saveId, OR: npcs.map((n) => ({ npcId: n.id, scope: scopeFor(n.kind, locationId) })) } })
      : [];
    const npcStateBySlugColision = new Map(
      npcs.map((n) => [n.slug, npcStatesColision.find((s) => s.npcId === n.id && s.scope === scopeFor(n.kind, locationId))]),
    );
    const puntosVivos = puntos.filter(
      (p) => !npcBySlug.get(p.targetSlug)?.muertoEnMundo && !(npcBySlug.get(p.targetSlug)?.npcStates?.length ?? 0) && !zonePointNpcMuertoParaSiempre(npcBySlug.get(p.targetSlug)?.kind ?? '', npcStateBySlugColision.get(p.targetSlug)?.condicionFisica),
    );
    // Nombre oculto genérico (2026-09-09, generalización pedida por Álvaro: "esta lógica se debe
    // aplicar a todos los que tienen nombre propio" — hasta ahora la colisión de Zona era el único
    // punto del motor que revelaba `Npc.name` sin mirar si la partida ya lo descubrió; `GET /zona`
    // (§ `descubierto`, más arriba en este archivo) y la Enciclopedia ya aplican este mismo filtro
    // desde el hallazgo 34, 2026-09-07 — solo faltaba conectarlo aquí). Mismo criterio de catálogo
    // ya establecido en todo el proyecto: `kind === 'PRINCIPAL'` = nombre propio (Gistera Koh,
    // Sella Marn...), cualquier otro `kind` = fauna/NPC genérico sin identidad que ocultar (su
    // "nombre" ya es un nombre de especie/rol, nunca un spoiler).
    const discoveredNpcs = await tx.discoveredEntity.findMany({ where: { saveId, entityType: 'npc' } });
    const isNpcDiscovered = (targetSlug: string): boolean => discoveredNpcs.some((d) => d.entitySlug === targetSlug);
    const nombreVisibleColision = (targetSlug: string, kind: string | undefined, nombreReal: string, raza?: string | null, genero?: string | null): string =>
      kind === 'PRINCIPAL' && !isNpcDiscovered(targetSlug) ? nombreOcultoPorRaza(raza, genero) : nombreReal;

    // NPC "dinámicos" (2026-09-09, bug real jugando en vivo — Álvaro: "me he movido hasta la
    // casilla anterior a un NPC... pero no pasa nada... me puedo seguir moviendo libremente")
    // — hasta ahora esta función SOLO miraba `ZonePoint` de catálogo fijo, ciega a cualquier NPC
    // presentado por la narración (`detectNpcsInScene`/sessionFacts — Gistera Koh perseguidora,
    // interrupciones de la Capa 2/3...), que SÍ se pinta como pin en el mapa (`GET /zona` §
    // `dinamicos`) pero nunca participaba en la colisión/aviso del movimiento. Mismo criterio
    // exacto que `GET /zona` (líneas ~100-117 más arriba): candidatos vivos sin `ZonePoint` propio,
    // posición real leída de `NpcState.zonaPosX/Y` — nunca se les asigna posición aquí (a
    // diferencia de `GET /zona`, que sí la asigna perezosamente la primera vez); si un dinámico
    // todavía no tiene posición asignada, no puede colisionar (mismo fallback seguro que el resto
    // del sistema: sin posición conocida, nunca se fuerza nada).
    const zonePointSlugsColision = new Set(puntos.map((p) => p.targetSlug));
    const sessionFactsColision = await loadSessionFacts(saveId);
    const npcsInSceneColision = await detectNpcsInScene({
      action: '',
      worldId,
      sessionFacts: sessionFactsColision,
      saveId,
      currentLocationId: locationId,
      fictionalMinutes,
    });
    // Mismo filtro de lugar que el mapa (P24/P51): quien no se pinta tampoco te corta el paso.
    const locationColision = await tx.location.findUnique({ where: { id: locationId }, select: { slug: true, kind: true } });
    const locationSlugColision = locationColision?.slug ?? null;
    // P143 (decisión de la usuaria, 2026-10-13): en un asentamiento, quien no te es hostil no te
    // corta el paso al caminar; se le habla pulsándolo (ir hasta él o pulsar tu casilla a su lado).
    // Como en los pueblos de Medieval Dynasty o Bellwright: la gente está, pero no te para.
    const enAsentamiento = ['asentamiento', 'interior'].includes(locationColision?.kind ?? '');
    const noCortaElPaso = (tipo: string, temperamento: string, celdaNpc: { col: number; row: number }) =>
      enAsentamiento && !!celdaDestino && tipo === 'NPC' && !esTemperamentoHostil(temperamento) && !celdaAdyacenteOMisma(celdaDestino, celdaNpc);
    // P116 (QA-27): junto a una entrada de la zona (`RADIO_SEGURO_ENTRADA`), la fauna hostil no corta el paso.
    const enEntradaSegura = enRadioSeguro(celda, entradasConocidas ?? (await celdasDeEntrada(tx, saveId, locationId)));
    const faunaHostilEnEntrada = (tipo: string, temperamento: string) => enEntradaSegura && tipo === 'FAUNA' && esTemperamentoHostil(temperamento);
    const fueraDeSuSitioColision = (n: { kind: string; homeLocationSlug: string | null }) => n.kind !== 'PRINCIPAL' && !!n.homeLocationSlug && n.homeLocationSlug !== locationSlugColision;
    const dinamicosCandidatosColision = npcsInSceneColision.filter((n) => n.condicionFisica !== 'MUERTO' && !zonePointSlugsColision.has(n.slug) && !fueraDeSuSitioColision(n));
    const dinamicosStatesColision = dinamicosCandidatosColision.length
      ? await tx.npcState.findMany({
          where: {
            saveId,
            OR: dinamicosCandidatosColision.map((n) => ({ npcId: n.id, scope: scopeFor(n.kind, locationId) })),
          },
        })
      : [];
    const dinamicosStateByIdColision = new Map(dinamicosStatesColision.map((s) => [`${s.npcId}|${s.scope}`, s]));
    const dinamicosConPosicionColision = dinamicosCandidatosColision
      .map((n) => {
        const state = dinamicosStateByIdColision.get(`${n.id}|${scopeFor(n.kind, locationId)}`);
        if (!state || state.zonaPosX == null || state.zonaPosY == null || state.zonaLocationId !== locationId) return null;
        return {
          id: n.id,
          targetSlug: n.slug,
          targetName: n.name,
          kind: n.kind,
          raza: n.raza,
          genero: n.genero,
          articulo: n.articulo,
          temperamento: n.temperamento,
          faction: n.faction,
          tipo: (n.kind === 'PRINCIPAL' ? 'NPC' : 'FAUNA') as 'NPC' | 'FAUNA',
          x: state.zonaPosX,
          y: state.zonaPosY,
          // "¿Quién ve a quién primero?" (2026-09-17) — Destreza real, ya proyectada a su nivel
          // real por `detectNpcsInScene` (npcAttributesForLevel).
          attributes: n.attributes,
          level: n.level,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    // Umbral único de colisión (2026-09-17, petición explícita de Álvaro: "revisa bien que si
    // estas a una casilla de un elemento salte el interactuar" — antes celda ADYACENTE solo daba un
    // aviso de texto sin abrir nada, causando la frustración real reportada. Ahora ADYACENTE o MISMA
    // celda disparan exactamente el mismo árbol de decisión — el "aviso" puro queda eliminado, no
    // tenía ningún caso real que lo siguiera necesitando).
    // CR-16: quien te guarda rencor te corta el paso como un agresivo.
    const rencoresColision = await npcsConRencor(tx, saveId, [...puntosVivos.map((p) => npcBySlug.get(p.targetSlug)?.id), ...dinamicosConPosicionColision.map((d) => d.id)].filter((x): x is string => !!x), fictionalMinutes);
    let colision: { targetSlug: string; targetName: string; temperamento: string; articulo?: string | null; genero?: string | null } | null = null;
    // QA-27 P82: gracia tras reaparecer (`enGraciaTrasRenacer`, death.ts): nada hostil corta el paso.
    // Se consulta solo si hace falta.
    let enGraciaCache: boolean | null = null;
    const enGracia = async (): Promise<boolean> => {
      if (enGraciaCache === null) enGraciaCache = await enGraciaTrasRenacer(tx, saveId, fictionalMinutes);
      return enGraciaCache;
    };
    // "¿Quién ve a quién primero?" (2026-09-17) — Destreza del NPC/fauna del encuentro, guardada
    // junto a `colision` para la tirada de `quienIniciaEncuentro` más abajo.
    let destrezaColision: number | null = null;
    let nivelNpcColision = 1;
    // `tipo` real de catálogo — 'FAUNA' | 'NPC' tal cual lo trae `ZonePoint.tipo`, NUNCA derivado
    // de "¿tiene fila Npc?" (bug real detectado por los tests: un `Npc` con ficha propia puede
    // seguir siendo FAUNA cazable, `kind: 'PLANTILLA'` — `npcBySlug.has(slug)` daba `true` para
    // fauna real también, mandando siempre 'NPC').
    let colisionTipo: 'FAUNA' | 'NPC' | null = null;
    // Grupos de fauna reales (Fase 1, 2026-09-28) — id/cantidad del `ZonePoint` colisionado, ausentes
    // (`undefined`/`1`) para un dinámico sin `ZonePoint` propio, ver comentario de la interfaz arriba.
    let colisionZonePointId: string | undefined;
    let colisionCantidad = 1;
    let ultimoEncuentroSigueCerca = false;
    for (const punto of puntosVivos) {
      const celdaPunto = celdaDePixel({ x: punto.x, y: punto.y });
      const npc = npcBySlug.get(punto.targetSlug);
      const nombreReal = npc?.name ?? sourceDisplayNameFor(punto.targetSlug);
      // Nombre oculto genérico (ver `nombreVisibleColision` arriba) — Gistera (su `ZonePoint` ya
      // se oculta del todo tras aceptar, `ZONE_POINTS_OCULTOS_POR_QUEST`) queda cubierta por esta
      // regla igual que cualquier otro NPC de nombre propio no descubierto todavía.
      const nombre = nombreVisibleColision(punto.targetSlug, npc?.kind, nombreReal, npc?.raza, npc?.genero);
      if (celdaAdyacenteOMisma(celda, celdaPunto)) {
        const temperamento = npc ? conRencor(effectiveTemperamento(npc.temperamento, npc.faction, factionsStatus), rencoresColision.has(npc.id)) : 'CAUTELOSO';
        if (esTemperamentoHostil(temperamento) && (await enGracia())) continue;
        if (noCortaElPaso(punto.tipo, temperamento, celdaPunto) || faunaHostilEnEntrada(punto.tipo, temperamento)) continue;
        // Un AGRESIVO/ENEMIGO nunca se silencia: si sigue encima del jugador, vuelve a cortarle el paso.
        if (punto.targetSlug === ultimoEncuentroSlug && !esTemperamentoHostil(temperamento)) {
          ultimoEncuentroSigueCerca = true;
          continue;
        }
        colision = { targetSlug: punto.targetSlug, targetName: nombre, temperamento, articulo: nombre === nombreReal ? npc?.articulo : null, genero: npc?.genero };
        colisionTipo = punto.tipo === 'NPC' ? 'NPC' : 'FAUNA';
        destrezaColision = (npc?.attributes as { destreza?: number } | null)?.destreza ?? 10;
        nivelNpcColision = npc?.level ?? 1;
        colisionZonePointId = punto.id;
        colisionCantidad = punto.cantidad;
        break; // Solo el primer encuentro — no acumula varios a la vez.
      }
    }
    if (!colision) {
      for (const dinamico of dinamicosConPosicionColision) {
        const celdaDinamico = celdaDePixel({ x: dinamico.x, y: dinamico.y });
        const nombreDinamico = nombreVisibleColision(dinamico.targetSlug, dinamico.kind, dinamico.targetName, dinamico.raza, dinamico.genero);
        if (celdaAdyacenteOMisma(celda, celdaDinamico)) {
          const temperamento = conRencor(effectiveTemperamento(dinamico.temperamento, dinamico.faction, factionsStatus), rencoresColision.has(dinamico.id));
          if (esTemperamentoHostil(temperamento) && (await enGracia())) continue;
          if (noCortaElPaso(dinamico.tipo, temperamento, celdaDinamico) || faunaHostilEnEntrada(dinamico.tipo, temperamento)) continue;
          if (dinamico.targetSlug === ultimoEncuentroSlug && !esTemperamentoHostil(temperamento)) {
            ultimoEncuentroSigueCerca = true;
            continue;
          }
          colision = { targetSlug: dinamico.targetSlug, targetName: nombreDinamico, temperamento, articulo: nombreDinamico === dinamico.targetName ? dinamico.articulo : null, genero: dinamico.genero };
          colisionTipo = dinamico.tipo;
          destrezaColision = dinamico.attributes.destreza;
          nivelNpcColision = dinamico.level;
          break;
        }
      }
    }

    // Conexión real con Interactuar (2026-09-08, hallazgo de Álvaro: "aunque me ponga encima de
    // algo... no pasa nada") — CUALQUIER temperamento en la MISMA celda dispara
    // `pendingDynamicModeOffer` real con el candidato EXACTO (nunca por sorteo — la posición real ya
    // es la señal determinista). Ninguna oferta si ya hay una en curso/pendiente.
    //
    // AGRESIVO/ENEMIGO (2026-09-20, corrección de diseño — hallazgo real jugando en vivo, Álvaro:
    // "todos los encuentros deben provocar el interactuar... si choco con el orco me dice que está
    // ahí y tengo que escribir para que salte el combate, cuando debería saltar el interactuar y
    // ahí darte la opción de combatir o de huir") — hasta ahora un AGRESIVO/ENEMIGO en la misma
    // celda quedaba excluido a propósito de esta rama, dejando solo un LogEntry de aviso y
    // delegando el combate real al siguiente turno de texto libre (`shouldForceCombat`,
    // turnResolution.ts) — igual de determinista, pero rompía la promesa "todo encuentro pasa por
    // Interactuar" y obligaba a escribir texto para que pasara algo. Ahora entra en la MISMA rama
    // que el resto: `dynamicModeOffer.combateForzado: true` es la única diferencia — el modal
    // (dynamicMode.ts) decide con eso si ofrece conversación normal o el árbol de combate/huida.
    let dynamicModeOffer:
      | {
          tipo: 'FAUNA' | 'NPC' | 'RECURSO';
          targetSlug: string;
          targetName: string;
          aQuien?: string;
          quienInicia: 'jugador' | 'npc';
          combateForzado?: true;
          zonePointId?: string;
          cantidad?: number;
          riesgoCaza?: RiesgoCazaInfo;
          /// P124: plural del nombre para un grupo de FAUNA (`pluralDeEspecie`).
          nombrePlural?: string;
          /// Método de obtención de la fuente (RECURSO, 2026-09-29) — el frontend lo usa para el verbo del
          /// botón del modal de detalle ("Talar"/"Minar"/…). Ausente en ofertas antiguas persistidas y en
          /// NPC/FAUNA; `null` si la fuente no tiene ningún yield (ver `metodoPrincipalDeFuente`).
          metodo?: MetodoObtencion | null;
        }
      | null = null;
    let logEntry: { id: string; text: string; timeLabel: string; createdAt: string; roll?: IniciativaEncuentroLogRoll } | null = null;
    if (colision) {
      const combateForzado = esTemperamentoHostil(colision.temperamento);
      const freshSave = await tx.save.findUnique({ where: { id: saveId }, select: { pendingDynamicMode: true, pendingDynamicModeOffer: true } });
      if (!freshSave?.pendingDynamicMode && !freshSave?.pendingDynamicModeOffer) {
        // "¿Quién ve a quién primero?" (2026-09-17, efecto MECÁNICO real desde 2026-09-20 para
        // AGRESIVO/ENEMIGO) — Destreza jugador vs Destreza NPC, mismo patrón que `rollInitiative` de
        // combate. Para el resto de temperamentos solo decide el FRAMING narrativo de la primera
        // vuelta (ver `buildDynamicModeTurnoPrompt`, dynamicModeNarracion.ts); para AGRESIVO/ENEMIGO
        // decide además si el jugador puede elegir (lo vio primero) o el combate se abre
        // directamente (el agresivo lo vio primero) — ver `narrarAperturaCombateForzado`,
        // dynamicMode.ts, y la ruta `/modo-dinamico/interactuar`.
        const iniciativa = tirarQuienIniciaEncuentro(destrezaJugador, destrezaColision ?? 10);
        const quienInicia = iniciativa.quienInicia;
        // CR-14 (Q4): la fauna cautelosa que reconoce a un «Cazador temido» antes de que se acerque, huye.
        if (colisionTipo === 'FAUNA' && colision.temperamento === 'CAUTELOSO' && quienInicia === 'npc' && (await etiquetasActivas(tx, saveId)).has('CAZADOR_TEMIDO')) {
          const textoHuida = `${nombreEnFrase(colision.targetName, true)} reconoce a ${characterName} de lejos y huye antes de que pueda acercarse.`;
          const creada = await tx.logEntry.create({ data: { saveId, channel: 'CHARACTER', text: textoHuida, timeLabel, fictionalMinutes, isPlayerAction: false, isSystemMessage: true } });
          // Queda como último encuentro: mientras sigas en su radio no vuelve a «huir» a cada paso.
          return { ultimoEncuentroSigueCerca, colision: null, dynamicModeOffer: null, logEntry: { id: creada.id, text: textoHuida, timeLabel, createdAt: creada.createdAt.toISOString() }, avistadoSinOferta: { targetSlug: colision.targetSlug } };
        }
        dynamicModeOffer = {
          tipo: colisionTipo!,
          targetSlug: colision.targetSlug,
          targetName: colision.targetName,
          ...(colisionTipo === 'NPC' ? { aQuien: aNombre(colision.targetName, colision.articulo) } : {}),
          // P124: el plural para la tarjeta de un grupo («Un grupo de 6 Guchapos»).
          ...(colisionTipo === 'FAUNA' && colisionCantidad > 1 ? { nombrePlural: pluralDeEspecie(colision.targetName) } : {}),
          quienInicia,
          ...(combateForzado ? { combateForzado: true as const } : {}),
          ...(colisionZonePointId ? { zonePointId: colisionZonePointId } : {}),
          cantidad: colisionCantidad,
          // Aviso de riesgo (F9-1, decisión de Álvaro, 2026-09-29): donde la tarjeta ofrece "Cazar"
          // (FAUNA, no forzada, con ZonePoint) y, desde QA-27 P27 (usuaria, 2026-10-12, como el
          // nivel de amenaza de X4 o el «Peligroso» de BG3), también cuando alguien hostil te corta
          // el paso. Solo como dato: no cambia ninguna regla.
          ...((colisionTipo === 'FAUNA' && !combateForzado && colisionZonePointId) || combateForzado
            ? {
                riesgoCaza: riesgoDeCaza({
                  nivelJugador,
                  destrezaJugador,
                  nombreGrupo: colision.targetName,
                  nivelNpc: nivelNpcColision,
                  destrezaNpc: destrezaColision ?? 10,
                  cantidad: colisionCantidad,
                }),
              }
            : {}),
        };
        // Grupos de fauna reales (Fase 1, 2026-09-28) — "un grupo de N {especie}" en vez de solo el
        // nombre cuando el punto colisionado representa más de un individuo; concordancia sencilla
        // (el nombre de especie ya viene en singular de catálogo, "un grupo de N" no necesita
        // pluralizarlo). Solo aplica a FAUNA — un NPC (identidad única) nunca se agrupa.
        const nombreEncuentro =
          colisionTipo === 'FAUNA' && colisionCantidad > 1
            ? `un grupo de ${colisionCantidad} ${pluralDeEspecie(colision.targetName)}`
            : colisionTipo === 'FAUNA'
              ? conIndefinido(colision.targetName, colision.articulo, colision.genero) // P149: «con un Guchapo»
              : nombreEnFrase(colision.targetName);
        const nombreEncuentroInicio = nombreEncuentro.charAt(0).toUpperCase() + nombreEncuentro.slice(1);
        // LogEntry real determinista (2026-09-09, hallazgo real jugando en vivo: la tarjeta de
        // oferta SIEMPRE se renderiza colgada de una LogEntry concreta — LogPanel.tsx solo lee
        // `entry.dynamicModeOffer`, nunca `Save.pendingDynamicModeOffer` directamente). El
        // movimiento en Zona no narra nada por sí mismo (a diferencia de un turno normal, que sí
        // deja su propia entrada) — sin esto, la oferta quedaba persistida en BD pero invisible en
        // el log real: el mecanismo de reconstrucción tras F5 (GameView.tsx § syncFromSave) solo
        // sabe colgarla de "la última entrada del log", que puede no tener ninguna relación con
        // este encuentro (o ya estar ocupada por otra oferta, bloqueando el enganche del todo).
        const text = combateForzado
          ? quienInicia === 'jugador'
            ? // P29 (QA-27): ganó la iniciativa y puede huir — nada de «no hay escapatoria».
              `${characterName} se topa de frente con ${nombreEncuentro}, que le corta el paso — reacciona antes que su rival: toca decidir si pelear o huir.`
            : `${nombreEncuentroInicio} se abalanza sobre ${characterName} sin darle tiempo a reaccionar.`
          : quienInicia === 'jugador'
            ? colisionTipo === 'NPC'
              ? `${characterName} se topa con ${nombreEncuentro}.`
              : `${characterName} se topa con ${nombreEncuentro}, que le observa con cautela.`
            : `${nombreEncuentroInicio} se acerca a ${characterName} antes de que este reaccione.`;
        // Fase 10 (2026-09-29) — la tirada opuesta Destreza vs Destreza se guarda en `LogEntry.roll`
        // (discriminada por `kind`) para que la tarjeta la muestre también tras una recarga.
        const logRoll: IniciativaEncuentroLogRoll = { kind: 'iniciativa-encuentro', quienInicia, jugador: iniciativa.jugador, npc: iniciativa.npc, npcName: colision.targetName };
        const created = await tx.logEntry.create({
          data: { saveId, channel: 'CHARACTER', text, timeLabel, fictionalMinutes, isPlayerAction: false, isSystemMessage: true, roll: logRoll as unknown as Prisma.InputJsonValue },
        });
        logEntry = { id: created.id, text, timeLabel, createdAt: created.createdAt.toISOString(), roll: logRoll };
        // B31 (pruebas 2026-09-28): toparse con fauna/NPC genérico lo descubre en la partida — antes
        // el log ya lo nombraba pero su pin seguía "???". Un PRINCIPAL no descubierto conserva el
        // nombre oculto (se descubre por la historia, `nombreVisibleColision`).
        const kindColision = npcBySlug.get(colision.targetSlug)?.kind ?? dinamicosConPosicionColision.find((d) => d.targetSlug === colision!.targetSlug)?.kind;
        if (kindColision !== 'PRINCIPAL') {
          await recordEntityDiscoveries({ saveId, worldId, mentionedText: colision.targetName, npcSlugsInScene: [colision.targetSlug] }, tx);
        }
      }
    }

    // RECURSO (2026-09-20, hallazgo real jugando en vivo — Álvaro: "mira también si funciona lo de
    // descubrir al acercarnos a una flora" — confirmado que no funcionaba en absoluto:
    // `detectarEncuentroEnCelda` solo miraba FAUNA/NPC, así que caminar hasta la celda exacta de un
    // recurso nunca disparaba nada, ni descubrimiento ni recolección). Un ser vivo (FAUNA/NPC) SIEMPRE
    // tiene prioridad sobre un recurso inerte — `!colision` — coherente con el resto del motor
    // ("todo debe tener ZonePoint", pero un encuentro con algo vivo importa más que una veta de
    // mineral en el mismo radio). Nunca compite con AGRESIVO/combate: si ya hubo colisión, este
    // bloque ni se evalúa.
    if (!colision) {
      const recursosCrudos = await tx.zonePoint.findMany({ where: { saveId, locationId, tipo: 'RECURSO', activo: true } });
      for (const punto of recursosCrudos) {
        const celdaPunto = celdaDePixel({ x: punto.x, y: punto.y });
        if (!celdaAdyacenteOMisma(celda, celdaPunto)) continue;
        if (punto.targetSlug === ultimoEncuentroSlug) {
          ultimoEncuentroSigueCerca = true;
          continue;
        }
        const freshSave = await tx.save.findUnique({ where: { id: saveId }, select: { pendingDynamicMode: true, pendingDynamicModeOffer: true } });
        if (freshSave?.pendingDynamicMode || freshSave?.pendingDynamicModeOffer) break;
        // P136 (QA-27): el mismo nombre que la ficha del mapa (su `label`, si lo tiene), no el de catálogo.
        const nombre = punto.label ?? sourceDisplayNameFor(punto.targetSlug);
        // B7 (pruebas 2026-09-28): un recurso por encima del nivel de oficio del jugador (p.ej. el
        // Yerreo tier 4 para un minero de nivel 1) ya no se ofrece como Interactuar imposible de
        // completar — se registra como descubrimiento con el motivo real y se sigue andando.
        const yieldsRecurso = await tx.harvestYield.findMany({
          where: { worldId, sourceSlug: punto.targetSlug },
          select: { metodoObtencion: true, item: { select: { tier: true } } },
        });
        const abilityRecurso = yieldsRecurso.length > 0 ? harvestAbilityForMetodo(yieldsRecurso[0].metodoObtencion) : null;
        if (abilityRecurso) {
          const progresos = await tx.professionProgress.findMany({ where: { saveId }, select: { professionId: true, nivel: true } });
          const nivelOficio = progresos.find((pp) => matchesOficioPrefix(pp.professionId, abilityRecurso.oficio))?.nivel ?? 1;
          const tierMinimo = Math.min(...yieldsRecurso.map((y) => y.item.tier ?? 1));
          if (tierMinimo > nivelOficio) {
            const text = `${characterName} ve ${nombre} cerca, pero todavía no sabe aprovecharlo: hace falta ${abilityRecurso.ability.name} a nivel ${tierMinimo} (tiene nivel ${nivelOficio}).`;
            const created = await tx.logEntry.create({
              data: { saveId, channel: 'CHARACTER', text, timeLabel, fictionalMinutes, isPlayerAction: false, isSystemMessage: true },
            });
            logEntry = { id: created.id, text, timeLabel, createdAt: created.createdAt.toISOString() };
            await recordEntityDiscoveries({ saveId, worldId, mentionedText: sourceDisplayNameFor(punto.targetSlug) }, tx);
            return { ultimoEncuentroSigueCerca, colision, dynamicModeOffer: null, logEntry, avistadoSinOferta: { targetSlug: punto.targetSlug } };
          }
        }
        // Sin tirada de iniciativa — un recurso nunca "busca" al jugador, siempre es él quien lo
        // encuentra (mismo framing que ya usa `buildDynamicModeTurnoPrompt` cuando `quienInicia` no
        // aplica, pero aquí ni siquiera hay LLM: `dynamicModeRecurso.ts` narra con texto fijo).
        dynamicModeOffer = { tipo: 'RECURSO', targetSlug: punto.targetSlug, targetName: nombre, quienInicia: 'jugador', zonePointId: punto.id, cantidad: punto.cantidad, metodo: metodoPrincipalDeFuente(yieldsRecurso.map((y) => y.metodoObtencion)) };
        const text = `${characterName} encuentra ${nombre} cerca.`;
        const created = await tx.logEntry.create({
          data: { saveId, channel: 'CHARACTER', text, timeLabel, fictionalMinutes, isPlayerAction: false, isSystemMessage: true },
        });
        logEntry = { id: created.id, text, timeLabel, createdAt: created.createdAt.toISOString() };
        await recordEntityDiscoveries({ saveId, worldId, mentionedText: sourceDisplayNameFor(punto.targetSlug) }, tx);
        break; // Solo el primer recurso — no acumula varios a la vez.
      }
    }
    return { ultimoEncuentroSigueCerca, colision, dynamicModeOffer, logEntry };
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
      select: SAVE_SELECT_PARA_MOVER,
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    if (!save.currentLocationId) return reply.status(400).send({ error: 'Sin ubicación actual — no hay zona donde moverse.' });
    // Encuentro AGRESIVO/ENEMIGO sin resolver (2026-09-28, bug real jugando en vivo: con la tarjeta
    // "X te corta el paso" pendiente el jugador podía seguir caminando, y el agresor le perseguía
    // hasta su misma casilla sin que pasara nada) — hay que reaccionar (Interactuar → combatir o
    // huir) antes de volver a moverse, igual que promete el propio texto del encuentro.
    const ofertaPendiente = save.pendingDynamicModeOffer as { combateForzado?: boolean; targetName?: string } | null;
    if (ofertaPendiente?.combateForzado) {
      return reply.status(409).send({ error: `${ofertaPendiente.targetName ? nombreEnFrase(ofertaPendiente.targetName, true) : 'Algo'} no te deja marcharte — tienes que reaccionar primero.` });
    }

    if (!zonaMoverClaims.claim(save.id)) {
      return reply.status(409).send({ error: 'Ya hay un movimiento en curso para esta partida.' });
    }
    try {
      return await resolverMovimientoEnZona(save, destino);
    } finally {
      zonaMoverClaims.release(save.id);
    }
  });

  async function resolverMovimientoEnZona(
    save: NonNullable<Prisma.SaveGetPayload<{ select: typeof SAVE_SELECT_PARA_MOVER }>>,
    destino: { x: number; y: number },
  ) {
    const factionsStatus = (save.worldState?.factionsStatus as Record<string, number> | null) ?? {};
    const posicionActual = save.zonaPosX != null && save.zonaPosY != null ? { x: save.zonaPosX, y: save.zonaPosY } : { x: 400, y: 300 };
    const celdaActual = celdaDePixel(posicionActual);
    // Fauna diurna/nocturna (2026-09-17) — mismo `momento` que ya calcula `GET /zona`, propagado
    // aquí para que un Kirelon nocturno deje de moverse/perseguir/colisionar de día (ver
    // `zonePointActivoAhora`, zonePoints.ts).
    const momentoActual = momentoDelDiaFor(save.worldState?.fictionalMinutes ?? 480);
    // "¿Quién ve a quién primero?" (2026-09-17) — Destreza real del jugador para `quienIniciaEncuentro`.
    const destrezaJugador = effectiveAttributes(save.attributes as AttributeBlock, save.inventoryItems).destreza ?? 10;
    // Último encuentro ya ofrecido (2026-09-28) — solo cuenta si fue en ESTA Location (un slug de
    // otra zona no debe silenciar nada aquí).
    const ultimoEncuentro = save.zonaUltimoEncuentro as { targetSlug: string; locationId: string } | null;
    const ultimoEncuentroSlug = ultimoEncuentro && ultimoEncuentro.locationId === save.currentLocationId ? ultimoEncuentro.targetSlug : null;
    const marcaUltimoEncuentro = (offer: { targetSlug: string } | null) =>
      offer ? ({ targetSlug: offer.targetSlug, locationId: save.currentLocationId! } as unknown as Prisma.InputJsonValue) : undefined;

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
        const { colision, dynamicModeOffer, logEntry } = await detectarEncuentroEnCelda(
          tx,
          save.id,
          save.worldId,
          save.currentLocationId!,
          celdaActual,
          factionsStatus,
          save.characterName,
          save.worldState?.fictionalMinutes ?? 480,
          save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
          destrezaJugador,
          // Pulsar la propia casilla es una petición explícita de interactuar con lo que hay al
          // lado — nunca se silencia por el último encuentro.
          null,
          save.level,
        );
        if (dynamicModeOffer) {
          await tx.save.update({
            where: { id: save.id },
            data: { pendingDynamicModeOffer: dynamicModeOffer as unknown as Prisma.InputJsonValue, zonaUltimoEncuentro: marcaUltimoEncuentro(dynamicModeOffer) },
          });
        }
        // El mundo no da un paso si el jugador tampoco lo da (mismo criterio "un paso tuyo = un
        // paso del mundo" — camino vacío significa que el destino ya es la celda actual).
        return { jugador: posicionActual, caminoRestante: [], llegado: true, colision, dynamicModeOffer, logEntry, zonePointsMovidos: [] as { id: string; x: number; y: number }[], ofertaDescartada: false };
      });
    }

    const [siguienteCelda, ...restoCamino] = caminoCeldas;
    const nuevaPosicion = pixelDeCelda(siguienteCelda);

    const resultado = await prisma.$transaction(async (tx) => {
      // Alejarse andando de una oferta pacífica sin responder = ignorarla (2026-09-28, bug real
      // jugando en vivo: la tarjeta vieja seguía "pendiente" en BD y, mientras nadie pulsara su
      // Ignorar, ningún encuentro nuevo podía ofrecerse en toda la zona — `detectarEncuentroEnCelda`
      // nunca ofrece nada con otra oferta pendiente). Se limpia ANTES de detectar, para que este
      // mismo paso ya pueda toparse con algo nuevo. Las de combate forzado ya se rechazaron arriba.
      const ofertaDescartada = !!save.pendingDynamicModeOffer;
      if (ofertaDescartada) {
        // El menú del NPC abierto desde ese encuentro (P142) se va con él: elegir en él ya no tiene
        // encuentro sobre el que actuar (`/code-review` del PR #53).
        const menuDelEncuentro = !!(save.pendingNpcInteractionOffer as { desdeEncuentro?: boolean } | null)?.desdeEncuentro;
        await tx.save.update({
          where: { id: save.id },
          data: { pendingDynamicModeOffer: Prisma.JsonNull, ...(menuDelEncuentro ? { pendingNpcInteractionOffer: Prisma.JsonNull } : {}) },
        });
      }

      // El mundo también se mueve — un paso por cada paso del jugador, ANTES de comprobar colisión
      // (mismo criterio Mount & Blade: ambos avanzan a la vez, la colisión se evalúa sobre el
      // estado ya actualizado, no sobre la posición vieja de la fauna). `zonePointsMovidos` viaja
      // en la respuesta HTTP (2026-09-09, bug real: "los elementos se mueven, pero no... a la vez
      // que muevo yo" — antes se descartaba, el frontend nunca se enteraba hasta el próximo
      // refetch completo del panel) para que el frontend pueda animar la fauna/NPC en el mismo
      // ritmo que su propio marcador, paso a paso.
      // Persecución (2026-09-17) — `nuevaPosicion` (no `posicionActual`) porque el jugador ya dio
      // este paso antes de que el mundo se mueva (mismo criterio "Mount & Blade" del comentario de
      // arriba: ambos avanzan a la vez, evaluados sobre el estado ya actualizado).
      // Las entradas de la zona no cambian dentro del paso: una sola vez para el mundo y el encuentro.
      const entradas = await celdasDeEntrada(tx, save.id, save.currentLocationId!);
      const zonePointsMovidos = await avanzarZonePointsUnPaso(tx, save.currentLocationId!, save.id, Math.random, nuevaPosicion, factionsStatus, momentoActual, entradas);

      // B2 (pruebas 2026-09-28): moverse por la zona no avanzaba el reloj — decenas de pasos y
      // encuentros seguían en "Día 1, 08:00". Cada paso real (una celda, ~50 m) cuesta 1 minuto.
      const minutosTrasPaso = advanceFictionalMinutes(save.worldState?.fictionalMinutes ?? 480, MINUTOS_POR_PASO_ZONA);
      const etiquetaTrasPaso = formatFictionalDate(minutosTrasPaso);
      await tx.worldState.updateMany({ where: { saveId: save.id }, data: { fictionalMinutes: minutosTrasPaso, fictionalDateLabel: etiquetaTrasPaso } });
      // B11 — la regeneración pasiva de energía también corre al caminar (mismo reloj; P160: la misma
      // función que al recolectar). P161: la energía nueva vuelve en la respuesta, para el HUD.
      const energiaTrasPaso = await sumarEnergiaPasiva(tx, save.id, save.worldState?.fictionalMinutes ?? 480, minutosTrasPaso);

      const { ultimoEncuentroSigueCerca, colision, dynamicModeOffer, logEntry, avistadoSinOferta } = await detectarEncuentroEnCelda(
        tx,
        save.id,
        save.worldId,
        save.currentLocationId!,
        siguienteCelda,
        factionsStatus,
        save.characterName,
        minutosTrasPaso,
        etiquetaTrasPaso,
        destrezaJugador,
        ultimoEncuentroSlug,
        save.level,
        celdaDestino,
        entradas,
      );
      // Un encuentro nuevo pasa a ser el "último"; si no, se olvida el anterior en cuanto este paso
      // deja al jugador fuera de su radio (volver a acercarse lo vuelve a ofrecer).
      const zonaUltimoEncuentro = dynamicModeOffer
        ? marcaUltimoEncuentro(dynamicModeOffer)
        : avistadoSinOferta
          ? marcaUltimoEncuentro(avistadoSinOferta)
          : save.zonaUltimoEncuentro && !ultimoEncuentroSigueCerca
          ? Prisma.JsonNull
          : undefined;

      // Una colisión detiene el avance AQUÍ — el jugador no llega más allá del punto de encuentro,
      // y no queda camino pendiente (tiene que decidir qué hacer antes de seguir moviéndose).
      // Una oferta nueva de RECURSO (sin `colision`, ver `detectarEncuentroEnCelda`) también lo
      // detiene (2026-09-28, bug real jugando en vivo con Playwright: el jugador pasaba de largo
      // junto al Yerreo, la oferta quedaba persistida pero el trayecto seguía 3 celdas más y el
      // frontend nunca llegaba a mostrar la tarjeta hasta recargar la página).
      const caminoRestantePixel = colision || dynamicModeOffer ? [] : restoCamino.map((c) => pixelDeCelda(c));

      await tx.save.update({
        where: { id: save.id },
        data: {
          zonaPosX: nuevaPosicion.x,
          zonaPosY: nuevaPosicion.y,
          zonaCaminoPendiente: caminoRestantePixel.length > 0 ? (caminoRestantePixel as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          ...(dynamicModeOffer ? { pendingDynamicModeOffer: dynamicModeOffer as unknown as Prisma.InputJsonValue } : {}),
          ...(zonaUltimoEncuentro !== undefined ? { zonaUltimoEncuentro } : {}),
        },
      });

      // `llegado`: este paso es el último del trayecto, haya o no encuentro (P135: un encuentro deja
      // `caminoRestante` vacío aunque falte camino, y el frontend no puede deducirlo del píxel pulsado).
      return { jugador: nuevaPosicion, caminoRestante: caminoRestantePixel, llegado: restoCamino.length === 0, colision, dynamicModeOffer, logEntry, zonePointsMovidos, ofertaDescartada, fictionalMinutes: minutosTrasPaso, fictionalDateLabel: etiquetaTrasPaso, ...(energiaTrasPaso !== null ? { energia: energiaTrasPaso } : {}) };
    });

    return resultado;
  }

  /// Cazar desde la tarjeta de encuentro de zona (Fase 2, 2026-09-28,
  /// `plan-mecanicas-por-zona-2026-09-28.md`) — caza EXACTAMENTE el grupo con el que se ha
  /// colisionado en el mapa (`pendingDynamicModeOffer.zonePointId`), nunca por sorteo de población
  /// regional como el viejo botón suelto de `cazar.ts` (que la Fase 4 retira). Misma forma de
  /// respuesta que `POST /saves/:id/cazar/confirmar` — el frontend reutiliza el mismo tratamiento
  /// de resultado (`handleHuntResolved`, GameView.tsx).
  app.post<{ Params: { id: string }; Body: { zonePointId: string } }>('/saves/:id/zona/cazar', async (request, reply) => {
    const { zonePointId } = request.body;
    if (!zonePointId) return reply.status(400).send({ error: 'Falta el campo: zonePointId' });

    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { currentLocation: true, worldState: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    // Mismas guardas de combate que `cazar/confirmar` (ver comentario completo en cazar.ts) — un
    // combate en curso (por `pendingCombatNpcSlugs` o por un `CombatEncounter` real huérfano)
    // bloquea salir a cazar hasta resolverlo.
    if (Array.isArray(save.pendingCombatNpcSlugs) && save.pendingCombatNpcSlugs.length > 0) {
      return reply.status(400).send({ error: 'Ya hay un combate en curso — resuélvelo antes de salir a cazar.' });
    }
    const activeEncounter = await prisma.combatEncounter.findFirst({ where: { saveId: save.id, estado: 'EN_CURSO', jugable: true } });
    if (activeEncounter) {
      return reply.status(400).send({ error: 'Ya hay un combate en curso — resuélvelo antes de salir a cazar.' });
    }

    // "Solo se caza lo que se tiene al lado" (petición explícita del plan) — exige que la oferta
    // pendiente sea EXACTAMENTE este `zonePointId` y de tipo FAUNA; cualquier otra cosa (sin
    // oferta, NPC/RECURSO, o un `zonePointId` distinto ya descartado) se rechaza con un mensaje
    // claro, nunca caza "por sorpresa" algo con lo que no se ha colisionado de verdad.
    const oferta = save.pendingDynamicModeOffer as { tipo?: string; zonePointId?: string } | null;
    if (!oferta || oferta.tipo !== 'FAUNA' || oferta.zonePointId !== zonePointId) {
      return reply.status(409).send({ error: 'Ese grupo ya no está disponible aquí — puede que se te haya adelantado.' });
    }

    const puntoBruto = await prisma.zonePoint.findUnique({ where: { id: zonePointId } });
    const punto = puntoBruto && puntoBruto.saveId === save.id ? puntoBruto : null;
    const npc = punto ? await prisma.npc.findFirst({ where: { worldId: save.worldId, slug: punto.targetSlug } }) : null;
    // La oferta ya se resuelve aquí (igual que el resto de caminos de "Interactuar",
    // dynamicMode.ts) — se limpia siempre, tanto en éxito como en el rechazo de abajo, para que
    // nunca reaparezca sola tras un F5.
    await prisma.save.update({ where: { id: save.id }, data: { pendingDynamicModeOffer: Prisma.JsonNull } });
    if (!punto || !punto.activo || punto.cantidad <= 0 || !npc) {
      return reply.status(409).send({ error: 'Ese grupo ya no está disponible aquí — puede que se te haya adelantado.' });
    }

    const targets: CazaTarget[] = [{ npc, cantidadObjetivo: punto.cantidad, zonePointId: punto.id }];
    const resultado = await iniciarCaza({
      save: {
        id: save.id,
        worldId: save.worldId,
        characterName: save.characterName,
        level: save.level,
        attributes: save.attributes as AttributeBlock,
        currentLocationId: save.currentLocationId,
        region: save.currentLocation?.region ?? null,
        fictionalMinutes: save.worldState?.fictionalMinutes ?? 480,
      },
      targets,
    });
    if ('error' in resultado) return reply.status(resultado.status).send({ error: resultado.error });
    return resultado;
  });
}
