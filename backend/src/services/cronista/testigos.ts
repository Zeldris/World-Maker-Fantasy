// Testigos de una muerte (CR-11, hito 0.2 — decisión de la entrevista: solo testigos, sin parentesco).
// Testigo = NPC con nombre, vivo, con un punto activo de la partida en el mismo lugar en que ocurre.
import type { Prisma } from '@prisma/client';
import { npcVivoEnPartida } from '../mundoPartida.js';

export async function testigosEnLugar(tx: Prisma.TransactionClient, saveId: string, worldId: string, locationId: string, victimaId: string): Promise<string[]> {
  const puntos = await tx.zonePoint.findMany({ where: { saveId, locationId, activo: true, tipo: 'NPC' }, select: { targetSlug: true } });
  if (puntos.length === 0) return [];
  const npcs = await tx.npc.findMany({
    where: {
      worldId, kind: 'PRINCIPAL', slug: { in: puntos.map((p) => p.targetSlug) }, id: { not: victimaId }, AND: [npcVivoEnPartida(saveId), { NOT: { npcStates: { some: { saveId, condicionFisica: 'MUERTO' } } } }],
    },
    select: { id: true },
    orderBy: { slug: 'asc' },
  });
  return npcs.map((n) => n.id);
}
