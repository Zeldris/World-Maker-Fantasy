// QA-266 (2026-10-26): el paso `punto-retirado:<especie>[:<n>]` de `prepararReino.ts` (P313). Un punto de fauna RETIRADO con presas
// (`activo` false y `cantidad` > 0) es un estado SINTÉTICO: el juego no lo produce hoy (el Cronista solo retira puntos de NPC y la
// caza deja `cantidad` 0). Sirve para comprobar la defensa de `opcionesDePartida` (`partidasReino.ts`): Reino › Partidas no lo lista
// ni lo lanza. Se crea y se retira con los efectos del juego (`crearPuntoZona` y `retirarPuntoZona`, `aplicarEfecto`), no con un
// `update` a mano (QA-151). Se comprueba al cargar, sin avanzar: con ~4 h de juego en el lugar el recálculo de la zona lo cambia.
import type { PrismaClient } from '@prisma/client';
import { aplicarEfecto } from './efectos.js';
import { FAUNA_AMBIENTAL } from '../../scripts/worldCatalog.js';
import { LIENZO_ALTO } from '../zonaPosicion.js';

export type ResultadoPuntoRetirado = { nombre: string; cantidad: number; lugar: string; yaEstaba: boolean };

class Rechazo extends Error {}

const CANTIDAD_MAX = 20;

export async function dejarPuntoRetirado(
  prisma: PrismaClient,
  { saveId, especie, cantidad = 3 }: { saveId: string; especie: string; cantidad?: number },
): Promise<ResultadoPuntoRetirado | { error: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > CANTIDAD_MAX) throw new Rechazo(`punto-retirado: las presas van de 1 a ${CANTIDAD_MAX}.`);
      const save = await tx.save.findUnique({
        where: { id: saveId },
        select: { worldId: true, endedAt: true, currentLocationId: true, worldState: { select: { fictionalMinutes: true } } },
      });
      if (!save) throw new Rechazo(`punto-retirado: no hay partida ${saveId}.`);
      if (save.endedAt) throw new Rechazo('punto-retirado: la partida ha terminado.');
      if (!save.currentLocationId) throw new Rechazo('punto-retirado: la partida no está en ningún lugar.');
      const npc = await tx.npc.findFirst({ where: { worldId: save.worldId, saveId: null, slug: especie }, select: { slug: true, name: true, faunaCategoria: true } });
      if (!npc) throw new Rechazo(`punto-retirado: no hay fauna ${especie}.`);
      if (npc.faunaCategoria == null) throw new Rechazo(`punto-retirado: ${especie} no es fauna.`);
      // La fauna ambiental no tiene puntos: el juego los borra al abrir la zona (`asegurarZonePointsDePartida`).
      if (FAUNA_AMBIENTAL.has(npc.slug)) throw new Rechazo(`punto-retirado: ${especie} es fauna ambiental, no tiene puntos en el mapa.`);
      const lugar = await tx.location.findUniqueOrThrow({ where: { id: save.currentLocationId }, select: { name: true } });
      // Idempotente: si ya hay uno retirado con presas de esa especie aquí, no se crea otro.
      const previo = await tx.zonePoint.findFirst({ where: { saveId, tipo: 'FAUNA', targetSlug: npc.slug, locationId: save.currentLocationId, activo: false, cantidad: { gt: 0 } }, select: { cantidad: true } });
      if (previo) return { nombre: npc.name, cantidad: previo.cantidad, lugar: lugar.name, yaEstaba: true };
      const ctx = { tx, saveId, worldId: save.worldId, fictionalMinutes: save.worldState?.fictionalMinutes ?? 0, origen: 'MOTOR' as const };
      // Hueco libre en el lienzo: una fila por punto que ya hay en el lugar, en la franja de abajo.
      const hay = await tx.zonePoint.count({ where: { saveId, locationId: save.currentLocationId } });
      const creado = await aplicarEfecto(ctx, { tipo: 'crearPuntoZona', locationId: save.currentLocationId, puntoTipo: 'FAUNA', targetSlug: npc.slug, x: 80 + (hay % 9) * 80, y: LIENZO_ALTO - 60, cantidad });
      if (!creado.aplicado || !creado.id) throw new Rechazo('punto-retirado: el juego no ha creado el punto.');
      const retirado = await aplicarEfecto(ctx, { tipo: 'retirarPuntoZona', zonePointId: creado.id });
      if (!retirado.aplicado) throw new Rechazo('punto-retirado: el juego no ha retirado el punto.');
      return { nombre: npc.name, cantidad, lugar: lugar.name, yaEstaba: false };
    });
  } catch (e) {
    if (e instanceof Rechazo) return { error: e.message };
    throw e;
  }
}
