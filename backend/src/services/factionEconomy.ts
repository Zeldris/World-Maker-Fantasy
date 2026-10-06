import type { Prisma, PrismaClient } from '@prisma/client';
import { CRAFTING_RECIPES, type CraftingRecipe } from './crafting.js';
import { daysCrossed, hambrunaNueva, tickFactionProduction, tickKingdomOneDay, type KingdomStatsBlock } from './kingdomTick.js';
import { decayPresion, stageForPresion, typeForPresion } from './factionRelations.js';
import { registrarHambruna } from './cronista/hambruna.js';
import { AGUA_FUENTE_FACCION, aplicarBajasDeFaccion, muertesDelDia, repartirMuertes, sueldosDelDia } from './cronista/economiaFacciones.js';

/// Economía de facción (Fase 4 del plan oct-2026: H-6, H-2, H-4). Corre sobre las facciones del mundo
/// de cada partida, en su avance diario (`avanceDiario.ts`, CR-7), con el reloj de esa partida; el
/// catálogo nunca cambia jugando (CR-35 quitó la versión que corría sobre él desde `worldTick`).
/// `KingdomStats.ultimoDiaProducido` (y `FactionRelation.ultimaSemanaDecaida`) garantizan que cada
/// día/semana se procesa una sola vez.

/// DECISIÓN POR DEFECTO REVISABLE: tope de unidades de un mismo `catalogSlug` que una facción
/// acumula en su Almacén (`AlmacenItem.factionId`). Sin tope el stock crecería sin límite.
export const TOPE_STOCK_FACCION_POR_SLUG = 5;
/// DECISIÓN POR DEFECTO REVISABLE: máximo de días de ficción que se recuperan en un solo tick (p. ej.
/// tras semanas con el backend apagado o un salto enorme de reloj) — el resto se descarta.
export const MAX_DIAS_CATCHUP_FACCION = 30;
const SALON_KIND = 'sede';

/// Puro: días de ficción pendientes de procesar. `ultimo` null = sin línea base → 0 (se fija al día
/// actual sin producir retroactivamente). Reutiliza `daysCrossed` (kingdomTick.ts) sobre minutos de
/// inicio de día. Acotado a `MAX_DIAS_CATCHUP_FACCION`; nunca negativo.
export function pendingFactionDays(ultimo: number | null, diaActual: number): number {
  if (ultimo === null) return 0;
  return Math.min(MAX_DIAS_CATCHUP_FACCION, Math.max(0, daysCrossed(ultimo * 1440, diaActual * 1440)));
}

/// Puro: semanas de ficción completas cruzadas entre dos días (mismo criterio que `daysCrossed`).
export function pendingWeeks(ultimaSemana: number | null, diaActual: number): number {
  if (ultimaSemana === null) return 0;
  return Math.max(0, Math.floor(diaActual / 7) - ultimaSemana);
}

/// Puro: un día de economía de facción = producción agregada de sus edificios (tickFactionProduction)
/// sumada a la comida/riqueza, y después el MISMO día de reino del jugador (`tickKingdomOneDay`:
/// trabajadores producen, bocas consumen, soldados cuestan, déficit baja la felicidad). Las
/// facciones NPC no modelan bebida (no hay producción de agua): se le da a `tickKingdomOneDay` una
/// bebida holgada y se restaura la original, para que no haya "déficit de bebida" perpetuo.
/// CR-54 (Q17): el agua sale de su fuente canónica, que cubre el consumo con un 10 % de margen; caben
/// 30 días de agua. Los sueldos van por semana (`sueldosDelDia`), no como mantenimiento diario.
export function tickFactionOneDay(stats: KingdomStatsBlock, produccion: { comida: number; riqueza: number }): KingdomStatsBlock {
  const bocas = stats.poblacion + stats.soldados + stats.visitantes;
  const conProduccion = { ...stats, comida: stats.comida + produccion.comida, riqueza: stats.riqueza + produccion.riqueza };
  return tickKingdomOneDay(conProduccion, { agua: Math.ceil(bocas * AGUA_FUENTE_FACCION), topeComida: Infinity, topeBebida: Math.max(30, bocas * 30), sueldosSemanales: true });
}

/// Recetas de producto de un oficio: mismo oficio exacto; si no hay ninguna (p. ej. `herrero-orcos-cristal`
/// no tiene recetas propias), las de la misma familia (`herrero-*`). Solo recetas con ingredientes y
/// `resultCatalogSlug` (excluye las de extracción, que no son objetos fabricados).
export function productRecipesForOficio(oficio: string, recipes: CraftingRecipe[] = CRAFTING_RECIPES): CraftingRecipe[] {
  const fabricables = recipes.filter((r) => r.oficio && r.resultCatalogSlug && r.ingredients.length > 0);
  const exactas = fabricables.filter((r) => r.oficio === oficio);
  if (exactas.length > 0) return exactas;
  const familia = oficio.split('-')[0]!;
  return fabricables.filter((r) => r.oficio!.split('-')[0] === familia);
}

