import { prisma } from '../lib/prisma.js';
import type { AttributeBlock } from './dice.js';
import { minutosConDestreza, bandaForMinutos, type TravelResolution } from './travel.js';
import { pickAmbientEncounterCandidate, type AmbientEncounterCandidate } from './npcScene.js';
import { stripRegionArticle } from './population.js';

/// Eventos de viaje interactivos (2026-08-05, petición explícita: "que las esperas entre los
/// movimientos de zonas sean más dinámicas"). Un viaje "extendida"/"larga" se resolvía siempre de
/// un tirón, del origen al destino, narrando la llegada completa de una sola vez. Este módulo
/// decide, en el momento de INICIAR el viaje (no al resolverlo), si algún nodo intermedio de la
/// ruta interrumpe el viaje con un encuentro real — el viaje se trunca ahí y se resuelve como
/// llegada a ese punto intermedio, con el candidato elegido ya en escena de verdad (no una mera
/// sugerencia narrativa, ver turnResolution.ts). Puro donde puede serlo (`truncateTravelResolution`),
/// con `random` inyectable para tests, mismo criterio que `pickAmbientEncounterCandidate`.

export interface TravelInterruption {
  travel: TravelResolution;
  npcId: string;
  npcSlug: string;
  npcName: string;
}

/// Recorta un `TravelResolution` para que termine en el nodo intermedio `segmentIndex` (índice
/// dentro de `pathIds`, debe estar entre 1 y `pathIds.length - 2` — ni el origen ni el destino
/// final). Recalcula `minutos` con destreza sobre los `minutosBase` acumulados SOLO hasta ese
/// punto, no sobre el total del viaje original.
export function truncateTravelResolution(travel: TravelResolution, segmentIndex: number, attributes: AttributeBlock): TravelResolution {
  const segments = travel.segments.slice(0, segmentIndex);
  const baseMinutos = segments.reduce((sum, s) => sum + s.minutosBase, 0);
  const minutos = minutosConDestreza(baseMinutos, attributes);
  return {
    toLocationId: travel.pathIds[segmentIndex],
    toLocationName: travel.pathNames[segmentIndex],
    pathIds: travel.pathIds.slice(0, segmentIndex + 1),
    path: travel.path.slice(0, segmentIndex + 1),
    pathNames: travel.pathNames.slice(0, segmentIndex + 1),
    segments,
    baseMinutos,
    minutos,
    banda: bandaForMinutos(minutos),
  };
}

/// Recorre los nodos intermedios de `travel` EN ORDEN; por cada uno tira `random() <
/// perSegmentProbability` de forma independiente — un viaje con más nodos intermedios tiene más
/// tiradas, no una probabilidad mayor por tirada, así "viaje más largo = más posibilidades de
/// interrupción" sale solo sin necesidad de escalar el número a mano. Al primer nodo que acierte
/// Y tenga al menos un candidato itinerante válido en su región, corta ahí; si no hay candidato
/// (región sin fauna/NPC itinerante registrado), sigue probando el siguiente nodo sin más.
///
/// A diferencia del encuentro ambiental de `turnResolution.ts` (que EXCLUYE cualquier candidato
/// sin fila de `WorldPopulation` — así nunca sugiere mercaderes ni peregrinos, solo fauna con
/// población real), aquí un candidato sin fila de población entra igualmente con peso 1 por
/// defecto: se quiere también el caso "mercader"/"gancho de misión", no solo fauna agresiva.
export async function pickTravelInterruption(
  worldId: string,
  travel: TravelResolution,
  perSegmentProbability: number,
  attributes: AttributeBlock,
  random: () => number = Math.random,
): Promise<TravelInterruption | null> {
  // pathIds = [origen, ...intermedios, destino] — sin al menos un nodo intermedio real, no hay
  // dónde interrumpir (un salto directo de un solo tramo nunca se ve afectado).
  if (travel.pathIds.length < 3) return null;

  const itinerantNpcs = await prisma.npc.findMany({
    where: { worldId, kind: 'PLANTILLA', homeLocationSlug: null, muertoEnMundo: false },
    select: { id: true, slug: true, name: true, role: true },
  });
  if (itinerantNpcs.length === 0) return null;

  const [populationRows, intermediateLocations] = await Promise.all([
    prisma.worldPopulation.findMany({
      where: { worldId, targetType: 'FAUNA', targetSlug: { in: itinerantNpcs.map((n) => n.slug) } },
    }),
    prisma.location.findMany({
      where: { worldId, id: { in: travel.pathIds.slice(1, -1) } },
      select: { id: true, region: true },
    }),
  ]);
  const populationBySlug = new Map(populationRows.map((row) => [row.targetSlug, row]));
  const regionByLocationId = new Map(intermediateLocations.map((l) => [l.id, l.region]));

  for (let i = 1; i < travel.pathIds.length - 1; i++) {
    if (random() >= perSegmentProbability) continue;

    const region = regionByLocationId.get(travel.pathIds[i]);
    if (!region) continue;

    const weightedCandidates = itinerantNpcs
      .map((npc): AmbientEncounterCandidate | null => {
        const row = populationBySlug.get(npc.slug);
        if (!row) return { slug: npc.slug, name: npc.name, role: npc.role, weight: 1 };
        if (row.poblacion <= 0) return null;
        // Bug real jugando en vivo 2026-08-07 (ver stripRegionArticle, population.ts): `distribucion`
        // se siembra sin artículo, `region` (Location.region) siempre lo lleva completo.
        const regionWeight = (row.distribucion as Record<string, number> | null)?.[stripRegionArticle(region)] ?? 0;
        if (regionWeight <= 0) return null;
        return { slug: npc.slug, name: npc.name, role: npc.role, weight: row.poblacion };
      })
      .filter((c): c is AmbientEncounterCandidate => c !== null);

    const candidate = pickAmbientEncounterCandidate(weightedCandidates, random);
    if (!candidate) continue;

    const npc = itinerantNpcs.find((n) => n.slug === candidate.slug)!;
    return {
      travel: truncateTravelResolution(travel, i, attributes),
      npcId: npc.id,
      npcSlug: npc.slug,
      npcName: npc.name,
    };
  }

  return null;
}
