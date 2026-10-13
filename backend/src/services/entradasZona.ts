import type { Prisma, PrismaClient } from '@prisma/client';
import { PUERTA_INTERIOR, enFila, posicionPuertaAInterior } from './puertasInterior.js';
import { celdaDePixel, posicionesDeSalidas, type Celda } from './zonaPosicion.js';

type Db = Prisma.TransactionClient | PrismaClient;

export interface DestinoDeSalida {
  id: string;
  x: number | null;
  y: number | null;
  kind: string;
}

/// Dónde está, en el mapa de zona, la salida hacia cada destino conectado: las puertas de los
/// interiores (`puertasInterior.ts`) y, para el resto, el rumbo real entre coordenadas
/// (`posicionesDeSalidas`). Lo comparten los iconos de salida (`GET /zona`) y el radio seguro de
/// las entradas (P116). Un destino sin coordenadas que no es un interior no tiene salida en el mapa.
export async function posicionesDeSalidasDeZona(
  db: Db,
  saveId: string,
  location: { id: string; x: number | null; y: number | null },
  conectadas: DestinoDeSalida[],
): Promise<Map<string, { x: number; y: number }>> {
  const posiciones = new Map<string, { x: number; y: number }>();
  const esInterior = location.x == null || location.y == null;
  const interiores = esInterior ? conectadas : conectadas.filter((c) => c.kind === 'interior' && (c.x == null || c.y == null));
  if (interiores.length > 0) {
    const base = esInterior ? PUERTA_INTERIOR : await posicionPuertaAInterior(db, saveId, location.id);
    interiores.forEach((destino, indice) => posiciones.set(destino.id, enFila(base, interiores.length, indice)));
  }
  if (!esInterior) {
    const conCoordenadas = conectadas.filter((d): d is DestinoDeSalida & { x: number; y: number } => d.x != null && d.y != null);
    for (const [id, punto] of posicionesDeSalidas({ x: location.x!, y: location.y! }, conCoordenadas)) posiciones.set(id, punto);
  }
  return posiciones;
}

/// P116 (QA-27, decisión de la usuaria 2026-10-13): alrededor de cada entrada de una zona, la fauna
/// hostil no corta el paso, no persigue ni entra. Antes, en el Paso de los Pilares Rotos, un grupo
/// de Cruzavientos de nivel 5 vigilaba la entrada desde la Hondonada a dos casillas y Gorhorn, de
/// nivel 1, no podía ni cruzar ni volver. Como los sectores seguros junto a las puertas de X4 y las
/// entradas a las zonas de Medieval Dynasty y Bellwright. P88 ya lo hacía con toda la zona de inicio.
export const RADIO_SEGURO_ENTRADA = 3;

/// Celdas de las entradas de la zona (la salida hacia cada vecino, por donde también se llega).
export async function celdasDeEntrada(db: Db, saveId: string, locationId: string): Promise<Celda[]> {
  const location = await db.location.findUnique({ where: { id: locationId }, select: { id: true, x: true, y: true } });
  if (!location) return [];
  const links = await db.locationLink.findMany({
    where: { OR: [{ fromId: locationId }, { toId: locationId }] },
    select: { from: { select: { id: true, x: true, y: true, kind: true } }, to: { select: { id: true, x: true, y: true, kind: true } } },
  });
  const conectadas = links.map((l) => (l.from.id === locationId ? l.to : l.from));
  const posiciones = await posicionesDeSalidasDeZona(db, saveId, location, conectadas);
  return [...posiciones.values()].map((p) => celdaDePixel(p));
}

/// La celda está a `RADIO_SEGURO_ENTRADA` casillas o menos (en cualquier dirección) de una entrada.
export function enRadioSeguro(celda: Celda, entradas: Celda[]): boolean {
  return entradas.some((e) => Math.max(Math.abs(e.col - celda.col), Math.abs(e.row - celda.row)) <= RADIO_SEGURO_ENTRADA);
}
