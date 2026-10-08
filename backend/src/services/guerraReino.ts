// CR-37 (hito 0.3, Fase E): guerra de una facción contra el Reino de la jugadora. Decisiones Q1-Q7 de
// la ronda de detalle (`docs/producto/plan-roadmap-0.3.md`; X4 marca el camino):
//
// - Hay guerra cuando la relación de la facción con el Reino está en la banda GUERRA (la misma presión
//   que entre facciones, X4: la reputación cruza un umbral).
// - Cada semana como mucho, si le sobra comida (7 días, la prudencia de `CR-63`), manda un ejército
//   (viajero `ASALTO` con su facción) de la mitad de sus soldados, hasta 16, al asentamiento del Reino
//   más cercano con camino (X4: flotas contra la estación enemiga más cercana). Se resuelve con la
//   defensa de `CR-65` al llegar (`asaltos.ts`).
import type { PrismaClient } from '@prisma/client';
import { asentamientosDelReino, TIPO_ASALTO } from './defensaReino.js';
import { DIAS_RESERVA_PARA_CAZAR, diasDeReservaFaccion } from './partidasFacciones.js';
import { avisoDeViajero, crearViajero, enlacesDelMundo, rutaMasCorta } from './viajeros.js';

export const MAX_EJERCITO = 16;
export const DIAS_ENTRE_EJERCITOS = 7;

/// Puro: soldados que manda una facción (la mitad, hasta 16; ninguno si no llega a 2).
export function tamanoDeEjercito(soldados: number): number {
  const n = Math.min(MAX_EJERCITO, Math.floor(soldados / 2));
  return n >= 2 ? n : 0;
}

/// La facción del Reino de la partida (la que no tiene origen en el catálogo).
export async function faccionDelReino(prisma: Pick<PrismaClient, 'faction'>, saveId: string) {
  return prisma.faction.findFirst({ where: { saveId, origenSlug: null, disueltaEn: null }, select: { id: true, name: true } });
}

/// Las facciones en guerra con el Reino.
export async function enGuerraConElReino(prisma: Pick<PrismaClient, 'faction' | 'factionRelation'>, saveId: string): Promise<string[]> {
  const reino = await faccionDelReino(prisma, saveId);
  if (!reino) return [];
  const rel = await prisma.factionRelation.findMany({ where: { type: 'GUERRA', OR: [{ sourceFactionId: reino.id }, { targetFactionId: reino.id }] }, select: { sourceFactionId: true, targetFactionId: true } });
  return [...new Set(rel.map((r) => (r.sourceFactionId === reino.id ? r.targetFactionId : r.sourceFactionId)))];
}

/// Un día: cada facción en guerra con el Reino que pueda manda su ejército. Devuelve cuántos salen.
export async function lanzarEjercitosContraElReino(prisma: PrismaClient, saveId: string, dia: number): Promise<number> {
  const enemigas = await enGuerraConElReino(prisma, saveId);
  if (enemigas.length === 0) return 0;
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
  if (!save) return 0;
  const enlaces = await enlacesDelMundo(prisma, save.worldId);
  let salen = 0;
  for (const factionId of enemigas) {
    await prisma.$transaction(async (tx) => {
      const f = await tx.faction.findFirst({
        where: { id: factionId, disueltaEn: null },
        select: { id: true, name: true, kingdomStats: true, buildings: { where: { locationId: { not: null } }, select: { locationId: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1 } },
      });
      const casa = f?.buildings[0]?.locationId;
      if (!f || !casa || !f.kingdomStats || diasDeReservaFaccion(f.kingdomStats) < DIAS_RESERVA_PARA_CAZAR) return;
      // Como mucho uno por semana (y nunca dos en marcha).
      const reciente = await tx.viajero.findFirst({ where: { saveId, factionId: f.id, tipo: TIPO_ASALTO, OR: [{ estado: { not: 'TERMINADO' } }, { diaSalida: { gt: dia - DIAS_ENTRE_EJERCITOS } }] }, select: { id: true } });
      if (reciente) return;
      const van = tamanoDeEjercito(f.kingdomStats.soldados);
      if (van === 0) return;
      // El asentamiento del Reino más cercano con camino.
      let objetivo: { locationId: string; nombre: string; pasos: number } | null = null;
      for (const a of await asentamientosDelReino(tx, saveId)) {
        const ruta = rutaMasCorta(enlaces, casa, a.locationId);
        if (ruta && (!objetivo || ruta.length < objetivo.pasos)) objetivo = { locationId: a.locationId, nombre: a.nombre, pasos: ruta.length };
      }
      if (!objetivo) return;
      const r = await crearViajero(tx, { saveId, factionId: f.id, tipo: TIPO_ASALTO, origenLocationId: casa, destinoLocationId: objetivo.locationId, dia, miembros: [{ genericos: van, rol: 'soldado' }] });
      if (!r.ok) return;
      await avisoDeViajero(tx, { saveId, factionId: null }, `${f.name} manda ${van} soldados contra ${objetivo.nombre}: estamos en guerra.`);
      salen++;
    });
  }
  return salen;
}
