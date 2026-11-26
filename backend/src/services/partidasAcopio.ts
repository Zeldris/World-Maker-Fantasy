// Partidas de acopio de las facciones (CR-36b, hito 0.3 — decisiones Q-40, Q-41 y Q-37 de
// `plan-roadmap-0.3.md`). Cuando la obra de una facción se para por falta de madera, piedra o fibras, manda
// una partida (un viajero de tipo `ACOPIO`, `viajeros.ts`) a por ello:
//
// - Va a la zona más cercana de su región (menos tramos desde su casa) con un punto de recurso de esa
//   categoría, trabaja un día y vuelve con 10 unidades por porteador vivo (o lo que quede), descontadas del
//   punto, a su Almacén (una fila `AlmacenItem` por unidad).
// - Q-41: 8 porteadores genéricos (de sus trabajadores) y guardias de sus soldados según el riesgo de la
//   ruta; los guardias salen de `KingdomStats.soldados` y los que vuelven se devuelven. En el combate pelean
//   primero ellos (`viajerosEncuentros.ts`).
// - Un acopio a la vez, dentro de las 4 partidas de la facción (`MAX_PARTIDAS_FACCION`).
import type { Prisma, PrismaClient } from '@prisma/client';
import { CONSTRUCTION_RECIPES, type ConstructionRecipe } from './construction.js';
import { cuotaDelDia } from './cronista/casaDeObras.js';
import { totalQuantity, type CatalogLookup, type InventoryRowLike } from './ingredients.js';
import { descontarZonePointCaza } from './caza.js';
import { campamentoCerca } from './campamentos.js';
import { MAX_PARTIDAS_FACCION } from './partidasFacciones.js';
import { avisoDeViajero, crearViajero, enlacesDelMundo, esDelReino, rutaMasCorta, TRABAJOS, type Enlace, type ViajeroFila } from './viajeros.js';

type Tx = Prisma.TransactionClient;

export const TIPO_ACOPIO = 'ACOPIO';
/// Categorías del catálogo que una partida puede recolectar.
export const CATEGORIAS_ACOPIO = ['madera', 'piedra', 'fibras'] as const;
export type CategoriaAcopio = (typeof CATEGORIAS_ACOPIO)[number];
/// Q-41: porteadores por partida y lo que carga cada uno.
export const PORTEADORES_POR_PARTIDA = 8;
export const UNIDADES_POR_PORTEADOR = 10;
/// Q-41: guardias según el riesgo.
export const GUARDIAS_CON_RIESGO = 2;
export const GUARDIAS_EN_GUERRA = 4;

const enMarcha = { estado: { not: 'TERMINADO' } };

export interface CargaAcopio {
  categoria: CategoriaAcopio;
  items: { slug: string; name: string; description: string; n: number }[];
}

/// Puro (Q-41): guardias que lleva una partida: 0 sin riesgo, 2 con un enlace de riesgo o un campamento cerca de
/// la ruta, 4 si su facción está en guerra; nunca más de la mitad de su guarnición.
export function guardiasParaRuta(d: { riesgo: boolean; bandidosCerca: boolean; enGuerra: boolean; soldados: number }): number {
  const quiere = d.enGuerra ? GUARDIAS_EN_GUERRA : d.riesgo || d.bandidosCerca ? GUARDIAS_CON_RIESGO : 0;
  return Math.max(0, Math.min(quiere, Math.floor(d.soldados / 2)));
}

/// Puro (Q-40): las categorías recolectables (madera, piedra, fibras) de las que el Almacén no tiene para la cuota de
/// hoy de la obra, en el orden de `CATEGORIAS_ACOPIO`.
export function categoriasQueFaltan(
  receta: ConstructionRecipe,
  obra: { dias: number; diasHechos: number },
  filas: InventoryRowLike[],
  catalogo: Map<string, CatalogLookup>,
): CategoriaAcopio[] {
  const avance = Math.max(0, Math.min(1, obra.dias - obra.diasHechos));
  const faltan = new Set<string>();
  for (const req of receta.requirements) {
    if (req.match.kind !== 'category' || req.match.tipo !== 'RECURSO') continue;
    const cuota = cuotaDelDia(req.cantidad, obra.dias, obra.diasHechos, avance);
    if (cuota > 0 && totalQuantity(filas, req, catalogo) < cuota) faltan.add(req.match.category);
  }
  return CATEGORIAS_ACOPIO.filter((c) => faltan.has(c));
}

/// Los objetos que da cada fuente de recurso de una categoría (`HarvestYield`): el primero por fuente.
async function itemsDeCategoria(tx: Tx, worldId: string, categoria: string): Promise<Map<string, { slug: string; name: string; description: string }>> {
  const filas = await tx.harvestYield.findMany({ where: { worldId, item: { category: categoria } }, select: { sourceSlug: true, item: { select: { slug: true, name: true, description: true } } }, orderBy: [{ sourceSlug: 'asc' }, { id: 'asc' }] });
  const out = new Map<string, { slug: string; name: string; description: string }>();
  for (const f of filas) if (!out.has(f.sourceSlug)) out.set(f.sourceSlug, f.item);
  return out;
}

