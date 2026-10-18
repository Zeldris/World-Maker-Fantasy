import type { PrismaClient } from '@prisma/client';
import { dynamicModeCandidateNameFor, nombreVisibleDeNpc, type DynamicModeCandidato } from './dynamicMode.js';
import { recordEntityDiscoveries } from './entityDiscovery.js';

/// P141/P165 (QA-27): cómo se nombra lo que ofrece la tarjeta del turno («¿Interactuar?») y qué se
/// descubre con ella. Un NPC con nombre propio sin descubrir va por su raza («Orco desconocido»), como en
/// el mapa y en la colisión; lo que la tarjeta nombra queda descubierto, como al toparse con ello en el
/// mapa (B31): antes la tarjeta decía «Cazadora Serhu» y su ficha del mapa seguía en «???».
export async function nombrarOferta(
  prisma: PrismaClient,
  partida: { saveId: string; worldId: string },
  candidato: DynamicModeCandidato,
): Promise<{ targetName: string; articuloNpc: string | null; generoNpc: string | null }> {
  const { saveId, worldId } = partida;
  let targetName = await dynamicModeCandidateNameFor(prisma, candidato);
  let articuloNpc: string | null = null;
  let generoNpc: string | null = null;
  let oculto = false;
  if (candidato.tipo === 'NPC') {
    const npc = await prisma.npc.findFirst({
      where: { worldId, slug: candidato.targetSlug },
      select: { slug: true, name: true, kind: true, raza: true, genero: true, articulo: true },
    });
    if (npc) {
      const visible = await nombreVisibleDeNpc(prisma, saveId, npc);
      targetName = visible.nombre;
      oculto = visible.oculto;
      // El artículo de catálogo («a la Cazadora Serhu»), solo si se le llama por su nombre real.
      articuloNpc = visible.oculto ? null : npc.articulo;
    }
  } else if (candidato.tipo === 'FAUNA') {
    // P196: el artículo de la especie para el aviso («Un Guchapo busca tu atención»).
    const especie = await prisma.npc.findFirst({ where: { worldId, slug: candidato.targetSlug }, select: { articulo: true, genero: true } });
    articuloNpc = especie?.articulo ?? null;
    generoNpc = especie?.genero ?? null;
  }
  if (candidato.tipo === 'RECURSO') await recordEntityDiscoveries({ saveId, worldId, mentionedText: targetName });
  else if (!oculto) await recordEntityDiscoveries({ saveId, worldId, mentionedText: targetName, npcSlugsInScene: [candidato.targetSlug] });
  return { targetName, articuloNpc, generoNpc };
}
