// Economía de supervivencia del Reino (CR-53, hito 0.3 — Fase D, decisiones Q1-Q6 de la usuaria del
// 2026-10-06; Medieval Dynasty y D&D: cada boca bebe y come a diario, el pozo es la fuente de agua).
// Paso 53a: el agua que entra (pozos y fuente natural) y los topes del almacén por categoría.
import type { Prisma } from '@prisma/client';
import { CONSTRUCTION_RECIPES } from '../construction.js';
import { CONSUMO_COMIDA_POR_BOCA, escalonCocinaDe, type SuministrosDia } from '../kingdomTick.js';
import { comidaDelDia } from './comidaOficios.js';
import { estacionFor } from '../worldClock.js';
import { locationTerrainTags } from '../../scripts/worldCatalog.js';
import { ownerKeyFor } from '../reinoOwner.js';
import { volverASuPueblo } from './salidas.js';
import { avisarEnReino, recalcularPoblacion, rolDeSubdito, soltarPareja, tareasDelReino } from './subditos.js';
import { costeDePiezas, desgasteSemanal, EQUIPO, equipoDeAlta, gastarMateriales, piezasEnCasa, roturaSinPagar, talleresDelReino } from './facturaEquipo.js';

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

/// CR-61 (61c): lo que decide la comida del Reino y no cambia de un día a otro de un salto: cuántos
/// trabajadores hay en cada tarea, si hay agua junto al Ayuntamiento para pescar y el escalón de su
/// mejor Cocina. Se carga una vez por tick (QA-19).
export async function datosComidaDelReino(tx: Tx, saveId: string, ahora: number) {
  const [subditos, edificios] = await Promise.all([
    tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, select: { role: true, pueblo: true, nacidoEn: true, tarea: true, enMilicia: true } }),
    tx.building.findMany({ where: { saveId, status: 'ACTIVO' }, select: { recipeKey: true, status: true, tier: true, location: { select: { slug: true, name: true } } } }),
  ]);
  const ayuntamiento = edificios.find((b) => b.recipeKey && AYUNTAMIENTOS.has(b.recipeKey));
  return { tareas: tareasDelReino(subditos, ahora), hayAgua: !!ayuntamiento?.location && tieneFuenteNatural(ayuntamiento.location), escalonCocina: escalonCocinaDe(edificios) };
}

/// Puro: comida (con decimales) que dan en un día las tareas de los súbditos, con la estación de ese
/// día y la reserva que queda. Sin agua los pescadores recolectan; sin Cocina, los cocineros también.
/// `factor`: la parte que rinde (CR-58: quien no tiene herramienta produce la mitad). El tick reparte
/// las medias por número de día (`porcionDelDia`).
export function comidaDelReinoDia(
  datos: Awaited<ReturnType<typeof datosComidaDelReino>>,
  minutosDelDia: number,
  comidaDisponible: number,
  factor = 1,
): number {
  const { tareas, hayAgua, escalonCocina } = datos;
  const cuadrilla = {
    recolectores: tareas.recolector + (hayAgua ? 0 : tareas.pescador) + (escalonCocina ? 0 : tareas.cocinero),
    pescadores: hayAgua ? tareas.pescador : 0,
    cocineros: escalonCocina ? tareas.cocinero : 0,
    cazadores: 0,
  };
  return comidaDelDia(cuadrilla, { estacion: estacionFor(minutosDelDia), hayAgua, escalonCocina: escalonCocina || null, comidaDisponible }) * factor;
}

/// Las dos de arriba juntas, para un solo día.
export async function comidaDelReino(tx: Tx, saveId: string, ahora: number, comidaDisponible: number, factor = 1): Promise<number> {
  return comidaDelReinoDia(await datosComidaDelReino(tx, saveId, ahora), ahora, comidaDisponible, factor);
}

