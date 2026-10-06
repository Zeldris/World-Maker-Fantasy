// Economía de supervivencia del Reino (CR-53, hito 0.3 — Fase D, decisiones Q1-Q6 de la usuaria del
// 2026-10-06; Medieval Dynasty y D&D: cada boca bebe y come a diario, el pozo es la fuente de agua).
// Paso 53a: el agua que entra (pozos y fuente natural) y los topes del almacén por categoría.
import type { Prisma } from '@prisma/client';
import { CONSTRUCTION_RECIPES } from '../construction.js';
import type { SuministrosDia } from '../kingdomTick.js';
import { locationTerrainTags } from '../../scripts/worldCatalog.js';
import { ownerKeyFor } from '../reinoOwner.js';
import { volverASuPueblo } from './salidas.js';
import { recalcularPoblacion, rolDeSubdito } from './subditos.js';

type Tx = Prisma.TransactionClient;

/// Q2: lo que guarda el Reino sin ningún almacén (el Ayuntamiento o el campamento).
export const BASE_ALMACEN = { comida: 60, bebida: 60, materiales: 60 };
/// Q1: una fuente natural junto al Ayuntamiento (Los Manaderos, el Cauce, costa o agua) da esto al día.
export const AGUA_FUENTE_NATURAL_DIA = 20;
const AYUNTAMIENTOS = new Set(['ayuntamiento', 'ayuntamiento-mediano', 'ayuntamiento-grande']);

/// Puro: si un lugar tiene agua natural (por sus etiquetas de terreno o por su nombre).
export function tieneFuenteNatural(lugar: { slug: string; name: string }): boolean {
  const tags = locationTerrainTags[lugar.slug] ?? [];
  return tags.includes('acuatico') || tags.includes('costero') || /manadero|cauce/i.test(`${lugar.slug} ${lugar.name}`);
}

/// Puro: lo que suman los edificios activos del Reino (agua al día y topes).
export function suministrosDeEdificios(recipeKeys: (string | null)[], fuenteNatural: boolean): SuministrosDia & { topeMateriales: number } {
  const r = { agua: fuenteNatural ? AGUA_FUENTE_NATURAL_DIA : 0, topeComida: BASE_ALMACEN.comida, topeBebida: BASE_ALMACEN.bebida, topeMateriales: BASE_ALMACEN.materiales };
  for (const key of recipeKeys) {
    const s = CONSTRUCTION_RECIPES.find((x) => x.key === key)?.suministro;
    if (!s) continue;
    r.agua += s.aguaDia ?? 0;
    r.topeComida += s.topeComida ?? 0;
    r.topeBebida += s.topeBebida ?? 0;
    r.topeMateriales += s.topeMateriales ?? 0;
  }
  return r;
}

/// Lo que da hoy el Reino de la jugadora: edificios activos y fuente natural junto al Ayuntamiento.
export async function suministrosDelReino(tx: Tx, saveId: string) {
  const edificios = await tx.building.findMany({ where: { saveId, status: 'ACTIVO' }, select: { recipeKey: true, location: { select: { slug: true, name: true } } } });
  const ayuntamiento = edificios.find((b) => b.recipeKey && AYUNTAMIENTOS.has(b.recipeKey));
  return { ...suministrosDeEdificios(edificios.map((b) => b.recipeKey), !!ayuntamiento?.location && tieneFuenteNatural(ayuntamiento.location)), sueldosSemanales: true };
}

/// CR-53 53b (Q2): materiales del Almacén del Reino = objetos de tipo RECURSO (leña, piedra, fibra…).
/// Cuántos caben aún (la base y lo que suman las Leñeras, menos lo que ya hay).
export async function huecoDeMateriales(tx: Tx, saveId: string): Promise<number> {
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const recursos = (await tx.itemCatalog.findMany({ where: { worldId: save.worldId, tipo: 'RECURSO' }, select: { slug: true } })).map((r) => r.slug);
  const [{ topeMateriales }, guardados] = await Promise.all([
    suministrosDelReino(tx, saveId),
    tx.almacenItem.count({ where: { saveId, catalogSlug: { in: recursos } } }),
  ]);
  return Math.max(0, topeMateriales - guardados);
}

