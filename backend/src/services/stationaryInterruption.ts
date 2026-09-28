import { prisma } from '../lib/prisma.js';
import { pickAmbientEncounterCandidate, type AmbientEncounterCandidate } from './npcScene.js';

/// Grupo 3 § Mundo determinista, Capa 2 (docs/rpgtarkor/lore-mundo/mundo-determinista.md, 2026-08-25) —
/// generaliza `pickTravelInterruption` (travelInterruption.ts) a acciones largas SIN
/// desplazamiento (descansar, construir, crafteo) — hasta ahora sin ningún mecanismo de "algo pasa
/// mientras tanto" (comentario explícito en turn.ts: "acciones largas sin desplazamiento... no
/// entran"). A diferencia del viaje (tira por cada nodo intermedio de la ruta), aquí no hay
/// ruta — se tira una vez por cada bloque de `CHUNK_MINUTES` de la duración de la acción, mismo
/// espíritu que el viaje: una acción más larga tiene más oportunidades, sin escalar la
/// probabilidad a mano.
///
/// Solo puede disparar en zonas con `ZonePoint` real sembrado (Capa 1, hoy únicamente La Hondonada
/// del Eco) — sin eso, no hay nada que rodar y la función siempre devuelve `null`, sin ningún
/// efecto en el resto de zonas del juego (mismo criterio aditivo de toda esta sesión). Solo se
/// consideran puntos FAUNA/NPC — un punto RECURSO no "interrumpe" nada, es estático.
const CHUNK_MINUTES = 120;

export interface StationaryInterruption {
  npcId: string;
  npcSlug: string;
  npcName: string;
}

export async function pickStationaryInterruption(
  worldId: string,
  locationId: string,
  durationMinutos: number,
  perChunkProbability: number,
  random: () => number = Math.random,
): Promise<StationaryInterruption | null> {
  const zonePoints = await prisma.zonePoint.findMany({
    where: { locationId, tipo: { in: ['FAUNA', 'NPC'] } },
  });
  if (zonePoints.length === 0) return null;

  const targetSlugs = [...new Set(zonePoints.map((p) => p.targetSlug))];
  const [npcRows, populationRows] = await Promise.all([
    prisma.npc.findMany({ where: { worldId, slug: { in: targetSlugs } }, select: { id: true, slug: true, name: true, role: true } }),
    prisma.worldPopulation.findMany({ where: { worldId, targetType: 'FAUNA', targetSlug: { in: targetSlugs } } }),
  ]);
  if (npcRows.length === 0) return null;
  const populationBySlug = new Map(populationRows.map((row) => [row.targetSlug, row]));

  const chunks = Math.max(1, Math.floor(durationMinutos / CHUNK_MINUTES));
  for (let i = 0; i < chunks; i++) {
    if (random() >= perChunkProbability) continue;

    const weightedCandidates = npcRows
      .map((npc): AmbientEncounterCandidate | null => {
        const row = populationBySlug.get(npc.slug);
        if (!row) return { slug: npc.slug, name: npc.name, role: npc.role, weight: 1 };
        if (row.poblacion <= 0) return null;
        return { slug: npc.slug, name: npc.name, role: npc.role, weight: row.poblacion };
      })
      .filter((c): c is AmbientEncounterCandidate => c !== null);

    const candidate = pickAmbientEncounterCandidate(weightedCandidates, random);
    if (!candidate) continue;

    const npc = npcRows.find((n) => n.slug === candidate.slug)!;
    return { npcId: npc.id, npcSlug: npc.slug, npcName: npc.name };
  }

  return null;
}
