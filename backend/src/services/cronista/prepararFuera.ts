// P427 (2026-11-11): paso `fuera:<lugar>` de `prepararReino.ts`. Para probar un asalto con la jugadora fuera de la Capital
// hubo que mover por SQL `currentLocationId` y `zonaPos`. Aquí se hace como una llegada: `currentLocationId` al lugar de ese
// slug (`Location.slug` del mundo de la partida), `LocationVisit` como el viaje real, el punto de entrada sobre la salida
// de la zona hacia su primer vecino por slug (la misma posición que el icono de salida de `GET /zona`, `posicionesDeSalidasDeZona`:
// donde el viaje deja a quien llega, y dentro del radio seguro de entradas) vía `fijarEntradaAZona`, y se limpia lo que el
// juego limpia al reaparecer (`death.ts`: ofertas y encuentros pendientes, camino). Se rechaza, antes de escribir, con un
// combate abierto (`pendingCombatNpcSlugs`: usa `fuera` antes de `combate:`) y en zonas `interior` (sin coordenadas de mundo).
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { posicionesDeSalidasDeZona } from '../entradasZona.js';
import { fijarEntradaAZona } from '../zonaPosicion.js';

/// Sin ninguna salida a un vecino con coordenadas: el centro del lienzo, como el viaje sin origen (`turnResolution.ts`).
export const PUNTO_ENTRADA_CENTRO = { x: 400, y: 300 } as const;

export type ResultadoFuera = { lugar: string; desde: string | null; yaEstaba: boolean; x: number; y: number } | { error: string };

export async function sacarAJugadora(prisma: PrismaClient, { saveId, lugarSlug }: { saveId: string; lugarSlug: string }): Promise<ResultadoFuera> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true, endedAt: true, currentLocationId: true, currentLocation: { select: { name: true } }, pendingCombatNpcSlugs: true, zonaPosX: true, zonaPosY: true } });
  if (!save) return { error: `fuera: no hay partida ${saveId}.` };
  if (save.endedAt) return { error: 'fuera: la partida ha terminado.' };
  if (Array.isArray(save.pendingCombatNpcSlugs) && save.pendingCombatNpcSlugs.length > 0) return { error: 'fuera: hay un combate en curso; usa fuera antes de combate:<npc>.' };
  const lugar = await prisma.location.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: lugarSlug } }, select: { id: true, name: true, kind: true, x: true, y: true } });
  if (!lugar) {
    const conocidos = (await prisma.location.findMany({ where: { worldId: save.worldId }, select: { slug: true }, orderBy: { slug: 'asc' } })).map((l) => l.slug);
    return { error: `fuera: no hay lugar «${lugarSlug}» en el mundo de la partida (lugares: ${conocidos.join(', ')}).` };
  }
  if (save.currentLocationId === lugar.id) return { lugar: lugar.name, desde: lugar.name, yaEstaba: true, x: save.zonaPosX ?? PUNTO_ENTRADA_CENTRO.x, y: save.zonaPosY ?? PUNTO_ENTRADA_CENTRO.y };
  if (lugar.kind === 'interior' || lugar.x == null || lugar.y == null) return { error: `fuera: «${lugarSlug}» es una zona interior o sin coordenadas de mundo: no se puede aparecer en ella sin una entrada que calcular.` };
  const entrada = await prisma.$transaction(async (tx) => {
    const links = await tx.locationLink.findMany({
      where: { OR: [{ fromId: lugar.id }, { toId: lugar.id }] },
      select: { from: { select: { id: true, slug: true, x: true, y: true, kind: true } }, to: { select: { id: true, slug: true, x: true, y: true, kind: true } } },
    });
    const vecinos = links.map((l) => (l.from.id === lugar.id ? l.to : l.from)).sort((a, b) => a.slug.localeCompare(b.slug));
    const salidas = await posicionesDeSalidasDeZona(tx, saveId, lugar, vecinos);
    const entrada = vecinos.map((v) => salidas.get(v.id)).find((p) => p != null) ?? { ...PUNTO_ENTRADA_CENTRO };
    await tx.save.update({ where: { id: saveId }, data: {
      currentLocationId: lugar.id,
      pendingDynamicModeOffer: Prisma.JsonNull,
      pendingDynamicMode: Prisma.JsonNull,
      pendingNpcAttack: Prisma.JsonNull,
      zonaUltimoEncuentro: Prisma.JsonNull,
      zonaCaminoPendiente: Prisma.JsonNull,
    } });
    await fijarEntradaAZona(tx, saveId, entrada.x, entrada.y);
    await tx.locationVisit.upsert({ where: { saveId_locationId: { saveId, locationId: lugar.id } }, create: { saveId, locationId: lugar.id }, update: {} });
    return entrada;
  });
  return { lugar: lugar.name, desde: save.currentLocation?.name ?? null, yaEstaba: false, x: entrada.x, y: entrada.y };
}
