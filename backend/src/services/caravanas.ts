// Caravanas del Reino (CR-47 paso 47b, hito 0.2). Cada día de la partida:
// 1. Las órdenes permanentes del Mercado que toque (falta o sobra) sacan una caravana hacia una
//    facción con tratado o alianza: si compra, lleva la riqueza; si vende, la mercancía.
// 2. La que llega comercia unidad a unidad (`comercioVolumen.ts`, como X4): compra lo que puede
//    pagar del almacén de la facción, o vende lo que la facción puede pagar.
// 3. La que vuelve deja en el Reino lo comprado o lo cobrado, y lo que no vendió.
// 47c: al llegar, si la región del destino tiene otro dueño en guerra o en tensión con el Reino, la
// caravana puede caer en un asalto (mismo riesgo que las expediciones de facción): pierde la carga.
import type { Prisma, PrismaClient } from '@prisma/client';
import { cotizarCompra, cotizarVenta, diasDeCamino, unidadesDeOrden, type TipoOrden } from './comercioVolumen.js';
import { buildAdjacency, shortestPath } from './travel.js';
import { MERCADO_RECIPE_KEY } from './construction.js';
import { riesgoIntercepcion, seIntercepta } from './factionExpeditions.js';
import type { FactionRelationType } from '@prisma/client';

type Tx = Prisma.TransactionClient;

const exteriorDe = (slug: string) => slug.replace(/-interior$/, '');

/// Facciones con tratado o alianza con el Reino.
async function sociosDelReino(db: Tx | PrismaClient, reinoId: string): Promise<string[]> {
  const rel = await db.factionRelation.findMany({
    where: { type: { in: ['ALIANZA', 'TRATADO_COMERCIAL'] }, OR: [{ sourceFactionId: reinoId }, { targetFactionId: reinoId }] },
    select: { sourceFactionId: true, targetFactionId: true },
  });
  return rel.map((r) => (r.sourceFactionId === reinoId ? r.targetFactionId : r.sourceFactionId));
}

/// Dónde está el asentamiento de una facción (exterior, para el camino).
async function asentamientoDe(db: Tx | PrismaClient, worldId: string, factionId: string): Promise<{ id: string; slug: string } | null> {
  const b = await db.building.findFirst({ where: { factionId, locationId: { not: null } }, select: { location: { select: { slug: true } } } });
  if (!b?.location) return null;
  return db.location.findFirst({ where: { worldId, slug: exteriorDe(b.location.slug) }, select: { id: true, slug: true } });
}

async function minutosEntre(db: Tx | PrismaClient, worldId: string, desde: string, hasta: string): Promise<number> {
  const links = await db.locationLink.findMany({ where: { from: { worldId } }, select: { fromId: true, toId: true, minutosBase: true } });
  return shortestPath(buildAdjacency(links), desde, hasta)?.totalMinutos ?? 0;
}

const stockDe = (db: Tx, donde: { saveId: string } | { factionId: string }, catalogSlug: string) =>
  db.almacenItem.count({ where: { ...donde, catalogSlug } });

/// Crea `n` unidades de un objeto del catálogo en un almacén (del Reino o de una facción).
async function meterEnAlmacen(tx: Tx, worldId: string, donde: { saveId: string } | { factionId: string }, catalogSlug: string, n: number) {
  if (n <= 0) return;
  const item = await tx.itemCatalog.findFirst({ where: { worldId, slug: catalogSlug }, select: { name: true, description: true, statBonuses: true } });
  if (!item) return;
  await tx.almacenItem.createMany({
    data: Array.from({ length: n }, () => ({ ...donde, name: item.name, description: item.description, statBonuses: item.statBonuses ?? undefined, catalogSlug })),
  });
}

