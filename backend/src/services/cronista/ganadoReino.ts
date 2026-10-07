// Ganado del Reino de la jugadora (CR-55 paso 55c, hito 0.3). Un animal por fila (`Ganado`), en un
// corral (`Building` con `recipeKey: 'corrales'`, escalón en `tier`) de una sola especie (Q2). Los
// ganaderos y los trabajadores de la Fibrería son los compañeros asignados al edificio, como en
// cualquier otro edificio del Reino; nunca contaron en la comida pasiva de los súbditos (Q15).
// Reglas puras en `ganaderia.ts`.
import type { Prisma } from '@prisma/client';
import { CONSTRUCTION_RECIPES } from '../construction.js';
import { ownerKeyFor } from '../reinoOwner.js';
import { huecoDeMateriales, suministrosDelReino } from './economiaReino.js';
import { esAdultoSubdito, regionDelReino, rolDeSubdito } from './subditos.js';
import { esCompanero } from './usosFauna.js';
import { esDomador, FELICIDAD_UMBRAL_DOMADOR, maxSlotsDomadorFor } from '../companionSupervivencia.js';
import {
  comidaDe,
  consumoCorral,
  ESPECIES_GANADO,
  esGanado,
  etapaDe,
  etapasDe,
  factorSacrificio,
  fraccionQueMuere,
  hayPasto,
  muertesPorCarencia,
  plazasCorral,
  probMuerteDeViejoPorDia,
  produccionDelDia,
  tocaCria,
  valorCrudo,
  type Sexo,
} from './ganaderia.js';

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
  // CR-61 (61c): los súbditos con la tarea de ganadero se reparten por turno entre los corrales.
  const subditos = corrales.length === 0 ? [] : await subditosConTarea(tx, saveId, 'ganadero');
  return corrales.map((c, i) => ({
    id: c.id,
    name: c.name,
    escalon: c.tier ?? 1,
    plazas: plazasCorral(c.tier),
    especie: c.ganado[0]?.especie ?? null,
    animales: c.ganado,
    ganaderos: [...c.trabajadores, ...subditos.filter((_, k) => k % corrales.length === i)],
  }));
}

/// Súbditos trabajadores adultos con esa tarea (los ganaderos y fibreros del Reino, además de los
/// compañeros asignados al edificio).
async function subditosConTarea(tx: Tx, saveId: string, tarea: 'ganadero' | 'fibrero'): Promise<{ id: string; name: string }[]> {
  const ws = await tx.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } });
  const ahora = ws?.fictionalMinutes ?? 0;
  const filas = await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO', tarea }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, role: true, pueblo: true, nacidoEn: true } });
  return filas.filter((s) => rolDeSubdito(s.role) === 'trabajador' && esAdultoSubdito(s, ahora)).map((s) => ({ id: s.id, name: s.name }));
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
  // CR-61 (61c): y los súbditos fibreros, si hay alguna Fibrería en pie.
  const hayFibreria = await tx.building.count({ where: { saveId, recipeKey: RECETA_FIBRERIA, status: 'ACTIVO' } });
  const fibreros = hayFibreria ? (await subditosConTarea(tx, saveId, 'fibrero')).length : 0;
  return (trabajadores + fibreros) * porTrabajador;
}

/// Etapa de un animal del Reino en el minuto `ahora`.
export function etapaDelAnimal(a: { especie: string; nacidoEn: number }, faunaCategoria: string | null, ahora: number) {
  const edadDias = Math.max(0, Math.floor((ahora - a.nacidoEn) / 1440));
  return { edadDias, etapa: etapaDe(etapasDe(a.especie, faunaCategoria), edadDias) };
}

// ── 55d: avance diario ───────────────────────────────────────────────────────────────────────

export interface ResumenGanadoDia {
  comido: boolean;
  bebido: boolean;
  producido: Record<string, number>;
  comidaDeLeche: number;
  crias: number;
  muertos: number;
}

