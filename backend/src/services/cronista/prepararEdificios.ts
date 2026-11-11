// P369/P378/P301 (2026-11-03): pasos de preparación sobre el estado de los edificios del Reino, SOLO con las funciones del
// juego (QA-151): `repararEdificio` (`asaltos.ts`, la del botón «Reparar» de Reino › Edificios: cuesta materiales del
// Almacén) y el efecto `danarEdificio` (`efectos.ts`, el de las tormentas: deja DANADO, escribe el suceso y avisa en el
// diario del Reino). Los usan `prepararReino.ts` (`reparar`, `danar:<receta>`) y `avanzarDias.ts` (`--reparar`).
import type { PrismaClient } from '@prisma/client';
import { repararEdificio } from '../asaltos.js';
import { aplicarEfecto } from './efectos.js';

export type ResultadoReparar = { reparados: { nombre: string; coste: number }[]; sinReparar: { nombre: string; motivo: string; coste?: number; falta?: number }[] };

/// P383: lo que falta para reparar uno que se quedó sin materiales (el Almacén guarda un solo tipo de cuenta: «materiales»).
export function textoSinReparar(x: ResultadoReparar['sinReparar'][number]): string {
  return x.falta != null && x.coste != null ? `faltan ${x.falta} materiales (cuesta ${x.coste}, en el Almacén hay ${x.coste - x.falta}): ${x.motivo}` : x.motivo;
}

/// Repara cada edificio DANADO del Reino (y cada Empalizada caída) con `repararEdificio`, uno por transacción: si faltan
/// materiales para uno, queda en `sinReparar` con el motivo y se sigue con los demás (lo ya reparado no se deshace).
export async function repararDanados(prisma: PrismaClient, saveId: string): Promise<ResultadoReparar> {
  const danados = await prisma.building.findMany({
    where: { saveId, OR: [{ status: 'DANADO' }, { status: 'ACTIVO', caida: true }] },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  const r: ResultadoReparar = { reparados: [], sinReparar: [] };
  for (const b of danados) {
    const res = await prisma.$transaction((tx) => repararEdificio(tx, saveId, b.id));
    if (res.ok) r.reparados.push({ nombre: b.name, coste: res.coste });
    else r.sinReparar.push({ nombre: b.name, motivo: res.motivo, coste: res.coste, falta: res.falta });
  }
  return r;
}

/// Deja DANADO el edificio ACTIVO más antiguo de esa receta, con el efecto `danarEdificio` de las tormentas.
export async function danarEdificioDeReceta(prisma: PrismaClient, { saveId, receta }: { saveId: string; receta: string }): Promise<{ nombre: string } | { error: string }> {
  const [save, ws] = await Promise.all([prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } }), prisma.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } })]);
  if (!save || !ws) return { error: `danar: no hay partida ${saveId} con reloj.` };
  const b = await prisma.building.findFirst({ where: { saveId, recipeKey: receta, status: 'ACTIVO' }, select: { id: true, name: true }, orderBy: { createdAt: 'asc' } });
  if (!b) return { error: `danar: no hay ningún edificio «${receta}» activo (dar-reino edificio:${receta}).` };
  const res = await prisma.$transaction((tx) => aplicarEfecto({ tx, saveId, worldId: save.worldId, fictionalMinutes: ws.fictionalMinutes, origen: 'MOTOR' }, { tipo: 'danarEdificio', buildingId: b.id, causa: 'una tormenta' }));
  if (!res.aplicado) return { error: `danar: no se pudo dañar ${b.name}.` };
  return { nombre: b.name };
}
