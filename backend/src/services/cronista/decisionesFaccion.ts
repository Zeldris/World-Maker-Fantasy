// Decisiones de facción (CR-34 paso 34c, hito 0.2 — diseño en roadmap-cronista.md, entrada CR-34).
// Una vez por día de ficción y partida (`avanceDiario.ts`, tras el narrador de fondo), cada facción
// del mundo de la partida a la que le toca revisar su situación (Q6: semanal, o antes con una
// carencia grave) puede tomar UNA decisión diplomática:
//
// - **Proponer un tratado** (desde neutral) o **una alianza** (solo desde tratado, Q12): la otra
//   facción responde en el acto con su propia IA; si acepta, las dos direcciones van a 35 / 15; si
//   rechaza, la presión de quien propuso sube 5.
// - **Declarar la guerra** (solo desde tensión, Q13): las dos direcciones a 80, y los aliados de la
//   víctima suben su presión contra el agresor.
// - **Pedir la paz** (solo en guerra): se acepta si la otra también sufre; las dos a 65.
// - **Presionar** a una facción neutral (solo las belicosas): +10 hacia ella.
//
// Qué opción elige depende de sus carencias (`carencias.ts`), su disposición y el tramo de
// Inteligencia de su líder (Q4): el impulsivo elige casi al azar (y puede declarar una guerra que no
// le conviene), el sensato puntúa con algo de ruido y el estratega elige lo mejor sin abrir dos
// guerras. Sin líder no decide nada grande (Q8). Las decisiones gastan el presupuesto de tensión del
// narrador de fondo según la importancia de su suceso (Q17), así que el Ritmo del mundo las gobierna.
// Cada una queda en el Libro y llega a «El mundo» con el rumor por distancia (Q9).
//
// El Reino de la jugadora (Q7, paso 34e) solo recibe propuestas de tratado o alianza (una noticia con
// Aceptar y Rechazar y 3 días de plazo; dejarla pasar es rechazarla) y presión de las belicosas;
// nunca una guerra (`CR-37`). Él no decide aquí: responde la jugadora.
import type { Disposicion, FactionRelationType, Prisma, PrismaClient } from '@prisma/client';
import { tickFactionProduction } from '../kingdomTick.js';
import { ETIQUETA_BANDA, stageForPresion, typeForPresion, PRESION_MAX, PRESION_MIN, PRESION_NEUTRAL } from '../factionRelations.js';
import { carenciasDe, inteligenciaDelLider, tocaRevisar, tramoDeInteligencia, type Carencia, type Tramo } from './carencias.js';
import { CATALOGO_SUCESOS, type TipoSuceso } from './catalogoSucesos.js';
import { costeDe } from './narradorFondo.js';
import { categoriaDeFamilia, darNoticia, type MetaNoticia } from './noticias.js';
import type { CtxConsecuencia } from './consecuencias.js';
import { registrarSuceso, type ActorSuceso } from './sucesos.js';

type Tx = Prisma.TransactionClient;

// ─────────────────────────── Parte pura ───────────────────────────

export type AccionDiplomatica = 'PROPONER_TRATADO' | 'PROPONER_ALIANZA' | 'DECLARAR_GUERRA' | 'PEDIR_PAZ' | 'PRESIONAR';

/// Presión en las dos direcciones tras cada pacto (Q12, Q13) y empujones.
export const PRESION_TRAS = { TRATADO: 35, ALIANZA: 15, GUERRA: 80, PAZ: 65 } as const;
export const SUBE_AL_RECHAZAR = 5;
export const SUBEN_ALIADOS_DE_LA_VICTIMA = 10;
export const SUBE_AL_PRESIONAR = 10;
/// Ruido del sensato al puntuar (Q4): ± la mitad de esto.
export const RUIDO_SENSATO = 2;

/// Lo que una facción sabe de su relación con otra.
export interface VistaRelacion {
  otroId: string;
  /// Estado del par: la banda de la dirección más hostil de las dos.
  tipo: FactionRelationType;
  soldadosOtro: number;
  /// Las dos están en tensión o guerra con una tercera.
  enemigoComun: boolean;
  /// Es el Reino de la jugadora: solo se le proponen pactos o se le presiona (Q7).
  esReino?: boolean;
}

