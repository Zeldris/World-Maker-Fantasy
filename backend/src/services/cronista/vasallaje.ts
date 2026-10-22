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
/// pero no deja al corriente (y sin rearme) hasta saldar lo pendiente. Sin cuota (sin soldados) no
/// hay con qué recortar: lo pendiente se conserva entero y se paga con lo que haya.
export function pagoSemanal(riqueza: number, pendiente: number, cuota: number): { pagado: number; pendiente: number; alCorriente: boolean; fraccion: number } {
  const previo = Math.max(0, pendiente);
  const debe = (cuota > 0 ? Math.min(previo, cuota) : previo) + cuota;
  const pagado = Math.min(Math.max(0, riqueza), debe);
  const resto = cuota > 0 ? Math.min(cuota, debe - pagado) : debe - pagado;
  return { pagado, pendiente: resto, alCorriente: resto === 0, fraccion: cuota > 0 ? Math.min(1, pagado / cuota) : 1 };
}

/// Puro: el porcentaje de la cuota pagado, para la interfaz y el diario (1-99 si pagó solo parte de
/// la cuota; 0 sin pagar; 100 con la cuota entera).
export const porcentajePagado = (fraccion: number) => (fraccion >= 1 ? 100 : fraccion <= 0 ? 0 : Math.min(99, Math.max(1, Math.round(fraccion * 100))));

/// Motivo de ruptura de la regla anterior al 2026-10-22, que ya no existe (se reabren al migrar).
const RUPTURA_VIEJA = 'deuda saldada';

/// Las líneas de la regla nueva (con `estado`) de los vasallos dados (slug → nombre), de una sola
/// consulta: primero por partida y tipo (índice `[saveId, tipo]`), luego por sus actores, agrupadas en
/// memoria por vasallo. `ultima` es la última línea de revisión (sin las `migrado`, que pueden llevar
/// minutos posteriores a una revisión de días atrasados); `marcada`, si tiene alguna de la regla nueva,
/// `migrado` incluida. `sinTope` lee todo el diario del vasallo: la migración lo usa para que `marcada`
/// no dependa de que la marca caiga dentro de las últimas líneas.
async function lineasNuevas(tx: Tx, saveId: string, vasallos: Map<string, string>, sinTope = false): Promise<Map<string, { ultima: DatosLinea | null; marcada: boolean }>> {
  const porVasallo = new Map([...vasallos.keys()].map((v) => [v, { ultima: null as DatosLinea | null, marcada: false }]));
  if (vasallos.size === 0) return porVasallo;
  // Las líneas sin `vasalloSlug` (escritas antes de guardarlo) se asignan por `datos.vasallo`, el
  // nombre del vasallo: los actores no guardan orden (vasallo y señor son los dos AFECTADO).
  const porNombre = new Map([...vasallos].map(([slug, nombre]) => [nombre, slug]));
  // Con tope: basta con las últimas semanas de cada vasallo (una línea por semana como mucho).
  const lineas = await tx.suceso.findMany({
    where: { saveId, tipo: 'PATRULLA_VASALLO', actores: { some: { entidadTipo: 'FACCION', entidadId: { in: [...vasallos.keys()] } } } },
    orderBy: { fictionalMinutes: 'desc' },
    ...(sinTope ? {} : { take: LINEAS_POR_VASALLO * vasallos.size }),
    select: { datos: true },
  });
  let faltan = vasallos.size;
  for (const l of lineas) {
    const d = l.datos as DatosLinea;
    if (!d.estado) continue;
    const e = porVasallo.get(d.vasalloSlug ?? porNombre.get(d.vasallo ?? '') ?? '');
    if (!e || (e.ultima && e.marcada)) continue;
    e.marcada = true;
    if (!e.ultima && d.estado !== 'migrado') e.ultima = d;
    if (e.ultima && --faltan === 0) break;
  }
  return porVasallo;
}
type DatosLinea = { estado?: string; porcentaje?: number; vasalloSlug?: string; vasallo?: string };
const LINEAS_POR_VASALLO = 50;

/// Puro: cuántos trabajadores pasan a guerreros con un excedente de comida (cada uno deja de producir 2).
export const rearme = (margenComida: number, trabajadores: number) => Math.max(0, Math.min(trabajadores, Math.floor(margenComida / 2)));

