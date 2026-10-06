// Ganado del Reino de la jugadora (CR-55 paso 55c, hito 0.3). Un animal por fila (`Ganado`), en un
// corral (`Building` con `recipeKey: 'corrales'`, escalón en `tier`) de una sola especie (Q2). Los
// ganaderos y los trabajadores de la Fibrería son los compañeros asignados al edificio, como en
// cualquier otro edificio del Reino; nunca contaron en la comida pasiva de los súbditos (Q15).
// Reglas puras en `ganaderia.ts`.
import type { Prisma } from '@prisma/client';
import { CONSTRUCTION_RECIPES } from '../construction.js';
import { ownerKeyFor } from '../reinoOwner.js';
import { suministrosDelReino } from './economiaReino.js';
import { ESPECIES_GANADO, esGanado, etapaDe, etapasDe, plazasCorral, type Sexo } from './ganaderia.js';

type Tx = Prisma.TransactionClient;

export const RECETA_CORRAL = 'corrales';
export const RECETA_FIBRERIA = 'fibreria';
/// Q7: forraje por cada pasto entregado.
export const FORRAJE_POR_PASTO = 2;
export const PASTOS = new Set(['pasto-solar', 'pasto-de-sangre']);

export interface CorralDelReino {
  id: string;
  name: string;
  escalon: number;
  plazas: number;
  especie: string | null;
  animales: { id: string; especie: string; sexo: string; nacidoEn: number }[];
  ganaderos: { id: string; name: string }[];
}

export async function corralesDelReino(tx: Tx, saveId: string): Promise<CorralDelReino[]> {
  const corrales = await tx.building.findMany({
    where: { saveId, recipeKey: RECETA_CORRAL, status: 'ACTIVO' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      tier: true,
      ganado: { orderBy: { nacidoEn: 'asc' }, select: { id: true, especie: true, sexo: true, nacidoEn: true } },
      trabajadores: { where: { rolReino: { not: null } }, select: { id: true, name: true } },
    },
  });
  return corrales.map((c) => ({
    id: c.id,
    name: c.name,
    escalon: c.tier ?? 1,
    plazas: plazasCorral(c.tier),
    especie: c.ganado[0]?.especie ?? null,
    animales: c.ganado,
    ganaderos: c.trabajadores,
  }));
}

/// Corral donde cabe un animal de `especie`: el que ya guarda esa especie con plaza libre o, si no,
/// uno vacío, y siempre de su escalón mínimo (la Gargantúa solo en Gran obrador).
export function elegirCorral(corrales: CorralDelReino[], especie: string, buildingId?: string): CorralDelReino | { motivo: string } {
  const esp = ESPECIES_GANADO[especie];
  if (!esp) return { motivo: 'Este animal no se cría en corral.' };
  const candidatos = corrales.filter((c) => !buildingId || c.id === buildingId);
  if (candidatos.length === 0) return { motivo: 'No tienes ningún corral del Ganadero.' };
  const validos = candidatos.filter((c) => c.escalon >= esp.escalonMinimo);
  if (validos.length === 0) return { motivo: 'Necesita un corral más grande (Gran obrador).' };
  const conHueco = validos.filter((c) => c.animales.length < c.plazas);
  const mismo = conHueco.find((c) => c.especie === especie);
  if (mismo) return mismo;
  const vacio = conHueco.find((c) => c.especie === null);
  if (vacio) return vacio;
  return { motivo: 'No hay plaza: cada corral guarda una sola especie y los tuyos están llenos u ocupados por otra.' };
}

/// Mete en un corral un animal domesticado (adulto joven: recién entrado en la edad adulta). El sexo
/// sale al azar.
export async function meterEnCorral(
  tx: Tx,
  saveId: string,
  especie: { slug: string; faunaCategoria: string | null },
  ahora: number,
  random: () => number = Math.random,
  buildingId?: string,
): Promise<{ ok: true; ganadoId: string; buildingId: string; sexo: Sexo } | { ok: false; motivo: string }> {
  if (!esGanado(especie.slug)) return { ok: false, motivo: 'Este animal no se cría en corral.' };
  const corral = elegirCorral(await corralesDelReino(tx, saveId), especie.slug, buildingId);
  if ('motivo' in corral) return { ok: false, motivo: corral.motivo };
  const e = etapasDe(especie.slug, especie.faunaCategoria);
  // Recién adulto, con hasta una estación de más.
  const edadDias = e.adulto + Math.floor(random() * 30);
  const sexo: Sexo = random() < 0.5 ? 'M' : 'F';
  const creado = await tx.ganado.create({ data: { saveId, buildingId: corral.id, especie: especie.slug, sexo, nacidoEn: ahora - edadDias * 1440 } });
  return { ok: true, ganadoId: creado.id, buildingId: corral.id, sexo };
}

/// Tope de forraje: el de la comida (Granero), compartido con ella (Q7).
export async function huecoDeForraje(tx: Tx, saveId: string): Promise<number> {
  const stats = await tx.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId }) }, select: { comida: true, forraje: true } });
  if (!stats) return 0;
  const { topeComida } = await suministrosDelReino(tx, saveId);
  return Math.max(0, topeComida - stats.comida - stats.forraje);
}

/// Entrega todos los pastos de un tipo que lleva el personaje: 2 de forraje cada uno, hasta el tope.
export async function entregarPastos(tx: Tx, saveId: string, catalogSlug: string): Promise<{ ok: true; entregados: number; forraje: number } | { ok: false; motivo: string }> {
  if (!PASTOS.has(catalogSlug)) return { ok: false, motivo: 'Eso no sirve de forraje.' };
  const stats = await tx.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId }) }, select: { forraje: true } });
  if (!stats) return { ok: false, motivo: 'Aún no has fundado tu Reino.' };
  const hueco = await huecoDeForraje(tx, saveId);
  const caben = Math.floor(hueco / FORRAJE_POR_PASTO);
  if (caben <= 0) return { ok: false, motivo: 'El Granero está lleno.' };
  const pastos = await tx.inventoryItem.findMany({ where: { saveId, catalogSlug, slot: null }, select: { id: true }, take: caben });
  if (pastos.length === 0) return { ok: false, motivo: 'No llevas ese pasto.' };
  await tx.inventoryItem.deleteMany({ where: { id: { in: pastos.map((p) => p.id) } } });
  const forraje = stats.forraje + pastos.length * FORRAJE_POR_PASTO;
  await tx.kingdomStats.update({ where: { ownerKey: ownerKeyFor({ saveId }) }, data: { forraje } });
  return { ok: true, entregados: pastos.length, forraje };
}

/// Forraje que dan hoy las Fibrerías: 10 por trabajador asignado.
export async function forrajeDeFibrerias(tx: Tx, saveId: string): Promise<number> {
  const porTrabajador = CONSTRUCTION_RECIPES.find((r) => r.key === RECETA_FIBRERIA)?.suministro?.forrajePorTrabajador ?? 0;
  const trabajadores = await tx.companion.count({ where: { saveId, rolReino: { not: null }, building: { recipeKey: RECETA_FIBRERIA, status: 'ACTIVO' } } });
  return trabajadores * porTrabajador;
}

/// Etapa de un animal del Reino en el minuto `ahora`.
export function etapaDelAnimal(a: { especie: string; nacidoEn: number }, faunaCategoria: string | null, ahora: number) {
  const edadDias = Math.max(0, Math.floor((ahora - a.nacidoEn) / 1440));
  return { edadDias, etapa: etapaDe(etapasDe(a.especie, faunaCategoria), edadDias) };
}