export interface VistaFaccion {
  id: string;
  disposicion: Disposicion;
  /// Null sin líder (Q8).
  tramo: Tramo | null;
  soldados: number;
  carencias: Carencia[];
  relaciones: VistaRelacion[];
}

export interface Opcion {
  accion: AccionDiplomatica;
  objetivoId: string;
  puntuacion: number;
}

const tiene = (v: VistaFaccion, tipo: Carencia['tipo']) => v.carencias.some((c) => c.tipo === tipo);
const bono = (v: VistaFaccion, porDisposicion: Partial<Record<Disposicion, number>>) => porDisposicion[v.disposicion] ?? 0;

/// Puro: fuerza propia frente a la del otro, como la valora un líder con juicio (el impulsivo no la mira).
function ventajaMilitar(v: VistaFaccion, r: VistaRelacion): number {
  if (v.tramo === 'IMPULSIVO') return 0;
  const proporcion = r.soldadosOtro === 0 ? (v.soldados > 0 ? Infinity : 1) : v.soldados / r.soldadosOtro;
  if (proporcion >= 2 && v.tramo === 'ESTRATEGA') return 3;
  if (proporcion >= 1.2) return 2;
  if (proporcion < 0.8) return -2;
  return 0;
}

/// Puro: las decisiones diplomáticas que tienen sentido para la facción, con su puntuación (solo las
/// positivas). Sin líder, ninguna.
export function opcionesDiplomaticas(v: VistaFaccion): Opcion[] {
  if (v.tramo === null) return [];
  const enGuerras = v.relaciones.filter((r) => r.tipo === 'GUERRA').length;
  const opciones: Opcion[] = [];
  const graves = v.carencias.filter((c) => c.gravedad === 'GRAVE').length;
  for (const r of [...v.relaciones].sort((a, b) => a.otroId.localeCompare(b.otroId))) {
    const push = (accion: AccionDiplomatica, puntuacion: number) => opciones.push({ accion, objetivoId: r.otroId, puntuacion });
    switch (r.tipo) {
      case 'NEUTRAL':
        push('PROPONER_TRATADO', 0.5 + (tiene(v, 'GOIRNOS') ? 3 : 0) + (tiene(v, 'BEBIDA') ? 2 : 0) + bono(v, { MERCANTIL: 2, RECELOSA: -3, BELICOSA: -1 }));
        if (v.disposicion === 'BELICOSA') push('PRESIONAR', 1 + Math.max(0, ventajaMilitar(v, r)));
        break;
      case 'TRATADO_COMERCIAL': {
        const comun = r.enemigoComun ? (tiene(v, 'SOLDADOS') ? 3 : 0) + (v.tramo === 'ESTRATEGA' ? 2 : 0) : 0;
        push('PROPONER_ALIANZA', -0.5 + comun + bono(v, { MERCANTIL: 1, RECELOSA: -3 }));
        break;
      }
      case 'TENSION':
        // Nunca contra el Reino de la jugadora (Q7, `CR-37`).
        if (r.esReino) break;
        // El estratega nunca abre dos guerras a la vez (Q4).
        if (v.tramo === 'ESTRATEGA' && enGuerras > 0) break;
        push('DECLARAR_GUERRA', -0.5 + ventajaMilitar(v, r) + bono(v, { BELICOSA: 3, MERCANTIL: -2, RECELOSA: -3 }) + (v.disposicion === 'BELICOSA' && tiene(v, 'GOIRNOS') ? 1 : 0));
        break;
      case 'GUERRA': {
        if (r.esReino) break;
        const contraEste = v.carencias.find((c) => c.tipo === 'SOLDADOS' && c.enemigoId === r.otroId);
        const perdiendo = contraEste ? (contraEste.gravedad === 'GRAVE' ? 4 : 2) : 0;
        push('PEDIR_PAZ', -0.5 + perdiendo + graves + bono(v, { MERCANTIL: 1, BELICOSA: -1 }));
        break;
      }
      default:
        break;
    }
  }
  return opciones.filter((o) => o.puntuacion > 0);
}