/// Saca `n` unidades de un almacén; devuelve cuántas salieron.
async function sacarDeAlmacen(tx: Tx, donde: { saveId: string } | { factionId: string }, catalogSlug: string, n: number): Promise<number> {
  if (n <= 0) return 0;
  const filas = await tx.almacenItem.findMany({ where: { ...donde, catalogSlug }, select: { id: true }, take: n, orderBy: { createdAt: 'asc' } });
  await tx.almacenItem.deleteMany({ where: { id: { in: filas.map((f) => f.id) } } });
  return filas.length;
}

async function registrarEnReino(tx: Tx, saveId: string, text: string) {
  const ws = await tx.worldState.findUnique({ where: { saveId }, select: { fictionalDateLabel: true, fictionalMinutes: true } });
  await tx.logEntry.create({ data: { saveId, channel: 'KINGDOM', isSystemMessage: true, text, timeLabel: ws?.fictionalDateLabel ?? '', fictionalMinutes: ws?.fictionalMinutes ?? undefined } });
}

/// 47e: el lugar por donde pasa ahora una caravana de fondo de `faccion` (punto «Caravana de …» de
/// `oportunidades.ts`) en la región del Mercado, o null.
async function caravanaDeFondoCerca(db: Tx | PrismaClient, saveId: string, faccion: string, mercadoLocationId: string): Promise<{ id: string; slug: string } | null> {
  const mercado = await db.location.findUnique({ where: { id: mercadoLocationId }, select: { region: true } });
  if (!mercado) return null;
  const punto = await db.zonePoint.findFirst({
    where: { saveId, activo: true, label: `Caravana de ${faccion}`, location: { region: mercado.region } },
    select: { location: { select: { id: true, slug: true } } },
  });
  return punto?.location ?? null;
}

export interface ResultadoComercio {
  salen: number;
  comercian: number;
  vuelven: number;
  asaltadas: number;
}

/// Relación del Reino con cada otra facción (por nombre), la de más riesgo si hay dos.
async function relacionesDelReino(db: Tx | PrismaClient, reinoId: string): Promise<Map<string, FactionRelationType>> {
  const rel = await db.factionRelation.findMany({
    where: { OR: [{ sourceFactionId: reinoId }, { targetFactionId: reinoId }] },
    select: { type: true, sourceFaction: { select: { id: true, name: true } }, targetFaction: { select: { id: true, name: true } } },
  });
  const m = new Map<string, FactionRelationType>();
  const peso: Partial<Record<FactionRelationType, number>> = { GUERRA: 2, TENSION: 1 };
  for (const r of rel) {
    const otra = r.sourceFaction.id === reinoId ? r.targetFaction.name : r.sourceFaction.name;
    if ((peso[r.type] ?? 0) >= (peso[m.get(otra)!] ?? 0)) m.set(otra, r.type);
  }
  return m;
}

