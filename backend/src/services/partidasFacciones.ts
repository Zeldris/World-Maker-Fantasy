// Partidas de caza de las facciones (CR-63 paso 63g, hito 0.3 — decisiones Q10 y Q12 de la ronda de
// detalle; prototipo `docs/prototipos/cr-63-comida-facciones.html`). Las facciones cazan con el mismo
// motor que el Reino (ADR 0003):
//
// - Solo salen si les sobra comida (Q12, opción a): 7 días de reserva o más. Una partida rinde el
//   40-50 % que sus cazadores en agregado y la comida llega a golpes; una facción al límite no se
//   arriesga, como la IA de X4.
// - Partidas de 8 cazadores genéricos, como mucho 4 en marcha por facción; el resto de sus cazadores
//   sigue en agregado (`factionEconomy.ts` descuenta los que están fuera).
// - Van a la zona de su región con más fauna cazable a la vista, con orden permanente; al volver, sus
//   piezas se desuellan solas y lo comestible va a su comida. Si la reserva baja de 7 días, no repiten.
import type { Prisma, PrismaClient } from '@prisma/client';
import { CAZA_AGREGADA } from './cronista/comidaOficios.js';
import { comidaDe, valorCrudo } from './cronista/ganaderia.js';
import { crearViajero, enlacesDelMundo, rutaMasCorta, type ViajeroFila } from './viajeros.js';

type Tx = Prisma.TransactionClient;

export const MAX_PARTIDAS_FACCION = 4;
export const CAZADORES_POR_PARTIDA = 8;
/// Q12: días de reserva de comida que necesita una facción para mandar (o repetir) una partida.
export const DIAS_RESERVA_PARA_CAZAR = 7;

const enMarcha = { estado: { not: 'TERMINADO' } };

/// Puro: días que le dura la reserva a una facción.
export function diasDeReservaFaccion(k: { comida: number; poblacion: number; soldados: number; visitantes: number }): number {
  const bocas = k.poblacion + k.soldados + k.visitantes;
  return bocas > 0 ? k.comida / bocas : Infinity;
}

/// Cazadores de una facción que están fuera con sus partidas (no cazan en agregado).
export async function cazadoresFuera(tx: Tx, factionId: string): Promise<number> {
  const r = await tx.viajeroMiembro.aggregate({ where: { viajero: { factionId, ...enMarcha } }, _sum: { genericos: true } });
  return r._sum.genericos ?? 0;
}

/// Comida que dan las piezas de una partida de facción al volver (lo comestible de cada animal).
export async function comidaDePiezas(tx: Tx, worldId: string, especie: string, piezas: number): Promise<number> {
  if (piezas <= 0) return 0;
  const rendimientos = await tx.harvestYield.findMany({ where: { worldId, sourceSlug: especie }, select: { cantidad: true, item: { select: { slug: true, category: true, curaHambre: true } } } });
  return rendimientos
    .filter((r) => r.item.category === 'alimento' || (r.item.curaHambre ?? 0) > 0)
    .reduce((s, r) => s + comidaDe(valorCrudo(r.item.slug, r.item.curaHambre), r.cantidad * piezas), 0);
}

/// Al volver una partida de facción: sus piezas, desolladas, a su comida.
export async function descargarCazaFaccion(tx: Tx, v: ViajeroFila): Promise<number> {
  const carga = v.carga as { especie?: string; piezas?: number } | null;
  if (!v.factionId || !carga?.especie || !carga.piezas) return 0;
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: v.saveId }, select: { worldId: true } });
  const comida = await comidaDePiezas(tx, worldId, carga.especie, carga.piezas);
  if (comida > 0) await tx.kingdomStats.updateMany({ where: { factionId: v.factionId }, data: { comida: { increment: comida } } });
  return comida;
}

/// Q12: ¿puede repetir (o salir) una partida de esta facción?
export async function faccionPuedeCazar(tx: Tx, factionId: string): Promise<boolean> {
  const k = await tx.kingdomStats.findFirst({ where: { factionId }, select: { comida: true, poblacion: true, soldados: true, visitantes: true } });
  return !!k && diasDeReservaFaccion(k) >= DIAS_RESERVA_PARA_CAZAR;
}

/// El coto de su región: el lugar con más fauna cazable a la vista (con camino desde casa) y su especie
/// más numerosa.
async function cotoDeFaccion(tx: Tx, saveId: string, worldId: string, casaId: string, region: string): Promise<{ locationId: string; especie: string } | null> {
  const cazables = new Set((await tx.harvestYield.findMany({ where: { worldId, metodoObtencion: 'CAZA', item: { OR: [{ category: 'alimento' }, { curaHambre: { gt: 0 } }] } }, select: { sourceSlug: true } })).map((h) => h.sourceSlug));
  const puntos = await tx.zonePoint.findMany({ where: { saveId, tipo: 'FAUNA', activo: true, cantidad: { gt: 0 }, location: { region } }, select: { locationId: true, targetSlug: true, cantidad: true } });
  const enlaces = await enlacesDelMundo(tx, worldId);
  let mejor: { locationId: string; especie: string; cantidad: number } | null = null;
  for (const p of puntos) {
    if (!cazables.has(p.targetSlug) || rutaMasCorta(enlaces, casaId, p.locationId) === null) continue;
    if (!mejor || p.cantidad > mejor.cantidad || (p.cantidad === mejor.cantidad && p.locationId < mejor.locationId)) mejor = { locationId: p.locationId, especie: p.targetSlug, cantidad: p.cantidad };
  }
  return mejor && { locationId: mejor.locationId, especie: mejor.especie };
}

/// Un día: cada facción que caza (orcos, Faerus) y tiene comida de sobra manda una partida más si le
/// caben y le quedan cazadores en agregado. Devuelve cuántas salen.
export async function lanzarPartidasDeFacciones(prisma: PrismaClient, saveId: string, dia: number): Promise<number> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
  if (!save) return 0;
  const facciones = await prisma.faction.findMany({
    where: { saveId, disueltaEn: null, origenSlug: { not: null }, raza: { in: Object.keys(CAZA_AGREGADA) } },
    select: { id: true, raza: true, kingdomStats: true, buildings: { where: { locationId: { not: null } }, select: { location: { select: { id: true, region: true } } }, take: 1 } },
    orderBy: { id: 'asc' },
  });
  let salen = 0;
  for (const f of facciones) {
    const k = f.kingdomStats;
    const casa = f.buildings[0]?.location;
    if (!k || !casa || diasDeReservaFaccion(k) < DIAS_RESERVA_PARA_CAZAR) continue;
    await prisma.$transaction(async (tx) => {
      if ((await tx.viajero.count({ where: { factionId: f.id, ...enMarcha } })) >= MAX_PARTIDAS_FACCION) return;
      const cazadores = Math.round(k.trabajadores * (CAZA_AGREGADA[f.raza ?? ''] ?? 0));
      if (cazadores - (await cazadoresFuera(tx, f.id)) < CAZADORES_POR_PARTIDA) return;
      const coto = await cotoDeFaccion(tx, saveId, save.worldId, casa.id, casa.region);
      if (!coto) return;
      const r = await crearViajero(tx, {
        saveId, factionId: f.id, tipo: 'CAZA', objetivo: coto.especie, origenLocationId: casa.id, destinoLocationId: coto.locationId, dia,
        orden: { repetir: true }, miembros: [{ genericos: CAZADORES_POR_PARTIDA, rol: 'cazador' }],
      });
      if (r.ok) salen++;
    });
  }
  return salen;
}