/// Puro (Q4): la opción que toma un líder de `tramo`. El impulsivo, la mitad de las veces nada y si
/// no una al azar; el sensato, la mejor con ruido; el estratega, la mejor.
export function elegirDecision(opciones: Opcion[], tramo: Tramo | null, random: () => number): Opcion | null {
  if (opciones.length === 0 || tramo === null) return null;
  if (tramo === 'IMPULSIVO') {
    if (random() < 0.5) return null;
    return opciones[Math.min(opciones.length - 1, Math.floor(random() * opciones.length))]!;
  }
  const valor = (o: Opcion) => o.puntuacion + (tramo === 'SENSATO' ? (random() - 0.5) * RUIDO_SENSATO : 0);
  let mejor: Opcion | null = null;
  let mejorValor = -Infinity;
  for (const o of opciones) {
    const x = valor(o);
    if (x > mejorValor) {
      mejor = o;
      mejorValor = x;
    }
  }
  return mejor;
}

/// Puro (Q12, Q13): ¿acepta `receptor` lo que le propone `proponente`? Responde con su propia IA (sin
/// líder, con el juicio de un sensato).
export function aceptaPropuesta(
  accion: 'PROPONER_TRATADO' | 'PROPONER_ALIANZA' | 'PEDIR_PAZ',
  receptor: VistaFaccion,
  proponente: { id: string; soldados: number },
  random: () => number,
): boolean {
  const rel = receptor.relaciones.find((r) => r.otroId === proponente.id);
  let puntuacion: number;
  if (accion === 'PROPONER_TRATADO') {
    if (rel && (rel.tipo === 'TENSION' || rel.tipo === 'GUERRA')) return false;
    puntuacion = 0.5 + (tiene(receptor, 'GOIRNOS') ? 2 : 0) + (tiene(receptor, 'BEBIDA') ? 1 : 0) + bono(receptor, { MERCANTIL: 2, RECELOSA: -3 });
  } else if (accion === 'PROPONER_ALIANZA') {
    puntuacion = -0.5 + (tiene(receptor, 'SOLDADOS') ? 2 : 0) + (rel?.enemigoComun ? 2 : 0) + bono(receptor, { MERCANTIL: 1, RECELOSA: -3 });
  } else {
    // La paz, si también sufre: alguna carencia (la belicosa, solo grave) o menos soldados.
    const carencia = receptor.disposicion === 'BELICOSA' ? receptor.carencias.some((c) => c.gravedad === 'GRAVE') : receptor.carencias.length > 0;
    puntuacion = carencia || receptor.soldados < proponente.soldados ? 1 : -1;
  }
  const tramo = receptor.tramo ?? 'SENSATO';
  if (tramo === 'IMPULSIVO') return random() < 0.5;
  if (tramo === 'SENSATO') return puntuacion + (random() - 0.5) > 0;
  return puntuacion > 0;
}

/// Suceso que registra cada decisión cuando sale adelante (y con él, su coste en presupuesto).
export const SUCESO_DE_ACCION: Record<AccionDiplomatica, TipoSuceso> = {
  PROPONER_TRATADO: 'TRATADO_COMERCIAL',
  PROPONER_ALIANZA: 'ALIANZA',
  DECLARAR_GUERRA: 'GUERRA_DECLARADA',
  PEDIR_PAZ: 'TREGUA',
  PRESIONAR: 'CAMBIO_RELACION',
};

// ─────────────────────────── Orquestación por partida ───────────────────────────

/// Lo justo de una facción para mover su relación con otra.
interface Parte {
  id: string;
  slug: string;
  name: string;
}

interface FaccionCargada extends Parte {
  /// El Reino de la jugadora: destinatario, nunca decide aquí.
  esReino: boolean;
  disposicion: Disposicion;
  statsId: string;
  ultimaRevision: number | null;
  soldados: number;
  stats: Parameters<typeof carenciasDe>[0]['stats'];
  produccion: { comida: number; riqueza: number };
  tramo: Tramo | null;
}

