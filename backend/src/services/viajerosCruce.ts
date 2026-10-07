// Cruzarse con viajeros (CR-63 paso 63e, hito 0.3 — decisión Q9 de la ronda de detalle y ADR 0003).
// Los viajeros se ven en el mapa de Berig (por el tramo por el que van, con las expediciones) y, en el
// lugar donde está el personaje, como «De paso por aquí»:
//
// - Preguntar: cuentan qué han visto en cada lugar por el que pasaron, con el día.
// - Comerciar: una partida de caza vende la carne de sus piezas, ya desollada, al precio del catálogo.
// - Órdenes: con las tuyas, las de siempre (`partidasReino.ordenarPartida`).
import type { Prisma } from '@prisma/client';
import { enlacesDelMundo, JORNADA_MINUTOS, minutosTramo, rutaMasCorta, type EntradaDiario, type Enlace } from './viajeros.js';
import type { ExpedicionEnMapa } from './expedicionesMapa.js';
import { conocer } from './cronista/difusion.js';
import { GRID_COLS, GRID_ROWS, pixelDeCelda } from './zonaPosicion.js';
import { comidaDe, valorCrudo } from './cronista/ganaderia.js';

type Tx = Prisma.TransactionClient;

const exterior = (slug: string) => slug.replace(/-interior$/, '');
/// Q9: rumores que te pasa un viajero al preguntarle, como mucho.
export const MAX_RUMORES_DE_VIAJERO = 2;
const NOMBRE_TIPO: Record<string, string> = { CAZA: 'partida de caza', CAPTURA: 'partida de captura' };

/// Puro: días que le faltan para volver a casa (ida que quede + un día en el destino + vuelta).
export function diasParaVolver(enlaces: Enlace[], v: { estado: string; ubicacionLocationId: string; ruta: string[]; minutosEnTramo: number; origenLocationId: string; destinoLocationId: string }): number {
  const sumar = (desde: string, ruta: string[]) => ruta.reduce((s, l, i) => s + minutosTramo(enlaces, i === 0 ? desde : ruta[i - 1]!, l), 0);
  const quedaRuta = Math.max(0, sumar(v.ubicacionLocationId, v.ruta) - v.minutosEnTramo);
  if (v.estado === 'VUELTA') return Math.ceil(quedaRuta / JORNADA_MINUTOS);
  const vuelta = sumar(v.destinoLocationId, rutaMasCorta(enlaces, v.destinoLocationId, v.origenLocationId) ?? []);
  return Math.ceil(quedaRuta / JORNADA_MINUTOS) + 1 + Math.ceil(vuelta / JORNADA_MINUTOS);
}

