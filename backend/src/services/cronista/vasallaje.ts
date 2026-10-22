// Vasallaje y deuda (CR-59, hito 0.3 — Fase D, decisiones Q21-Q24 y Q28 de la usuaria del 2026-10-06).
// Idea de la usuaria: los Serhu «no saben crecer». Son vasallos de la Concordia de Hierro, que les
// vende las armas al doble. Decisión de la usuaria 2026-10-22 (P286/P297): presupuesto al estilo
// X4: Foundations, sin deuda acumulada. Cada semana:
//   1. la cuota: el desgaste de las armas de sus soldados, al doble, sale del tesoro del vasallo y va
//      al señor; lo que sobre paga lo pendiente de la semana anterior. Si no le llega, paga lo que
//      pueda («pago parcial», decisión del mismo día) y lo pendiente nunca pasa de una cuota; si no
//      paga nada, el vasallaje queda «impagado»;
//   2. el rearme: el excedente de comida pasa trabajadores a guerreros, con sus armas al doble, solo
//      al corriente y con lo que le quede en el tesoro tras la cuota (sin crédito);
//   3. la patrulla, en proporción a lo pagado de la cuota de la semana (pagar el 40 % da un 40 % de
//      probabilidad de patrullar; sin pagar, no patrulla): 20 guerreros a una zona de su región; 25 % de escaramuza, que se pelea
//      de verdad contra 1d6+2 rivales (CR-62, combate de fondo). La patrulla es el servicio que se
//      paga; ya no rebaja deuda.
// El ciclo se rompe si cae el señor o el vasallo (Q24; la alianza con el Reino y la guerra llegan con
// `CR-37`).
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
/// Los vasallajes del canon de cada partida.
export const VASALLAJES_DEL_CANON = [{ vasallo: 'clan-serhu', senor: 'concordia-de-hierro' }];

/// Puro: armas de una semana, al doble (desgaste de las armas de sus soldados).
export const armasDeLaSemana = (soldados: number) => Math.round(((soldados * EQUIPO.arma.valor) / EQUIPO.arma.semanas) * SOBREPRECIO_ARMAS);

/// Puro: la cuota semanal es el desgaste de sus armas al doble (decisión 2026-10-22).
export const cuotaSemanal = armasDeLaSemana;

/// Puro: un pago semanal. Paga primero la cuota de la semana y con lo que sobre lo pendiente (como
/// mucho una cuota); lo que no llegue queda pendiente, con tope de una cuota (no se acumula; este es
/// el único sitio donde se aplica el tope). `fraccion` es la parte pagada de la cuota de la semana
/// (0-1): la probabilidad de que patrulle. Pagar la cuota entera con algo pendiente patrulla seguro,
/// pero no deja al corriente (y sin rearme) hasta saldar lo pendiente.
export function pagoSemanal(riqueza: number, pendiente: number, cuota: number): { pagado: number; pendiente: number; alCorriente: boolean; fraccion: number } {
  const debe = Math.min(Math.max(0, pendiente), cuota) + cuota;
  const pagado = Math.min(Math.max(0, riqueza), debe);
  const resto = Math.min(cuota, debe - pagado);
  return { pagado, pendiente: resto, alCorriente: resto === 0, fraccion: cuota > 0 ? Math.min(1, pagado / cuota) : 1 };
}

/// Puro: el porcentaje de la cuota pagado, para la interfaz y el diario (1-99 si pagó solo parte de
/// la cuota; 0 sin pagar; 100 con la cuota entera).
export const porcentajePagado = (fraccion: number) => (fraccion >= 1 ? 100 : fraccion <= 0 ? 0 : Math.min(99, Math.max(1, Math.round(fraccion * 100))));

/// Motivo de ruptura de la regla anterior al 2026-10-22, que ya no existe (se reabren al migrar).
const RUPTURA_VIEJA = 'deuda saldada';

/// La última línea del diario de un vasallaje (por el slug del vasallo como actor), o null.
async function ultimaLineaDe(tx: Tx, saveId: string, vasalloSlug: string): Promise<DatosLinea | null> {
  const s = await tx.suceso.findFirst({
    where: { saveId, tipo: 'PATRULLA_VASALLO', actores: { some: { entidadTipo: 'FACCION', entidadId: vasalloSlug } } },
    orderBy: { fictionalMinutes: 'desc' },
    select: { datos: true },
  });
  return s ? (s.datos as DatosLinea) : null;
}
type DatosLinea = { estado?: string; porcentaje?: number };

/// Puro: cuántos trabajadores pasan a guerreros con un excedente de comida (cada uno deja de producir 2).
export const rearme = (margenComida: number, trabajadores: number) => Math.max(0, Math.min(trabajadores, Math.floor(margenComida / 2)));