/// Un día del ganado del Reino (el día `dia` de la partida, `ahora` dentro de él):
/// 1. Las Fibrerías dan su forraje (hasta el tope compartido con la comida).
/// 2. Comen y beben de las reservas del Reino; si falta, cuentan los días sin comer o beber (Q6).
/// 3. Con todo comido y bebido, los adultos con ganadero producen (Q4, Q12): la comida cruda va a la
///    reserva de comida (Q15) y lo demás al Almacén, hasta su tope.
/// 4. Una vez por semana, cada corral con pareja adulta, plaza y comida tiene una cría.
/// 5. Mueren los que toque por hambre o sed (primero las crías) y de viejos.
export async function avanzarGanadoReino(tx: Tx, saveId: string, dia: number, ahora: number, random: () => number = Math.random): Promise<ResumenGanadoDia | null> {
  const owner = ownerKeyFor({ saveId });
  const stats = await tx.kingdomStats.findUnique({ where: { ownerKey: owner } });
  if (!stats) return null;
  const corrales = await corralesDelReino(tx, saveId);
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const sum = await suministrosDelReino(tx, saveId);

  // 1. Forraje de las Fibrerías.
  let forraje = Math.min(stats.forraje + (await forrajeDeFibrerias(tx, saveId)), Math.max(stats.forraje, sum.topeComida - stats.comida));
  const vacio: ResumenGanadoDia = { comido: true, bebido: true, producido: {}, comidaDeLeche: 0, crias: 0, muertos: 0 };
  const animales = corrales.flatMap((c) => c.animales);
  if (animales.length === 0) {
    if (forraje !== stats.forraje) await tx.kingdomStats.update({ where: { ownerKey: owner }, data: { forraje } });
    return vacio;
  }

  const especies = [...new Set(animales.map((a) => a.especie))];
  const fauna = await tx.npc.findMany({ where: { worldId, saveId: null, slug: { in: especies } }, select: { slug: true, faunaCategoria: true } });
  const categoria = new Map(fauna.map((f) => [f.slug, f.faunaCategoria]));
  const conEtapa = (a: CorralDelReino['animales'][number]) => ({ ...a, ...etapaDelAnimal(a, categoria.get(a.especie) ?? null, ahora) });

  // 2. Comer y beber.
  const todos = animales.map(conEtapa);
  // Pastoreo (55f): en una región con pasto natural los herbívoros comen la mitad.
  const pasto = hayPasto(await regionDelReino(tx, saveId));
  // Herbívoros (forraje) y carnívoros (comida) comen por separado: si falta carne, el Múrgol come igual
  // (revisión del PR de CR-55).
  const comoAnimal = (x: (typeof todos)[number]) => ({ a: { especie: x.especie, sexo: x.sexo as Sexo, edadDias: x.edadDias }, etapa: x.etapa });
  const esCarnivoro = (especie: string) => ESPECIES_GANADO[especie]?.dieta === 'CARNIVORO';
  const consumoHerb = consumoCorral(todos.filter((x) => !esCarnivoro(x.especie)).map(comoAnimal), dia, pasto);
  const consumoCarn = consumoCorral(todos.filter((x) => esCarnivoro(x.especie)).map(comoAnimal), dia, pasto);
  let comida = stats.comida;
  let bebida = stats.bebida;
  const comidoHerb = forraje >= consumoHerb.forraje;
  const comidoCarn = comida >= consumoCarn.comida;
  const comido = comidoHerb && comidoCarn;
  const agua = consumoHerb.agua + consumoCarn.agua;
  const bebido = bebida >= agua;
  forraje = Math.max(0, forraje - consumoHerb.forraje);
  comida = Math.max(0, comida - consumoCarn.comida);
  bebida = Math.max(0, bebida - agua);
  const diasSinComer = comido ? 0 : stats.ganadoDiasSinComer + 1;
  const diasSinBeber = bebido ? 0 : stats.ganadoDiasSinBeber + 1;
  const haComido = (especie: string) => (esCarnivoro(especie) ? comidoCarn : comidoHerb);
  const bienAtendido = (especie: string) => haComido(especie) && bebido;

  // 3. Producción de cada corral bien atendido.
  const producido: Record<string, number> = {};
  for (const c of corrales) {
    if (!c.especie || !bienAtendido(c.especie)) continue;
    const r = produccionDelDia(c.especie, c.animales.map((a) => conEtapa(a).etapa), c.ganaderos.length, dia, true);
    for (const [slug, n] of Object.entries(r)) producido[slug] = (producido[slug] ?? 0) + n;
  }
  let comidaDeLeche = 0;
  const slugs = Object.keys(producido);
  if (slugs.length > 0) {
    const catalogo = await tx.itemCatalog.findMany({ where: { worldId, slug: { in: slugs } }, select: { slug: true, name: true, description: true, category: true, curaHambre: true } });
    let hueco = await huecoDeMateriales(tx, saveId);
    for (const it of catalogo) {
      const n = producido[it.slug] ?? 0;
      if (it.category === 'alimento') {
        // Q15: lo comestible crudo alimenta según su valor.
        comidaDeLeche += comidaDe(valorCrudo(it.slug, it.curaHambre), n);
        continue;
      }
      const cabe = Math.min(n, hueco);
      hueco -= cabe;
      if (cabe > 0) await tx.almacenItem.createMany({ data: Array.from({ length: cabe }, () => ({ saveId, name: it.name, description: it.description, catalogSlug: it.slug })) });
    }
    // El Granero se comparte con el forraje (Q7).
    comida = Math.max(comida, Math.min(sum.topeComida - forraje, comida + comidaDeLeche));
  }

  // 4. Muertes: de hambre (solo los de la dieta que no ha comido, primero las crías), de sed (todos) y
  //    de viejos.
  const muertos = new Set<string>();
  const porEdad = (xs: typeof todos) => [...xs].sort((a, b) => (a.etapa === 'CRIA' ? 0 : 1) - (b.etapa === 'CRIA' ? 0 : 1) || b.edadDias - a.edadDias);
  const hambrientos = todos.filter((x) => !haComido(x.especie));
  for (const x of porEdad(hambrientos).slice(0, muertesPorCarencia(hambrientos.length, fraccionQueMuere(diasSinComer, 0)))) muertos.add(x.id);
  const sedientos = porEdad(todos.filter((x) => !muertos.has(x.id)));
  for (const x of sedientos.slice(0, muertesPorCarencia(sedientos.length, fraccionQueMuere(0, diasSinBeber)))) muertos.add(x.id);
  for (const x of todos) {
    if (muertos.has(x.id)) continue;
    if (random() < probMuerteDeViejoPorDia(etapasDe(x.especie, categoria.get(x.especie) ?? null), x.edadDias)) muertos.add(x.id);
  }
  if (muertos.size > 0) await tx.ganado.deleteMany({ where: { id: { in: [...muertos] } } });

  // 5. Crías, una vez por semana, con los que siguen vivos.
  let crias = 0;
  if (dia % 7 === 0) {
    for (const c of corrales) {
      if (!c.especie || !bienAtendido(c.especie)) continue;
      const vivos = c.animales.filter((a) => !muertos.has(a.id)).map((a) => comoAnimal(conEtapa(a)));
      if (!tocaCria(vivos, c.plazas, true)) continue;
      await tx.ganado.create({ data: { saveId, buildingId: c.id, especie: c.especie, sexo: random() < 0.5 ? 'M' : 'F', nacidoEn: ahora } });
      crias++;
    }
  }

  await tx.kingdomStats.update({ where: { ownerKey: owner }, data: { forraje, comida, bebida, ganadoDiasSinComer: diasSinComer, ganadoDiasSinBeber: diasSinBeber } });
  return { comido, bebido, producido, comidaDeLeche, crias, muertos: muertos.size };
}

