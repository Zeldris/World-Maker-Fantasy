// P377 (2026-11-11): `escenario.sh avanzar` avanza el reloj y el mundo, pero el juego repone los puntos de fauna vacíos de la
// zona al abrir su mapa o al resolver un turno (`recalcularZonePointsDeLocation`); sin eso, tras avanzar quedaba un punto en
// cantidad 0 que a la usuaria se le repondría al instante. Esta función llama a la MISMA del juego, con el reloj ya avanzado,
// sobre el lugar actual de la partida (no copia su lógica).
import type { PrismaClient } from '@prisma/client';
import { recalcularZonePointsDeLocation } from '../zonePoints.js';

export async function reponerZonaActual(prisma: PrismaClient, saveId: string): Promise<{ lugar: string } | null> {
  const s = await prisma.save.findUnique({
    where: { id: saveId },
    select: { worldId: true, currentLocation: { select: { id: true, name: true, region: true } }, worldState: { select: { fictionalMinutes: true } } },
  });
  if (!s?.currentLocation || !s.worldState) return null;
  await recalcularZonePointsDeLocation(prisma, s.worldId, saveId, s.currentLocation.id, s.currentLocation.region, s.worldState.fictionalMinutes);
  return { lugar: s.currentLocation.name };
}