const clave = (a: string, b: string) => `${a}|${b}`;
const HOSTILES: FactionRelationType[] = ['TENSION', 'GUERRA'];

/// Estado de la partida mientras se decide: las presiones cambian con cada decisión del día.
class Mesa {
  readonly presion = new Map<string, number>();
  constructor(readonly facciones: FaccionCargada[]) {}

  presionDe(a: string, b: string): number {
    return this.presion.get(clave(a, b)) ?? PRESION_NEUTRAL;
  }

  tipoPar(a: string, b: string): FactionRelationType {
    return typeForPresion(Math.max(this.presionDe(a, b), this.presionDe(b, a)));
  }

  vista(f: FaccionCargada): VistaFaccion {
    const otras = this.facciones.filter((o) => o.id !== f.id);
    const hostiles = (x: string) => new Set(this.facciones.filter((o) => o.id !== x && HOSTILES.includes(this.tipoPar(x, o.id))).map((o) => o.id));
    const mios = hostiles(f.id);
    const relaciones = otras.map((o) => {
      const suyos = hostiles(o.id);
      return { otroId: o.id, tipo: this.tipoPar(f.id, o.id), soldadosOtro: o.soldados, enemigoComun: [...mios].some((x) => x !== o.id && suyos.has(x)), ...(o.esReino ? { esReino: true } : {}) };
    });
    const enemigos = otras.filter((o) => mios.has(o.id)).map((o) => ({ factionId: o.id, soldados: o.soldados }));
    const carencias = carenciasDe({ stats: f.stats, produccion: f.produccion, enemigos }, f.tramo ?? 'SENSATO');
    return { id: f.id, disposicion: f.disposicion, tramo: f.tramo, soldados: f.soldados, carencias, relaciones };
  }
}

export interface ResultadoDecisiones {
  revisadas: number;
  decisiones: { faccion: string; accion: AccionDiplomatica; objetivo: string; aceptada: boolean | null }[];
  presupuesto: number;
}