// ── 55e: sacrificar ──────────────────────────────────────────────────────────────────────────

/// Sacrificar un animal del corral (Q8): da lo mismo que desollarlo, por su etapa (`factorSacrificio`).
/// Lo comestible va a la comida del Reino por su valor (Q15); lo demás, al Almacén hasta su tope. Sin
/// Desolladero en el Reino, la piel, el hueso y el resto salen a la mitad.
export async function sacrificar(tx: Tx, saveId: string, ganadoId: string, ahora: number): Promise<
  { ok: true; comida: number; almacen: Record<string, number>; perdido: number } | { ok: false; motivo: string }
> {
  const animal = await tx.ganado.findFirst({ where: { id: ganadoId, saveId } });
  if (!animal) return { ok: false, motivo: 'Ese animal no está en tus corrales.' };
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const especie = await tx.npc.findFirst({ where: { worldId, saveId: null, slug: animal.especie }, select: { faunaCategoria: true } });
  const { etapa } = etapaDelAnimal(animal, especie?.faunaCategoria ?? null, ahora);
  const factor = factorSacrificio(etapa);
  if (factor === 0) return { ok: false, motivo: 'Es una cría: todavía no da nada.' };

  const conDesolladero = (await tx.building.count({ where: { saveId, recipeKey: 'desolladero', status: 'ACTIVO' } })) > 0;
  const rendimientos = await tx.harvestYield.findMany({ where: { worldId, sourceSlug: animal.especie }, select: { cantidad: true, item: { select: { slug: true, name: true, description: true, category: true, curaHambre: true } } } });
  let comida = 0;
  const almacen: Record<string, number> = {};
  let perdido = 0;
  let hueco = await huecoDeMateriales(tx, saveId);
  for (const r of rendimientos) {
    const comestible = r.item.category === 'alimento' || (r.item.curaHambre ?? 0) > 0;
    const n = Math.floor(r.cantidad * factor * (comestible || conDesolladero ? 1 : 0.5));
    if (n <= 0) continue;
    if (comestible) {
      comida += comidaDe(valorCrudo(r.item.slug, r.item.curaHambre), n);
      continue;
    }
    const cabe = Math.min(n, hueco);
    hueco -= cabe;
    perdido += n - cabe;
    if (cabe > 0) {
      await tx.almacenItem.createMany({ data: Array.from({ length: cabe }, () => ({ saveId, name: r.item.name, description: r.item.description, catalogSlug: r.item.slug })) });
      almacen[r.item.slug] = (almacen[r.item.slug] ?? 0) + cabe;
    }
  }
  await tx.ganado.delete({ where: { id: animal.id } });
  if (comida > 0) {
    const owner = ownerKeyFor({ saveId });
    const stats = await tx.kingdomStats.findUnique({ where: { ownerKey: owner }, select: { comida: true, forraje: true } });
    if (stats) {
      // El Granero se comparte con el forraje (Q7).
      const { topeComida } = await suministrosDelReino(tx, saveId);
      await tx.kingdomStats.update({ where: { ownerKey: owner }, data: { comida: Math.max(stats.comida, Math.min(topeComida - stats.forraje, stats.comida + comida)) } });
    }
  }
  return { ok: true, comida, almacen, perdido };
}

