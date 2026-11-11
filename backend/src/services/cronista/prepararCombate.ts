// El paso `combate:<npc>,<npc>…` de `prepararReino.ts`: abre un combate de la jugadora contra esos NPC, donde esté, con
// `abrirCombateDePersonas` (la misma apertura que el combate de personas del juego). P374: en el juego, el grupo que
// entra en combate sale de `grupoDePersona`, que ya deja fuera a los muertos y convalecientes; este paso nombra a los
// NPC a mano, así que lo comprueba aquí. Sin la comprobación, un rival MUERTO de un combate anterior (su `NpcState`)
// entraba en el encuentro nuevo, `GET /saves/:id` lo devolvía «Muerto» en `combateIniciado` y el panel salía con
// «¡Victoria!» de entrada, sin nada que jugar.
import type { PrismaClient } from '@prisma/client';
import { abrirCombateDePersonas, type MiembroDeGrupo } from '../combatePersonas.js';
import { scopeFor } from '../npcScene.js';
import { formatFictionalDate } from '../worldClock.js';
import type { AttributeBlock } from '../dice.js';

export type ResultadoCombate = { rivales: { nombre: string; inteligencia: number }[] };

export async function abrirCombateDePreparacion(
  prisma: PrismaClient,
  { saveId, npcSlugs }: { saveId: string; npcSlugs: string[] },
): Promise<ResultadoCombate | { error: string }> {
  const save = await prisma.save.findUnique({
    where: { id: saveId },
    select: { worldId: true, characterName: true, attributes: true, currentLocationId: true, worldState: { select: { fictionalMinutes: true } } },
  });
  if (!save) return { error: `combate: no hay partida ${saveId}.` };
  const npcs = await prisma.npc.findMany({ where: { worldId: save.worldId, saveId: null, slug: { in: npcSlugs } } });
  const faltan = npcSlugs.filter((s) => !npcs.some((n) => n.slug === s));
  if (faltan.length) return { error: `combate: no hay NPC ${faltan.join(', ')}.` };
  const miembros: MiembroDeGrupo[] = npcSlugs.map((slug) => {
    const n = npcs.find((x) => x.slug === slug)!;
    const a = n.attributes as AttributeBlock;
    return { npcId: n.id, nombre: n.name, scope: scopeFor(n.kind, save.currentLocationId), destreza: a.destreza, inteligencia: a.inteligencia, esGrupo: false };
  });
  const ahora = save.worldState?.fictionalMinutes ?? 0;
  const abierto = await abrirCombateDePersonas(
    prisma,
    { id: saveId, characterName: save.characterName, attributes: save.attributes as AttributeBlock, fictionalMinutes: ahora, timeLabel: formatFictionalDate(ahora) },
    miembros,
  );
  if (!abierto) return { error: 'combate: ya hay un combate en curso.' };
  return { rivales: miembros.map((m) => ({ nombre: m.nombre, inteligencia: m.inteligencia })) };
}
