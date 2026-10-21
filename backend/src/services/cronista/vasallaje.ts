// Vasallaje y deuda (CR-59, hito 0.3 — Fase D, decisiones Q21-Q24 y Q28 de la usuaria del 2026-10-06).
// Idea de la usuaria: los Serhu «no saben crecer». Son vasallos de la Concordia de Hierro, que les
// vende las armas al doble y a crédito y les cobra la deuda en patrullas obligadas. Cada semana:
//   1. las armas: el desgaste de las de sus soldados, al doble, al señor (lo que no paguen, a deuda);
//   2. el rearme: todo excedente de comida pasa trabajadores a guerreros, con sus armas al doble;
//   3. la patrulla: 20 guerreros a una zona de su región; 25 % de escaramuza, que se pelea de verdad
//      contra 1d6+2 rivales (CR-62, combate de fondo); cada
//      patrulla rebaja 100 la deuda.
// El ciclo se rompe si se salda la deuda o cae el señor (Q24; la alianza con el Reino y la guerra
// llegan con `CR-37`).
import { pelearEscaramuza, resumenEscaramuza } from './escaramuzas.js';
import type { Prisma } from '@prisma/client';
import { EQUIPO } from './facturaEquipo.js';
import { produccionDeFaccion } from '../kingdomTick.js';
import { registrarSuceso } from './sucesos.js';
import { REPARTO_FACCIONES } from '../../scripts/repartoFacciones.js';

type Tx = Prisma.TransactionClient;

export const SOBREPRECIO_ARMAS = 2;
export const PATRULLA_GUERREROS = 20;
export const PROB_ESCARAMUZA = 0.25;
export const DEUDA_POR_PATRULLA = 100;
/// Deuda con la que empieza el vasallaje del canon (viene de lejos, desde el golpe de Ketg).
export const DEUDA_INICIAL = 500;
/// Los vasallajes del canon de cada partida.
export const VASALLAJES_DEL_CANON = [{ vasallo: 'clan-serhu', senor: 'concordia-de-hierro' }];

/// Puro: armas de una semana, al doble (desgaste de las armas de sus soldados).
export const armasDeLaSemana = (soldados: number) => Math.round(((soldados * EQUIPO.arma.valor) / EQUIPO.arma.semanas) * SOBREPRECIO_ARMAS);

/// Puro: cuántos trabajadores pasan a guerreros con un excedente de comida (cada uno deja de producir 2).
export const rearme = (margenComida: number, trabajadores: number) => Math.max(0, Math.min(trabajadores, Math.floor(margenComida / 2)));

/// Crea los vasallajes del canon si aún no existen en la partida (idempotente).
export async function asegurarVasallajes(tx: Tx, saveId: string, ahora: number): Promise<void> {
  for (const v of VASALLAJES_DEL_CANON) {
    if (await tx.vasallaje.findUnique({ where: { saveId_vasalloSlug: { saveId, vasalloSlug: v.vasallo } } })) continue;
    const vivas = await tx.faction.count({ where: { saveId, slug: { in: [v.vasallo, v.senor] }, disueltaEn: null } });
    if (vivas < 2) continue;
    await tx.vasallaje.create({ data: { saveId, vasalloSlug: v.vasallo, senorSlug: v.senor, deuda: DEUDA_INICIAL, desdeMinutes: ahora } });
  }
}

const fila = (tx: Tx, saveId: string, slug: string) => tx.worldPopulation.findFirst({ where: { saveId, targetType: 'FACCION', targetSlug: slug } });

