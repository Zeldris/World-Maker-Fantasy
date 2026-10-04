import type { Prisma, PrismaClient } from '@prisma/client';
import { CRAFTING_RECIPES, type CraftingRecipe } from './crafting.js';
import { daysCrossed, hambrunaNueva, tickFactionProduction, tickKingdomOneDay, type KingdomStatsBlock } from './kingdomTick.js';
import { decayPresion, stageForPresion, typeForPresion } from './factionRelations.js';
import { registrarHambruna } from './cronista/hambruna.js';

/// Economía de facción en `worldTick` (Fase 4 del plan oct-2026: H-6, H-2, H-4). Antes
/// `tickFactionProduction` corría en el turno de CADA partida (producción duplicada, sin consumo);
/// ahora corre aquí, UNA vez por mundo y por día de ficción, desde `tick()` de workers/worldTick.ts.
///
/// El reloj de ficción vive por partida (`WorldState.fictionalMinutes`): el día de ficción de un
/// mundo = el máximo de sus partidas. `KingdomStats.ultimoDiaProducido` (y
/// `FactionRelation.ultimaSemanaDecaida`) garantizan que cada día/semana se procesa una sola vez.

/// DECISIÓN POR DEFECTO REVISABLE: tope de unidades de un mismo `catalogSlug` que una facción
/// acumula en su Almacén (`AlmacenItem.factionId`). Sin tope el stock crecería sin límite.
export const TOPE_STOCK_FACCION_POR_SLUG = 5;
/// DECISIÓN POR DEFECTO REVISABLE: máximo de días de ficción que se recuperan en un solo tick (p. ej.
/// tras semanas con el backend apagado o un salto enorme de reloj) — el resto se descarta.
export const MAX_DIAS_CATCHUP_FACCION = 30;
const SALON_KIND = 'sede';

/// Puro: día de ficción del mundo = máximo de `fictionalMinutes` de sus partidas.
export function worldFictionDay(fictionalMinutesPorPartida: number[]): number | null {
  if (fictionalMinutesPorPartida.length === 0) return null;
  return Math.floor(Math.max(...fictionalMinutesPorPartida) / 1440);
}

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
export function tickFactionOneDay(stats: KingdomStatsBlock, produccion: { comida: number; riqueza: number }): KingdomStatsBlock {
  const bocas = stats.poblacion + stats.soldados + stats.visitantes;
  const conProduccion = { ...stats, comida: stats.comida + produccion.comida, riqueza: stats.riqueza + produccion.riqueza, bebida: bocas * 2 + 1 };
  return { ...tickKingdomOneDay(conProduccion), bebida: stats.bebida };
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

/// Recorre las facciones de catálogo y aplica, por mundo y una sola vez por día/semana de ficción:
/// producción + consumo (KingdomStats), stock real en el Almacén (H-2) y decaimiento de presión (H-4).
export async function advanceFactionEconomy(prisma: Db): Promise<{ diasProcesados: number; semanasDecaidas: number; depositados: number }> {
  const result = { diasProcesados: 0, semanasDecaidas: 0, depositados: 0 };

  const estados = await prisma.worldState.findMany({ select: { fictionalMinutes: true, save: { select: { worldId: true } } } });
  const minutosPorMundo = new Map<string, number[]>();
  for (const e of estados) {
    const lista = minutosPorMundo.get(e.save.worldId) ?? [];
    lista.push(e.fictionalMinutes);
    minutosPorMundo.set(e.save.worldId, lista);
  }

  for (const [worldId, minutos] of minutosPorMundo) {
    const diaActual = worldFictionDay(minutos);
    if (diaActual === null) continue;
    // CR-7 (hito 0.2): aquí solo el catálogo; las copias de cada partida, en su avance diario.
    await producirFacciones(prisma, worldId, { worldId, saveId: null }, diaActual, result);
    await decaerRelaciones(prisma, { worldId, saveId: null }, diaActual, result);
  }
  return result;
}

type ResultadoEconomia = { diasProcesados: number; semanasDecaidas: number; depositados: number };

/// Producción, consumo y stock (H-6, H-2) de las facciones de `faccion` hasta `diaActual`.
/// Idempotente por `KingdomStats.ultimoDiaProducido`.
/// CR-12 (12c): las facciones del mundo llevan la cuenta de días de hambre, pero aún no registran
/// `HAMBRUNA`: con los números provisionales de su economía, 6 de las 9 sembradas pasan hambre siempre
/// (sin trabajadores o con más bocas que comida) y se hundirían en semanas. Se enciende cuando estén
/// los números de la economía de supervivencia (pregunta 5 a Álvaro).
export const HAMBRUNA_EN_FACCIONES = false;

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
    include: { faction: { select: { id: true, saveId: true } } },
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
        diasFelicidadAlta: fks.diasFelicidadAlta, diasFelicidadBaja: fks.diasFelicidadBaja, diasHambre: fks.diasHambre,
      };
      for (let i = 0; i < pendientes; i++) stats = tickFactionOneDay(stats, porDia);
      // CR-12 (12c): hambruna de una facción del mundo de una partida (las del catálogo no tienen Libro).
      if (hambruna && fks.faction?.saveId && hambrunaNueva(fks.diasHambre, stats.diasHambre ?? 0, pendientes)) {
        await registrarHambruna(tx, fks.faction.saveId, { factionId });
      }
      await tx.kingdomStats.update({
        where: { id: fks.id },
        data: {
          comida: stats.comida, riqueza: stats.riqueza, felicidad: stats.felicidad,
          diasFelicidadAlta: stats.diasFelicidadAlta, diasFelicidadBaja: stats.diasFelicidadBaja, diasHambre: stats.diasHambre ?? 0,
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