/// Decide el día `dia` de la partida. Idempotente por `KingdomStats.ultimaRevision`.
export async function decidirFacciones(prisma: PrismaClient, saveId: string, dia: number, random: () => number = Math.random): Promise<ResultadoDecisiones> {
  return prisma.$transaction(
    async (tx) => {
      const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true, worldState: { select: { fictionalMinutes: true, presupuestoTension: true } } } });
      const ws = save.worldState!;
      const resultado: ResultadoDecisiones = { revisadas: 0, decisiones: [], presupuesto: ws.presupuestoTension };
      const filas = await tx.faction.findMany({
        where: { saveId, origenSlug: { not: null }, disueltaEn: null, kingdomStats: { isNot: null } },
        select: {
          id: true, slug: true, name: true, disposicion: true, kingdomStats: true,
          liderNpc: { select: { attributes: true } },
          buildings: { where: { status: 'ACTIVO' }, select: { recipeKey: true, status: true } },
        },
        orderBy: { id: 'asc' },
      });
      const facciones: FaccionCargada[] = filas.map((f) => {
        const inteligencia = inteligenciaDelLider(f.liderNpc);
        return {
          esReino: false,
          id: f.id, slug: f.slug, name: f.name, disposicion: f.disposicion, statsId: f.kingdomStats!.id, ultimaRevision: f.kingdomStats!.ultimaRevision,
          soldados: f.kingdomStats!.soldados, stats: f.kingdomStats!, produccion: tickFactionProduction(f.buildings),
          tramo: inteligencia === null ? null : tramoDeInteligencia(inteligencia),
        };
      });
      // Q7: el Reino de la jugadora, solo como destinatario (su reino cuelga de la partida).
      const reino = await tx.faction.findFirst({ where: { saveId, origenSlug: null, disueltaEn: null }, select: { id: true, slug: true, name: true } });
      const statsReino = reino ? await tx.kingdomStats.findUnique({ where: { saveId } }) : null;
      if (reino && statsReino) {
        facciones.push({
          esReino: true, ...reino, disposicion: 'NEUTRAL', statsId: statsReino.id, ultimaRevision: null, soldados: statsReino.soldados,
          stats: statsReino, produccion: { comida: 0, riqueza: 0 }, tramo: null,
        });
      }
      const mesa = new Mesa(facciones);
      const ids = facciones.map((f) => f.id);
      for (const r of await tx.factionRelation.findMany({ where: { sourceFactionId: { in: ids }, targetFactionId: { in: ids } }, select: { sourceFactionId: true, targetFactionId: true, presion: true } })) {
        mesa.presion.set(clave(r.sourceFactionId, r.targetFactionId), r.presion);
      }

      // Después del suceso de fondo del día y nunca por delante del reloj de la partida.
      const minutos = Math.min(dia * 1440 + 780, ws.fictionalMinutes);
      const ctx = { tx, saveId, worldId: save.worldId, minutos, mesa };
      let presupuesto = ws.presupuestoTension;

      for (const f of facciones) {
        if (f.esReino) continue;
        const vista = mesa.vista(f);
        if (!tocaRevisar(dia, f.ultimaRevision, vista.carencias)) continue;
        resultado.revisadas++;
        await tx.kingdomStats.update({ where: { id: f.statsId }, data: { ultimaRevision: dia } });
        const opcion = elegirDecision(opcionesDiplomaticas(vista), vista.tramo, random);
        if (!opcion) continue;
        const tipoSuceso = SUCESO_DE_ACCION[opcion.accion];
        // Q17: sin presupuesto, espera a su próxima revisión.
        if (costeDe(tipoSuceso) > presupuesto) continue;
        const objetivo = facciones.find((o) => o.id === opcion.objetivoId)!;
        const aceptada = await aplicarDecision(ctx, f, objetivo, opcion.accion, random);
        resultado.decisiones.push({ faccion: f.slug, accion: opcion.accion, objetivo: objetivo.slug, aceptada });
        if (aceptada !== false) presupuesto -= costeDe(tipoSuceso);
      }
      presupuesto = Math.max(0, presupuesto);
      if (presupuesto !== ws.presupuestoTension) await tx.worldState.update({ where: { saveId }, data: { presupuestoTension: presupuesto } });
      resultado.presupuesto = presupuesto;
      return resultado;
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

interface CtxDecision {
  tx: Tx;
  saveId: string;
  worldId: string;
  minutos: number;
  mesa: Mesa;
}

/// Aplica la decisión. Devuelve si la otra aceptó (null si no había nada que aceptar).
async function aplicarDecision(ctx: CtxDecision, f: FaccionCargada, o: FaccionCargada, accion: AccionDiplomatica, random: () => number): Promise<boolean | null> {
  if (o.esReino && (accion === 'PROPONER_TRATADO' || accion === 'PROPONER_ALIANZA')) {
    // Responde la jugadora: sin respuesta todavía (null); false si ya tenía una propuesta suya pendiente.
    return (await proponerAlReino(ctx, f, accion === 'PROPONER_TRATADO' ? 'TRATADO' : 'ALIANZA')) ? null : false;
  }
  switch (accion) {
    case 'PROPONER_TRATADO':
    case 'PROPONER_ALIANZA':
    case 'PEDIR_PAZ': {
      if (!aceptaPropuesta(accion, ctx.mesa.vista(o), { id: f.id, soldados: f.soldados }, random)) {
        // Rechazo: sube la presión de quien propuso (la paz rechazada no cambia nada).
        if (accion !== 'PEDIR_PAZ') await moverPresion(ctx, f, o, ctx.mesa.presionDe(f.id, o.id) + SUBE_AL_RECHAZAR);
        return false;
      }
      const presion = accion === 'PROPONER_TRATADO' ? PRESION_TRAS.TRATADO : accion === 'PROPONER_ALIANZA' ? PRESION_TRAS.ALIANZA : PRESION_TRAS.PAZ;
      await fijarPar(ctx, f, o, presion, SUCESO_DE_ACCION[accion]);
      return true;
    }
    case 'DECLARAR_GUERRA': {
      await fijarPar(ctx, f, o, PRESION_TRAS.GUERRA, 'GUERRA_DECLARADA');
      // Los aliados de la víctima se vuelven contra el agresor.
      for (const aliado of ctx.mesa.facciones) {
        if (aliado.id === f.id || aliado.id === o.id || ctx.mesa.tipoPar(aliado.id, o.id) !== 'ALIANZA') continue;
        await moverPresion(ctx, aliado, f, ctx.mesa.presionDe(aliado.id, f.id) + SUBEN_ALIADOS_DE_LA_VICTIMA);
      }
      return null;
    }
    case 'PRESIONAR':
      await moverPresion(ctx, f, o, ctx.mesa.presionDe(f.id, o.id) + SUBE_AL_PRESIONAR);
      return null;
  }
}

