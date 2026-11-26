// CR-36 (36a, hito 0.3, Q27-Q31 y Q38-Q39 de plan-roadmap-0.3.md): las facciones construyen.
// Cada facción del mundo tiene como mucho UNA obra a la vez (`ObraFaccion`), aparte de la cola del Reino. Elige
// por carencias, en un orden fijo (Q30; `CR-38` lo ajustará): sed, hambre y oficio. Gasta los materiales reales de
// la receta (`construction.ts`) de SU Almacén (`AlmacenItem.factionId`) con el mismo gasto diario por cuota que la
// Casa de obras del Reino, y al terminar suma un edificio a `Building.cantidad` (o sube el escalón del taller).
// Aún sin obreros que viajan ni pausa en guerra: eso es el paso 36c.
import type { Prisma } from '@prisma/client';
import { CONSTRUCTION_RECIPES, buildingTierFor, type ConstructionRecipe } from '../construction.js';
import { COCINA_RECIPE_KEYS } from '../kingdomTick.js';
import { slugify } from '../../lib/slugify.js';
import { gastarCuotaDelDia, redondearAvance } from './casaDeObras.js';
import { AGUA_FUENTE_NATURAL_DIA, BASE_ALMACEN, suministrosDeEdificios } from './economiaReino.js';
import { registrarSuceso } from './sucesos.js';

type Tx = Prisma.TransactionClient;

/// Cada boca bebe 1 al día y la fuente cubre el consumo con un 10 % de margen (la regla de la Cisterna y del agua del Reino).
export const MARGEN_DE_AGUA = 1.1;
/// Días de agua y de comida que una facción quiere poder guardar (Q39: «para 30 días»).
export const DIAS_DE_RESERVA_DE_ALMACEN = 30;
/// Q29: una facción solo empieza una obra con comida para tantos días de sus bocas.
export const DIAS_DE_COMIDA_PARA_EMPEZAR = 7;
/// Q27: con la comida en este tramo del tope de su almacén, ya no cabe más y levanta un Granero.
export const TRAMO_DE_ALMACEN_LLENO = 0.9;
/// Q29: obreros que una obra de tier 1 pide; cada tier más, otros tantos (`obrerosNecesarios`).
export const OBREROS_POR_TIER = 5;
/// Q29: parte de los trabajadores de la facción que puede dejar su tarea para la obra (`obrerosDisponibles`).
export const FRACCION_DE_OBREROS = 0.05;
/// Q29: el plazo se alarga como mucho hasta ×4 con pocos obreros.
export const FACTOR_MAXIMO_DE_PLAZO = 4;

/// Receta del escalón siguiente de un taller (`cocina` → `cocina-obrador` → `cocina-gran-obrador`).
const SIGUIENTE_ESCALON: Record<string, string[]> = {
  cocina: ['cocina-obrador', 'cocina-gran-obrador'],
  corrales: ['corrales-obrador', 'corrales-gran-obrador'],
};

export interface EdificioDeFaccion {
  id: string;
  recipeKey: string | null;
  tier: number | null;
  cantidad: number;
}

/// Lo que mira una facción para elegir su obra de hoy (puro; lo reúne `estadoDeObras`).
export interface EstadoDeObras {
  /// Población + soldados + visitantes (`KingdomStats`): las bocas.
  bocas: number;
  comida: number;
  /// Agua al día y topes que dan hoy sus edificios (`suministrosDeFaccion`).
  suministros: { agua: number; topeComida: number; topeBebida: number };
  edificios: EdificioDeFaccion[];
  tieneRebano: boolean;
}

export interface ObraElegida {
  recipeKey: string;
  /// Mejora de escalón: id del `Building` que sube.
  mejoraDe: string | null;
}

const recetaDe = (key: string) => CONSTRUCTION_RECIPES.find((r) => r.key === key) ?? null;

