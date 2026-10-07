// Situación de una facción del mundo de la partida (CR-34): sus carencias tal como las ve quien la
// lidera. Lee de la base de datos y delega el cálculo en `carencias.ts` (puro).
import type { Prisma } from '@prisma/client';
import { produccionDeFaccion } from '../kingdomTick.js';
import { carenciasDe, inteligenciaDelLider, tramoDeInteligencia, type Carencia, type Tramo } from './carencias.js';

type Tx = Prisma.TransactionClient;

export interface SituacionFaccion {
  carencias: Carencia[];
  /// Null sin líder (Q8): solo inercia, nada grande.
  tramo: Tramo | null;
  inteligencia: number | null;
}

/// Carencias de la facción (con el juicio de su líder; sin líder, el de un sensato) y su tramo.
/// Null si no tiene reino (`KingdomStats`).
export async function situacionDeFaccion(tx: Tx, factionId: string): Promise<SituacionFaccion | null> {
  const faccion = await tx.faction.findUnique({
    where: { id: factionId },
    select: {
      kingdomStats: true,
      liderNpc: { select: { attributes: true } },
      raza: true,
      buildings: { where: { status: 'ACTIVO' }, select: { recipeKey: true, status: true, tier: true } },
    },
  });
  if (!faccion?.kingdomStats) return null;
  const relaciones = await tx.factionRelation.findMany({
    where: { type: { in: ['TENSION', 'GUERRA'] }, OR: [{ sourceFactionId: factionId }, { targetFactionId: factionId }] },
    select: { sourceFactionId: true, targetFactionId: true },
  });
  const enemigosIds = [...new Set(relaciones.map((r) => (r.sourceFactionId === factionId ? r.targetFactionId : r.sourceFactionId)))];
  const enemigos = enemigosIds.length === 0 ? [] : (await tx.kingdomStats.findMany({ where: { factionId: { in: enemigosIds } }, select: { factionId: true, soldados: true } }))
    .map((k) => ({ factionId: k.factionId!, soldados: k.soldados }));

  const inteligencia = inteligenciaDelLider(faccion.liderNpc);
  const tramo = inteligencia === null ? null : tramoDeInteligencia(inteligencia);
  const carencias = carenciasDe({ stats: faccion.kingdomStats, produccion: produccionDeFaccion(faccion.buildings, faccion.raza, faccion.kingdomStats), enemigos }, tramo ?? 'SENSATO');
  return { carencias, tramo, inteligencia };
}