/// Si un objeto del catálogo cuenta como material (para no mirar el hueco con lo que no lo es).
export async function esMaterial(tx: Tx, saveId: string, catalogSlug: string | null): Promise<boolean> {
  if (!catalogSlug) return false;
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  return (await tx.itemCatalog.count({ where: { worldId: save.worldId, slug: catalogSlug, tipo: 'RECURSO' } })) > 0;
}

// ─────────────────────────── 53c: Goirnos y sueldos ───────────────────────────

/// Q3-Q5: el tesoro del Reino es `KingdomStats.riqueza` en Goirnos (1 = 1). Sueldos por semana.
export const SUELDO_TRABAJADOR_SEMANA = 2;
export const SUELDO_SOLDADO_SEMANA = 5;
export const FELICIDAD_SIN_COBRAR_DIA = 3;
export const DIAS_SIN_COBRAR_PARA_DESERTAR = 7;
const SEMANA = 7 * 1440;

/// Puro: lo que cuesta una semana de sueldos (soldados y vigías cobran como soldados).
export function sueldosSemana(c: { trabajadores: number; soldados: number }): number {
  return c.trabajadores * SUELDO_TRABAJADOR_SEMANA + c.soldados * SUELDO_SOLDADO_SEMANA;
}

/// Puro: tras `dias` sin cobrar, si toca que deserte alguien hoy (a los 7 días y luego cada semana).
export function tocaDesertar(diasSinCobrar: number): boolean {
  return diasSinCobrar >= DIAS_SIN_COBRAR_PARA_DESERTAR && (diasSinCobrar - DIAS_SIN_COBRAR_PARA_DESERTAR) % 7 === 0;
}

/// Un día del tesoro del Reino: cada semana se pagan los sueldos. Si no hay Goirnos, cada día sin
/// cobrar baja la felicidad 3 y, pasados 7 días, cada semana deserta un soldado (el más descontento),
/// que vuelve a su pueblo. En cuanto el tesoro alcanza, se paga lo debido y se acaba la deuda.
export async function revisarSueldos(tx: Tx, saveId: string, ahora: number): Promise<{ pagado: number; desertor: string | null }> {
  const ownerKey = ownerKeyFor({ saveId });
  const k = await tx.kingdomStats.findUnique({ where: { ownerKey }, select: { riqueza: true, trabajadores: true, soldados: true, felicidad: true, ultimoPagoSueldos: true, diasSinCobrar: true } });
  if (!k) return { pagado: 0, desertor: null };
  const total = sueldosSemana(k);
  const tocaPagar = k.ultimoPagoSueldos == null || ahora - k.ultimoPagoSueldos >= SEMANA;
  if ((tocaPagar || k.diasSinCobrar > 0) && total > 0 && k.riqueza >= total) {
    await tx.kingdomStats.update({ where: { ownerKey }, data: { riqueza: { decrement: total }, ultimoPagoSueldos: ahora, diasSinCobrar: 0 } });
    return { pagado: total, desertor: null };
  }
  if (tocaPagar && total === 0) {
    await tx.kingdomStats.update({ where: { ownerKey }, data: { ultimoPagoSueldos: ahora, diasSinCobrar: 0 } });
    return { pagado: 0, desertor: null };
  }
  if (!tocaPagar && k.diasSinCobrar === 0) return { pagado: 0, desertor: null };
  // No alcanza: un día más sin cobrar.
  const dias = k.diasSinCobrar + 1;
  await tx.kingdomStats.update({
    where: { ownerKey },
    data: { diasSinCobrar: dias, felicidad: Math.max(0, k.felicidad - FELICIDAD_SIN_COBRAR_DIA), ...(tocaPagar ? { ultimoPagoSueldos: ahora } : {}) },
  });
  if (!tocaDesertar(dias)) return { pagado: 0, desertor: null };
  const soldados = await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, orderBy: [{ felicidad: 'asc' }, { createdAt: 'asc' }], select: { id: true, name: true, role: true, pueblo: true, nacidoEn: true, felicidad: true, madreId: true, padreId: true, poblacionOrigenId: true } });
  const quien = soldados.find((s) => rolDeSubdito(s.role) === 'soldado' || rolDeSubdito(s.role) === 'vigia');
  if (!quien) return { pagado: 0, desertor: null };
  await tx.subject.update({ where: { id: quien.id }, data: { estado: 'SE_FUE', hastaMinutes: ahora, parejaId: null, notes: 'Desertó: no le pagabas.' } });
  await volverASuPueblo(tx, saveId, quien);
  await recalcularPoblacion(tx, saveId, ahora);
  return { pagado: 0, desertor: quien.id };
}

