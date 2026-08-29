import type { Prisma, PrismaClient, ZonePointTipo } from '@prisma/client';
import { stripRegionArticle } from './population.js';
import { sourceDisplayNameFor } from '../scripts/worldCatalog.js';
import { factionRepFor } from './reputation.js';

export type ZonePointColor = 'ALIADO' | 'NEUTRO' | 'ENEMIGO' | 'SIN_FACCION';

/// Puro — color del punto en el mapa por reputación con SU facción (`ZonePoint.factionSlug`), mismo
/// medidor 0-5000 que `reputation.ts` (2500 = neutro). 3 bandas simplificadas de las 5 de
/// `effectiveTemperamento` (esa función es para IA de combate, aquí solo hace falta un color).
/// `factionSlug` null (fauna salvaje, recursos, seres inertes) siempre es `SIN_FACCION` — nunca
/// hereda el color de nadie.
export function zonePointColorFor(factionSlug: string | null, factionsStatus: Record<string, number>): ZonePointColor {
  if (!factionSlug) return 'SIN_FACCION';
  const rep = factionRepFor(factionsStatus, factionSlug);
  if (rep >= 3000) return 'ALIADO';
  if (rep < 1000) return 'ENEMIGO';
  return 'NEUTRO';
}

/// Dinamismo del mundo, Pieza 3 (2026-08-27, docs/21-roadmap.md) — `ZonePoint` como instancia viva:
/// recalcula proporcionalmente al tiempo de ficción que YA pasó desde la última vez que se tocó
/// este punto, disparado por cada turno real del jugador (nunca tiempo real de pared, nunca
/// pre-cómputo — decisión explícita, ver plan de sesión). Una acción corta mueve poco (fracción de
/// paso/crecimiento), una larga mueve más — cubre el 100% de los turnos, no solo esperas largas.
///
/// Solo `FAUNA`/`RECURSO` tienen cantidad dinámica real (agrupación por población regional real,
/// `WorldPopulation`) — `NPC` (identidad única, nunca se agrupa) y `EDIFICIO` (existencia binaria,
/// gobernada por `Building`/`construction.ts`, no por población) quedan fuera de este recalculo a
/// propósito, documentado, no un descuido.

/// Fracción de la población regional agregada que un único `ZonePoint` puede llegar a representar
/// como máximo (cifra de partida, ajustable jugando, mismo criterio que el resto de números de este
/// proyecto) — evita que un solo punto intente mostrar "×400" de golpe si la población regional es
/// grande; varios puntos de la misma especie en la misma zona se reparten la población real.
const CANTIDAD_MAX_POR_PUNTO = 20;

/// Cuánto puede moverse `cantidad` hacia su objetivo por CADA DÍA completo de ficción transcurrido
/// (no de golpe) — mismo espíritu que `GROWTH_RATE_PER_DAY` de `population.ts`, pero aplicado al
/// AJUSTE del punto visual, no al crecimiento real de la especie (que ya lo calcula
/// `growAllPopulations`/`WorldPopulation` por su cuenta). Cifra de partida.
const AJUSTE_MAXIMO_POR_DIA = 3;

const MINUTOS_POR_DIA = 24 * 60;

export interface ZonePointRow {
  id: string;
  tipo: ZonePointTipo;
  targetSlug: string;
  cantidad: number;
  activo: boolean;
  lastUpdatedAtMinutes: number | null;
}

/// Puro — decide la `cantidad`/`activo` nuevos de UN punto dado cuánta población regional real hay
/// disponible para su especie y cuántos minutos de ficción pasaron desde su último recalculo. Nunca
/// toca `x`/`y` (reposicionar puntos dentro del lienzo queda fuera de esta pasada, documentado) ni
/// decide DE DÓNDE sale un punto nuevo (eso lo resuelve el caller, que sí conoce cuántos puntos
/// existen ya para esa especie en la Location).
export function proximaCantidadPara(punto: ZonePointRow, poblacionRegional: number, fictionalMinutesActuales: number): { cantidad: number; activo: boolean } {
  const objetivo = Math.max(0, Math.min(CANTIDAD_MAX_POR_PUNTO, poblacionRegional));
  if (punto.lastUpdatedAtMinutes == null) return { cantidad: objetivo, activo: objetivo > 0 };

  const minutosTranscurridos = Math.max(0, fictionalMinutesActuales - punto.lastUpdatedAtMinutes);
  if (minutosTranscurridos === 0) return { cantidad: punto.cantidad, activo: punto.activo };

  const diasTranscurridos = minutosTranscurridos / MINUTOS_POR_DIA;
  const ajusteMaximo = Math.max(1, Math.round(AJUSTE_MAXIMO_POR_DIA * diasTranscurridos));
  const delta = objetivo - punto.cantidad;
  const ajusteReal = Math.max(-ajusteMaximo, Math.min(ajusteMaximo, delta));
  const cantidad = punto.cantidad + ajusteReal;
  return { cantidad, activo: cantidad > 0 };
}

