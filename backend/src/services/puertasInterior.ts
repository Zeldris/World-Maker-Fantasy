import type { Prisma, PrismaClient } from '@prisma/client';

type Db = Prisma.TransactionClient | PrismaClient;

/// Puertas de las zonas interiores (QA-27, P7, 2026-10-09, jugando: «acceder a una zona interior
/// desde el botón»). Un interior (`Location.kind: 'interior'`, p. ej. Ketg'lukar dentro de Karot
/// Veku, o la Capital y el Cuartel Avanzado del jugador) no tiene coordenadas de mundo a propósito:
/// vive dentro de su exterior. Por eso las salidas, que se colocan por el rumbo entre coordenadas,
/// nunca lo mostraban: no había forma de entrar desde el mapa de zona, ni de salir desde dentro.
/// Aquí se fija dónde está la puerta a cada lado, para las salidas (`GET /zona`) y para el punto de
/// llegada tras cruzarla (turnResolution.ts), con el mismo cálculo en los dos sitios.

/// Dentro de un interior: la puerta está abajo, en el centro del lienzo (800×600).
export const PUERTA_INTERIOR = { x: 400, y: 550 } as const;

/// Fuera, sin edificio de referencia: un poco por debajo del centro.
const PUERTA_EXTERIOR_SIN_EDIFICIO = { x: 400, y: 450 } as const;

/// Distancia de la puerta al edificio principal del exterior (dos celdas por debajo).
const SEPARACION_DEL_EDIFICIO = 100;

/// Fuera: la puerta de un interior está junto al edificio principal del exterior (el primer
/// `ZonePoint` EDIFICIO, de la partida o de catálogo), dos celdas por debajo; sin edificio, cerca del
/// centro.
export async function posicionPuertaAInterior(db: Db, saveId: string, exteriorLocationId: string): Promise<{ x: number; y: number }> {
  const edificio = await db.zonePoint.findFirst({
    where: { locationId: exteriorLocationId, tipo: 'EDIFICIO', OR: [{ saveId }, { saveId: null }] },
    orderBy: [{ saveId: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
    select: { x: true, y: true },
  });
  if (!edificio) return { ...PUERTA_EXTERIOR_SIN_EDIFICIO };
  return { x: edificio.x, y: Math.min(edificio.y + SEPARACION_DEL_EDIFICIO, PUERTA_INTERIOR.y) };
}

/// Varias puertas en el mismo sitio (un exterior con dos interiores, o un interior con dos salidas)
/// se reparten en fila, a dos celdas una de otra, centradas en `base`.
export function enFila(base: { x: number; y: number }, total: number, indice: number): { x: number; y: number } {
  return { x: base.x + (indice - (total - 1) / 2) * 100, y: base.y };
}
