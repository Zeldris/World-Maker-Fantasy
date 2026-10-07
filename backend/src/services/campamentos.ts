// CR-50 (hito 0.3, Fase E, paso 50a): campamentos de bandidos con base de datos — aparición (Q2) y
// refuerzos (Q3). Reglas y semillas en `cronista/campamentosBandidos.ts`. Cada campamento tiene su
// punto en el mapa de zona (tipo NPC, con la `cantidad` de su banda), así que atacarlo en vivo usa el
// combate de varios de `CR-49` sin nada más.
import type { Prisma, PrismaClient } from '@prisma/client';
import { elegirOcupante, genteInicial, ocupanteDe, refuerzos, regionesConCampamentos, tocaCampamento, TOPE_MAX_CAMPAMENTO } from './cronista/campamentosBandidos.js';
import { posicionEnZona } from './viajerosCruce.js';
import { registrarSuceso } from './cronista/sucesos.js';
import { slugify } from '../lib/slugify.js';
import { asentamientosDelReino } from './defensaReino.js';
import { topeTrasExito } from './cronista/campamentosBandidos.js';
import { crearViajero, enlacesDelMundo, lugaresATramos, type Enlace, type ViajeroFila } from './viajeros.js';
import { TIPO_ASALTO } from './defensaReino.js';
import { ownerKeyFor } from './reinoOwner.js';

type Tx = Prisma.TransactionClient;

