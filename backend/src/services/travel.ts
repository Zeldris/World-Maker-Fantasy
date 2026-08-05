import { prisma } from '../lib/prisma.js';
import type { AttributeBlock } from './dice.js';
import type { Banda } from './narrador.js';

/// Servicio de viaje (docs/12-mundo-estructurado.md § 1) — puro y sin IA en su núcleo
/// (normalizar/matchear/Dijkstra), candidato ideal a tests unitarios, como progression.ts.
/// El modelo nunca elige la ruta, solo (como mucho) el destino, y siempre de una lista cerrada.

const TRAVEL_INTENT_REGEX = /viaj|camin|desplaz|ruta|tramo|voy (a|hacia)|me dirijo|parto hacia|vuelvo a|regreso a|me acerco a/;

/// Bug real jugando (docs/revisar-partida-hallazgos.md, 2026-08-01, "narración de ambientación
/// repetida sin progreso tras el combate"): "avanzo por una salida" / "Continuo por la cueva" /
/// "Continuo hasta llegar a la siguiente localización" no disparan `TRAVEL_INTENT_REGEX` (no
/// nombran ningún verbo de viaje "hacia algo") y tampoco nombran un destino real, así que
/// `resolveTravel` nunca actuaba — el turno caía en ambientación genérica una y otra vez sin que
/// la ubicación cambiara nunca. A diferencia del viaje con destino nombrado, aquí no hace falta
/// que el jugador diga un nombre — "seguir adelante" ya es intención de movimiento de sobra clara.
/// Acotado a propósito para no confundir "sigo mirando"/"continúo hablando" (no es movimiento):
/// "avanzo"/"prosigo"/"me adentro" solo significan eso, pero "sigo"/"continúo" exigen ir
/// acompañados de una palabra que sí indique desplazamiento (camino, adelante, zona, "por <algo>"
/// que no sea el idiom "por ahora", etc.).
const VAGUE_MOVEMENT_REGEX =
  /\b(avanz\w*|prosig\w*|me adentro|me interno)\b|\b(sigo|contin[uú]o)\b\s+por\s+(?!ahora\b)\w+|\b(sigo|contin[uú]o)\b[^.]*\b(camino|adelante|explorando|hasta llegar|zona|localizaci[oó]n|lugar|senda|ruta)\b|\bsiguiente (zona|localizaci[oó]n|lugar|[aá]rea)\b|\bbusco (la )?salida\b/;

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

/// Distancia de edición clásica (Levenshtein) — vive aquí junto a normalizeText porque varios
/// detectores de texto libre (npcScene.ts, harvest.ts) la necesitan para tolerar erratas de una
/// sola palabra (roadmap 2026-07-20, bug real jugando: "redazagado" en vez de "rezagado" hacía
/// fallar la coincidencia exacta por completo, y en silencio). Nunca usarla para nada que decida
/// tiradas o daño — solo para reconocer qué mencionó el jugador.
export function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[rows - 1][cols - 1];
}

export function detectsTravelIntent(action: string): boolean {
  return TRAVEL_INTENT_REGEX.test(normalizeText(action));
}

export function detectsVagueMovementIntent(action: string): boolean {
  return VAGUE_MOVEMENT_REGEX.test(normalizeText(action));
}

/// Palabras de 5+ letras de una acción ya normalizada — mismo umbral y criterio en todos los
/// detectores de intención por tolerancia a erratas del proyecto (ver findFuzzyStemMatch abajo).
export function fuzzyMatchCandidates(normalized: string): string[] {
  return normalized.split(/\s+/).filter((w) => w.length >= 5);
}

/// Deuda técnica (2026-07-30, "control de deuda técnica"): este mismo bucle — palabras de 5+
/// letras, distancia Levenshtein ≤2 contra una lista de stems — estaba reimplementado por
/// separado en turnResolution.ts (saqueo), npcScene.ts (ataque) y narrador.ts (Reino), cada uno
/// con su propio filtro de exclusiones a mano. Centralizado aquí tras el bug real de 2026-07-29
/// ("ataque"/"desde"/"después"/"comer" confundidos con stems de saqueo, lo que desactivaba el
/// combate real de fondo): cualquier detector nuevo hereda el mismo criterio sin reimplementar
/// nada, y una futura mejora del matching (o una exclusión nueva) solo hay que tocarla aquí.
/// Primitiva de una sola palabra — separada de `findFuzzyStemMatch` para que un caller que
/// necesite probar varias palabras candidatas una a una (p.ej. detectsAttackIntent, que sigue
/// buscando otra palabra si la primera coincidencia sale negada) no tenga que reimplementar el
/// bucle de stems.
export function fuzzyMatchesAnyStem(word: string, stems: string[]): boolean {
  return stems.some((stem) => levenshtein(word, stem) <= 2);
}

/// Devuelve la primera palabra que matcheó (o null si ninguna) — para el caso simple de "¿alguna
/// palabra de la acción coincide con algún stem de esta lista?", sin necesidad de comprobar nada
/// más sobre esa palabra.
export function findFuzzyStemMatch(words: string[], stems: string[], exclusions: ReadonlySet<string> = new Set()): string | null {
  return words.find((w) => !exclusions.has(w) && fuzzyMatchesAnyStem(w, stems)) ?? null;
}