/// Q3: pasar Goirnos entre la bolsa del personaje (`Save.goirnos`) y el tesoro del Reino. Positivo:
/// de la bolsa al tesoro; negativo: del tesoro a la bolsa.
export async function traspasarGoirnos(tx: Tx, saveId: string, cantidad: number): Promise<{ ok: true; bolsa: number; tesoro: number } | { ok: false; motivo: string }> {
  const ownerKey = ownerKeyFor({ saveId });
  if (!Number.isInteger(cantidad) || cantidad === 0) return { ok: false, motivo: 'Di cuántos Goirnos.' };
  const [save, k] = await Promise.all([
    tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { goirnos: true } }),
    tx.kingdomStats.findUnique({ where: { ownerKey }, select: { riqueza: true } }),
  ]);
  if (!k) return { ok: false, motivo: 'Aún no tienes un Reino con tesoro.' };
  if (cantidad > 0 && save.goirnos < cantidad) return { ok: false, motivo: `Solo llevas ${save.goirnos} Goirnos.` };
  if (cantidad < 0 && k.riqueza < -cantidad) return { ok: false, motivo: `El tesoro solo tiene ${k.riqueza} Goirnos.` };
  const s = await tx.save.update({ where: { id: saveId }, data: { goirnos: { decrement: cantidad } }, select: { goirnos: true } });
  const t = await tx.kingdomStats.update({ where: { ownerKey }, data: { riqueza: { increment: cantidad } }, select: { riqueza: true } });
  return { ok: true, bolsa: s.goirnos, tesoro: t.riqueza };
}

/// 53e: lo que enseña Visión general — agua al día, topes, tesoro, sueldos y avisos.
export async function resumenEconomia(tx: Tx, saveId: string) {
  const [sum, hueco, k, save] = await Promise.all([
    suministrosDelReino(tx, saveId),
    huecoDeMateriales(tx, saveId),
    tx.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId }) }, select: { trabajadores: true, soldados: true, poblacion: true, visitantes: true, riqueza: true, diasSinCobrar: true, diasSed: true, diasHambre: true } }),
    tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { goirnos: true } }),
  ]);
  return {
    aguaDia: sum.agua,
    bocas: k ? k.poblacion + k.soldados + k.visitantes : 0,
    topeComida: sum.topeComida,
    topeBebida: sum.topeBebida,
    topeMateriales: sum.topeMateriales,
    materiales: sum.topeMateriales - hueco,
    sueldosSemana: k ? sueldosSemana(k) : 0,
    tesoro: k?.riqueza ?? 0,
    bolsa: save.goirnos,
    diasSinCobrar: k?.diasSinCobrar ?? 0,
    diasSed: k?.diasSed ?? 0,
    diasHambre: k?.diasHambre ?? 0,
  };
}