/// Puro: producto que un edificio deposita el día `dia` — rota determinista por las recetas del oficio.
export function pickDailyProduct(recetas: CraftingRecipe[], dia: number): CraftingRecipe | null {
  if (recetas.length === 0) return null;
  return recetas[((dia % recetas.length) + recetas.length) % recetas.length]!;
}

/// Puro: ¿cabe una unidad más de `slug` bajo el tope?
export function cabeEnStock(existentes: number, tope: number = TOPE_STOCK_FACCION_POR_SLUG): boolean {
  return existentes < tope;
}

type Db = Pick<PrismaClient, '$transaction' | 'kingdomStats' | 'worldState' | 'factionRelation' | 'itemCatalog'>;

type ResultadoEconomia = { diasProcesados: number; semanasDecaidas: number; depositados: number };

/// Producción, consumo y stock (H-6, H-2) de las facciones de `faccion` hasta `diaActual`.
/// Idempotente por `KingdomStats.ultimoDiaProducido`.
/// CR-12 (12c): las facciones del mundo llevan la cuenta de días de hambre, pero aún no registran
/// `HAMBRUNA`: con los números provisionales de su economía, 6 de las 9 sembradas pasan hambre siempre
/// (sin trabajadores o con más bocas que comida) y se hundirían en semanas. Se enciende cuando estén
/// los números de la economía de supervivencia (pregunta 5 a Álvaro).
/// CR-54 (Q19): encendida con los números de la economía de supervivencia (Fase D, 2026-10-06).
export const HAMBRUNA_EN_FACCIONES = true;