export interface LocationNode {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
}

/// Matcher determinista de destino: busca el alias MÁS LARGO que aparezca en el texto de la
/// acción, para no confundir "el pozo" con un alias parcial de otro sitio. Excluye la ubicación
/// actual (viajar "a donde ya estás" no es un viaje).
export function matchDestination(action: string, locations: LocationNode[], excludeId?: string): LocationNode | undefined {
  const normalizedAction = normalizeText(action);
  const candidates = locations
    .filter((loc) => loc.id !== excludeId)
    .flatMap((loc) => loc.aliases.map((alias) => ({ loc, alias: normalizeText(alias) })))
    .filter(({ alias }) => alias.length > 0 && normalizedAction.includes(alias))
    .sort((a, b) => b.alias.length - a.alias.length);
  return candidates[0]?.loc;
}

export interface LinkEdge {
  fromId: string;
  toId: string;
  minutosBase: number;
  terreno?: string;
  riesgo?: string | null;
}

/// Busca la fila de LocationLink entre dos nodos consecutivos del camino, sin importar la
/// dirección en la que se guardó (el grafo es bidireccional, § 1.2).
export function edgeBetween(links: LinkEdge[], aId: string, bId: string): LinkEdge | undefined {
  return links.find((l) => (l.fromId === aId && l.toId === bId) || (l.fromId === bId && l.toId === aId));
}

/// El grafo se trata como bidireccional (§ 1.2): una fila de LocationLink habilita ir y volver
/// por el mismo coste.
export function buildAdjacency(links: LinkEdge[]): Map<string, { to: string; minutos: number }[]> {
  const adjacency = new Map<string, { to: string; minutos: number }[]>();
  const add = (a: string, b: string, minutos: number) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a)!.push({ to: b, minutos });
  };
  for (const link of links) {
    add(link.fromId, link.toId, link.minutosBase);
    add(link.toId, link.fromId, link.minutosBase);
  }
  return adjacency;
}

export interface DijkstraResult {
  path: string[]; // ids de Location, incluye origen y destino
  totalMinutos: number;
}

export function shortestPath(
  adjacency: Map<string, { to: string; minutos: number }[]>,
  fromId: string,
  toId: string,
): DijkstraResult | null {
  if (fromId === toId) return { path: [fromId], totalMinutos: 0 };

  const dist = new Map<string, number>([[fromId, 0]]);
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  const queue = new Set<string>([fromId]);

  while (queue.size > 0) {
    let current: string | null = null;
    let currentDist = Infinity;
    for (const node of queue) {
      const d = dist.get(node) ?? Infinity;
      if (d < currentDist) {
        currentDist = d;
        current = node;
      }
    }
    if (current === null) break;
    queue.delete(current);
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === toId) break;

    for (const edge of adjacency.get(current) ?? []) {
      if (visited.has(edge.to)) continue;
      const newDist = currentDist + edge.minutos;
      if (newDist < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, newDist);
        prev.set(edge.to, current);
        queue.add(edge.to);
      }
    }
  }

  if (!dist.has(toId)) return null;

  const path: string[] = [toId];
  let node = toId;
  while (node !== fromId) {
    const p = prev.get(node);
    if (!p) return null;
    path.unshift(p);
    node = p;
  }
  return { path, totalMinutos: dist.get(toId)! };
}

/// Misma fórmula de timedActions.ts (minutos = base / (1 + destreza/20)) — no se toca, solo se
/// le da un `base` determinista sacado del grafo en vez de la estimación libre del clasificador.
export function minutosConDestreza(baseMinutos: number, attributes: AttributeBlock): number {
  return Math.max(1, Math.round(baseMinutos / (1 + attributes.destreza / 20)));
}

/// Banda derivada de los minutos YA calculados con destreza — para viajes por grafo, el dato
/// determinista manda sobre la estimación del clasificador (§ 1.4 paso 5).
export function bandaForMinutos(minutos: number): Banda {
  if (minutos < 60) return 'corta';
  if (minutos < 1440) return 'extendida';
  return 'larga';
}

export interface TravelSegment {
  fromName: string;
  toName: string;
  terreno: string;
  riesgo?: string | null;
  /// Minutos base de ESTA arista (antes de destreza) — separado de `TravelResolution.baseMinutos`
  /// (el total acumulado) para poder truncar una ruta a mitad de camino sin recalcular contra el
  /// grafo (ver travelInterruption.ts, eventos de viaje interactivos, 2026-08-05).
  minutosBase: number;
}

export interface TravelResolution {
  toLocationId: string;
  toLocationName: string;
  pathIds: string[]; // ids de Location, en orden, incluido origen y destino
  path: string[]; // slugs, mismo orden
  pathNames: string[];
  segments: TravelSegment[]; // una por arista recorrida (path.length - 1)
  baseMinutos: number;
  minutos: number;
  banda: Banda;
}