async function guardarPresion(ctx: CtxDecision, origen: Parte, destino: Parte, presion: number): Promise<void> {
  const valor = Math.max(PRESION_MIN, Math.min(PRESION_MAX, presion));
  const data = { presion: valor, type: typeForPresion(valor), stage: stageForPresion(valor) };
  await ctx.tx.factionRelation.upsert({
    where: { sourceFactionId_targetFactionId: { sourceFactionId: origen.id, targetFactionId: destino.id } },
    update: data,
    create: { worldId: ctx.worldId, saveId: ctx.saveId, sourceFactionId: origen.id, targetFactionId: destino.id, ...data },
  });
  ctx.mesa.presion.set(clave(origen.id, destino.id), valor);
}

/// Pacto, guerra o paz: las dos direcciones a `presion`, su suceso y su noticia.
async function fijarPar(ctx: CtxDecision, f: Parte, o: Parte, presion: number, tipo: TipoSuceso): Promise<void> {
  await guardarPresion(ctx, f, o, presion);
  await guardarPresion(ctx, o, f, presion);
  const datos: Record<string, string> = tipo === 'GUERRA_DECLARADA' ? { atacante: f.name, atacada: o.name } : { faccionA: f.name, faccionB: o.name };
  await registrarYAvisar(ctx, f, o, tipo, datos);
}

/// Una sola dirección (rechazo, presión, aliados): si cambia de banda, queda en el Libro y se avisa.
async function moverPresion(ctx: CtxDecision, origen: Parte, destino: Parte, presion: number): Promise<void> {
  const antes = ctx.mesa.tipoPar(origen.id, destino.id);
  await guardarPresion(ctx, origen, destino, presion);
  const despues = ctx.mesa.tipoPar(origen.id, destino.id);
  if (antes === despues) return;
  await registrarYAvisar(ctx, origen, destino, 'CAMBIO_RELACION', { faccionA: origen.name, faccionB: destino.name, antes: ETIQUETA_BANDA[antes], despues: ETIQUETA_BANDA[despues] });
}

async function registrarYAvisar(ctx: CtxDecision, autor: Parte, afectada: Parte, tipo: TipoSuceso, datos: Record<string, string>): Promise<void> {
  const actores: ActorSuceso[] = [
    { entidadTipo: 'FACCION', entidadId: autor.slug, papel: 'AUTOR' },
    { entidadTipo: 'FACCION', entidadId: afectada.slug, papel: 'AFECTADO' },
  ];
  const sucesoId = await registrarSuceso(ctx.tx, { saveId: ctx.saveId, tipo, fictionalMinutes: ctx.minutos, origen: 'MUNDO', actores, datos } as Parameters<typeof registrarSuceso>[1]);
  const { texto } = await ctx.tx.suceso.findUniqueOrThrow({ where: { id: sucesoId }, select: { texto: true } });
  await darNoticia(ctx.tx, { saveId: ctx.saveId, worldId: ctx.worldId, fictionalMinutes: ctx.minutos, causa: sucesoId }, {
    texto, facciones: [autor.name, afectada.name], region: null, categoria: categoriaDeFamilia(CATALOGO_SUCESOS[tipo].familia),
  });
}