/// Una semana de cada vasallaje vivo de la partida (idempotente por `ultimaSemana`).
export async function revisarVasallajes(tx: Tx, saveId: string, dia: number, ahora: number, random: () => number): Promise<{ escaramuzas: number }> {
  let escaramuzas = 0;
  for (const v of await tx.vasallaje.findMany({ where: { saveId, rotoEn: null } })) {
    if (v.ultimaSemana != null && dia - v.ultimaSemana < 7) continue;
    await tx.vasallaje.update({ where: { id: v.id }, data: { ultimaSemana: dia } });
    const [vasallo, senor] = await Promise.all(
      [v.vasalloSlug, v.senorSlug].map((slug) => tx.faction.findFirst({ where: { saveId, slug, disueltaEn: null }, select: { id: true, slug: true, name: true, worldId: true, raza: true, kingdomStats: true } })),
    );
    if (!vasallo || !senor || !vasallo.kingdomStats || !senor.kingdomStats) {
      await tx.vasallaje.update({ where: { id: v.id }, data: { rotoEn: ahora, motivoRuptura: senor ? 'el vasallo ya no existe' : 'cayó el señor' } });
      continue;
    }
    let deuda = v.deuda;
    let riqueza = vasallo.kingdomStats.riqueza;
    const cobrar = (goirnos: number) => {
      const pagado = Math.min(riqueza, goirnos);
      riqueza -= pagado;
      deuda += goirnos - pagado;
      return pagado;
    };
    // 1. Armas de la semana.
    let alSenor = cobrar(armasDeLaSemana(vasallo.kingdomStats.soldados));
    // 2. Rearme con el excedente de comida.
    const [trab, sold] = await Promise.all([fila(tx, saveId, `${v.vasalloSlug}-trabajadores`), fila(tx, saveId, `${v.vasalloSlug}-soldados`)]);
    const k = vasallo.kingdomStats;
    // Lo que comen frente a lo que producen sus trabajadores y sus edificios (Serhu: +1, comen justo).
    const edificios = await tx.building.findMany({ where: { factionId: vasallo.id, status: 'ACTIVO' }, select: { recipeKey: true, status: true, kind: true } });
    const margen = produccionDeFaccion(edificios, vasallo.raza ?? null, k).comida - (k.poblacion + k.soldados + k.visitantes);
    const nuevos = trab && sold ? rearme(margen, trab.poblacion) : 0;
    if (nuevos > 0) {
      await tx.worldPopulation.update({ where: { id: trab!.id }, data: { poblacion: { decrement: nuevos } } });
      await tx.worldPopulation.update({ where: { id: sold!.id }, data: { poblacion: { increment: nuevos }, poblacionMax: Math.max(sold!.poblacionMax, sold!.poblacion + nuevos) } });
      alSenor += cobrar(nuevos * EQUIPO.arma.valor * SOBREPRECIO_ARMAS);
    }
    // 3. Patrulla obligada.
    let patrullo = false;
    let huboEscaramuza = false;
    if (sold && sold.poblacion + nuevos >= PATRULLA_GUERREROS) {
      deuda = Math.max(0, deuda - DEUDA_POR_PATRULLA);
      patrullo = true;
      if (random() < PROB_ESCARAMUZA) {
        const region = Object.keys((sold.distribucion ?? {}) as Record<string, number>)[0] ?? null;
        const rival = await tx.faction.findFirst({
          where: {
            saveId, disueltaEn: null, origenSlug: { not: null },
            slug: { notIn: [v.vasalloSlug, v.senorSlug], in: REPARTO_FACCIONES.filter((r) => r.region === region).map((r) => r.slug) },
          },
          orderBy: { slug: 'asc' },
          select: { slug: true, name: true, kingdomStats: { select: { id: true } } },
        });
        // CR-62 (62c, Q4): la patrulla (20) pelea de verdad contra 1d6+2 de la otra facción de su región
        // o contra renegados (combate de fondo, ADR 0002); las bajas ya las resta `pelearEscaramuza`.
        const pelea = await pelearEscaramuza(tx, { saveId, worldId: senor.worldId }, v.vasalloSlug, rival?.slug ?? null, PATRULLA_GUERREROS, 3 + Math.floor(random() * 6), random);
        await registrarSuceso(tx, {
          saveId, tipo: 'ESCARAMUZA', fictionalMinutes: ahora, origen: 'MUNDO',
          actores: [{ entidadTipo: 'FACCION', entidadId: v.vasalloSlug, papel: 'AFECTADO' }, ...(rival ? [{ entidadTipo: 'FACCION' as const, entidadId: rival.slug, papel: 'AFECTADO' as const }] : [])],
          datos: { faccionA: vasallo.name, faccionB: rival?.name ?? 'los renegados', ...(region ? { region } : {}), ...(pelea ? { resultado: resumenEscaramuza(pelea) } : {}) },
        });
        escaramuzas++;
        huboEscaramuza = true;
      }
    }
    // P297: sin escaramuza la semana no dejaba rastro; el diario dice que patrulló y cómo queda la deuda.
    if (patrullo && !huboEscaramuza) {
      await registrarSuceso(tx, {
        saveId, tipo: 'PATRULLA_VASALLO', fictionalMinutes: ahora, origen: 'MUNDO',
        actores: [{ entidadTipo: 'FACCION', entidadId: v.vasalloSlug, papel: 'AFECTADO' }, { entidadTipo: 'FACCION', entidadId: v.senorSlug, papel: 'AFECTADO' }],
        datos: { vasallo: vasallo.name, senor: senor.name, deuda, ...(nuevos > 0 ? { rearmados: nuevos } : {}) },
      });
    }
    await tx.kingdomStats.update({ where: { id: vasallo.kingdomStats.id }, data: { riqueza, trabajadores: { decrement: nuevos }, poblacion: { decrement: nuevos }, soldados: { increment: nuevos } } });
    if (alSenor > 0) await tx.kingdomStats.update({ where: { id: senor.kingdomStats.id }, data: { riqueza: { increment: alSenor } } });
    await tx.vasallaje.update({ where: { id: v.id }, data: { deuda, ...(deuda === 0 ? { rotoEn: ahora, motivoRuptura: 'deuda saldada' } : {}) } });
  }
  return { escaramuzas };
}