/// En el mapa de Berig: los viajeros de la partida que el personaje puede ver (los del Reino, los de
/// facciones aliadas y los de su región), con la forma de una expedición: del lugar en que están al
/// siguiente de su ruta, con lo andado del tramo.
export async function viajerosEnMapa(tx: Tx, saveId: string, ctx: { dia: number; regionActual: string | null; aliadas: Set<string> }): Promise<ExpedicionEnMapa[]> {
  const viajeros = await tx.viajero.findMany({
    where: { saveId, estado: { not: 'TERMINADO' } },
    include: { faction: { select: { name: true } }, ubicacion: { select: { slug: true, name: true, region: true } }, destino: { select: { name: true } }, origen: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (viajeros.length === 0) return [];
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const enlaces = await enlacesDelMundo(tx, worldId);
  const siguientes = await tx.location.findMany({ where: { id: { in: viajeros.map((v) => v.ruta[0]).filter((x): x is string => !!x) } }, select: { id: true, slug: true } });
  const out: ExpedicionEnMapa[] = [];
  for (const v of viajeros) {
    const delReino = !v.factionId;
    if (!delReino && !(v.factionId && ctx.aliadas.has(v.factionId)) && v.ubicacion.region !== ctx.regionActual) continue;
    const siguiente = siguientes.find((s) => s.id === v.ruta[0]);
    const tramo = siguiente ? minutosTramo(enlaces, v.ubicacionLocationId, siguiente.id) : 0;
    const fraccion = siguiente && tramo > 0 ? Math.min(1, v.minutosEnTramo / tramo) : 0;
    out.push({
      id: v.id,
      faccion: v.faction?.name ?? 'tu Reino',
      oficio: `${NOMBRE_TIPO[v.tipo] ?? 'viajeros'}${v.estado === 'VUELTA' ? ', de vuelta' : ''}`,
      motivo: null,
      origenSlug: exterior(v.ubicacion.slug),
      destinoSlug: exterior(siguiente?.slug ?? v.ubicacion.slug),
      destinoNombre: v.estado === 'VUELTA' ? v.origen.name : v.destino.name,
      diaRegreso: ctx.dia + diasParaVolver(enlaces, v),
      progreso: fraccion / 2,
      delReino,
    });
  }
  return out;
}

/// «De paso por aquí»: los viajeros que están ahora en el lugar del personaje.
export async function viajerosAqui(tx: Tx, saveId: string) {
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { currentLocationId: true, worldId: true } });
  if (!save.currentLocationId) return [];
  const filas = await tx.viajero.findMany({
    where: { saveId, estado: { not: 'TERMINADO' }, ubicacionLocationId: save.currentLocationId },
    include: { faction: { select: { name: true } }, miembros: true },
    orderBy: { createdAt: 'asc' },
  });
  const fauna = new Map((await tx.npc.findMany({ where: { worldId: save.worldId, saveId: null, slug: { in: filas.map((f) => f.objetivo ?? '') } }, select: { slug: true, name: true } })).map((n) => [n.slug, n.name]));
  return filas.map((v) => {
    const carga = v.carga as { piezas?: number } | null;
    return {
      id: v.id,
      propia: !v.factionId,
      quien: v.faction?.name ?? 'tu Reino',
      tipo: v.tipo,
      que: `${NOMBRE_TIPO[v.tipo] ?? 'viajeros'}${v.objetivo ? ` de ${fauna.get(v.objetivo) ?? v.objetivo}` : ''}`,
      estado: v.estado,
      gente: v.miembros.reduce((s, m) => s + (m.genericos > 0 ? m.genericos : 1), 0),
      piezas: carga?.piezas ?? 0,
    };
  });
}

async function viajeroAqui(tx: Tx, saveId: string, id: string) {
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { currentLocationId: true, worldId: true, goirnos: true } });
  const v = await tx.viajero.findFirst({ where: { id, saveId, estado: { not: 'TERMINADO' }, ubicacionLocationId: save.currentLocationId ?? '' }, include: { faction: { select: { name: true } } } });
  return v ? { v, save } : null;
}

