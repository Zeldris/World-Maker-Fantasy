import type { Prisma, PrismaClient } from '@prisma/client';
import { GRID_COLS, GRID_ROWS, celdaDePixel, claveCelda, pixelDeCelda } from './zonaPosicion.js';
import { murosDe } from './murosZona.js';

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

/// P211 (usuaria, 2026-10-26): celdas que ocupan las fichas fijas de la zona (recursos y edificios,
/// también los agotados: siguen en su sitio) y los muros de la zona (`murosDe`, P185). La puerta de un
/// interior no comparte casilla con ninguna: en la Llanura Roja la entrada a Hogar de Maktor caía en la
/// misma casilla que la Veta de Yerreo y al pulsarla en el mapa salía el recurso, sin llegar a entrar.
export async function celdasFijasOcupadas(db: Db, saveId: string, locationId: string): Promise<Set<string>> {
  const [fijos, location] = await Promise.all([
    db.zonePoint.findMany({
      where: { locationId, tipo: { in: ['RECURSO', 'EDIFICIO'] }, OR: [{ saveId }, { saveId: null }] },
      select: { x: true, y: true },
    }),
    db.location.findUnique({ where: { id: locationId }, select: { slug: true } }),
  ]);
  return new Set([...fijos.map((p) => claveCelda(celdaDePixel(p))), ...murosDe(location?.slug)]);
}

/// P211: `deseada` si su celda está libre; si no, el centro de la celda libre más cercana (anillos de
/// 1, 2, 3… celdas; a igual anillo, la más cerca en píxeles; a igual distancia, orden fijo de filas y
/// columnas). Determinista, porque la puerta no se guarda: se recalcula en cada carga de la zona y la
/// partida ya empezada también queda arreglada. Sin ninguna celda libre, `deseada` tal cual.
export function celdaLibreCercana(deseada: { x: number; y: number }, ocupadas: ReadonlySet<string>): { x: number; y: number } {
  const origen = celdaDePixel(deseada);
  if (!ocupadas.has(claveCelda(origen))) return deseada;
  for (let radio = 1; radio < Math.max(GRID_COLS, GRID_ROWS); radio++) {
    const candidatas: { x: number; y: number; d: number }[] = [];
    for (let row = origen.row - radio; row <= origen.row + radio; row++) {
      for (let col = origen.col - radio; col <= origen.col + radio; col++) {
        if (Math.max(Math.abs(col - origen.col), Math.abs(row - origen.row)) !== radio) continue;
        if (col < 0 || row < 0 || col >= GRID_COLS || row >= GRID_ROWS) continue;
        if (ocupadas.has(claveCelda({ col, row }))) continue;
        const centro = pixelDeCelda({ col, row });
        candidatas.push({ ...centro, d: Math.hypot(centro.x - deseada.x, centro.y - deseada.y) });
      }
    }
    if (candidatas.length > 0) {
      const mejor = candidatas.reduce((m, c) => (c.d < m.d ? c : m));
      return { x: mejor.x, y: mejor.y };
    }
  }
  return deseada;
}

/// Fuera: la puerta de un interior está junto al edificio principal del exterior (el primer
/// `ZonePoint` EDIFICIO, de la partida o de catálogo), dos celdas por debajo; sin edificio, cerca del
/// centro. Nunca en la casilla de un recurso o un edificio (`celdaLibreCercana`, P211).
export async function posicionPuertaAInterior(db: Db, saveId: string, exteriorLocationId: string): Promise<{ x: number; y: number }> {
  const edificio = await db.zonePoint.findFirst({
    where: { locationId: exteriorLocationId, tipo: 'EDIFICIO', OR: [{ saveId }, { saveId: null }] },
    orderBy: [{ saveId: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
    select: { x: true, y: true },
  });
  const deseada = edificio ? { x: edificio.x, y: Math.min(edificio.y + SEPARACION_DEL_EDIFICIO, PUERTA_INTERIOR.y) } : { ...PUERTA_EXTERIOR_SIN_EDIFICIO };
  return celdaLibreCercana(deseada, await celdasFijasOcupadas(db, saveId, exteriorLocationId));
}

/// Varias puertas en el mismo sitio (un exterior con dos interiores, o un interior con dos salidas)
/// se reparten en fila, a dos celdas una de otra, centradas en `base`.
export function enFila(base: { x: number; y: number }, total: number, indice: number): { x: number; y: number } {
  return { x: base.x + (indice - (total - 1) / 2) * 100, y: base.y };
}