// ── CR-56 (56b): la Domadora saca animales del corral ────────────────────────────────────────

/// «Llevar contigo» (Q4): la jugadora Domadora con su hueco de Domador libre saca del corral un adulto
/// de una especie de compañero, que pasa a ser su compañero animal (conserva sexo y nacimiento).
export async function llevarConsigo(tx: Tx, saveId: string, ganadoId: string, ahora: number): Promise<{ ok: true; companionId: string } | { ok: false; motivo: string }> {
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true, clase: true, especializacion: true, level: true } });
  if (!esDomador(save.clase, save.especializacion)) return { ok: false, motivo: 'Solo un Domador puede llevarse un animal del corral.' };
  const animal = await tx.ganado.findFirst({ where: { id: ganadoId, saveId } });
  if (!animal) return { ok: false, motivo: 'Ese animal no está en tus corrales.' };
  if (!esCompanero(animal.especie)) return { ok: false, motivo: 'Este animal no sirve de compañero.' };
  const npc = await tx.npc.findFirst({ where: { worldId: save.worldId, saveId: null, slug: animal.especie }, select: { name: true, faunaCategoria: true, attributes: true } });
  if (!npc) return { ok: false, motivo: 'Especie desconocida.' };
  if (etapaDelAnimal(animal, npc.faunaCategoria, ahora).etapa !== 'ADULTO') return { ok: false, motivo: 'Solo un adulto puede acompañarte.' };
  const usados = await tx.companion.count({ where: { saveId, esSlotDomador: true } });
  if (usados >= maxSlotsDomadorFor(save.clase, save.especializacion, save.level)) return { ok: false, motivo: 'Ya llevas contigo todos los animales que puede guiar un Domador.' };
  const c = await tx.companion.create({
    data: {
      saveId, name: npc.name, role: 'mascota', notes: '', tipo: 'FAUNA', sourceSlug: animal.especie, felicidad: FELICIDAD_UMBRAL_DOMADOR,
      esSlotDomador: true, attributes: npc.attributes as object, sexo: animal.sexo, nacidoEn: animal.nacidoEn,
    },
  });
  await tx.ganado.delete({ where: { id: animal.id } });
  return { ok: true, companionId: c.id };
}

/// «Devolver al corral» (Q4): un compañero animal de especie de ganado vuelve a un corral de su especie
/// (o a uno vacío), con su sexo y su nacimiento.
export async function devolverAlCorral(tx: Tx, saveId: string, companionId: string, ahora: number, random: () => number = Math.random): Promise<{ ok: true; buildingId: string } | { ok: false; motivo: string }> {
  const c = await tx.companion.findFirst({ where: { id: companionId, saveId, tipo: 'FAUNA' } });
  if (!c?.sourceSlug || !esGanado(c.sourceSlug)) return { ok: false, motivo: 'Este compañero no se cría en corral.' };
  if (c.condicionFisica === 'MUERTO') return { ok: false, motivo: `${c.name} está muerto.` };
  if (await tx.combatParticipant.count({ where: { companionId: c.id, encounter: { estado: 'EN_CURSO' } } })) return { ok: false, motivo: `${c.name} está en un combate.` };
  const corral = elegirCorral(await corralesDelReino(tx, saveId), c.sourceSlug);
  if ('motivo' in corral) return { ok: false, motivo: corral.motivo };
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const npc = await tx.npc.findFirst({ where: { worldId, saveId: null, slug: c.sourceSlug }, select: { faunaCategoria: true } });
  const e = etapasDe(c.sourceSlug, npc?.faunaCategoria ?? null);
  await tx.ganado.create({
    data: { saveId, buildingId: corral.id, especie: c.sourceSlug, sexo: c.sexo ?? (random() < 0.5 ? 'M' : 'F'), nacidoEn: c.nacidoEn ?? ahora - e.adulto * 1440 },
  });
  await tx.companion.delete({ where: { id: c.id } });
  return { ok: true, buildingId: corral.id };
}