/// Q9 «Preguntar»: qué ha visto en cada lugar por el que pasó (los 6 últimos), con el día.
export async function preguntarAViajero(tx: Tx, saveId: string, id: string): Promise<{ ok: true; lineas: string[] } | { ok: false; motivo: string }> {
  const aqui = await viajeroAqui(tx, saveId, id);
  if (!aqui) return { ok: false, motivo: 'Ya no están aquí.' };
  const diario = ((aqui.v.diario as unknown as EntradaDiario[] | null) ?? []).filter((e) => e.vio).slice(-6);
  const lugares = new Map((await tx.location.findMany({ where: { id: { in: diario.map((e) => e.locationId) } }, select: { id: true, name: true } })).map((l) => [l.id, l.name]));
  const slugs = [...new Set(diario.flatMap((e) => e.vio!.fauna.map((f) => f.slug)))];
  const fauna = new Map((await tx.npc.findMany({ where: { worldId: aqui.save.worldId, saveId: null, slug: { in: slugs } }, select: { slug: true, name: true } })).map((n) => [n.slug, n.name]));
  const lineas = diario.map((e) => {
    const vio = e.vio!;
    const animales = vio.fauna.length > 0 ? vio.fauna.map((f) => `${f.cantidad} ${fauna.get(f.slug) ?? f.slug}`).join(', ') : 'ni rastro de caza';
    const otros = vio.viajeros > 0 ? `; se cruzaron con ${vio.viajeros} grupo${vio.viajeros === 1 ? '' : 's'} más` : '';
    return `Día ${e.dia + 1}, ${lugares.get(e.locationId) ?? 'un sitio'}: ${animales}${otros}.`;
  });
  if (lineas.length === 0) lineas.push('Acaban de salir: aún no han visto nada que contar.');
  // Q9: lo que pasó en los lugares por los que han pasado, desde que salieron, llega como rumor
  // (sistema de rumores de la Fase E del 0.2); como mucho dos que aún no sepas.
  const ws0 = await tx.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } });
  const pasados = [...new Set(((aqui.v.diario as unknown as EntradaDiario[] | null) ?? []).map((e) => e.locationId))];
  const sucesos = await tx.suceso.findMany({
    where: { saveId, locationId: { in: pasados }, fictionalMinutes: { gte: aqui.v.diaSalida * 1440 }, conocimientos: { none: { saveId } } },
    orderBy: [{ importancia: 'desc' }, { fictionalMinutes: 'desc' }],
    take: MAX_RUMORES_DE_VIAJERO,
    select: { id: true, locationId: true },
  });
  const regionDe = new Map((await tx.location.findMany({ where: { id: { in: pasados } }, select: { id: true, region: true } })).map((l) => [l.id, l.region]));
  let rumores = 0;
  for (const s of sucesos) {
    const r = await conocer(tx, { saveId, sucesoId: s.id, via: 'NPC', confirmado: false, minutos: ws0?.fictionalMinutes ?? 0, escribirNoticia: true, region: regionDe.get(s.locationId ?? '') ?? null, fuente: aqui.v.faction ? `partida de ${aqui.v.faction.name}` : 'tu partida' });
    if (r) rumores++;
  }
  if (rumores > 0) lineas.push(`Y te cuentan ${rumores === 1 ? 'algo que ha pasado' : `${rumores} cosas que han pasado`} por allí (en «El mundo»).`);
  const ws = await tx.worldState.findUnique({ where: { saveId }, select: { fictionalDateLabel: true, fictionalMinutes: true } });
  await tx.logEntry.create({ data: { saveId, channel: 'CHARACTER', isSystemMessage: true, text: `La ${aqui.v.faction ? `partida de ${aqui.v.faction.name}` : 'partida'} cuenta lo que ha visto:\n${lineas.join('\n')}`, timeLabel: ws?.fictionalDateLabel ?? '', fictionalMinutes: ws?.fictionalMinutes ?? undefined } });
  return { ok: true, lineas };
}

/// Q9 «Comerciar»: una partida de caza que trae piezas te vende la carne de una, ya desollada, al
/// precio del catálogo (lo comestible que da esa especie). Va a tu bolsa.
export async function comprarCarneAViajero(tx: Tx, saveId: string, id: string): Promise<{ ok: true; items: string[]; precio: number } | { ok: false; motivo: string }> {
  const aqui = await viajeroAqui(tx, saveId, id);
  if (!aqui) return { ok: false, motivo: 'Ya no están aquí.' };
  if (!aqui.v.factionId) return { ok: false, motivo: 'Es tu partida: lo que traen ya es tuyo.' };
  const carga = aqui.v.carga as { especie?: string; piezas?: number } | null;
  if (!carga?.especie || !carga.piezas) return { ok: false, motivo: 'No llevan nada que vender.' };
  const rendimientos = await tx.harvestYield.findMany({ where: { worldId: aqui.save.worldId, sourceSlug: carga.especie }, select: { cantidad: true, item: { select: { slug: true, name: true, description: true, category: true, curaHambre: true, valorGoirnos: true } } } });
  const carne = rendimientos.filter((r) => r.item.category === 'alimento' || (r.item.curaHambre ?? 0) > 0);
  if (carne.length === 0) return { ok: false, motivo: 'Lo que llevan no se come.' };
  const precio = carne.reduce((s, r) => s + r.cantidad * Math.max(1, r.item.valorGoirnos ?? 1), 0);
  // Cobro condicionado al saldo en la misma sentencia (dos clics no dejan la bolsa en negativo).
  const { count } = await tx.save.updateMany({ where: { id: saveId, goirnos: { gte: precio } }, data: { goirnos: { decrement: precio } } });
  if (count === 0) return { ok: false, motivo: `No te llega: piden ${precio} Goirnos.` };
  // Condicionado a que nadie haya comprado entre medias (dos compras a la vez no pagan dos y quitan una).
  const { count: hay } = await tx.viajero.updateMany({ where: { id, carga: { path: ['piezas'], equals: carga.piezas } }, data: { carga: { ...carga, piezas: carga.piezas - 1 } as Prisma.InputJsonValue } });
  if (hay === 0) throw new Error('La pieza ya se vendió');
  const items: string[] = [];
  for (const r of carne) {
    for (let i = 0; i < r.cantidad; i++) {
      await tx.inventoryItem.create({ data: { saveId, name: r.item.name, description: r.item.description, catalogSlug: r.item.slug } });
      items.push(r.item.name);
    }
  }
  await tx.kingdomStats.updateMany({ where: { factionId: aqui.v.factionId }, data: { riqueza: { increment: precio } } });
  return { ok: true, items, precio };
}