/// Punto de entrada del turno (§ 1.4): detecta intención, matchea destino contra la lista
/// cerrada de Location del mundo, calcula ruta con Dijkstra y deriva banda — todo determinista.
/// Devuelve null si no hay intención de viaje, no hay ubicación actual, el destino no matchea,
/// ya está ahí, o el destino queda fuera del grafo v1 (el turno sigue el flujo normal).
async function resolveTravelPath(
  worldId: string,
  currentLocationId: string,
  destination: LocationNode,
  attributes: AttributeBlock,
): Promise<TravelResolution | null> {
  const locations = await prisma.location.findMany({ where: { worldId } });
  const links = await prisma.locationLink.findMany({
    where: { from: { worldId } },
    select: { fromId: true, toId: true, minutosBase: true, terreno: true, riesgo: true },
  });
  const adjacency = buildAdjacency(links);
  const result = shortestPath(adjacency, currentLocationId, destination.id);
  if (!result || result.path.length < 2) return null; // sin ruta o ya en destino

  const locationById = new Map(locations.map((l) => [l.id, l]));
  const pathSlugs = result.path.map((id) => locationById.get(id)?.slug ?? id);
  const pathNames = result.path.map((id) => locationById.get(id)?.name ?? id);
  const segments: TravelSegment[] = [];
  for (let i = 0; i < result.path.length - 1; i++) {
    const edge = edgeBetween(links, result.path[i], result.path[i + 1]);
    segments.push({
      fromName: pathNames[i],
      toName: pathNames[i + 1],
      terreno: edge?.terreno ?? 'terreno sin datos',
      riesgo: edge?.riesgo,
      minutosBase: edge?.minutosBase ?? 0,
    });
  }
  const minutos = minutosConDestreza(result.totalMinutos, attributes);

  return {
    toLocationId: destination.id,
    toLocationName: destination.name,
    pathIds: result.path,
    path: pathSlugs,
    pathNames,
    segments,
    baseMinutos: result.totalMinutos,
    minutos,
    banda: bandaForMinutos(minutos),
  };
}

export async function resolveTravel(params: {
  action: string;
  worldId: string;
  currentLocationId: string | null;
  attributes: AttributeBlock;
}): Promise<TravelResolution | null> {
  const { action, worldId, currentLocationId, attributes } = params;
  if (!currentLocationId) return null;

  if (detectsTravelIntent(action)) {
    const locations = await prisma.location.findMany({ where: { worldId } });
    const destination = matchDestination(action, locations, currentLocationId);
    if (destination) {
      const resolved = await resolveTravelPath(worldId, currentLocationId, destination, attributes);
      if (resolved) return resolved;
    }
  }

  // Fallback de movimiento vago sin destino nombrado (ver comentario de VAGUE_MOVEMENT_REGEX
  // arriba) — solo se resuelve solo si hay EXACTAMENTE una salida directa conocida desde aquí:
  // con una sola opción real, "seguir adelante" no tiene ninguna ambigüedad genuina que decidir
  // (el modelo nunca elige la ruta, esto sigue siendo así). Con 2+ salidas no se adivina cuál —
  // eso sí sería inventar una elección del jugador — se deja que el turno siga su curso normal
  // (el contexto ya lista las opciones reales; ver aviso reforzado en turnResolution.ts).
  if (detectsVagueMovementIntent(action)) {
    const options = await destinationsFrom(currentLocationId, attributes);
    if (options.length === 1) {
      const destination = await prisma.location.findUnique({ where: { id: options[0].locationId } });
      if (destination) {
        return resolveTravelPath(worldId, currentLocationId, destination, attributes);
      }
    }
  }

  return null;
}

/// Ubicación inicial al crear una partida nueva (docs/12-mundo-estructurado.md § 1.2) — hoy
/// solo Gorhorn tiene mundo estructurado (alcance v1), igual que startingAbilitiesFor.
export function initialLocationSlugFor(characterName: string): string | undefined {
  if (characterName === 'Gorhorn') return 'hondonada-del-eco';
  return undefined;
}

export interface DestinationOption {
  locationId: string;
  slug: string;
  name: string;
  minutos: number;
}

/// Lista cerrada de destinos directos desde la ubicación actual, con tiempos ya ajustados a la
/// destreza del personaje (§ 1.5, § 1.6) — la misma lista que ve el clasificador si algún día
/// hiciera falta el fallback de enum, visible también para el jugador en el mapa.
export async function destinationsFrom(currentLocationId: string, attributes: AttributeBlock): Promise<DestinationOption[]> {
  const links = await prisma.locationLink.findMany({
    where: { OR: [{ fromId: currentLocationId }, { toId: currentLocationId }] },
    include: { from: true, to: true },
  });

  return links.map((link) => {
    const dest = link.fromId === currentLocationId ? link.to : link.from;
    return {
      locationId: dest.id,
      slug: dest.slug,
      name: dest.name,
      minutos: minutosConDestreza(link.minutosBase, attributes),
    };
  });
}