/// Un día de comercio de la partida (idempotente por día: cada caravana avanza por su estado).
export async function avanzarComercio(prisma: PrismaClient, saveId: string, dia: number, random: () => number = Math.random): Promise<ResultadoComercio> {
  const resultado: ResultadoComercio = { salen: 0, comercian: 0, vuelven: 0, asaltadas: 0 };
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
  const reino = await prisma.faction.findFirst({ where: { saveId, origenSlug: null, disueltaEn: null }, select: { id: true, name: true } });
  if (!save || !reino) return resultado;
  const { worldId } = save;

  // 3. Vuelven.
  for (const c of await prisma.caravana.findMany({ where: { saveId, status: 'VOLVIENDO', diaRegreso: { lte: dia } }, include: { faction: { select: { name: true } } } })) {
    await prisma.$transaction(async (tx) => {
      const fresca = await tx.caravana.updateMany({ where: { id: c.id, status: 'VOLVIENDO' }, data: { status: 'TERMINADA' } });
      if (fresca.count === 0) return;
      if (c.riqueza > 0) await tx.kingdomStats.update({ where: { saveId }, data: { riqueza: { increment: c.riqueza } } });
      await meterEnAlmacen(tx, worldId, { saveId }, c.catalogSlug, c.traidas);
      const item = (await tx.itemCatalog.findFirst({ where: { worldId, slug: c.catalogSlug }, select: { name: true } }))?.name ?? c.catalogSlug;
      await registrarEnReino(
        tx,
        saveId,
        c.tipo === 'COMPRA'
          ? `Vuelve la caravana de ${c.faction.name}: trae ${c.traidas} de ${item}${c.riqueza > 0 ? ` y ${c.riqueza} de riqueza sin gastar` : ''}.`
          : `Vuelve la caravana de ${c.faction.name}: ${c.riqueza} de riqueza por ${item}${c.traidas > 0 ? ` (${c.traidas} sin vender)` : ''}.`,
      );
    });
    resultado.vuelven++;
  }

  // 2. Llegan y comercian (o caen en un asalto).
  const relaciones = await relacionesDelReino(prisma, reino.id);
  for (const c of await prisma.caravana.findMany({ where: { saveId, status: 'EN_CAMINO', diaLlegada: { lte: dia } }, include: { destino: { select: { region: true, name: true } }, faction: { select: { name: true } } } })) {
    if (!c.local && seIntercepta(riesgoIntercepcion(c.destino.region, reino.name, relaciones), random())) {
      await prisma.$transaction(async (tx) => {
        const fresca = await tx.caravana.updateMany({ where: { id: c.id, status: 'EN_CAMINO' }, data: { status: 'ASALTADA', riqueza: 0, traidas: 0 } });
        if (fresca.count === 0) return;
        await registrarEnReino(tx, saveId, `Asaltan la caravana que iba a ${c.faction.name} cerca de ${c.destino.name}: se pierde todo lo que llevaba.`);
      });
      resultado.asaltadas++;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      const fresca = await tx.caravana.updateMany({ where: { id: c.id, status: 'EN_CAMINO' }, data: { status: 'VOLVIENDO' } });
      if (fresca.count === 0) return;
      const valor = (await tx.itemCatalog.findFirst({ where: { worldId, slug: c.catalogSlug }, select: { valorGoirnos: true } }))?.valorGoirnos ?? 0;
      const statsFaccion = await tx.kingdomStats.findUnique({ where: { factionId: c.factionId }, select: { riqueza: true } });
      if (c.tipo === 'COMPRA') {
        const stock = await stockDe(tx, { factionId: c.factionId }, c.catalogSlug);
        const { unidades, coste } = cotizarCompra(valor, stock, c.unidades, c.riqueza);
        const sacadas = await sacarDeAlmacen(tx, { factionId: c.factionId }, c.catalogSlug, unidades);
        if (statsFaccion && coste > 0) await tx.kingdomStats.update({ where: { factionId: c.factionId }, data: { riqueza: { increment: coste } } });
        await tx.caravana.update({ where: { id: c.id }, data: { traidas: sacadas, riqueza: c.riqueza - coste } });
      } else {
        const stock = await stockDe(tx, { factionId: c.factionId }, c.catalogSlug);
        // La facción compra lo que puede pagar.
        let vendidas = c.unidades;
        while (vendidas > 0 && statsFaccion && cotizarVenta(valor, stock, vendidas) > statsFaccion.riqueza) vendidas--;
        if (!statsFaccion) vendidas = 0;
        const ingreso = cotizarVenta(valor, stock, vendidas);
        await meterEnAlmacen(tx, worldId, { factionId: c.factionId }, c.catalogSlug, vendidas);
        if (ingreso > 0) await tx.kingdomStats.update({ where: { factionId: c.factionId }, data: { riqueza: { decrement: ingreso } } });
        await tx.caravana.update({ where: { id: c.id }, data: { riqueza: ingreso, traidas: c.unidades - vendidas } });
      }
    });
    resultado.comercian++;
  }

  // 1. Salen las que toque.
  const mercado = await prisma.building.findFirst({ where: { saveId, recipeKey: MERCADO_RECIPE_KEY, status: 'ACTIVO', locationId: { not: null } }, select: { locationId: true } });
  if (!mercado?.locationId) return resultado;
  const socios = new Set(await sociosDelReino(prisma, reino.id));
  if (socios.size === 0) return resultado;
  const ordenes = await prisma.ordenComercio.findMany({ where: { saveId, activa: true }, include: { caravanas: { where: { status: { in: ['EN_CAMINO', 'VOLVIENDO'] } }, select: { id: true } } } });
  for (const orden of ordenes) {
    if (orden.caravanas.length > 0) continue;
    await prisma.$transaction(async (tx) => {
      const stockReino = await stockDe(tx, { saveId }, orden.catalogSlug);
      const unidades = unidadesDeOrden({ tipo: orden.tipo as TipoOrden, umbral: orden.umbral, lote: orden.lote }, stockReino);
      if (unidades === 0) return;
      // Socio: el preferido si tiene trato; si no, el primero que tenga trato (y género, si compra).
      const candidatos = await tx.faction.findMany({ where: { id: { in: [...socios] }, disueltaEn: null }, select: { id: true, slug: true, name: true } });
      const ordenados = [...candidatos].sort((a, b) => Number(b.slug === orden.factionSlug) - Number(a.slug === orden.factionSlug));
      let socio: (typeof candidatos)[number] | undefined;
      for (const f of ordenados) {
        if (orden.tipo === 'COMPRA' && (await stockDe(tx, { factionId: f.id }, orden.catalogSlug)) === 0) continue;
        socio = f;
        break;
      }
      if (!socio) return;
      // 47e: si una caravana del socio (narrador de fondo) pasa por la región del Mercado, se comercia
      // con ella allí mismo: ida y vuelta en el día y sin riesgo de asalto.
      const cercana = await caravanaDeFondoCerca(tx, saveId, socio.name, mercado.locationId!);
      const destino = cercana ?? (await asentamientoDe(tx, worldId, socio.id));
      if (!destino) return;
      const dias = cercana ? 0 : diasDeCamino(await minutosEntre(tx, worldId, mercado.locationId!, destino.id));
      let riqueza = 0;
      let carga = unidades;
      if (orden.tipo === 'COMPRA') {
        const stats = await tx.kingdomStats.findUnique({ where: { saveId }, select: { riqueza: true } });
        const valor = (await tx.itemCatalog.findFirst({ where: { worldId, slug: orden.catalogSlug }, select: { valorGoirnos: true } }))?.valorGoirnos ?? 0;
        const stockSocio = await stockDe(tx, { factionId: socio.id }, orden.catalogSlug);
        riqueza = Math.min(stats?.riqueza ?? 0, cotizarCompra(valor, stockSocio, unidades).coste);
        if (riqueza <= 0) return;
        await tx.kingdomStats.update({ where: { saveId }, data: { riqueza: { decrement: riqueza } } });
      } else {
        carga = await sacarDeAlmacen(tx, { saveId }, orden.catalogSlug, unidades);
        if (carga === 0) return;
      }
      await tx.caravana.create({
        data: {
          saveId, ordenId: orden.id, factionId: socio.id, destinoLocationId: destino.id, tipo: orden.tipo, catalogSlug: orden.catalogSlug,
          unidades: carga, riqueza, diaSalida: dia, diaLlegada: dia + Math.max(1, dias), diaRegreso: dia + Math.max(1, 2 * dias), local: !!cercana,
        },
      });
      const item = (await tx.itemCatalog.findFirst({ where: { worldId, slug: orden.catalogSlug }, select: { name: true } }))?.name ?? orden.catalogSlug;
      await registrarEnReino(
        tx,
        saveId,
        cercana
          ? `La caravana de ${socio.name} pasa cerca del Mercado: mañana se ${orden.tipo === 'COMPRA' ? 'le compra' : 'le vende'} ${item} (hasta ${carga}) sin salir de la región.`
          : `Sale una caravana hacia ${socio.name} a ${orden.tipo === 'COMPRA' ? 'comprar' : 'vender'} ${carga} de ${item}; vuelve en ${2 * dias} días.`,
      );
      resultado.salen++;
    });
  }
  return resultado;
}