/// Q9 «Comerciar» (vender): le vendes a una partida de otra facción algo de comer de tu bolsa, al
/// precio del catálogo; lo paga su facción (si le llega) y va a su comida.
export async function venderAViajero(tx: Tx, saveId: string, id: string, itemId: string): Promise<{ ok: true; precio: number } | { ok: false; motivo: string }> {
  const aqui = await viajeroAqui(tx, saveId, id);
  if (!aqui) return { ok: false, motivo: 'Ya no están aquí.' };
  if (!aqui.v.factionId) return { ok: false, motivo: 'Es tu partida: no se le vende.' };
  const item = await tx.inventoryItem.findFirst({ where: { id: itemId, saveId, slot: null }, select: { id: true, name: true, catalogSlug: true } });
  if (!item?.catalogSlug) return { ok: false, motivo: 'Eso no lo llevas en la bolsa.' };
  const cat = await tx.itemCatalog.findFirst({ where: { worldId: aqui.save.worldId, slug: item.catalogSlug }, select: { category: true, curaHambre: true, valorGoirnos: true } });
  if (!cat || !(cat.category === 'alimento' || (cat.curaHambre ?? 0) > 0)) return { ok: false, motivo: 'Solo compran comida.' };
  const precio = Math.max(1, cat.valorGoirnos ?? 1);
  const { count } = await tx.kingdomStats.updateMany({ where: { factionId: aqui.v.factionId, riqueza: { gte: precio } }, data: { riqueza: { decrement: precio }, comida: { increment: comidaDe(valorCrudo(item.catalogSlug, cat.curaHambre), 1) } } });
  if (count === 0) return { ok: false, motivo: 'No tienen con qué pagarte.' };
  await tx.inventoryItem.delete({ where: { id: item.id } });
  await tx.save.update({ where: { id: saveId }, data: { goirnos: { increment: precio } } });
  return { ok: true, precio };
}

/// Lo que puedes venderle a una partida: la comida de tu bolsa (sin equipar), con su precio.
export async function comidaVendible(tx: Tx, saveId: string): Promise<{ id: string; name: string; precio: number }[]> {
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const items = await tx.inventoryItem.findMany({ where: { saveId, slot: null, catalogSlug: { not: null } }, select: { id: true, name: true, catalogSlug: true }, orderBy: { name: 'asc' } });
  const cat = new Map((await tx.itemCatalog.findMany({ where: { worldId: save.worldId, slug: { in: items.map((i) => i.catalogSlug!) } }, select: { slug: true, category: true, curaHambre: true, valorGoirnos: true } })).map((c) => [c.slug, c]));
  return items
    .filter((i) => { const c = cat.get(i.catalogSlug!); return !!c && (c.category === 'alimento' || (c.curaHambre ?? 0) > 0); })
    .map((i) => ({ id: i.id, name: i.name, precio: Math.max(1, cat.get(i.catalogSlug!)!.valorGoirnos ?? 1) }));
}

/// Puro (63e): celda fija de un viajero en el mapa de zona (sale de su id; lejos de los bordes).
export function posicionEnZona(id: string): { x: number; y: number } {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pixelDeCelda({ col: 2 + (h % (GRID_COLS - 4)), row: 2 + ((h >>> 8) % (GRID_ROWS - 4)) });
}