// ─────────────────────────── Propuestas al Reino de la jugadora (34e) ───────────────────────────

export const REGLA_PROPUESTA_REINO = 'PROPUESTA_REINO';
/// Días que tiene la jugadora para responder (Q15).
export const DIAS_PARA_RESPONDER = 3;

export type TipoPropuesta = 'TRATADO' | 'ALIANZA';
export type RespuestaPropuesta = 'ACEPTADA' | 'RECHAZADA' | 'CADUCADA';

interface DatosPropuesta {
  faccionId: string;
  faccion: string;
  tipo: TipoPropuesta;
  logEntryId?: string;
}

/// Lo que guarda la noticia de una propuesta (`LogEntry.noticia.propuesta`).
export interface PropuestaNoticia {
  id: string;
  faccion: string;
  tipo: TipoPropuesta;
  venceEn: number;
  respuesta?: RespuestaPropuesta;
}

/// Texto de la propuesta en «El mundo».
export function textoPropuesta(faccion: string, tipo: TipoPropuesta): string {
  return `${faccion} propone a tu reino ${tipo === 'TRATADO' ? 'un tratado comercial' : 'una alianza'}. Tienes ${DIAS_PARA_RESPONDER} días para responder.`;
}

/// Crea la propuesta (consecuencia con plazo) y su noticia con Aceptar y Rechazar. False si la
/// facción ya tenía una pendiente con este reino.
async function proponerAlReino(ctx: CtxDecision, f: Parte, tipo: TipoPropuesta): Promise<boolean> {
  const pendientes = await ctx.tx.consecuencia.findMany({ where: { saveId: ctx.saveId, regla: REGLA_PROPUESTA_REINO, estado: 'PENDIENTE' }, select: { datos: true } });
  if (pendientes.some((p) => (p.datos as unknown as DatosPropuesta).faccionId === f.id)) return false;
  const hoy = Math.floor(ctx.minutos / 1440);
  const datos: DatosPropuesta = { faccionId: f.id, faccion: f.name, tipo };
  const consecuencia = await ctx.tx.consecuencia.create({
    data: {
      saveId: ctx.saveId, regla: REGLA_PROPUESTA_REINO, tipoDisparo: 'DIAS', disparo: { tipo: 'DIAS', min: DIAS_PARA_RESPONDER, max: DIAS_PARA_RESPONDER },
      desdeDia: hoy + DIAS_PARA_RESPONDER, datos: datos as unknown as Prisma.InputJsonValue, creadaEn: ctx.minutos,
    },
  });
  const ws = await ctx.tx.worldState.findUnique({ where: { saveId: ctx.saveId }, select: { fictionalDateLabel: true } });
  const propuesta: PropuestaNoticia = { id: consecuencia.id, faccion: f.name, tipo, venceEn: ctx.minutos + DIAS_PARA_RESPONDER * 1440 };
  const meta: MetaNoticia = { categoria: categoriaDeFamilia('DIPLOMACIA'), propuesta };
  const entrada = await ctx.tx.logEntry.create({
    data: { saveId: ctx.saveId, channel: 'WORLD', text: textoPropuesta(f.name, tipo), timeLabel: ws?.fictionalDateLabel ?? '', fictionalMinutes: ctx.minutos, isSystemMessage: true, noticia: meta as unknown as Prisma.InputJsonValue },
  });
  await ctx.tx.consecuencia.update({ where: { id: consecuencia.id }, data: { datos: { ...datos, logEntryId: entrada.id } as unknown as Prisma.InputJsonValue } });
  return true;
}