/// La zona de su región más cercana a su casa (menos tramos) con un punto de recurso de esa categoría.
async function zonaDeAcopio(tx: Tx, saveId: string, worldId: string, enlaces: Enlace[], casaId: string, region: string, categoria: CategoriaAcopio): Promise<{ locationId: string; ruta: string[] } | null> {
  const fuentes = await itemsDeCategoria(tx, worldId, categoria);
  if (fuentes.size === 0) return null;
  const puntos = await tx.zonePoint.findMany({ where: { saveId, tipo: 'RECURSO', activo: true, cantidad: { gt: 0 }, targetSlug: { in: [...fuentes.keys()] }, location: { region } }, select: { locationId: true }, orderBy: { id: 'asc' } });
  let mejor: { locationId: string; ruta: string[] } | null = null;
  for (const locationId of new Set(puntos.map((p) => p.locationId))) {
    const ruta = rutaMasCorta(enlaces, casaId, locationId);
    if (!ruta) continue;
    if (!mejor || ruta.length < mejor.ruta.length || (ruta.length === mejor.ruta.length && locationId < mejor.locationId)) mejor = { locationId, ruta };
  }
  return mejor;
}

/// Riesgo de la ruta de ida desde casa: algún tramo con `riesgo` apuntado o un campamento de bandidos cerca de alguno de sus lugares.
async function riesgoDeRuta(tx: Tx, saveId: string, enlaces: Enlace[], casaId: string, ruta: string[]): Promise<{ riesgo: boolean; bandidosCerca: boolean }> {
  const lugares = [casaId, ...ruta];
  const pares = lugares.slice(1).map((l, i) => [lugares[i]!, l] as const);
  const conRiesgo = pares.length > 0
    ? await tx.locationLink.count({ where: { riesgo: { not: null }, OR: pares.flatMap(([a, b]) => [{ fromId: a, toId: b }, { fromId: b, toId: a }]) } })
    : 0;
  let bandidosCerca = false;
  for (const l of lugares) if (!bandidosCerca && (await campamentoCerca(tx, saveId, l, enlaces))) bandidosCerca = true;
  return { riesgo: conRiesgo > 0, bandidosCerca };
}

/// Un día: cada facción viva con la obra parada por falta de madera, piedra o fibras manda una partida de acopio
/// (si no tiene ya una ni 4 partidas en marcha y le quedan porteadores). Devuelve cuántas salen.
export async function lanzarAcopiosDeFacciones(prisma: PrismaClient, saveId: string, dia: number): Promise<number> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
  if (!save) return 0;
  const facciones = await prisma.faction.findMany({
    where: { saveId, disueltaEn: null, origenSlug: { not: null }, obra: { isNot: null }, kingdomStats: { isNot: null } },
    select: { id: true, name: true, obra: true, kingdomStats: true, buildings: { where: { locationId: { not: null } }, select: { location: { select: { id: true, region: true } } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1 } },
    orderBy: { id: 'asc' },
  });
  if (facciones.length === 0) return 0;
  const catalogo = new Map<string, CatalogLookup>((await prisma.itemCatalog.findMany({ where: { worldId: save.worldId }, select: { slug: true, tipo: true, category: true } })).map((c) => [c.slug, { tipo: c.tipo, category: c.category }]));
  let salen = 0;
  for (const f of facciones) {
    const k = f.kingdomStats;
    const obra = f.obra;
    const casa = f.buildings[0]?.location;
    const receta = obra ? CONSTRUCTION_RECIPES.find((r) => r.key === obra.recipeKey) : null;
    // Parada por materiales: su aviso lo dice (`avanzarObrasDeFacciones`).
    if (!k || !obra || !casa || !receta || !obra.aviso) continue;
    await prisma.$transaction(async (tx) => {
      if ((await tx.viajero.count({ where: { factionId: f.id, ...enMarcha } })) >= MAX_PARTIDAS_FACCION) return;
      if ((await tx.viajero.count({ where: { factionId: f.id, tipo: TIPO_ACOPIO, ...enMarcha } })) > 0) return;
      const fuera = await tx.viajeroMiembro.aggregate({ where: { rol: { in: ['porteador', 'cazador'] }, viajero: { factionId: f.id, ...enMarcha } }, _sum: { genericos: true } });
      if (k.trabajadores - (fuera._sum.genericos ?? 0) < PORTEADORES_POR_PARTIDA) return;
      const filas = await tx.almacenItem.findMany({ where: { factionId: f.id }, select: { id: true, name: true, catalogSlug: true } });
      const enlaces = await enlacesDelMundo(tx, save.worldId);
      let destino: { locationId: string; ruta: string[]; categoria: CategoriaAcopio } | null = null;
      for (const categoria of categoriasQueFaltan(receta, obra, filas, catalogo)) {
        const zona = await zonaDeAcopio(tx, saveId, save.worldId, enlaces, casa.id, casa.region, categoria);
        if (zona) {
          destino = { ...zona, categoria };
          break;
        }
      }
      if (!destino) return;
      const { riesgo, bandidosCerca } = await riesgoDeRuta(tx, saveId, enlaces, casa.id, destino.ruta);
      const enGuerra = (await tx.factionRelation.count({ where: { type: 'GUERRA', OR: [{ sourceFactionId: f.id }, { targetFactionId: f.id }] } })) > 0;
      const guardias = guardiasParaRuta({ riesgo, bandidosCerca, enGuerra, soldados: k.soldados });
      const r = await crearViajero(tx, {
        saveId, factionId: f.id, tipo: TIPO_ACOPIO, objetivo: destino.categoria, origenLocationId: casa.id, destinoLocationId: destino.locationId, dia,
        miembros: [{ genericos: PORTEADORES_POR_PARTIDA, rol: 'porteador' }, ...(guardias > 0 ? [{ genericos: guardias, rol: 'guardia' }] : [])],
      });
      if (!r.ok) return;
      // Los guardias no defienden la casa mientras viajan; al volver, los vivos se devuelven.
      if (guardias > 0) await tx.kingdomStats.update({ where: { id: k.id }, data: { soldados: { decrement: guardias } } });
      salen++;
    });
  }
  return salen;
}