/// Puro (Q30): la obra que toca a la facción, o null si no necesita ninguna. Orden fijo:
/// 1. sed: agua al día por debajo de lo que beben sus bocas (Pozo) o tope de bebida por debajo de 30 días (Cisterna);
/// 2. hambre: comida a un 90 % del tope o tope de comida por debajo de 30 días (Granero);
/// 3. oficio: sin Cocina la levanta; con rebaño y sin Corrales, también; después sube el escalón de la Cocina y el de los
///    Corrales (la fila existente, solo si el anterior ya está).
export function elegirObraDeFaccion(e: EstadoDeObras): ObraElegida | null {
  const bocas = Math.max(0, e.bocas);
  const nueva = (recipeKey: string): ObraElegida => ({ recipeKey, mejoraDe: null });
  if (e.suministros.agua < bocas * MARGEN_DE_AGUA) return nueva('pozo');
  if (e.suministros.topeBebida < bocas * DIAS_DE_RESERVA_DE_ALMACEN) return nueva('cisterna');
  if (e.comida >= e.suministros.topeComida * TRAMO_DE_ALMACEN_LLENO || e.suministros.topeComida < bocas * DIAS_DE_RESERVA_DE_ALMACEN) return nueva('granero');
  const tiene = (keys: ReadonlySet<string> | string[]) => e.edificios.some((b) => b.recipeKey && (Array.isArray(keys) ? keys.includes(b.recipeKey) : keys.has(b.recipeKey)));
  if (!tiene(COCINA_RECIPE_KEYS)) return nueva('cocina');
  if (e.tieneRebano && !tiene(['corrales'])) return nueva('corrales');
  // Escalón 1 → primer Obrador; 2 → Gran obrador; 3 → no hay más.
  for (const base of ['cocina', 'corrales']) {
    if (base === 'corrales' && !e.tieneRebano) continue;
    const fila = e.edificios.find((b) => b.recipeKey === base);
    const siguiente = fila ? SIGUIENTE_ESCALON[base]![Math.max(1, fila.tier ?? 1) - 1] : undefined;
    if (fila && siguiente) return { recipeKey: siguiente, mejoraDe: fila.id };
  }
  return null;
}

/// Puro (Q29): obreros que pide una obra de ese tier.
export const obrerosNecesarios = (tier: number) => OBREROS_POR_TIER * Math.max(1, tier);
/// Puro (Q29): obreros que puede dar la facción (un 5 % de sus trabajadores).
export const obrerosDisponibles = (trabajadores: number) => Math.floor(Math.max(0, trabajadores) * FRACCION_DE_OBREROS);
/// Puro (Q29): ×1 con todos los obreros que pide la obra, más lento con menos, hasta ×4 (y ×4 sin ninguno).
export function factorDePlazo(tier: number, trabajadores: number): number {
  const disponibles = obrerosDisponibles(trabajadores);
  if (disponibles <= 0) return FACTOR_MAXIMO_DE_PLAZO;
  return Math.min(FACTOR_MAXIMO_DE_PLAZO, Math.max(1, Math.ceil(obrerosNecesarios(tier) / disponibles)));
}
/// Puro (Q29): días de obra de una receta de ese tier (la Casa de obras del Reino: tier días; aquí, por el factor).
export const plazoDeObra = (tier: number, trabajadores: number) => Math.max(1, tier) * factorDePlazo(tier, trabajadores);

/// Puro (Q39): cuántos Pozos, Cisternas y Graneros necesita una facción cuyas bocas llegan a `bocasMax`: el agua
/// (20 de la fuente + 12 por Pozo) cubre el consumo con un 10 % de margen y las reservas, 30 días de bebida y de comida.
export function suministrosParaBocas(bocasMax: number): { pozo: number; cisterna: number; granero: number } {
  const bocas = Math.max(0, bocasMax);
  const aguaPorPozo = CONSTRUCTION_RECIPES.find((r) => r.key === 'pozo')!.suministro!.aguaDia!;
  const porCisterna = CONSTRUCTION_RECIPES.find((r) => r.key === 'cisterna')!.suministro!.topeBebida!;
  const porGranero = CONSTRUCTION_RECIPES.find((r) => r.key === 'granero')!.suministro!.topeComida!;
  const hacia = (falta: number, cada: number) => Math.max(0, Math.ceil(falta / cada - 1e-9));
  return {
    pozo: hacia(bocas * MARGEN_DE_AGUA - AGUA_FUENTE_NATURAL_DIA, aguaPorPozo),
    cisterna: hacia(bocas * DIAS_DE_RESERVA_DE_ALMACEN - BASE_ALMACEN.bebida, porCisterna),
    granero: hacia(bocas * DIAS_DE_RESERVA_DE_ALMACEN - BASE_ALMACEN.comida, porGranero),
  };
}

const SUMINISTROS = ['pozo', 'cisterna', 'granero'] as const;
const CAMPOS_DE_BOCA = ['poblacion', 'soldados', 'trabajadores', 'visitantes'] as const;