/// Contexto de una respuesta, fuera de la mesa del día: la mesa solo con el par.
async function ctxDePar(tx: Tx, saveId: string, a: Parte, b: Parte): Promise<CtxDecision> {
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true, worldState: { select: { fictionalMinutes: true } } } });
  const mesa = new Mesa([]);
  for (const r of await tx.factionRelation.findMany({ where: { OR: [{ sourceFactionId: a.id, targetFactionId: b.id }, { sourceFactionId: b.id, targetFactionId: a.id }] }, select: { sourceFactionId: true, targetFactionId: true, presion: true } })) {
    mesa.presion.set(clave(r.sourceFactionId, r.targetFactionId), r.presion);
  }
  return { tx, saveId, worldId: save.worldId, minutos: save.worldState?.fictionalMinutes ?? 0, mesa };
}

/// Cierra la propuesta: aceptada → el pacto en las dos direcciones (y su mercado); rechazada o
/// caducada → +5 de la facción hacia el Reino. Marca la noticia con la respuesta.
async function cerrarPropuesta(tx: Tx, saveId: string, consecuencia: { id: string; datos: Prisma.JsonValue }, respuesta: RespuestaPropuesta): Promise<boolean> {
  const datos = consecuencia.datos as unknown as DatosPropuesta;
  const [faccion, reino] = await Promise.all([
    tx.faction.findFirst({ where: { id: datos.faccionId, saveId, disueltaEn: null }, select: { id: true, slug: true, name: true } }),
    tx.faction.findFirst({ where: { saveId, origenSlug: null, disueltaEn: null }, select: { id: true, slug: true, name: true } }),
  ]);
  if (faccion && reino) {
    const ctx = await ctxDePar(tx, saveId, faccion, reino);
    if (respuesta === 'ACEPTADA') {
      await fijarPar(ctx, faccion, reino, datos.tipo === 'TRATADO' ? PRESION_TRAS.TRATADO : PRESION_TRAS.ALIANZA, datos.tipo === 'TRATADO' ? 'TRATADO_COMERCIAL' : 'ALIANZA');
    } else {
      await moverPresion(ctx, faccion, reino, ctx.mesa.presionDe(faccion.id, reino.id) + SUBE_AL_RECHAZAR);
    }
  }
  if (datos.logEntryId) {
    const entrada = await tx.logEntry.findUnique({ where: { id: datos.logEntryId }, select: { noticia: true } });
    const meta = (entrada?.noticia as unknown as MetaNoticia | null) ?? null;
    if (meta?.propuesta) await tx.logEntry.update({ where: { id: datos.logEntryId }, data: { noticia: { ...meta, propuesta: { ...meta.propuesta, respuesta } } as unknown as Prisma.InputJsonValue } });
  }
  return Boolean(faccion && reino);
}

/// La jugadora responde a una propuesta pendiente. Null si no existe o ya no está pendiente.
export async function responderPropuesta(prisma: PrismaClient, saveId: string, propuestaId: string, acepta: boolean): Promise<{ respuesta: RespuestaPropuesta } | null> {
  return prisma.$transaction(async (tx) => {
    const consecuencia = await tx.consecuencia.findFirst({ where: { id: propuestaId, saveId, regla: REGLA_PROPUESTA_REINO, estado: 'PENDIENTE' }, select: { id: true, datos: true } });
    if (!consecuencia) return null;
    // Reclamo atómico: solo una respuesta (ni dos clics ni la caducidad a la vez).
    const ws = await tx.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } });
    const claim = await tx.consecuencia.updateMany({ where: { id: consecuencia.id, estado: 'PENDIENTE' }, data: { estado: 'ANULADA', resueltaEn: ws?.fictionalMinutes ?? 0 } });
    if (claim.count === 0) return null;
    const respuesta: RespuestaPropuesta = acepta ? 'ACEPTADA' : 'RECHAZADA';
    await cerrarPropuesta(tx, saveId, consecuencia, respuesta);
    return { respuesta };
  });
}

/// Plazo vencido sin respuesta: cuenta como rechazo (Q15). Lo llama la regla `PROPUESTA_REINO`
/// (`reglasConsecuencias.ts`; función y no constante para no depender del orden de carga).
export async function caducarPropuesta(ctx: CtxConsecuencia): Promise<void> {
  await cerrarPropuesta(ctx.tx, ctx.saveId, ctx.consecuencia, 'CADUCADA');
}