export async function producirFacciones(
  prisma: Db,
  worldId: string,
  faccion: Prisma.FactionWhereInput,
  diaActual: number,
  result: ResultadoEconomia,
  opciones: { hambruna?: boolean } = {},
): Promise<void> {
  const hambruna = opciones.hambruna ?? HAMBRUNA_EN_FACCIONES;
  const statsRows = await prisma.kingdomStats.findMany({
    where: { faction: faccion },
    include: { faction: { select: { id: true, saveId: true, slug: true, raza: true } } },
  });
  const slugsValidos = new Map<string, boolean>(); // catalogSlug → tiene valor de mercado > 0
  for (const fks of statsRows) {
    const pendientes = pendingFactionDays(fks.ultimoDiaProducido, diaActual);
    if (fks.ultimoDiaProducido !== null && pendientes === 0 && fks.ultimoDiaProducido >= diaActual) continue;
    const factionId = fks.factionId!;
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Reclamo atómico del día: solo procesa quien consigue mover el marcador.
      const claim = await tx.kingdomStats.updateMany({
        where: { id: fks.id, ultimoDiaProducido: fks.ultimoDiaProducido },
        data: { ultimoDiaProducido: diaActual },
      });
      if (claim.count === 0 || pendientes === 0) return; // otro tick ya lo hizo, o solo se fija la línea base

      const edificios = await tx.building.findMany({ where: { factionId, status: 'ACTIVO' }, select: { recipeKey: true, status: true, kind: true } });
      const porDia = tickFactionProduction(edificios);
      let stats: KingdomStatsBlock = {
        poblacion: fks.poblacion, felicidad: fks.felicidad, comida: fks.comida, bebida: fks.bebida, riqueza: fks.riqueza,
        soldados: fks.soldados, trabajadores: fks.trabajadores, visitantes: fks.visitantes,
        diasFelicidadAlta: fks.diasFelicidadAlta, diasFelicidadBaja: fks.diasFelicidadBaja, diasHambre: fks.diasHambre, diasSed: fks.diasSed,
      };
      // CR-54 (54b): sueldos semanales, deserción y muertes de hambre y sed, día a día.
      let diasSinCobrar = fks.diasSinCobrar;
      let desertores = 0;
      let muertos = 0;
      for (let i = 0; i < pendientes; i++) {
        const dia = diaActual - pendientes + 1 + i;
        stats = tickFactionOneDay(stats, porDia);
        const pago = sueldosDelDia({ ...stats, diasSinCobrar }, dia);
        stats = { ...stats, riqueza: pago.riqueza, felicidad: pago.felicidad };
        diasSinCobrar = pago.diasSinCobrar;
        if (!hambruna) continue;
        const cuenta = { civiles: Math.max(0, stats.poblacion - stats.trabajadores), trabajadores: stats.trabajadores, soldados: Math.max(0, stats.soldados - desertores) };
        desertores += Math.min(cuenta.soldados, pago.desertores);
        muertos += muertesDelDia(cuenta, stats.diasHambre ?? 0, stats.diasSed ?? 0);
      }
      // CR-12 (12c): hambruna de una facción del mundo de una partida (las del catálogo no tienen Libro).
      if (hambruna && fks.faction?.saveId && hambrunaNueva(fks.diasHambre, stats.diasHambre ?? 0, pendientes)) {
        await registrarHambruna(tx, fks.faction.saveId, { factionId });
      }
      // Los muertos y desertores salen de sus filas de población (la partida las sincroniza con
      // `KingdomStats` cada día); aquí también se descuentan ya de sus cifras.
      const bajas = repartirMuertes(
        { civiles: Math.max(0, stats.poblacion - stats.trabajadores), trabajadores: stats.trabajadores, soldados: Math.max(0, stats.soldados - desertores) },
        muertos,
      );
      if (fks.faction?.saveId && (muertos > 0 || desertores > 0)) {
        await aplicarBajasDeFaccion(tx, fks.faction.saveId, fks.faction.slug, fks.faction.raza, bajas, desertores);
      }
      await tx.kingdomStats.update({
        where: { id: fks.id },
        data: {
          comida: stats.comida, bebida: stats.bebida, riqueza: stats.riqueza, felicidad: stats.felicidad,
          diasFelicidadAlta: stats.diasFelicidadAlta, diasFelicidadBaja: stats.diasFelicidadBaja, diasHambre: stats.diasHambre ?? 0, diasSed: stats.diasSed ?? 0,
          diasSinCobrar,
          poblacion: Math.max(0, stats.poblacion - bajas.civiles - bajas.trabajadores),
          trabajadores: Math.max(0, stats.trabajadores - bajas.trabajadores),
          soldados: Math.max(0, stats.soldados - bajas.soldados - desertores),
        },
      });

      // Stock real: 1 unidad por edificio de oficio y día, tope por catalogSlug.
      const oficios = edificios.filter((b) => b.kind !== SALON_KIND).map((b) => b.kind);
      if (oficios.length > 0) {
        const existentes = await tx.almacenItem.findMany({ where: { factionId, catalogSlug: { not: null } }, select: { catalogSlug: true } });
        const cuenta = new Map<string, number>();
        for (const e of existentes) cuenta.set(e.catalogSlug!, (cuenta.get(e.catalogSlug!) ?? 0) + 1);
        const nuevos: Prisma.AlmacenItemCreateManyInput[] = [];
        for (let d = 1; d <= pendientes; d++) {
          const dia = diaActual - pendientes + d;
          for (const oficio of oficios) {
            const receta = pickDailyProduct(productRecipesForOficio(oficio), dia);
            if (!receta) continue;
            const slug = receta.resultCatalogSlug!;
            if (!slugsValidos.has(slug)) {
              const cat = await prisma.itemCatalog.findFirst({ where: { worldId, slug }, select: { valorGoirnos: true } });
              slugsValidos.set(slug, !!cat && cat.valorGoirnos > 0);
            }
            if (!slugsValidos.get(slug)) continue;
            const actual = cuenta.get(slug) ?? 0;
            if (!cabeEnStock(actual)) continue;
            cuenta.set(slug, actual + 1);
            nuevos.push({
              factionId, name: receta.resultName, description: receta.resultDescription, catalogSlug: slug,
              statBonuses: receta.statBonuses ? (receta.statBonuses as Prisma.InputJsonValue) : undefined,
            });
          }
        }
        if (nuevos.length > 0) {
          await tx.almacenItem.createMany({ data: nuevos });
          result.depositados += nuevos.length;
        }
      }
      result.diasProcesados += pendientes;
    });
  }
}

/// Decaimiento de presión (H-4) de las relaciones de `relacion` hasta `diaActual`. Idempotente por
/// `FactionRelation.ultimaSemanaDecaida`.
export async function decaerRelaciones(prisma: Db, relacion: Prisma.FactionRelationWhereInput, diaActual: number, result: ResultadoEconomia): Promise<void> {
  const relaciones = await prisma.factionRelation.findMany({ where: relacion });
  const semanaActual = Math.floor(diaActual / 7);
  for (const rel of relaciones) {
    if (rel.ultimaSemanaDecaida !== null && rel.ultimaSemanaDecaida >= semanaActual) continue;
    const semanas = pendingWeeks(rel.ultimaSemanaDecaida, diaActual);
    const claim = await prisma.factionRelation.updateMany({
      where: { id: rel.id, ultimaSemanaDecaida: rel.ultimaSemanaDecaida },
      data: { ultimaSemanaDecaida: semanaActual },
    });
    if (claim.count === 0 || semanas === 0) continue;
    const presion = decayPresion(rel.presion, semanas);
    if (presion !== rel.presion) {
      await prisma.factionRelation.update({ where: { id: rel.id }, data: { presion, type: typeForPresion(presion), stage: stageForPresion(presion) } });
    }
    result.semanasDecaidas += semanas;
  }
}