/// Lugares de una región donde puede asentarse un campamento: con camino, sin asentamiento (ni de
/// facción ni del Reino) y sin otro campamento activo; si hay alternativa, no el último que cayó.
async function lugaresLibres(tx: Tx, saveId: string, worldId: string, region: string, evitar: string | null): Promise<string[]> {
  const lugares = await tx.location.findMany({
    where: {
      worldId, region,
      OR: [{ linksFrom: { some: {} } }, { linksTo: { some: {} } }],
      zonePoints: { none: { tipo: 'EDIFICIO', OR: [{ saveId: null }, { saveId }] } },
      buildings: { none: { OR: [{ saveId }, { faction: { saveId } }] } },
      campamentos: { none: { saveId, estado: 'ACTIVO' } },
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  const ids = lugares.map((l) => l.id);
  return ids.length > 1 && evitar ? ids.filter((id) => id !== evitar) : ids;
}

/// Un campamento nuevo en `region` (si tiene ocupantes y sitio).
async function levantarCampamento(tx: Tx, saveId: string, worldId: string, region: string, dia: number, evitar: string | null, random: () => number): Promise<string | null> {
  const ocupante = elegirOcupante(region, random);
  if (!ocupante) return null;
  const libres = await lugaresLibres(tx, saveId, worldId, region, evitar);
  if (libres.length === 0) return null;
  const locationId = libres[Math.floor(random() * libres.length)]!;
  const gente = genteInicial(random);
  const c = await tx.campamento.create({
    data: { saveId, locationId, region, ocupante: ocupante.slug, cabecilla: ocupante.cabecilla, gente, tope: gente, creadoDia: dia, ultimoRefuerzoDia: dia },
  });
  const { x, y } = posicionEnZona(c.id);
  const punto = await tx.zonePoint.create({ data: { saveId, locationId, tipo: 'NPC', targetSlug: ocupante.npcSlug, label: ocupante.grupo, cantidad: gente + 1, x, y } });
  await tx.campamento.update({ where: { id: c.id }, data: { zonePointId: punto.id } });
  // Q7: se sabe de oídas (el Libro y la difusión de rumores de `CR-18`).
  const lugar = (await tx.location.findUnique({ where: { id: locationId }, select: { name: true } }))?.name ?? region;
  await registrarSuceso(tx, {
    saveId, tipo: 'CAMPAMENTO_NUEVO', fictionalMinutes: dia * 1440, regionSlug: slugify(region), locationId, origen: 'MUNDO',
    actores: [{ entidadTipo: 'LOCATION', entidadId: locationId, papel: 'LUGAR' }],
    datos: { campamento: ocupante.grupo.toLowerCase(), lugar },
  });
  return c.id;
}

/// El punto del mapa de zona sigue a la gente del campamento (más el cabecilla).
export async function sincronizarPunto(tx: Tx, c: { zonePointId: string | null; gente: number; estado: string }): Promise<void> {
  if (!c.zonePointId) return;
  await tx.zonePoint.updateMany({ where: { id: c.zonePointId }, data: c.estado === 'ACTIVO' ? { cantidad: c.gente + 1, activo: true } : { activo: false } });
}

/// Un día de los campamentos de la partida: los que faltan aparecen y los que hay reciben refuerzos.
/// Devuelve cuántos aparecen.
export async function revisarCampamentos(prisma: PrismaClient, saveId: string, dia: number, random: () => number): Promise<number> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
  if (!save) return 0;
  let nuevos = 0;
  for (const region of regionesConCampamentos()) {
    await prisma.$transaction(async (tx) => {
      const activo = await tx.campamento.findFirst({ where: { saveId, region, estado: 'ACTIVO' } });
      if (activo) {
        const r = refuerzos(activo, dia);
        if (r.gente !== activo.gente || r.ultimoRefuerzoDia !== activo.ultimoRefuerzoDia) {
          await tx.campamento.update({ where: { id: activo.id }, data: r });
          await sincronizarPunto(tx, { ...activo, ...r });
        }
        return;
      }
      const ultimo = await tx.campamento.findFirst({ where: { saveId, region, estado: 'DESTRUIDO' }, orderBy: { caidoDia: 'desc' }, select: { caidoDia: true, locationId: true } });
      if (!tocaCampamento(dia, ultimo?.caidoDia ?? null)) return;
      if (await levantarCampamento(tx, saveId, save.worldId, region, dia, ultimo?.locationId ?? null, random)) nuevos++;
    });
  }
  await prisma.$transaction((tx) => revisarConocidos(tx, saveId));
  return nuevos;
}

/// Los campamentos activos de la partida, con lo que se sabe de ellos.
export async function campamentosActivos(tx: Tx, saveId: string) {
  const filas = await tx.campamento.findMany({ where: { saveId, estado: 'ACTIVO' }, include: { location: { select: { name: true, slug: true } } }, orderBy: { createdAt: 'asc' } });
  return filas.map((c) => ({ ...c, grupo: ocupanteDe(c.ocupante)?.grupo ?? 'Bandidos', npcSlug: ocupanteDe(c.ocupante)?.npcSlug ?? null }));
}

// ─────────────────────────── 50b: asaltos ───────────────────────────

/// Q4: los bandidos salen a por quien pasa a 2 tramos o menos de su campamento, con esta
/// probabilidad por lugar cruzado (provisional, fase de pruebas).
export const RADIO_CAMPAMENTO = 2;
export const PROB_ASALTO_BANDIDOS = 0.3;
/// Lo que vale en comida cada pieza de caza que roban (provisional).
export const COMIDA_POR_PIEZA_ROBADA = 10;
/// Q4: asaltan el Reino solo si tiene esta riqueza, como mucho cada 7 días, con la mitad de su gente.
export const RIQUEZA_PARA_ASALTO = 200;
export const DIAS_ENTRE_ASALTOS = 7;

/// El campamento activo más cercano a `locationId` (a 2 tramos o menos), si hay.
export async function campamentoCerca(tx: Tx, saveId: string, locationId: string, enlaces: Enlace[]) {
  const activos = await tx.campamento.findMany({ where: { saveId, estado: 'ACTIVO', gente: { gt: 0 } }, orderBy: { createdAt: 'asc' } });
  let mejor: { c: (typeof activos)[number]; tramos: number } | null = null;
  for (const c of activos) {
    const t = lugaresATramos(enlaces, c.locationId, RADIO_CAMPAMENTO).get(locationId);
    if (t !== undefined && (!mejor || t < mejor.tramos)) mejor = { c, tramos: t };
  }
  return mejor?.c ?? null;
}

/// Tras una pelea, la gente del campamento sigue a su punto de banda (menos el cabecilla).
async function genteDesdePunto(tx: Tx, campamentoId: string, zonePointId: string | null): Promise<void> {
  if (!zonePointId) return;
  const p = await tx.zonePoint.findUnique({ where: { id: zonePointId }, select: { cantidad: true } });
  if (p) await tx.campamento.update({ where: { id: campamentoId }, data: { gente: Math.max(0, p.cantidad - 1) } });
}

/// Q4: un viajero que cruza cerca de un campamento puede ser asaltado. Devuelve null si no pasa nada.
export async function asaltoAlViajero(tx: Tx, v: ViajeroFila, locationId: string, dia: number, random: () => number): Promise<'sigue' | 'vuelve' | null> {
  if (v.tipo === TIPO_ASALTO) return null;
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: v.saveId }, select: { worldId: true } });
  const c = await campamentoCerca(tx, v.saveId, locationId, await enlacesDelMundo(tx, worldId));
  if (!c || !c.zonePointId || random() >= PROB_ASALTO_BANDIDOS) return null;
  const punto = await tx.zonePoint.findUnique({ where: { id: c.zonePointId } });
  const ocupante = ocupanteDe(c.ocupante);
  const npc = ocupante ? await tx.npc.findFirst({ where: { worldId, saveId: null, slug: ocupante.npcSlug } }) : null;
  if (!punto || !npc) return null;
  const { pelearEncuentro } = await import('./viajerosEncuentros.js');
  const ganan = await pelearEncuentro(tx, v, { punto, npc: { ...npc, level: ocupante!.nivel } }, dia, random);
  await genteDesdePunto(tx, c.id, c.zonePointId);
  if (!ganan) {
    // Se llevan lo que cargan y el campamento crece (X4: las estaciones crecen con lo que ganan).
    const carga = (v.carga as { piezas?: number } | null) ?? null;
    const piezas = carga?.piezas ?? 0;
    if (piezas > 0) await tx.viajero.update({ where: { id: v.id }, data: { carga: { ...carga, piezas: 0 } as Prisma.InputJsonValue } });
    await tx.campamento.update({ where: { id: c.id }, data: { botinComida: { increment: piezas * COMIDA_POR_PIEZA_ROBADA }, tope: topeTrasExito(c.tope) } });
  }
  return ganan ? 'sigue' : 'vuelve';
}