const genericosDe = (v: ViajeroFila, rol: string) => v.miembros.filter((m) => m.rol === rol).reduce((s, m) => s + m.genericos, 0);

/// Un día de trabajo en el destino: recoge del lugar hasta 10 por porteador vivo, restando de los puntos de recurso.
async function acopiarEnDestino(tx: Tx, v: ViajeroFila): Promise<CargaAcopio | null> {
  const categoria = v.objetivo as CategoriaAcopio | null;
  if (!categoria || !CATEGORIAS_ACOPIO.includes(categoria)) return null;
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: v.saveId }, select: { worldId: true } });
  const fuentes = await itemsDeCategoria(tx, worldId, categoria);
  let quedan = UNIDADES_POR_PORTEADOR * genericosDe(v, 'porteador');
  const puntos = await tx.zonePoint.findMany({ where: { saveId: v.saveId, locationId: v.ubicacionLocationId, tipo: 'RECURSO', activo: true, cantidad: { gt: 0 }, targetSlug: { in: [...fuentes.keys()] } }, orderBy: [{ cantidad: 'desc' }, { id: 'asc' }] });
  const porItem = new Map<string, { slug: string; name: string; description: string; n: number }>();
  for (const p of puntos) {
    if (quedan <= 0) break;
    const toma = Math.min(quedan, p.cantidad);
    await descontarZonePointCaza(tx, v.saveId, p.id, toma);
    quedan -= toma;
    const item = fuentes.get(p.targetSlug)!;
    const previo = porItem.get(item.slug);
    porItem.set(item.slug, { ...item, n: (previo?.n ?? 0) + toma });
  }
  return { categoria, items: [...porItem.values()] };
}

TRABAJOS[TIPO_ACOPIO] = {
  alLlegar: async (tx, v) => {
    const carga = await acopiarEnDestino(tx, v);
    if (carga) await tx.viajero.update({ where: { id: v.id }, data: { carga: carga as unknown as Prisma.InputJsonValue } });
  },
  alVolver: async (tx, v) => {
    // Los guardias que vuelven vuelven a su guarnición (los caídos no).
    const guardias = genericosDe(v, 'guardia');
    if (v.factionId && guardias > 0) await tx.kingdomStats.updateMany({ where: { factionId: v.factionId }, data: { soldados: { increment: guardias } } });
    const carga = v.carga as CargaAcopio | null;
    const total = carga?.items.reduce((s, i) => s + i.n, 0) ?? 0;
    if (!carga || total <= 0) {
      await avisoDeViajero(tx, v, 'La partida de acopio vuelve con las manos vacías.');
      return;
    }
    const dueno = esDelReino(v) ? { saveId: v.saveId } : { factionId: v.factionId! };
    await tx.almacenItem.createMany({ data: carga.items.flatMap((i) => Array.from({ length: i.n }, () => ({ ...dueno, name: i.name, description: i.description, catalogSlug: i.slug }))) });
    await avisoDeViajero(tx, v, `La partida de acopio vuelve con ${carga.items.map((i) => `${i.n} de ${i.name}`).join(', ')}.`);
  },
};