/// Crea los vasallajes del canon si aún no existen en la partida (idempotente) y migra, una sola vez
/// por fila, los de antes del 2026-10-22. Corre cada día, así que no toca nada de la regla nueva (el
/// tope de una cuota va en la revisión semanal):
///   - los rotos por «deuda saldada» (regla vieja) se reabren al corriente si siguen vivas las dos;
///   - una deuda vieja (con algo pendiente y sin línea de la regla nueva en el diario) se recorta a
///     una cuota, o se salda si hay fondos, y deja su línea (`estado: 'migrado'`), que es la marca de
///     que ya se migró.
export async function asegurarVasallajes(tx: Tx, saveId: string, ahora: number): Promise<void> {
  for (const v of await tx.vasallaje.findMany({ where: { saveId, motivoRuptura: RUPTURA_VIEJA } })) {
    const vivas = await tx.faction.count({ where: { saveId, slug: { in: [v.vasalloSlug, v.senorSlug] }, disueltaEn: null } });
    if (vivas === 2) await tx.vasallaje.update({ where: { id: v.id }, data: { rotoEn: null, motivoRuptura: null, deuda: 0 } });
  }
  for (const v of await tx.vasallaje.findMany({ where: { saveId, rotoEn: null, deuda: { gt: 0 } } })) {
    if ((await ultimaLineaDe(tx, saveId, v.vasalloSlug))?.estado) continue;
    const [vasallo, senor] = await Promise.all(
      [v.vasalloSlug, v.senorSlug].map((slug) => tx.faction.findFirst({ where: { saveId, slug }, select: { name: true, kingdomStats: { select: { id: true, riqueza: true, soldados: true } } } })),
    );
    const k = vasallo?.kingdomStats;
    if (!vasallo || !k) continue;
    const cuota = cuotaSemanal(k.soldados);
    const saldar = v.deuda > cuota && k.riqueza >= cuota && !!senor?.kingdomStats;
    if (saldar) {
      await tx.kingdomStats.update({ where: { id: k.id }, data: { riqueza: { decrement: cuota } } });
      await tx.kingdomStats.update({ where: { id: senor!.kingdomStats!.id }, data: { riqueza: { increment: cuota } } });
    }
    const pendiente = saldar ? 0 : Math.min(v.deuda, cuota);
    await tx.vasallaje.update({ where: { id: v.id }, data: { deuda: pendiente } });
    await registrarSuceso(tx, {
      saveId, tipo: 'PATRULLA_VASALLO', fictionalMinutes: ahora, origen: 'MUNDO',
      actores: [{ entidadTipo: 'FACCION', entidadId: v.vasalloSlug, papel: 'AFECTADO' }, { entidadTipo: 'FACCION', entidadId: v.senorSlug, papel: 'AFECTADO' }],
      datos: { vasallo: vasallo.name, senor: senor?.name ?? v.senorSlug, estado: 'migrado', pendiente, ...(saldar ? { pagado: cuota } : {}) },
    });
  }
  for (const v of VASALLAJES_DEL_CANON) {
    if (await tx.vasallaje.findUnique({ where: { saveId_vasalloSlug: { saveId, vasalloSlug: v.vasallo } } })) continue;
    const vivas = await tx.faction.count({ where: { saveId, slug: { in: [v.vasallo, v.senor] }, disueltaEn: null } });
    if (vivas < 2) continue;
    await tx.vasallaje.create({ data: { saveId, vasalloSlug: v.vasallo, senorSlug: v.senor, deuda: 0, desdeMinutes: ahora } });
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
    // 1. La cuota de la semana (y lo pendiente de la anterior), del tesoro del vasallo al señor.
    const pago = pagoSemanal(vasallo.kingdomStats.riqueza, v.deuda, cuotaSemanal(vasallo.kingdomStats.soldados));
    let riqueza = vasallo.kingdomStats.riqueza - pago.pagado;
    let alSenor = pago.pagado;
    // 2. Rearme con el excedente de comida, solo con lo que quede en el tesoro (sin crédito).
    const [trab, sold] = await Promise.all([fila(tx, saveId, `${v.vasalloSlug}-trabajadores`), fila(tx, saveId, `${v.vasalloSlug}-soldados`)]);
    const k = vasallo.kingdomStats;
    // Lo que comen frente a lo que producen sus trabajadores y sus edificios (Serhu: +1, comen justo).
    const edificios = await tx.building.findMany({ where: { factionId: vasallo.id, status: 'ACTIVO' }, select: { recipeKey: true, status: true, kind: true } });
    const margen = produccionDeFaccion(edificios, vasallo.raza ?? null, k).comida - (k.poblacion + k.soldados + k.visitantes);
    const precioArma = EQUIPO.arma.valor * SOBREPRECIO_ARMAS;
    const nuevos = trab && sold && pago.alCorriente ? Math.min(rearme(margen, trab.poblacion), Math.floor(riqueza / precioArma)) : 0;
    if (nuevos > 0) {
      await tx.worldPopulation.update({ where: { id: trab!.id }, data: { poblacion: { decrement: nuevos } } });
      await tx.worldPopulation.update({ where: { id: sold!.id }, data: { poblacion: { increment: nuevos }, poblacionMax: Math.max(sold!.poblacionMax, sold!.poblacion + nuevos) } });
      riqueza -= nuevos * precioArma;
      alSenor += nuevos * precioArma;
    }
    // 3. Patrulla obligada, en proporción a lo pagado de la cuota (impagado: patrullas suspendidas esa semana).
    let patrullo = false;
    let huboEscaramuza = false;
    const tocaPatrulla = pago.alCorriente || (pago.fraccion > 0 && random() < pago.fraccion);
    if (tocaPatrulla && sold && sold.poblacion + nuevos >= PATRULLA_GUERREROS) {
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
    // P297: sin escaramuza la semana no dejaba rastro; el diario dice si está al corriente y patrulla
    // o si queda impagado con las patrullas suspendidas.
    if (!pago.alCorriente || (patrullo && !huboEscaramuza)) {
      await registrarSuceso(tx, {
        saveId, tipo: 'PATRULLA_VASALLO', fictionalMinutes: ahora, origen: 'MUNDO',
        actores: [{ entidadTipo: 'FACCION', entidadId: v.vasalloSlug, papel: 'AFECTADO' }, { entidadTipo: 'FACCION', entidadId: v.senorSlug, papel: 'AFECTADO' }],
        datos: {
          vasallo: vasallo.name, senor: senor.name,
          ...(pago.alCorriente
            ? { estado: 'al-corriente' as const }
            : pago.pagado > 0
              ? { estado: 'parcial' as const, porcentaje: porcentajePagado(pago.fraccion), patrulla: patrullo, pendiente: pago.pendiente }
              : { estado: 'impagado' as const }),
          ...(nuevos > 0 ? { rearmados: nuevos } : {}),
        },
      });
    }
    await tx.kingdomStats.update({ where: { id: vasallo.kingdomStats.id }, data: { riqueza, trabajadores: { decrement: nuevos }, poblacion: { decrement: nuevos }, soldados: { increment: nuevos } } });
    if (alSenor > 0) await tx.kingdomStats.update({ where: { id: senor.kingdomStats.id }, data: { riqueza: { increment: alSenor } } });
    await tx.vasallaje.update({ where: { id: v.id }, data: { deuda: pago.pendiente } });
  }
  return { escaramuzas };
}

export interface VasallajeVista {
  vasalloSlug: string;
  vasalloNombre: string;
  senorSlug: string;
  senorNombre: string;
  /// Lo que quedó sin pagar la última semana (como mucho una cuota); 0 si está al corriente.
  deuda: number;
  /// false: pago parcial o impagado, con las patrullas en proporción a lo pagado.
  alCorriente: boolean;
  /// Lo pagado de la cuota en la última revisión (0-100): la probabilidad de patrullar. 100 si está al
  /// corriente; null si debe algo y aún no hay línea de revisión (pendiente de la revisión semanal).
  porcentajePagado: number | null;
  /// Cuota semanal actual (las armas de sus soldados al doble).
  cuota: number;
  /// Reglas vigentes (las constantes de este módulo), para que la interfaz no las repita a mano.
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
  const facciones = await tx.faction.findMany({ where: { saveId, slug: { in: slugs } }, select: { slug: true, name: true, kingdomStats: { select: { soldados: true } } } });
  const nombres = new Map(facciones.map((f) => [f.slug, f.name]));
  const soldados = new Map(facciones.map((f) => [f.slug, f.kingdomStats?.soldados ?? 0]));
  // El porcentaje del último pago sale de la última línea del diario de ese vasallo (toda revisión con
  // algo pendiente la deja); sin línea de revisión (p. ej. recién migrado), null.
  const porcentajes = new Map<string, number | null>();
  for (const f of filas) {
    if (f.deuda === 0) continue;
    const d = await ultimaLineaDe(tx, saveId, f.vasalloSlug);
    porcentajes.set(f.vasalloSlug, d?.estado === 'parcial' ? (d.porcentaje ?? 0) : d?.estado === 'impagado' ? 0 : null);
  }
  return filas.map((f) => ({
    vasalloSlug: f.vasalloSlug,
    vasalloNombre: nombres.get(f.vasalloSlug) ?? f.vasalloSlug,
    senorSlug: f.senorSlug,
    senorNombre: nombres.get(f.senorSlug) ?? f.senorSlug,
    deuda: f.deuda,
    alCorriente: f.deuda === 0,
    porcentajePagado: f.deuda === 0 ? 100 : (porcentajes.get(f.vasalloSlug) ?? null),
    cuota: cuotaSemanal(soldados.get(f.vasalloSlug) ?? 0),
    sobreprecioArmas: SOBREPRECIO_ARMAS,
    patrullaGuerreros: PATRULLA_GUERREROS,
    proximaRevision: f.rotoEn != null ? null : Math.max(dia, (f.ultimaSemana ?? dia - 7) + 7),
    rotoEn: f.rotoEn,
    motivoRuptura: f.motivoRuptura,
  }));
}