/// Q4: una caravana que llega cerca de un campamento puede ser asaltada (pierde lo que lleva).
export async function asaltoACaravana(tx: Tx, saveId: string, destinoLocationId: string, riqueza: number, random: () => number): Promise<string | null> {
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const c = await campamentoCerca(tx, saveId, destinoLocationId, await enlacesDelMundo(tx, worldId));
  if (!c || random() >= PROB_ASALTO_BANDIDOS) return null;
  await tx.campamento.update({ where: { id: c.id }, data: { botinGoirnos: { increment: riqueza }, tope: topeTrasExito(c.tope) } });
  return ocupanteDe(c.ocupante)?.grupo ?? 'Bandidos';
}

/// Q4: los campamentos de la región de la Capital la asaltan si el Reino tiene riqueza, como mucho
/// cada 7 días, con la mitad de su gente como viajero `ASALTO` (entra en el radar y la defensa de
/// `CR-65`). Devuelve cuántos salen.
export async function lanzarAsaltosAlReino(prisma: PrismaClient, saveId: string, dia: number): Promise<number> {
  const capital = await prisma.building.findFirst({ where: { saveId, recipeKey: 'ayuntamiento', status: 'ACTIVO', location: { isNot: null } }, select: { location: { select: { id: true, region: true } } } });
  const k = await prisma.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId }) }, select: { riqueza: true } });
  if (!capital?.location || !k || k.riqueza < RIQUEZA_PARA_ASALTO) return 0;
  const campamentos = await prisma.campamento.findMany({ where: { saveId, estado: 'ACTIVO', region: capital.location.region, OR: [{ ultimoAsaltoReinoDia: null }, { ultimoAsaltoReinoDia: { lte: dia - DIAS_ENTRE_ASALTOS } }] } });
  let salen = 0;
  for (const c of campamentos) {
    const van = Math.floor(c.gente / 2);
    if (van < 2) continue;
    await prisma.$transaction(async (tx) => {
      const r = await crearViajero(tx, {
        saveId, tipo: TIPO_ASALTO, origenLocationId: c.locationId, destinoLocationId: capital.location!.id, dia,
        carga: { campamentoId: c.id }, miembros: [{ genericos: van, rol: 'bandido' }],
      });
      if (!r.ok) return;
      const gente = c.gente - van;
      await tx.campamento.update({ where: { id: c.id }, data: { gente, ultimoAsaltoReinoDia: dia } });
      await sincronizarPunto(tx, { ...c, gente });
      salen++;
    });
  }
  return salen;
}