/// P279/P300: por qué la comida del Reino sube, baja o se queda plana. Puro: frases cortas para Visión general.
export function explicarComida(d: {
  comida: number; tope: number; bocas: { civiles: number; soldados: number; visitantes: number }; produccion: number; consumo: number;
  tareas: Record<string, number>; hayAyuntamiento: boolean; hayAgua: boolean; escalonCocina: number | null; factor: number;
}): string[] {
  const m: string[] = [];
  const trabajadores = Object.values(d.tareas).reduce((a, b) => a + b, 0);
  const bocas = d.bocas.civiles + d.bocas.soldados + d.bocas.visitantes;
  if (bocas === 0) m.push('Nadie come ahora mismo (sin súbditos, soldados ni visitantes): la comida no baja por consumo.');
  else if (trabajadores === 0) m.push(`Nadie produce comida: no hay trabajadores, y ${bocas === 1 ? 'la boca come' : `las ${bocas} bocas comen`} ${d.consumo} al día.`);
  if ((d.tareas.pescador ?? 0) > 0 && !d.hayAgua) {
    m.push(d.hayAyuntamiento
      ? 'Los pescadores no tienen agua junto al Ayuntamiento: recolectan en su lugar (2 al día en vez de 3).'
      : 'No hay Ayuntamiento activo, así que no hay agua para pescar: los pescadores recolectan en su lugar (2 al día en vez de 3).');
  }
  if ((d.tareas.cocinero ?? 0) > 0 && !d.escalonCocina) m.push('Los cocineros no tienen Cocina: recolectan en su lugar.');
  if (d.factor < 1 && trabajadores > 0) m.push('Hay trabajadores sin herramienta: producen la mitad.');
  const neto = Math.round((d.produccion - d.consumo) * 10) / 10;
  if (bocas > 0 && trabajadores > 0 && neto === 0) m.push('Los trabajadores producen justo lo que comen las bocas: por eso no sube ni baja.');
  if (d.tope > 0 && d.comida >= d.tope) m.push(`El almacén de comida está lleno (${d.tope}): lo que sobra se pierde. Un Granero sube el tope.`);
  return m;
}

/// CR-53 53b (Q2): materiales del Almacén del Reino = objetos de tipo RECURSO (leña, piedra, fibra…).
/// Cuántos caben aún (la base y lo que suman las Leñeras, menos lo que ya hay).
export async function huecoDeMateriales(tx: Tx, saveId: string): Promise<number> {
  const { tope, guardados } = await materialesDelAlmacen(tx, saveId);
  return Math.max(0, tope - guardados);
}

/// P276: el aviso cuando los materiales no caben. Sin Leñera activa, el edificio que falta; con una (o más),
/// el Almacén está lleno y no hay nada que construir para esto.
export function avisoMaterialesLlenos(lenerasActivas: number, c: { guardados: number; tope: number }): string {
  if (lenerasActivas <= 0) return `No caben más materiales en el Almacén (${c.guardados}/${c.tope}): construye una Leñera.`;
  const n = lenerasActivas === 1 ? 'tu Leñera' : `tus ${lenerasActivas} Leñeras`;
  return `El Almacén está lleno de materiales (${c.guardados}/${c.tope}), incluso con ${n}: gasta o retira alguno para hacer sitio.`;
}

/// Lo que dice el juego al depositar un material sin hueco.
export async function motivoMaterialesLlenos(tx: Tx, saveId: string): Promise<string> {
  const [lenerasActivas, almacen] = await Promise.all([
    tx.building.count({ where: { saveId, status: 'ACTIVO', recipeKey: 'lenera' } }),
    materialesDelAlmacen(tx, saveId),
  ]);
  return avisoMaterialesLlenos(lenerasActivas, almacen);
}

/// Slugs del catálogo que cuentan como materiales (tipo RECURSO) en el mundo de la partida.
export async function slugsDeMateriales(tx: Tx, saveId: string): Promise<Set<string>> {
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  return new Set((await tx.itemCatalog.findMany({ where: { worldId: save.worldId, tipo: 'RECURSO' }, select: { slug: true } })).map((r) => r.slug));
}