/// Q39: a las facciones del mundo que aún no tienen Pozo, Cisterna ni Granero se les siembran los que necesitan para su
/// `poblacionMax` (la suma de sus cuatro filas de población, `repartoFacciones`), de modo que nadie arranque en
/// carencia al pasar a las reglas del Reino. Idempotente: solo toca a las que no tienen ninguno de los tres, y cada fila
/// queda en el mayor de lo que ya tenía y lo calculado (nunca baja una cantidad). Devuelve cuántas facciones sembró.
export async function sembrarSuministrosDeFacciones(tx: Tx, saveId: string): Promise<number> {
  const sin = await tx.faction.findMany({
    where: { saveId, origenSlug: { not: null }, disueltaEn: null, buildings: { none: { recipeKey: { in: [...SUMINISTROS] } } } },
    select: {
      id: true,
      slug: true,
      kingdomStats: { select: { poblacion: true, soldados: true, trabajadores: true, visitantes: true } },
      buildings: { where: { locationId: { not: null } }, select: { locationId: true, territoryId: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1 },
    },
  });
  let n = 0;
  for (const f of sin) {
    const filas = await tx.worldPopulation.findMany({ where: { saveId, targetType: 'FACCION', targetSlug: { in: CAMPOS_DE_BOCA.map((c) => `${f.slug}-${c}`) } }, select: { poblacion: true, poblacionMax: true } });
    const k = f.kingdomStats;
    const hoy = k ? k.poblacion + k.soldados + k.trabajadores + k.visitantes : 0;
    const bocasMax = Math.max(hoy, filas.reduce((s, x) => s + Math.max(x.poblacion, x.poblacionMax), 0));
    const necesita = suministrosParaBocas(bocasMax);
    const casa = f.buildings[0];
    for (const key of SUMINISTROS) {
      if (necesita[key] <= 0) continue;
      const r = recetaDe(key)!;
      const existe = await tx.building.findUnique({ where: { factionId_recipeKey: { factionId: f.id, recipeKey: key } }, select: { id: true, cantidad: true } });
      if (existe) {
        if (existe.cantidad < necesita[key]) await tx.building.update({ where: { id: existe.id }, data: { cantidad: necesita[key] } });
      } else {
        await tx.building.create({
          data: { factionId: f.id, locationId: casa?.locationId ?? undefined, territoryId: casa?.territoryId ?? undefined, recipeKey: key, name: r.name, kind: key, description: r.description, status: 'ACTIVO', cantidad: necesita[key] },
        });
      }
    }
    n++;
  }
  return n;
}

/// Reúne el estado de una facción para `elegirObraDeFaccion`.
async function estadoDeObras(tx: Tx, factionId: string): Promise<{ estado: EstadoDeObras; trabajadores: number } | null> {
  const k = await tx.kingdomStats.findFirst({ where: { factionId }, select: { poblacion: true, soldados: true, visitantes: true, trabajadores: true, comida: true } });
  if (!k) return null;
  const edificios = await tx.building.findMany({ where: { factionId, status: 'ACTIVO' }, select: { id: true, recipeKey: true, tier: true, cantidad: true } });
  const rebano = await tx.ganadoFaccion.count({ where: { factionId } });
  return {
    estado: {
      bocas: k.poblacion + k.soldados + k.visitantes,
      comida: k.comida,
      suministros: suministrosDeEdificios(edificios, true),
      edificios,
      tieneRebano: rebano > 0,
    },
    trabajadores: k.trabajadores,
  };
}

/// Una jornada de obras de todas las facciones del mundo de la partida (avanceDiario.ts, una vez por día simulado).
export async function avanzarObrasDeFacciones(tx: Tx, saveId: string, ahora: number): Promise<{ empezadas: number; avanzadas: number; terminadas: number }> {
  const res = { empezadas: 0, avanzadas: 0, terminadas: 0 };
  const facciones = await tx.faction.findMany({
    where: { saveId, origenSlug: { not: null }, disueltaEn: null },
    select: { id: true, slug: true, name: true, obra: true },
    orderBy: { slug: 'asc' },
  });
  for (const f of facciones) {
    let obra = f.obra;
    if (!obra) {
      const datos = await estadoDeObras(tx, f.id);
      if (!datos) continue;
      // Q29: guardan 7 días de comida antes de empezar.
      if (datos.estado.comida < datos.estado.bocas * DIAS_DE_COMIDA_PARA_EMPEZAR) continue;
      const elegida = elegirObraDeFaccion(datos.estado);
      const receta = elegida ? recetaDe(elegida.recipeKey) : null;
      if (!elegida || !receta) continue;
      obra = await tx.obraFaccion.create({
        data: { factionId: f.id, saveId, recipeKey: receta.key, tier: receta.tier, dias: plazoDeObra(receta.tier, datos.trabajadores), mejoraDe: elegida.mejoraDe },
      });
      res.empezadas++;
    }
    const receta = recetaDe(obra.recipeKey);
    if (!receta) {
      await tx.obraFaccion.delete({ where: { id: obra.id } });
      continue;
    }
    const avance = Math.min(1, obra.dias - obra.diasHechos);
    const primerDia = !obra.empezada;
    if (avance > 0) {
      const gasto = await gastarCuotaDelDia(tx, { factionId: f.id }, receta, obra.dias, obra.diasHechos, avance);
      if (!gasto.ok) {
        const aviso = `Faltan materiales en el Almacén: ${gasto.faltan.join(', ')}.`;
        if (obra.aviso !== aviso) await tx.obraFaccion.update({ where: { id: obra.id }, data: { aviso } });
        continue;
      }
      const hechos = Math.min(obra.dias, redondearAvance(obra.diasHechos + avance));
      obra = await tx.obraFaccion.update({ where: { id: obra.id }, data: { diasHechos: hechos, gastados: { increment: gasto.gastadas }, aviso: null, empezada: true } });
      res.avanzadas++;
      if (primerDia) await sucesoDeObra(tx, saveId, f, receta, 'OBRA_EMPEZADA', null, ahora);
    }
    if (obra.diasHechos < obra.dias) continue;
    await terminarObraDeFaccion(tx, saveId, f, obra, receta, ahora);
    res.terminadas++;
  }
  return res;
}

/// Suceso de la obra: la facción es la autora; en el de fin, el edificio es el beneficiario.
async function sucesoDeObra(
  tx: Tx,
  saveId: string,
  f: { slug: string; name: string },
  receta: ConstructionRecipe,
  tipo: 'OBRA_EMPEZADA' | 'EDIFICIO_CONSTRUIDO',
  edificioId: string | null,
  ahora: number,
) {
  const casa = await tx.building.findFirst({ where: { faction: { saveId, slug: f.slug }, locationId: { not: null } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { locationId: true, location: { select: { region: true } } } });
  const region = casa?.location?.region ?? null;
  const actores = [
    { entidadTipo: 'FACCION' as const, entidadId: f.slug, papel: 'AUTOR' as const },
    ...(edificioId ? [{ entidadTipo: 'EDIFICIO' as const, entidadId: edificioId, papel: 'BENEFICIARIO' as const }] : []),
  ];
  const base = { saveId, fictionalMinutes: ahora, regionSlug: region ? slugify(region) : null, locationId: casa?.locationId ?? null, origen: 'MOTOR' as const, actores };
  if (tipo === 'OBRA_EMPEZADA') await registrarSuceso(tx, { ...base, tipo, datos: { faccion: f.name, edificio: receta.name } });
  else await registrarSuceso(tx, { ...base, tipo, datos: { edificio: receta.name, reino: f.name } });
}

/// La obra acabada: +1 `cantidad` del edificio (o fila nueva) o, en una mejora, el escalón de su fila; y fuera la obra.
async function terminarObraDeFaccion(
  tx: Tx,
  saveId: string,
  f: { id: string; slug: string; name: string },
  obra: { id: string; mejoraDe: string | null },
  receta: ConstructionRecipe,
  ahora: number,
) {
  let edificioId: string | null = null;
  if (obra.mejoraDe) {
    const fila = await tx.building.findUnique({ where: { id: obra.mejoraDe }, select: { id: true } });
    if (fila) {
      await tx.building.update({ where: { id: fila.id }, data: { name: receta.name, description: receta.description, tier: buildingTierFor(receta) ?? undefined, status: 'ACTIVO' } });
      edificioId = fila.id;
    }
  } else {
    const existe = await tx.building.findUnique({ where: { factionId_recipeKey: { factionId: f.id, recipeKey: receta.key } }, select: { id: true } });
    if (existe) {
      await tx.building.update({ where: { id: existe.id }, data: { cantidad: { increment: 1 } } });
      edificioId = existe.id;
    } else {
      const casa = await tx.building.findFirst({ where: { factionId: f.id, locationId: { not: null } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { locationId: true, territoryId: true } });
      const creado = await tx.building.create({
        data: {
          factionId: f.id,
          locationId: casa?.locationId ?? undefined,
          territoryId: casa?.territoryId ?? undefined,
          recipeKey: receta.key,
          name: receta.name,
          kind: receta.key,
          description: receta.description,
          status: 'ACTIVO',
          tier: buildingTierFor(receta) ?? undefined,
        },
      });
      edificioId = creado.id;
    }
  }
  await tx.obraFaccion.delete({ where: { id: obra.id } });
  // Una mejora cuyo edificio ya no está se da por perdida sin suceso: no hay nada que celebrar.
  if (edificioId) await sucesoDeObra(tx, saveId, f, receta, 'EDIFICIO_CONSTRUIDO', edificioId, ahora);
}