/// Un asalto que vuelve a su campamento: los que quedan vuelven a él con lo que traen; si saquearon,
/// el campamento crece. Si el campamento ya no está, se dispersan.
export async function volverAlCampamento(tx: Tx, v: ViajeroFila): Promise<void> {
  const carga = (v.carga as { campamentoId?: string; botin?: { comida: number; goirnos: number } } | null) ?? {};
  if (!carga.campamentoId) return;
  const c = await tx.campamento.findUnique({ where: { id: carga.campamentoId } });
  if (!c || c.estado !== 'ACTIVO') return;
  const vuelven = v.miembros.reduce((s, m) => s + m.genericos, 0);
  const gente = Math.min(TOPE_MAX_CAMPAMENTO, c.gente + vuelven);
  await tx.campamento.update({
    where: { id: c.id },
    data: { gente, botinComida: { increment: carga.botin?.comida ?? 0 }, botinGoirnos: { increment: carga.botin?.goirnos ?? 0 }, ...(carga.botin ? { tope: topeTrasExito(c.tope) } : {}) },
  });
  await sincronizarPunto(tx, { ...c, gente });
}

// ─────────────────────────── 50d: conocerlos ───────────────────────────

/// Q7 (X4: solo ves lo descubierto): la jugadora sabe dónde está un campamento si estuvo allí, si le
/// llegó el rumor de que se asentó o si cae en el alcance de una Torre de vigía. Devuelve cuántos
/// descubre.
export async function revisarConocidos(tx: Tx, saveId: string): Promise<number> {
  const ocultos = await tx.campamento.findMany({ where: { saveId, estado: 'ACTIVO', conocido: false }, select: { id: true, locationId: true, creadoDia: true } });
  if (ocultos.length === 0) return 0;
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { currentLocationId: true, worldId: true } });
  const conTorre = (await asentamientosDelReino(tx, saveId)).filter((a) => a.efecto.radioTramos > 0);
  const enlaces = conTorre.length > 0 ? await enlacesDelMundo(tx, save.worldId) : [];
  const vigilados = new Set(conTorre.flatMap((a) => [...lugaresATramos(enlaces, a.locationId, a.efecto.radioTramos).keys()]));
  const lugares = ocultos.map((c) => c.locationId);
  // Pasar por su lugar lo descubre al viajar (`turnResolution`); aquí, estar allí ahora o el rumor.
  const rumores = await tx.conocimiento.findMany({ where: { saveId, suceso: { tipo: 'CAMPAMENTO_NUEVO', locationId: { in: lugares } } }, select: { suceso: { select: { locationId: true, fictionalMinutes: true } } } });
  const descubiertos: string[] = [];
  for (const c of ocultos) {
    const rumor = rumores.some((r) => r.suceso.locationId === c.locationId && r.suceso.fictionalMinutes >= c.creadoDia * 1440);
    if (save.currentLocationId === c.locationId || vigilados.has(c.locationId) || rumor) descubiertos.push(c.id);
  }
  if (descubiertos.length > 0) await tx.campamento.updateMany({ where: { id: { in: descubiertos } }, data: { conocido: true } });
  return descubiertos.length;
}

/// Los campamentos que conoce la jugadora (mapa de Berig y Reino › Partidas).
/// Solo lee: el descubrimiento se apunta en el avance diario (`revisarConocidos`).
export async function campamentosConocidos(tx: Tx, saveId: string) {
  const filas = await tx.campamento.findMany({ where: { saveId, estado: 'ACTIVO', conocido: true }, include: { location: { select: { name: true, slug: true } } }, orderBy: { createdAt: 'asc' } });
  return filas.map((c) => ({ id: c.id, lugar: c.location.name, slug: c.location.slug.replace(/-interior$/, ''), region: c.region, grupo: ocupanteDe(c.ocupante)?.grupo ?? 'Bandidos', cabecilla: c.cabecilla, gente: c.gente }));
}
