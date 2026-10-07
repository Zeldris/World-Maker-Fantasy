// Expediciones en el mapa de Berig (CR-46, hito 0.2 — decisiones de la Fase G, 2026-10-05). Como
// en X4, solo se ve lo que el personaje puede ver: las del Reino, las de las facciones con tratado o
// alianza con él y las que salen de o van a la región donde está. Cada una con su origen (el
// asentamiento de la facción), su destino y por dónde va (ida hasta la mitad del viaje, vuelta
// después). Las caravanas del Reino (`CR-47`) entrarán por el mismo camino.
import type { PrismaClient } from '@prisma/client';
import { viajerosEnMapa } from './viajerosCruce.js';

export interface ExpedicionEnMapa {
  id: string;
  faccion: string;
  /// Oficio de la expedición (a qué va: `minero`, `cazador`…).
  oficio: string;
  /// Por qué sale, si lo decidió una carencia (`COMIDA`…).
  motivo: string | null;
  origenSlug: string;
  destinoSlug: string;
  destinoNombre: string;
  diaRegreso: number;
  /// 0-1 del viaje completo: 0-0,5 ida, 0,5-1 vuelta.
  progreso: number;
  delReino: boolean;
}

/// Puro: dónde va del viaje completo en el día `dia`.
export function progresoDeExpedicion(diaSalida: number, diaRegreso: number, dia: number): number {
  const duracion = Math.max(1, diaRegreso - diaSalida);
  return Math.min(1, Math.max(0, (dia - diaSalida) / duracion));
}

const exterior = (slug: string) => slug.replace(/-interior$/, '');

export async function expedicionesVisibles(prisma: PrismaClient, saveId: string): Promise<ExpedicionEnMapa[]> {
  const save = await prisma.save.findUnique({
    where: { id: saveId },
    select: { currentLocation: { select: { region: true } }, worldState: { select: { fictionalMinutes: true } } },
  });
  if (!save) return [];
  const dia = Math.floor((save.worldState?.fictionalMinutes ?? 0) / 1440);
  const regionActual = save.currentLocation?.region ?? null;
  const reino = await prisma.faction.findFirst({ where: { saveId, origenSlug: null, disueltaEn: null }, select: { id: true } });
  const aliadas = new Set<string>();
  if (reino) {
    const rel = await prisma.factionRelation.findMany({
      where: { type: { in: ['ALIANZA', 'TRATADO_COMERCIAL'] }, OR: [{ sourceFactionId: reino.id }, { targetFactionId: reino.id }] },
      select: { sourceFactionId: true, targetFactionId: true },
    });
    for (const r of rel) aliadas.add(r.sourceFactionId === reino.id ? r.targetFactionId : r.sourceFactionId);
  }
  const expediciones = await prisma.expedicion.findMany({
    // Toda la expedición en curso: de camino, recolectando y de vuelta.
    where: { saveId, status: { in: ['EN_TRANSITO', 'RECOLECTANDO', 'RETORNANDO'] } },
    select: {
      id: true, professionId: true, motivo: true, diaSalida: true, diaRegreso: true,
      destino: { select: { slug: true, name: true, region: true } },
      faction: { select: { id: true, name: true, buildings: { where: { locationId: { not: null } }, select: { location: { select: { slug: true, region: true } } }, take: 1 } } },
    },
    orderBy: { diaSalida: 'asc' },
  });
  const visibles: ExpedicionEnMapa[] = [];
  for (const e of expediciones) {
    const origen = e.faction.buildings[0]?.location;
    if (!origen) continue;
    const delReino = e.faction.id === reino?.id;
    const cerca = !!regionActual && (e.destino.region === regionActual || origen.region === regionActual);
    if (!delReino && !aliadas.has(e.faction.id) && !cerca) continue;
    visibles.push({
      id: e.id, faccion: e.faction.name, oficio: e.professionId, motivo: e.motivo,
      origenSlug: exterior(origen.slug), destinoSlug: e.destino.slug, destinoNombre: e.destino.name,
      diaRegreso: e.diaRegreso, progreso: progresoDeExpedicion(e.diaSalida, e.diaRegreso, dia), delReino,
    });
  }
  // CR-47: las caravanas del Reino, del Mercado al socio.
  if (reino) {
    const mercado = await prisma.building.findFirst({ where: { saveId, recipeKey: 'mercado', status: 'ACTIVO', locationId: { not: null } }, select: { location: { select: { slug: true } } } });
    if (mercado?.location) {
      const caravanas = await prisma.caravana.findMany({
        where: { saveId, status: { in: ['EN_CAMINO', 'VOLVIENDO'] } },
        select: { id: true, tipo: true, diaSalida: true, diaRegreso: true, faction: { select: { name: true } }, destino: { select: { slug: true, name: true } } },
      });
      for (const c of caravanas) {
        visibles.push({
          id: c.id, faccion: c.faction.name, oficio: c.tipo === 'COMPRA' ? 'caravana de compra' : 'caravana de venta', motivo: null,
          origenSlug: exterior(mercado.location.slug), destinoSlug: c.destino.slug, destinoNombre: c.destino.name,
          diaRegreso: c.diaRegreso, progreso: progresoDeExpedicion(c.diaSalida, c.diaRegreso, dia), delReino: true,
        });
      }
    }
  }
  // CR-63 (63e): los viajeros (partidas de caza y captura…), por el tramo por el que van.
  visibles.push(...(await prisma.$transaction((tx) => viajerosEnMapa(tx, saveId, { dia, regionActual, aliadas }))));
  return visibles;
}