/// Materiales guardados y tope del Almacén (los guardados pueden pasar del tope en partidas viejas).
export async function materialesDelAlmacen(tx: Tx, saveId: string, sum?: { topeMateriales: number }): Promise<{ tope: number; guardados: number }> {
  const recursos = [...(await slugsDeMateriales(tx, saveId))];
  const [{ topeMateriales }, guardados] = await Promise.all([
    sum ?? suministrosDelReino(tx, saveId),
    tx.almacenItem.count({ where: { saveId, catalogSlug: { in: recursos } } }),
  ]);
  return { tope: topeMateriales, guardados };
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
    // CR-58: con los sueldos, el desgaste del equipo (y reponer lo roto, si alcanza).
    await liquidarEquipo(tx, saveId, k);
    return { pagado: total, desertor: null };
  }
  if ((tocaPagar || k.diasSinCobrar > 0) && total === 0) {
    await tx.kingdomStats.update({ where: { ownerKey }, data: { ultimoPagoSueldos: ahora, diasSinCobrar: 0 } });
    return { pagado: 0, desertor: null };
  }
  if (!tocaPagar && k.diasSinCobrar === 0) return { pagado: 0, desertor: null };
  // No alcanza: un día más sin cobrar, y el equipo de esta semana se gasta sin reponer (CR-58).
  if (tocaPagar) await romperEquipo(tx, saveId, k);
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
  const viudo = await soltarPareja(tx, saveId, quien.id);
  await avisarEnReino(tx, saveId, `${quien.name} deserta: no le pagabas.${viudo ? ` ${viudo} se queda sin pareja.` : ''}`, ahora);
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
  // Condicionado al saldo en la misma sentencia: dos traspasos a la vez no dejan nada en negativo.
  const sale = cantidad > 0
    ? await tx.save.updateMany({ where: { id: saveId, goirnos: { gte: cantidad } }, data: { goirnos: { decrement: cantidad } } })
    : await tx.kingdomStats.updateMany({ where: { ownerKey, riqueza: { gte: -cantidad } }, data: { riqueza: { increment: cantidad } } });
  if (sale.count === 0) return { ok: false, motivo: 'Ya no hay tantos Goirnos.' };
  const s = cantidad > 0
    ? await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { goirnos: true } })
    : await tx.save.update({ where: { id: saveId }, data: { goirnos: { decrement: cantidad } }, select: { goirnos: true } });
  const t = cantidad > 0
    ? await tx.kingdomStats.update({ where: { ownerKey }, data: { riqueza: { increment: cantidad } }, select: { riqueza: true } })
    : await tx.kingdomStats.findUniqueOrThrow({ where: { ownerKey }, select: { riqueza: true } });
  return { ok: true, bolsa: s.goirnos, tesoro: t.riqueza };
}

/// 53e: lo que enseña Visión general — agua al día, topes, tesoro, sueldos y avisos.
export async function resumenEconomia(tx: Tx, saveId: string) {
  const sum = await suministrosDelReino(tx, saveId);
  const [almacen, k, save, ws] = await Promise.all([
    materialesDelAlmacen(tx, saveId, sum),
    tx.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId }) }, select: { trabajadores: true, soldados: true, poblacion: true, visitantes: true, riqueza: true, diasSinCobrar: true, diasSed: true, diasHambre: true, sinHerramienta: true, sinArma: true } }),
    tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { goirnos: true } }),
    tx.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } }),
  ]);
  // La comida de un día como la calcula el tick (con la estación de hoy y la parte que rinde sin herramienta).
  const minutos = ws?.fictionalMinutes ?? 0;
  const datos = await datosComidaDelReino(tx, saveId, minutos);
  const factor = k && k.trabajadores > 0 ? Math.max(0, k.trabajadores - Math.ceil((k.sinHerramienta ?? 0) / 2)) / k.trabajadores : 1;
  const reservas = await tx.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId }) }, select: { comida: true, bebida: true } });
  const comidaActual = reservas?.comida ?? 0;
  const produccion = k ? Math.round(comidaDelReinoDia(datos, Math.floor(minutos / 1440) * 1440 + 720, comidaActual, factor) * 10) / 10 : 0;
  const bocasCifra = k ? k.poblacion + k.soldados + k.visitantes : 0;
  const hayAyuntamiento = (await tx.building.count({ where: { saveId, status: 'ACTIVO', recipeKey: { in: [...AYUNTAMIENTOS] } } })) > 0;
  return {
    comida: comidaActual,
    bebida: reservas?.bebida ?? 0,
    comidaProduccionDia: produccion,
    comidaConsumoDia: bocasCifra * CONSUMO_COMIDA_POR_BOCA,
    bocasDetalle: { civiles: k?.poblacion ?? 0, soldados: k?.soldados ?? 0, visitantes: k?.visitantes ?? 0 },
    motivosComida: k ? explicarComida({
      comida: comidaActual, tope: sum.topeComida, bocas: { civiles: k.poblacion, soldados: k.soldados, visitantes: k.visitantes },
      produccion, consumo: bocasCifra * CONSUMO_COMIDA_POR_BOCA, tareas: datos.tareas, hayAyuntamiento, hayAgua: datos.hayAgua, escalonCocina: datos.escalonCocina, factor,
    }) : [],
    aguaDia: sum.agua,
    bocas: bocasCifra,
    topeComida: sum.topeComida,
    topeBebida: sum.topeBebida,
    topeMateriales: sum.topeMateriales,
    materiales: almacen.guardados,
    sueldosSemana: k ? sueldosSemana(k) : 0,
    // CR-58: el desgaste del equipo de la semana (Goirnos lo comprado, materiales lo hecho en casa).
    ...(await (async () => {
      const equipo = k ? costeDePiezas(desgasteSemanal(k), piezasEnCasa(await talleresDelReino(tx, saveId))) : { goirnos: 0, materiales: 0 };
      return { equipoGoirnos: equipo.goirnos, equipoMateriales: equipo.materiales };
    })()),
    sinHerramienta: k?.sinHerramienta ?? 0,
    sinArma: k?.sinArma ?? 0,
    tesoro: k?.riqueza ?? 0,
    bolsa: save.goirnos,
    diasSinCobrar: k?.diasSinCobrar ?? 0,
    diasSed: k?.diasSed ?? 0,
    diasHambre: k?.diasHambre ?? 0,
  };
}

