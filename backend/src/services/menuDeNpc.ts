// Menú fijo de un NPC (P142, 2026-10-13): las opciones que da ESTE NPC (oficio, trabajo, noticias,
// unirse…) se calculaban solo en el turno narrado que lo nombraba, así que «Interactuar» desde el
// mapa abría siempre la escena libre y el menú no salía nunca. Lo comparten el turno
// (`turnResolution.ts`) y la ruta que abre el menú desde la tarjeta del mapa
// (`POST /saves/:id/npc-interaction/:npcSlug/abrir`).
import type { Prisma, PrismaClient } from '@prisma/client';
import { effectiveTemperamento, parseFactionsStatus } from './reputation.js';
import { buildNpcInScene, scopeFor, type NpcInScene } from './npcScene.js';
import { estaMalherido, opcionesDisponiblesPara } from './npcInteraction.js';

type Db = PrismaClient | Prisma.TransactionClient;

/// CR-40 (40f): un NPC con nombre de una facción viva de la partida puede ofrecer trabajo, contar
/// noticias (CR-18) y escuchar propuestas (CR-32). Nunca quien te trata como enemigo.
export async function escuchaPropuestas(db: Db, saveId: string, npc: NpcInScene, factionsStatus: Record<string, number>): Promise<boolean> {
  return (
    npc.kind !== 'PLANTILLA' && !!npc.faction &&
    ['AMIGABLE', 'INOFENSIVO', 'CAUTELOSO'].includes(effectiveTemperamento(npc.temperamento, npc.faction, factionsStatus)) &&
    (await db.faction.count({ where: { saveId, name: npc.faction, origenSlug: { not: null }, disueltaEn: null } })) > 0
  );
}

/// El NPC tiene menú propio: `interactionTypes` sembrado en el catálogo o malherido (CR-12).
/// Gistera Koh sigue su guion propio de misión (ver `turnResolution.ts` § npcInteractionCandidate).
export function tieneMenu(npc: NpcInScene): boolean {
  return npc.slug !== 'gistera-koh' && (npc.interactionTypes.length > 0 || estaMalherido(npc));
}

/// `desdeEncuentro`: abierto desde la tarjeta del mapa (ver `/elegir` § P142).
export interface MenuDeNpc { npcSlug: string; npcName: string; options: string[]; desdeEncuentro: true }

/// Menú del NPC del encuentro del mapa, guardado como `pendingNpcInteractionOffer` para que
/// `/elegir` lo resuelva igual que el del turno. `null` si el NPC no tiene menú: la tarjeta abre
/// entonces la escena libre de siempre. `npcName` es el que ya enseña la tarjeta (puede ser el
/// nombre oculto si aún no se ha presentado).
export async function abrirMenuDeNpc(db: PrismaClient, saveId: string, npcSlug: string, npcName: string): Promise<MenuDeNpc | null> {
  const save = await db.save.findUniqueOrThrow({
    where: { id: saveId },
    select: { worldId: true, currentLocationId: true, worldState: { select: { factionsStatus: true } } },
  });
  const npc = await db.npc.findFirst({ where: { worldId: save.worldId, slug: npcSlug }, include: { items: { include: { item: true } } } });
  if (!npc) return null;
  const estado = await db.npcState.findUnique({
    where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope: scopeFor(npc.kind, save.currentLocationId) } },
  });
  const enEscena = buildNpcInScene(npc, estado ?? undefined);
  if (!tieneMenu(enEscena)) return null;
  const propuestas = await escuchaPropuestas(db, saveId, enEscena, parseFactionsStatus(save.worldState?.factionsStatus));
  const options = opcionesDisponiblesPara(enEscena, {
    hayMisionOfertadaDeEsteNpc: false,
    puedeOfrecerTrabajo: propuestas,
    puedeContarNoticias: propuestas,
    puedeReclutar: propuestas,
  });
  if (options.length === 0) return null;
  const menu: MenuDeNpc = { npcSlug, npcName, options, desdeEncuentro: true };
  await db.save.update({ where: { id: saveId }, data: { pendingNpcInteractionOffer: { ...menu } } });
  return menu;
}