export interface VasallajeVista {
  vasalloSlug: string;
  vasalloNombre: string;
  senorSlug: string;
  senorNombre: string;
  deuda: number;
  /// Reglas vigentes (las constantes de este módulo), para que la interfaz no las repita a mano.
  deudaPorPatrulla: number;
  sobreprecioArmas: number;
  patrullaGuerreros: number;
  /// Próximo día de ficción en que se revisa (semanal); null si roto.
  proximaRevision: number | null;
  rotoEn: number | null;
  motivoRuptura: string | null;
}

/// P286: lo que enseña Reino › Diplomacia de cada vasallaje de la partida (también los rotos).
export async function vasallajesVista(tx: Tx, saveId: string, dia: number): Promise<VasallajeVista[]> {
  const filas = await tx.vasallaje.findMany({ where: { saveId }, orderBy: { vasalloSlug: 'asc' } });
  const slugs = [...new Set(filas.flatMap((f) => [f.vasalloSlug, f.senorSlug]))];
  const nombres = new Map((await tx.faction.findMany({ where: { saveId, slug: { in: slugs } }, select: { slug: true, name: true } })).map((f) => [f.slug, f.name]));
  return filas.map((f) => ({
    vasalloSlug: f.vasalloSlug,
    vasalloNombre: nombres.get(f.vasalloSlug) ?? f.vasalloSlug,
    senorSlug: f.senorSlug,
    senorNombre: nombres.get(f.senorSlug) ?? f.senorSlug,
    deuda: f.deuda,
    deudaPorPatrulla: DEUDA_POR_PATRULLA,
    sobreprecioArmas: SOBREPRECIO_ARMAS,
    patrullaGuerreros: PATRULLA_GUERREROS,
    proximaRevision: f.rotoEn != null ? null : Math.max(dia, (f.ultimaSemana ?? dia - 7) + 7),
    rotoEn: f.rotoEn,
    motivoRuptura: f.motivoRuptura,
  }));
}
