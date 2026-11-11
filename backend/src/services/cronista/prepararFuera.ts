// P427 (2026-11-11): paso `fuera:<lugar>` de `prepararReino.ts`. Para probar un asalto con la jugadora fuera de la Capital
// hubo que mover por SQL `currentLocationId` y `zonaPos`. Aquí se hace como una llegada: `currentLocationId` al lugar de ese
// slug (`Location.slug` del mundo de la partida) y el punto de entrada de siempre (`PUNTO_ENTRADA_INICIAL`, el de
// `creation.ts`) vía `fijarEntradaAZona`; el camino pendiente se vacía. Valida antes de escribir.
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { fijarEntradaAZona } from '../zonaPosicion.js';

/// El de `creation.ts` y `routes/saves/shared.ts`: esquina noroeste del lienzo.
export const PUNTO_ENTRADA_INICIAL = { x: 75, y: 75 } as const;

export type ResultadoFuera = { lugar: string; desde: string | null; yaEstaba: boolean; x: number; y: number } | { error: string };

export async function sacarAJugadora(prisma: PrismaClient, { saveId, lugarSlug }: { saveId: string; lugarSlug: string }): Promise<ResultadoFuera> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true, endedAt: true, currentLocationId: true, currentLocation: { select: { name: true } }, zonaPosX: true, zonaPosY: true } });
  if (!save) return { error: `fuera: no hay partida ${saveId}.` };
  if (save.endedAt) return { error: 'fuera: la partida ha terminado.' };
  const lugar = await prisma.location.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: lugarSlug } }, select: { id: true, name: true } });
  if (!lugar) {
    const conocidos = (await prisma.location.findMany({ where: { worldId: save.worldId }, select: { slug: true }, orderBy: { slug: 'asc' } })).map((l) => l.slug);
    return { error: `fuera: no hay lugar «${lugarSlug}» en el mundo de la partida (lugares: ${conocidos.join(', ')}).` };
  }
  if (save.currentLocationId === lugar.id) return { lugar: lugar.name, desde: lugar.name, yaEstaba: true, x: save.zonaPosX ?? PUNTO_ENTRADA_INICIAL.x, y: save.zonaPosY ?? PUNTO_ENTRADA_INICIAL.y };
  await prisma.$transaction(async (tx) => {
    await tx.save.update({ where: { id: saveId }, data: { currentLocationId: lugar.id, zonaCaminoPendiente: Prisma.JsonNull } });
    await fijarEntradaAZona(tx, saveId, PUNTO_ENTRADA_INICIAL.x, PUNTO_ENTRADA_INICIAL.y);
  });
  return { lugar: lugar.name, desde: save.currentLocation?.name ?? null, yaEstaba: false, ...PUNTO_ENTRADA_INICIAL };
}