/// Recalcula TODOS los `ZonePoint` de tipo FAUNA/RECURSO de una `Location`, proporcional al tiempo
/// de ficción transcurrido desde su último recalculo — llamado desde `narrateAndPersistTurn`
/// (turnResolution.ts), en el mismo punto donde ya se resuelve cada turno real del jugador.
export async function recalcularZonePointsDeLocation(
  tx: Prisma.TransactionClient | PrismaClient,
  worldId: string,
  locationId: string,
  region: string | null,
  fictionalMinutesActuales: number,
): Promise<void> {
  const puntos = await tx.zonePoint.findMany({
    where: { locationId, tipo: { in: ['FAUNA', 'RECURSO'] } },
  });
  if (puntos.length === 0) return;

  const targetSlugs = [...new Set(puntos.map((p) => p.targetSlug))];
  const poblaciones = await tx.worldPopulation.findMany({
    where: { worldId, targetSlug: { in: targetSlugs } },
  });
  const regionSinArticulo = region ? stripRegionArticle(region) : null;
  // Población REAL disponible para esta especie en ESTA región concreta — el peso relativo de
  // `distribucion` (mismo criterio que el resto del motor, `travelInterruption.ts`/`recolectar.ts`)
  // aplicado sobre el agregado del `World` entero, nunca la cifra global sin repartir por región.
  const poblacionRegionalPorSlug = new Map<string, number>();
  for (const fila of poblaciones) {
    const distribucion = (fila.distribucion as Record<string, number> | null) ?? {};
    const peso = (regionSinArticulo ? distribucion[regionSinArticulo] : undefined) ?? (region ? distribucion[region] : undefined) ?? 0;
    poblacionRegionalPorSlug.set(fila.targetSlug, Math.round(fila.poblacion * peso));
  }

  await Promise.all(
    puntos.map((punto) => {
      const poblacionRegional = poblacionRegionalPorSlug.get(punto.targetSlug) ?? 0;
      const { cantidad, activo } = proximaCantidadPara(punto, poblacionRegional, fictionalMinutesActuales);
      if (cantidad === punto.cantidad && activo === punto.activo && punto.lastUpdatedAtMinutes === fictionalMinutesActuales) return null;
      return tx.zonePoint.update({
        where: { id: punto.id },
        data: { cantidad, activo, lastUpdatedAtMinutes: fictionalMinutesActuales },
      });
    }),
  );
}

/// `ZonePoint` alimenta al narrador (2026-08-27, Pieza 3 de "Dinamismo del mundo") — cierra el
/// hueco de auditoría "ningún panorama de población ambiental real, solo el NPC puntual detectado
/// por nombre". Solo puntos `activo` entran en el resumen; NPC/EDIFICIO resuelven nombre por
/// `Npc.name` (mismo criterio ya establecido en `zona.ts`), FAUNA/RECURSO por
/// `sourceDisplayNameFor` (catálogo de recolección/caza). `null` si no hay nada que contar —
/// el caller decide si empuja el bloque de contexto o lo omite.
export async function zonePointsSummaryFor(prisma: PrismaClient, locationId: string): Promise<string | null> {
  const puntos = await prisma.zonePoint.findMany({ where: { locationId, activo: true } });
  if (puntos.length === 0) return null;

  const npcSlugs = [...new Set(puntos.filter((p) => p.tipo === 'NPC').map((p) => p.targetSlug))];
  const npcRows = npcSlugs.length ? await prisma.npc.findMany({ where: { slug: { in: npcSlugs } }, select: { slug: true, name: true } }) : [];
  const npcNameBySlug = new Map(npcRows.map((n) => [n.slug, n.name]));

  const entradas = puntos.map((p) => {
    // EDIFICIO no resuelve contra `Npc` — no tiene fila propia ahí (gobernado por
    // `Building`/`construction.ts`, fuera del alcance de esta pieza), solo `label` o el slug crudo.
    const nombre = p.label ?? (p.tipo === 'NPC' ? (npcNameBySlug.get(p.targetSlug) ?? p.targetSlug) : p.tipo === 'EDIFICIO' ? p.targetSlug : sourceDisplayNameFor(p.targetSlug));
    return p.cantidad > 1 ? `${nombre} ×${p.cantidad}` : nombre;
  });
  return entradas.join(', ') + '.';
}