// ─────────────────────────── CR-58: el equipo en la factura ───────────────────────────

/// Paga el desgaste semanal del equipo (Goirnos lo comprado, materiales lo hecho en casa) y repone lo
/// roto si alcanza. Si no se puede pagar el desgaste, se rompe la parte de esa semana.
export async function liquidarEquipo(tx: Tx, saveId: string, c: { trabajadores: number; soldados: number }): Promise<{ goirnos: number; materiales: number; pagado: boolean }> {
  const ownerKey = ownerKeyFor({ saveId });
  const enCasa = piezasEnCasa(await talleresDelReino(tx, saveId));
  const coste = costeDePiezas(desgasteSemanal(c), enCasa);
  const k = await tx.kingdomStats.findUniqueOrThrow({ where: { ownerKey }, select: { riqueza: true, sinHerramienta: true, sinArma: true } });
  if (k.riqueza < coste.goirnos || !(await gastarMateriales(tx, saveId, coste.materiales))) {
    await romperEquipo(tx, saveId, c);
    return { ...coste, pagado: false };
  }
  let riqueza = k.riqueza - coste.goirnos;
  let { sinHerramienta, sinArma } = k;
  // Reponer: primero las armas (la defensa), luego las herramientas.
  for (const [pieza, falta] of [['arma', sinArma], ['herramienta', sinHerramienta]] as const) {
    if (falta <= 0) continue;
    const piezas = pieza === 'arma' ? { arma: falta * EQUIPO.arma.valor, armadura: falta * EQUIPO.armadura.valor } : { herramienta: falta * EQUIPO.herramienta.valor };
    const r = costeDePiezas(piezas, enCasa);
    if (riqueza < r.goirnos || !(await gastarMateriales(tx, saveId, r.materiales))) continue;
    riqueza -= r.goirnos;
    if (pieza === 'arma') sinArma = 0;
    else sinHerramienta = 0;
  }
  await tx.kingdomStats.update({ where: { ownerKey }, data: { riqueza, sinHerramienta, sinArma } });
  return { ...coste, pagado: true };
}

/// Una semana sin pagar el desgaste: se rompe 1/4 de las herramientas y 1/6 de las armas.
async function romperEquipo(tx: Tx, saveId: string, c: { trabajadores: number; soldados: number }): Promise<void> {
  const ownerKey = ownerKeyFor({ saveId });
  const k = await tx.kingdomStats.findUniqueOrThrow({ where: { ownerKey }, select: { sinHerramienta: true, sinArma: true } });
  const r = roturaSinPagar(c);
  await tx.kingdomStats.update({
    where: { ownerKey },
    data: { sinHerramienta: Math.min(c.trabajadores, k.sinHerramienta + r.sinHerramienta), sinArma: Math.min(c.soldados, k.sinArma + r.sinArma) },
  });
}

/// El equipo de alta de alguien que entra en un rol (acogido como trabajador, o pasado a soldado o
/// vigía). Si no se puede pagar, entra sin él.
export async function equiparAlta(tx: Tx, saveId: string, rol: 'trabajador' | 'soldado' | 'cazador'): Promise<boolean> {
  const ownerKey = ownerKeyFor({ saveId });
  const k = await tx.kingdomStats.findUnique({ where: { ownerKey }, select: { riqueza: true } });
  if (!k) return false;
  const coste = costeDePiezas(equipoDeAlta(rol), piezasEnCasa(await talleresDelReino(tx, saveId)));
  if (k.riqueza >= coste.goirnos && (await gastarMateriales(tx, saveId, coste.materiales))) {
    await tx.kingdomStats.update({ where: { ownerKey }, data: { riqueza: { decrement: coste.goirnos } } });
    return true;
  }
  await tx.kingdomStats.update({ where: { ownerKey }, data: rol === 'trabajador' ? { sinHerramienta: { increment: 1 } } : { sinArma: { increment: 1 } } });
  return false;
}