/// Crea los vasallajes del canon si aún no existen en la partida (idempotente) y migra, una sola vez
/// por fila, los de antes del 2026-10-22. Corre cada día, así que no cobra ni toca nada de la regla
/// nueva (el cobro y el tope de una cuota van en la revisión semanal):
///   - los rotos por «deuda saldada» (regla vieja) se reabren al corriente si siguen vivas las dos;
///   - una deuda vieja de más de una cuota se recorta a una cuota, sin cobrar nada, y deja su línea
///     (`estado: 'migrado'`), que es la marca de que ya se migró. Solo se mira el diario si la deuda
///     pasa de la cuota actual (con la regla nueva, solo tras bajas a mitad de semana), y entero: con
///     CUALQUIER línea con `estado` del vasallo no se migra (toda revisión que deja algo pendiente la
///     escribe, así que una deuda de la regla nueva siempre la tiene).
export async function asegurarVasallajes(tx: Tx, saveId: string, ahora: number): Promise<void> {
  for (const v of await tx.vasallaje.findMany({ where: { saveId, motivoRuptura: RUPTURA_VIEJA } })) {
    const vivas = await tx.faction.count({ where: { saveId, slug: { in: [v.vasalloSlug, v.senorSlug] }, disueltaEn: null } });
    if (vivas === 2) await tx.vasallaje.update({ where: { id: v.id }, data: { rotoEn: null, motivoRuptura: null, deuda: 0 } });
  }
  const conDeuda = await tx.vasallaje.findMany({ where: { saveId, rotoEn: null, deuda: { gt: 0 } } });
  if (conDeuda.length > 0) {
    const facciones = await tx.faction.findMany({
      where: { saveId, slug: { in: [...new Set(conDeuda.flatMap((v) => [v.vasalloSlug, v.senorSlug]))] } },
      select: { slug: true, name: true, kingdomStats: { select: { soldados: true } } },
    });
    const porSlug = new Map(facciones.map((f) => [f.slug, f]));
    const pasadas = conDeuda.filter((v) => {
      const k = porSlug.get(v.vasalloSlug)?.kingdomStats;
      return !!k && v.deuda > cuotaSemanal(k.soldados);
    });
    // Sin tope: la marca de la regla nueva puede quedar lejos (p. ej. muchas líneas en las que es señor).
    const lineas = await lineasNuevas(tx, saveId, new Map(pasadas.map((v) => [v.vasalloSlug, porSlug.get(v.vasalloSlug)!.name])), true);
    for (const v of pasadas) {
      if (lineas.get(v.vasalloSlug)?.marcada) continue;
      const pendiente = cuotaSemanal(porSlug.get(v.vasalloSlug)!.kingdomStats!.soldados);
      await tx.vasallaje.update({ where: { id: v.id }, data: { deuda: pendiente } });
      await registrarSuceso(tx, {
        saveId, tipo: 'PATRULLA_VASALLO', fictionalMinutes: ahora, origen: 'MUNDO',
        actores: [{ entidadTipo: 'FACCION', entidadId: v.vasalloSlug, papel: 'AFECTADO' }, { entidadTipo: 'FACCION', entidadId: v.senorSlug, papel: 'AFECTADO' }],
        datos: { vasalloSlug: v.vasalloSlug, vasallo: porSlug.get(v.vasalloSlug)!.name, senor: porSlug.get(v.senorSlug)?.name ?? v.senorSlug, estado: 'migrado', pendiente },
      });
    }
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
    // También al saldar lo pendiente, aunque no patrulle (p. ej. sin cuota, sin guerreros).
    if (!pago.alCorriente || (patrullo && !huboEscaramuza) || v.deuda > 0) {
      await registrarSuceso(tx, {
        saveId, tipo: 'PATRULLA_VASALLO', fictionalMinutes: ahora, origen: 'MUNDO',
        actores: [{ entidadTipo: 'FACCION', entidadId: v.vasalloSlug, papel: 'AFECTADO' }, { entidadTipo: 'FACCION', entidadId: v.senorSlug, papel: 'AFECTADO' }],
        datos: {
          vasalloSlug: v.vasalloSlug, vasallo: vasallo.name, senor: senor.name,
          ...(pago.alCorriente
            ? { estado: 'al-corriente' as const, patrulla: patrullo }
            : pago.fraccion > 0
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
  // El porcentaje del último pago sale de la última línea de revisión de ese vasallo (toda revisión con
  // algo pendiente la deja; una consulta para todos); sin línea de revisión (p. ej. recién migrado), null.
  const lineas = await lineasNuevas(tx, saveId, new Map(filas.filter((f) => f.deuda > 0).map((f) => [f.vasalloSlug, nombres.get(f.vasalloSlug) ?? f.vasalloSlug])));
  const porcentajes = new Map<string, number | null>();
  for (const [slug, { ultima: d }] of lineas) porcentajes.set(slug, d?.estado === 'parcial' ? (d.porcentaje ?? 0) : d?.estado === 'impagado' ? 0 : null);
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
