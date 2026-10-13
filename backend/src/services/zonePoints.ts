import { Prisma, type PrismaClient, type ZonePointTipo } from '@prisma/client';
import { stripRegionArticle } from './population.js';
import { sourceDisplayNameFor, faunaMomentoDelDia, FAUNA_AMBIENTAL } from '../scripts/worldCatalog.js';
import { factionRepFor } from './reputation.js';
import {
  celdaDePixel,
  pixelDeCelda,
  siguienteCeldaEnRuta,
  celdaParaGrupoNuevo,
  claveCelda,
  repartirEnGrupos,
  GRID_COLS,
  GRID_ROWS,
  type Celda,
} from './zonaPosicion.js';
import { ORCO_ENFURECIDO_QUEST_SLUG } from '../routes/saves/quests.js';
import { siguienteCeldaDeZonePoint, enRangoDePersecucion } from './movementTemplates.js';
import type { FaunaCategoria } from './faunaAbilities.js';
import { effectiveTemperamento } from './reputation.js';
import type { MomentoDelDia } from './worldClock.js';
import { ambitoPoblacion, copiaDeFila } from './mundoPartida.js';
import { celdasDeEntrada, enRadioSeguro } from './entradasZona.js';

export type ZonePointColor = 'ALIADO' | 'NEUTRO' | 'ENEMIGO' | 'SIN_FACCION' | 'INERTE';

/// Puro — color del punto en el mapa por reputación con SU facción (`ZonePoint.factionSlug`), mismo
/// medidor 0-5000 que `reputation.ts` (2500 = neutro). 3 bandas simplificadas de las 5 de
/// `effectiveTemperamento` (esa función es para IA de combate, aquí solo hace falta un color).
/// `factionSlug` null se reparte en DOS colores distintos (2026-09-09, corrección de diseño real —
/// hasta ahora ambos caían en `SIN_FACCION`, confundiendo dos conceptos distintos: "SIN_FACCION"
/// (naranja) es la ausencia de facción de alguien que SÍ podría tenerla — un NPC/FAUNA/EDIFICIO
/// independiente, sigue siendo un desenlace real de reputación; "INERTE" (gris) es que la facción
/// simplemente NO APLICA — un RECURSO nunca tiene dueño por diseño, mezclarlo con NEUTRO (amarillo,
/// que ya significa "neutral CON una facción real") sería igual de confuso). `tipo` decide cuál de
/// los dos: solo RECURSO cae en INERTE, el resto de tipos del enum Prisma (FAUNA/NPC/EDIFICIO) sigue
/// en SIN_FACCION como siempre — OBJETO (DroppedItem, fuera de este enum) se resuelve aparte en el
/// caller (zona.ts), nunca pasa por aquí.
export function zonePointColorFor(factionSlug: string | null, factionsStatus: Record<string, number>, tipo: ZonePointTipo): ZonePointColor {
  if (!factionSlug) return tipo === 'RECURSO' ? 'INERTE' : 'SIN_FACCION';
  const rep = factionRepFor(factionsStatus, factionSlug);
  if (rep >= 3000) return 'ALIADO';
  if (rep < 1000) return 'ENEMIGO';
  return 'NEUTRO';
}

/// Dinamismo del mundo, Pieza 3 (2026-08-27, docs/producto/21-roadmap.md) — `ZonePoint` como instancia viva:
/// recalcula proporcionalmente al tiempo de ficción que YA pasó desde la última vez que se tocó
/// este punto, disparado por cada turno real del jugador (nunca tiempo real de pared, nunca
/// pre-cómputo — decisión explícita, ver plan de sesión). Una acción corta mueve poco (fracción de
/// paso/crecimiento), una larga mueve más — cubre el 100% de los turnos, no solo esperas largas.
///
/// Solo `FAUNA`/`RECURSO` tienen cantidad dinámica real (agrupación por población regional real,
/// `WorldPopulation`) — `NPC` (identidad única, nunca se agrupa) y `EDIFICIO` (existencia binaria,
/// gobernada por `Building`/`construction.ts`, no por población) quedan fuera de este recalculo a
/// propósito, documentado, no un descuido.

/// Fracción de la población regional agregada que un único `ZonePoint` puede llegar a representar
/// como máximo (cifra de partida, ajustable jugando, mismo criterio que el resto de números de este
/// proyecto) — evita que un solo punto intente mostrar "×400" de golpe si la población regional es
/// grande; varios puntos de la misma especie en la misma zona se reparten la población real.
const CANTIDAD_MAX_POR_PUNTO = 20;

/// Cuánto puede moverse `cantidad` hacia su objetivo por CADA DÍA completo de ficción transcurrido
/// (no de golpe) — mismo espíritu que `GROWTH_RATE_PER_DAY` de `population.ts`, pero aplicado al
/// AJUSTE del punto visual, no al crecimiento real de la especie (que ya lo calcula
/// `growAllPopulations`/`WorldPopulation` por su cuenta). Cifra de partida.
const AJUSTE_MAXIMO_POR_DIA = 3;

const MINUTOS_POR_DIA = 24 * 60;

/// Gate de aparición narrativa (2026-09-09, bug real jugando en vivo — Álvaro: "estás pintando el
/// orco enfurecido antes de hablar con gistera en el mapa... se debe añadir a la zona después de
/// hablar con gistera y aceptar su misión"). El Orco Enfurecido tiene `ZonePoint` de catálogo
/// incondicional (`activo: true` fijo, sembrado 2026-09-08 solo para que el gate de colisión de
/// Franja 3 no rompiera ese encuentro guionizado) — sin ningún filtro, aparecía en el mapa/colisión/
/// patrulla desde el turno 1, mucho antes del hito narrativo real ("justo cuando Gistera te da la
/// misión el Orco entra en la zona por primera vez", confirmado por Álvaro). Primer caso del
/// proyecto de "ZonePoint condicionado a progreso de misión" — no existe ningún precedente que
/// reutilizar, y no se generaliza a un campo de catálogo nuevo (sería sobre-ingeniería para una
/// única instancia hoy); en vez de eso, un filtro puntual por slug en los 3 consumidores reales de
/// `ZonePoint.activo` (GET /zona § render, `detectarEncuentroEnCelda` § colisión, aquí abajo §
/// patrulla), todos delegando a este único helper para no divergir entre ellos.
const ZONE_POINTS_GATEADOS_POR_QUEST: Record<string, string> = {
  'orco-enfurecido-hondonada': ORCO_ENFURECIDO_QUEST_SLUG,
};

/// Inverso del gate de arriba (2026-09-09, mismo hallazgo — conectando el guion determinista de
/// Gistera a la colisión de Zona) — Gistera Koh debe DESAPARECER del mapa/colisión/patrulla en
/// cuanto el jugador acepta su misión (`npcsRetiredForever` ya la retira de `detectNpcsInScene`
/// para el camino de texto libre, pero su `ZonePoint` de catálogo — posición fija en el mapa — no
/// pasaba por ningún filtro equivalente: el jugador podía seguir "chocando" con su fantasma en
/// Zona después de que la trama ya avanzó). Mismo `questSlug` que el gate del Orco a propósito —
/// es la misma `Quest`, un solo hito la hace aparecer a él y desaparecer a ella.
const ZONE_POINTS_OCULTOS_POR_QUEST: Record<string, string> = {
  'gistera-koh': ORCO_ENFURECIDO_QUEST_SLUG,
};

/// Puro sobre datos ya cargados — true si el `targetSlug` no tiene gate (inmensa mayoría de
/// `ZonePoint`) o si la `Quest` que lo desbloquea ya existe para la partida (aceptada, con
/// cualquier `status` — el propio hito de ACEPTAR es lo que introduce al Orco en escena, no su
/// desenlace posterior). `questSlugsActivos` se carga una vez por caller (batch, nunca N+1).
export function zonePointVisiblePara(targetSlug: string, questSlugsAceptados: ReadonlySet<string>): boolean {
  const questSlugRequerido = ZONE_POINTS_GATEADOS_POR_QUEST[targetSlug];
  if (questSlugRequerido) return questSlugsAceptados.has(questSlugRequerido);
  const questSlugOcultador = ZONE_POINTS_OCULTOS_POR_QUEST[targetSlug];
  if (questSlugOcultador) return !questSlugsAceptados.has(questSlugOcultador);
  return true;
}

/// Bug real jugando en vivo (2026-09-20, Álvaro: "al vencer al orco... no desaparecía
/// correctamente y me bloqueaba la partida") — un NPC de catálogo único (`kind: 'PRINCIPAL'`, con
/// nombre propio y `ZonePoint` fijo de posición, ej. el Orco Enfurecido) derrotado en combate solo
/// quedaba "ausente" 6h (`zonaAusenteHastaMinutes`, `MINUTOS_AUSENCIA_TRAS_DERROTA` en
/// zonaPosicion.ts) — ese campo se diseñó para fauna genérica que se dispersa y puede volver, nunca
/// para distinguir "muerto para siempre" de "huyó, puede reaparecer". Pasadas esas 6h, tanto el pin
/// del mapa (`GET /zona`) como la colisión real (`detectarEncuentroEnCelda`, zona.ts — que ni
/// siquiera aplicaba la ventana de 6h) volvían a tratarlo como si siguiera vivo, dejando al jugador
/// "chocar con su fantasma" para siempre. Solo aplica a `kind: 'PRINCIPAL'` (identidad única/nombre
/// propio) — fauna genérica (`kind` distinto) sigue usando el ciclo normal de repoblación/ausencia
/// temporal, nunca se retira por una muerte individual (la población regional sigue existiendo).
export function zonePointNpcMuertoParaSiempre(kind: string, condicionFisica: string | undefined): boolean {
  return kind === 'PRINCIPAL' && condicionFisica === 'MUERTO';
}

/// Puro — ¿esta especie está activa AHORA MISMO según `faunaMomentoDelDia` (worldCatalog.ts)?
/// `true` si no tiene ninguna entrada en ese diccionario (sin dato = sin filtrar, mismo criterio
/// documentado en el propio comentario de cabecera de `faunaMomentoDelDia`).
///
/// Bug real jugando en vivo (2026-09-17, Álvaro: "está apareciendo un kirelon todo el rato que no
/// se está representando con icono... y sin abrir combate" — el Kirelon Arenoso es nocturno
/// [`faunaMomentoDelDia['kirelon-arenoso'] = 'noche'`], invisible de día en `GET /zona` porque ESE
/// endpoint sí aplicaba el filtro — pero ni `detectarEncuentroEnCelda` [colisión/aviso] ni
/// `avanzarZonePointsUnPaso` [movimiento/persecución, incluida la persecución nueva de AGRESIVO]
/// lo conocían: el Kirelon seguía patrullando/persiguiendo y colisionando de pleno día, invisible
/// en el mapa, repitiendo el mensaje de "toca reaccionar" sin nunca abrir combate real (el turno de
/// texto libre nunca lo veía porque el jugador nunca lo mencionaba — no podía, no lo veía en
/// ningún sitio). Ahora los 3 consumidores de `ZonePoint.activo` comparten el mismo criterio.
export function zonePointActivoAhora(targetSlug: string, momento: MomentoDelDia): boolean {
  const momentoRequerido = faunaMomentoDelDia[targetSlug];
  return !momentoRequerido || momentoRequerido === momento;
}

/// Batch — todas las `Quest.questSlug` ya aceptadas por la partida entre las que este módulo puede
/// necesitar consultar (hoy el Orco Enfurecido y Gistera Koh, mismo `questSlug` para ambos — ver
/// `ZONE_POINTS_GATEADOS_POR_QUEST`/`ZONE_POINTS_OCULTOS_POR_QUEST`). Una sola query por caller,
/// nunca una por `ZonePoint`.
export async function questSlugsAceptadosPara(tx: Prisma.TransactionClient | PrismaClient, saveId: string): Promise<Set<string>> {
  const questSlugsRelevantes = [...new Set([...Object.values(ZONE_POINTS_GATEADOS_POR_QUEST), ...Object.values(ZONE_POINTS_OCULTOS_POR_QUEST)])];
  if (questSlugsRelevantes.length === 0) return new Set();
  const quests = await tx.quest.findMany({ where: { saveId, questSlug: { in: questSlugsRelevantes } }, select: { questSlug: true } });
  return new Set(quests.map((q) => q.questSlug).filter((s): s is string => s != null));
}

export interface ZonePointRow {
  id: string;
  tipo: ZonePointTipo;
  targetSlug: string;
  cantidad: number;
  activo: boolean;
  lastUpdatedAtMinutes: number | null;
}

/// Puro — decide la `cantidad`/`activo` nuevos de UN punto dado cuánta población regional real hay
/// disponible para su especie y cuántos minutos de ficción pasaron desde su último recalculo. Nunca
/// toca `x`/`y` (reposicionar puntos dentro del lienzo queda fuera de esta pasada, documentado) ni
/// decide DE DÓNDE sale un punto nuevo (eso lo resuelve el caller, que sí conoce cuántos puntos
/// existen ya para esa especie en la Location).
/// Cantidad a la que tiende un punto con esta población regional (topada a `CANTIDAD_MAX_POR_PUNTO`).
export function objetivoDePunto(poblacionRegional: number): number {
  return Math.max(0, Math.min(CANTIDAD_MAX_POR_PUNTO, poblacionRegional));
}

/// P109 (QA-27): si el punto no cambió pero aún no llegó a su objetivo, su reloj no se toca, para que
/// el tiempo se acumule hasta sumar un ajuste entero. Antes se tocaba en cada recálculo (el mapa
/// recalcula a cada paso) con un ajuste mínimo de 1: lo cazado o recolectado volvía en pocos pasos.
export function relojPorRefrescar(punto: ZonePointRow, cantidadNueva: number, activoNuevo: boolean, poblacionRegional: number, fictionalMinutesActuales: number): boolean {
  if (cantidadNueva !== punto.cantidad || activoNuevo !== punto.activo) return true;
  return cantidadNueva === objetivoDePunto(poblacionRegional) && punto.lastUpdatedAtMinutes !== fictionalMinutesActuales;
}

export function proximaCantidadPara(punto: ZonePointRow, poblacionRegional: number, fictionalMinutesActuales: number): { cantidad: number; activo: boolean } {
  const objetivo = objetivoDePunto(poblacionRegional);
  if (punto.lastUpdatedAtMinutes == null) return { cantidad: objetivo, activo: objetivo > 0 };

  const minutosTranscurridos = Math.max(0, fictionalMinutesActuales - punto.lastUpdatedAtMinutes);
  if (minutosTranscurridos === 0) return { cantidad: punto.cantidad, activo: punto.activo };

  const diasTranscurridos = minutosTranscurridos / MINUTOS_POR_DIA;
  const ajusteMaximo = Math.round(AJUSTE_MAXIMO_POR_DIA * diasTranscurridos);
  if (ajusteMaximo === 0) return { cantidad: punto.cantidad, activo: punto.activo };
  const delta = objetivo - punto.cantidad;
  const ajusteReal = Math.max(-ajusteMaximo, Math.min(ajusteMaximo, delta));
  const cantidad = punto.cantidad + ajusteReal;
  return { cantidad, activo: cantidad > 0 };
}

/// Grupos de fauna reales en el mapa (2026-09-28, Fase 1 de `plan-mecanicas-por-zona-2026-09-28.md`,
/// B26) — hasta ahora cada especie era UN `ZonePoint` topado a `CANTIDAD_MAX_POR_PUNTO` (×20);
/// `repartirEnGrupos` (zonaPosicion.ts) ya existía, testeada, pero sin ningún caller. Qué le pasa a
/// CADA fila de una especie dado su reparto actual (`cantidadesActuales`, índice 0 SIEMPRE la fila
/// ancla — la única con `label` propio, o si no la más antigua — nunca se borra) y el nuevo
/// `objetivo` YA calculado por el caller (mismo ajuste gradual de `proximaCantidadPara`, aplicado al
/// TOTAL del grupo como si fuera un único "punto virtual"). Puro, sin Prisma — el caller (§
/// `recalcularZonePointsDeLocation`, más abajo) traduce el resultado a updates/creates/deletes
/// reales, mismo criterio de separación que el resto de este archivo (`proximaCantidadPara`).
/// P88 (QA-27, decisión de la usuaria 2026-10-12): la zona donde empieza y reaparece la jugadora
/// es de seguridad alta, como los sectores centrales de X4 o el valle de inicio de Medieval Dynasty
/// y Bellwright. Su fauna hostil se queda en su guarida (D&D 5e/BG3): un solo grupo, el ancla de
/// catálogo («Boca de cueva»), con pocos individuos, y sin perseguir. El lore no cambia: los Kirelon
/// siguen viviendo en la Hondonada.
export const ZONAS_DE_INICIO: ReadonlySet<string> = new Set(['hondonada-del-eco']);
export const TOPE_HOSTIL_ZONA_DE_INICIO = 3;

/// Reconciliación de una especie hostil en una zona de inicio: todo en el ancla (índice 0), topado a
/// `TOPE_HOSTIL_ZONA_DE_INICIO`; el resto de filas se borra y no se crean grupos nuevos.
export function reconciliarEnGuarida(cantidadesActuales: number[], objetivo: number): ReconciliacionGruposResultado {
  const cantidadAncla = Math.min(objetivo, TOPE_HOSTIL_ZONA_DE_INICIO);
  return {
    actualizar: cantidadesActuales[0] === cantidadAncla ? [] : [{ index: 0, cantidad: cantidadAncla }],
    borrar: cantidadesActuales.map((_, i) => i).filter((i) => i !== 0),
    crear: [],
  };
}

export interface ReconciliacionGruposResultado {
  /// Filas EXISTENTES cuya `cantidad` cambia — `index` referencia `cantidadesActuales`. El índice 0
  /// (ancla) puede aparecer con `cantidad: 0`: eso NO es un borrado, el caller debe marcarla
  /// `activo: false` en vez de borrarla.
  actualizar: { index: number; cantidad: number }[];
  /// Índices de `cantidadesActuales` a borrar del todo — nunca incluye el índice 0 (ancla).
  borrar: number[];
  /// Cantidades de las filas NUEVAS a crear, una por cada elemento (el caller decide su posición).
  crear: number[];
}

export function reconciliarGrupos(
  cantidadesActuales: number[],
  objetivo: number,
  /// `true` si ninguna fila de esta especie tenía `lastUpdatedAtMinutes` todavía (primera vez que
  /// se reparte de verdad) — reparto completo desde cero con `repartirEnGrupos(objetivo)`, ignorando
  /// `cantidadesActuales` (la única fila real hasta ahora es la ancla, con la cifra topada vieja
  /// ×20 sin repartir).
  primerReparto: boolean,
  random: () => number = Math.random,
): ReconciliacionGruposResultado {
  if (primerReparto) {
    const grupos = repartirEnGrupos(objetivo, random);
    if (grupos.length === 0) return { actualizar: [{ index: 0, cantidad: 0 }], borrar: [], crear: [] };
    const [cantidadAncla, ...resto] = grupos;
    return { actualizar: [{ index: 0, cantidad: cantidadAncla }], borrar: [], crear: resto };
  }

  // QA-27 (2026-10-09): el reparto deseado sale siempre del total (`repartirEnGrupos`, 2-3 sueltos
  // y pocos grupos grandes) y se encaja sobre las filas que ya hay, tocando lo mínimo: así una
  // partida con el reparto viejo (muchos grupos pequeños) se consolida sola, y subir o bajar unos
  // pocos individuos no crea ni borra puntos sueltos sin parar. Se respetan los sueltos que ya hay
  // si están entre 2 y 3.
  const sueltosActuales = cantidadesActuales.filter((c) => c === 1).length;
  const sueltos = sueltosActuales >= 2 && sueltosActuales <= 3 ? sueltosActuales : undefined;
  const deseado = objetivo > 0 ? repartirEnGrupos(objetivo, random, sueltos) : [];
  if (deseado.length === 0) {
    return {
      actualizar: cantidadesActuales[0] === 0 ? [] : [{ index: 0, cantidad: 0 }],
      borrar: cantidadesActuales.map((_, i) => i).filter((i) => i !== 0),
      crear: [],
    };
  }
  const igual = (a: number[], b: number[]) => a.length === b.length && [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);
  if (igual(cantidadesActuales, deseado)) return { actualizar: [], borrar: [], crear: [] };

  // Emparejar de mayor a menor (desempate por índice); el ancla (índice 0) siempre se queda: si no
  // le toca pareja, ocupa la última plaza que sí la tiene.
  const deseadoOrdenado = [...deseado].sort((a, b) => b - a);
  const actuales = cantidadesActuales.map((cantidad, index) => ({ cantidad, index })).sort((a, b) => b.cantidad - a.cantidad || a.index - b.index);
  let conservadas = actuales.slice(0, deseadoOrdenado.length);
  if (!conservadas.some((f) => f.index === 0)) {
    conservadas = [...conservadas.slice(0, -1), actuales.find((f) => f.index === 0)!];
  }
  const actualizar: { index: number; cantidad: number }[] = [];
  conservadas.forEach((f, i) => {
    if (f.cantidad !== deseadoOrdenado[i]) actualizar.push({ index: f.index, cantidad: deseadoOrdenado[i] });
  });
  const indicesConservados = new Set(conservadas.map((f) => f.index));
  const borrar = actuales.filter((f) => !indicesConservados.has(f.index)).map((f) => f.index);
  const crear = deseadoOrdenado.slice(conservadas.length);
  return { actualizar, borrar, crear };
}

/// Fase 5 (plan oct-2026, B1) — `ZonePoint` por partida. Las filas con `saveId = null` son la
/// PLANTILLA de catálogo (sembrada por `seed-catalog`, nunca se mueve ni se caza); cada partida
/// trabaja con su propia copia. Si la partida aún no tiene filas en esta Location, clona las
/// plantillas activas (mismos campos, `lastUpdatedAtMinutes` null para que el primer reparto de
/// grupos corra) y las devuelve. Idempotente. Llamar antes de cualquier lectura de juego.
///
/// Resincronización aditiva (2026-09-29): si un re-seed del catálogo añade puntos a una Location
/// que la partida ya clonó (p. ej. las fuentes de pesca de la Playa), se clonan solo los que
/// faltan — ver `plantillasQueFaltan`. Nunca borra ni pisa las filas propias de la partida.
export async function asegurarZonePointsDePartida(
  tx: Prisma.TransactionClient | PrismaClient,
  saveId: string,
  locationId: string,
) {
  const [todasExistentes, todasPlantillas] = await Promise.all([
    tx.zonePoint.findMany({ where: { saveId, locationId } }),
    tx.zonePoint.findMany({ where: { saveId: null, locationId, activo: true } }),
  ]);
  // QA-27: la fauna ambiental no tiene puntos. Una partida de antes los pierde aquí (una sola vez)
  // y una plantilla vieja de catálogo (sin re-seed todavía) no se vuelve a clonar.
  const ambientales = todasExistentes.filter((p) => !esPuntoVigente(p));
  if (ambientales.length > 0) await tx.zonePoint.deleteMany({ where: { id: { in: ambientales.map((p) => p.id) } } });
  const existentes = todasExistentes.filter(esPuntoVigente);
  const plantillas = todasPlantillas.filter(esPuntoVigente);
  if (plantillasQueFaltan(existentes, plantillas).length === 0) return existentes;
  // Dos peticiones casi simultáneas (abrir el mapa + un turno) podían clonar dos veces. Candado de
  // Postgres por (partida, Location), liberado al acabar la transacción; si el caller no está ya en
  // una, se abre aquí.
  if ('$transaction' in tx) return tx.$transaction((t) => clonarPlantillasConCandado(t, saveId, locationId));
  return clonarPlantillasConCandado(tx, saveId, locationId);
}

type PuntoComparable = { tipo: string; targetSlug: string | null; x: number; y: number };

/// QA-27: un punto de FAUNA ambiental (ver `FAUNA_AMBIENTAL`, worldCatalog.ts) no va en el mapa.
export function esPuntoVigente(p: { tipo: string; targetSlug: string | null }): boolean {
  return !(p.tipo === 'FAUNA' && p.targetSlug != null && FAUNA_AMBIENTAL.has(p.targetSlug));
}

/// Plantillas de catálogo que la partida todavía no tiene. FAUNA y NPC se mueven (y los grupos de
/// FAUNA se parten y se borran, pero el ancla de cada especie nunca se borra — ver
/// `reconciliarGrupos`), así que se comparan por `targetSlug`: una especie o NPC sin ninguna fila en
/// la partida es nuevo del catálogo. RECURSO y EDIFICIO nunca se mueven ni se borran de una
/// partida, así que se comparan por (tipo, targetSlug, x, y). Partida sin filas → todas.
export function plantillasQueFaltan<P extends PuntoComparable>(existentes: PuntoComparable[], plantillas: P[]): P[] {
  const clave = (p: PuntoComparable) =>
    p.tipo === 'FAUNA' || p.tipo === 'NPC' ? `${p.tipo}|${p.targetSlug}` : `${p.tipo}|${p.targetSlug}|${p.x}|${p.y}`;
  const tiene = new Set(existentes.map(clave));
  return plantillas.filter((p) => !tiene.has(clave(p)));
}

async function clonarPlantillasConCandado(tx: Prisma.TransactionClient, saveId: string, locationId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`zonepoints|${saveId}|${locationId}`}))`;
  const [yaClonadas, plantillas] = await Promise.all([
    tx.zonePoint.findMany({ where: { saveId, locationId } }),
    tx.zonePoint.findMany({ where: { saveId: null, locationId, activo: true } }),
  ]);
  const faltan = plantillasQueFaltan(yaClonadas, plantillas.filter(esPuntoVigente));
  if (faltan.length === 0) return yaClonadas;
  await tx.zonePoint.createMany({
    data: faltan.map((p) => ({
      locationId: p.locationId,
      saveId,
      x: p.x,
      y: p.y,
      origenX: p.origenX,
      origenY: p.origenY,
      tipo: p.tipo,
      targetSlug: p.targetSlug,
      label: p.label,
      cantidad: p.cantidad,
      activo: p.activo,
      factionSlug: p.factionSlug,
      lastUpdatedAtMinutes: null,
      ruta: p.ruta === null ? Prisma.DbNull : (p.ruta as Prisma.InputJsonValue),
      pasoRuta: 0,
      plantillaEspecifica: p.plantillaEspecifica,
    })),
  });
  return tx.zonePoint.findMany({ where: { saveId, locationId } });
}

/// Recalcula TODOS los `ZonePoint` de tipo FAUNA/RECURSO de una `Location`, proporcional al tiempo
/// de ficción transcurrido desde su último recalculo — llamado desde `narrateAndPersistTurn`
/// (turnResolution.ts) y, si hace falta, desde `GET /saves/:id/zona` (zona.ts, partida nueva sin
/// ningún turno todavía). RECURSO se ajusta punto a punto, igual que siempre; FAUNA se reconcilia
/// por (locationId, targetSlug) — varias filas ("grupos") cuya suma es la población real, en vez de
/// una sola fila topada a `CANTIDAD_MAX_POR_PUNTO` (Fase 1, ver `reconciliarGrupos` arriba).
export async function recalcularZonePointsDeLocation(
  tx: Prisma.TransactionClient | PrismaClient,
  worldId: string,
  saveId: string,
  locationId: string,
  region: string | null,
  fictionalMinutesActuales: number,
  random: () => number = Math.random,
): Promise<void> {
  // Cargado en batch (2026-09-28) — TODOS los puntos de la Location, no solo FAUNA/RECURSO: hace
  // falta conocer también NPC/EDIFICIO para no colocar una fila de grupo nueva encima de ellos
  // (`ocupadas` más abajo).
  const todosPuntos = await asegurarZonePointsDePartida(tx, saveId, locationId);
  const puntos = todosPuntos.filter((p) => p.tipo === 'FAUNA' || p.tipo === 'RECURSO');
  if (puntos.length === 0) return;

  const targetSlugs = [...new Set(puntos.map((p) => p.targetSlug))];
  const ambito = await ambitoPoblacion(tx, saveId);
  let poblaciones = await tx.worldPopulation.findMany({
    where: { ...ambito, targetSlug: { in: targetSlugs } },
  });
  // QA-27: una fuente nueva del catálogo (p. ej. la Colmena de Lebude) no está en la población que
  // una partida de antes clonó al empezar; se copia aquí la primera vez que hace falta.
  if ('saveId' in ambito && ambito.saveId) {
    const faltan = targetSlugs.filter((slug) => !poblaciones.some((f) => f.targetSlug === slug));
    const enCatalogo = faltan.length > 0 ? await tx.worldPopulation.count({ where: { worldId, saveId: null, targetSlug: { in: faltan } } }) : 0;
    if (enCatalogo > 0) {
      const copiar = async (t: Prisma.TransactionClient) => {
        // Candado por partida: dos peticiones a la vez (abrir el mapa + un turno) no copian dos veces.
        await t.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`poblacion|${saveId}`}))`;
        const yaEstan = await t.worldPopulation.findMany({ where: { saveId, targetSlug: { in: faltan } }, select: { targetSlug: true } });
        const deCatalogo = (await t.worldPopulation.findMany({ where: { worldId, saveId: null, targetSlug: { in: faltan } } })).filter(
          (f) => !yaEstan.some((y) => y.targetSlug === f.targetSlug),
        );
        if (deCatalogo.length > 0) {
          await t.worldPopulation.createMany({
            data: deCatalogo.map((f) => copiaDeFila('WorldPopulation', f, { saveId }) as Prisma.WorldPopulationCreateManyInput),
          });
        }
      };
      if ('$transaction' in tx) await tx.$transaction(copiar);
      else await copiar(tx);
      poblaciones = await tx.worldPopulation.findMany({ where: { ...ambito, targetSlug: { in: targetSlugs } } });
    }
  }
  const regionSinArticulo = region ? stripRegionArticle(region) : null;
  // Población REAL disponible para esta especie en ESTA región concreta — el peso relativo de
  // `distribucion` (mismo criterio que el resto del motor, `travelInterruption.ts`/`recolectar.ts`)
  // aplicado sobre el agregado del `World` entero, nunca la cifra global sin repartir por región.
  const poblacionRegionalPorSlug = new Map<string, number>();
  for (const fila of poblaciones) {
    const distribucion = (fila.distribucion as Record<string, number> | null) ?? {};
    const peso = (regionSinArticulo ? distribucion[regionSinArticulo] : undefined) ?? (region ? distribucion[region] : undefined) ?? 0;
    poblacionRegionalPorSlug.set(fila.targetSlug, Math.round(fila.poblacion * peso));
  }

  const operaciones: Promise<unknown>[] = [];

  // RECURSO — sin cambios de diseño (un punto con cantidad, ver comentario de cabecera más arriba).
  for (const punto of puntos.filter((p) => p.tipo === 'RECURSO')) {
    const poblacionRegional = poblacionRegionalPorSlug.get(punto.targetSlug) ?? 0;
    const { cantidad, activo } = proximaCantidadPara(punto, poblacionRegional, fictionalMinutesActuales);
    if (!relojPorRefrescar(punto, cantidad, activo, poblacionRegional, fictionalMinutesActuales)) continue;
    operaciones.push(
      tx.zonePoint.update({ where: { id: punto.id }, data: { cantidad, activo, lastUpdatedAtMinutes: fictionalMinutesActuales } }),
    );
  }

  // FAUNA — reconciliación por grupos (Fase 1).
  const esZonaDeInicio = ZONAS_DE_INICIO.has((await tx.location.findUnique({ where: { id: locationId }, select: { slug: true } }))?.slug ?? '');
  const faunaPorSlug = new Map<string, (typeof puntos)[number][]>();
  for (const punto of puntos.filter((p) => p.tipo === 'FAUNA')) {
    const filas = faunaPorSlug.get(punto.targetSlug) ?? [];
    filas.push(punto);
    faunaPorSlug.set(punto.targetSlug, filas);
  }

  // QA-27 P82: un grupo nuevo de una especie hostil no se coloca a menos de 3 casillas de la
  // jugadora (con `celdaParaGrupoNuevo` repartiendo por toda la zona, aparecían junto a ella, también
  // donde reaparece tras morir).
  // Se consulta solo si algún grupo se va a colocar (perezoso: este recalculo corre al abrir la zona).
  // Temperamento de catálogo: la fauna casi nunca tiene facción que lo cambie.
  let evitar: { slugsHostiles: Set<string>; celdaJugadora: Celda | null; celdasSeguras: Set<string> } | null = null;
  const evitarAlColocar = async () => {
    if (evitar) return evitar;
    const faunaSlugs = [...new Set(puntos.filter((p) => p.tipo === 'FAUNA').map((p) => p.targetSlug))];
    const [hostiles, jugadora, entradas] = await Promise.all([
      tx.npc.findMany({ where: { worldId, slug: { in: faunaSlugs }, temperamento: { in: ['AGRESIVO', 'ENEMIGO'] } }, select: { slug: true } }),
      tx.save.findUnique({ where: { id: saveId }, select: { currentLocationId: true, zonaPosX: true, zonaPosY: true } }),
      celdasDeEntrada(tx, saveId, locationId),
    ]);
    evitar = {
      slugsHostiles: new Set(hostiles.map((n) => n.slug)),
      // P116: un grupo hostil nuevo no se coloca en el radio seguro de una entrada.
      celdasSeguras: new Set(
        Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => ({ col: i % GRID_COLS, row: Math.floor(i / GRID_COLS) }))
          .filter((c) => enRadioSeguro(c, entradas))
          .map(claveCelda),
      ),
      celdaJugadora:
        jugadora?.currentLocationId === locationId && jugadora.zonaPosX != null && jugadora.zonaPosY != null
          ? celdaDePixel({ x: jugadora.zonaPosX, y: jugadora.zonaPosY })
          : null,
    };
    return evitar;
  };

  // Ocupación real del lienzo (todos los puntos existentes, cualquier tipo/estado) — nunca se pisa
  // al colocar una fila de grupo nueva; se va ampliando con cada fila que este mismo recalculo crea.
  const ocupadas = new Set(todosPuntos.map((p) => claveCelda(celdaDePixel({ x: p.x, y: p.y }))));

  for (const [targetSlug, filas] of faunaPorSlug) {
    // Ancla — la de `label` no nulo (fila curada de catálogo); si ninguna lo tiene, la más antigua
    // (`createdAt`), con el `id` como desempate estable si dos filas compartieran el mismo instante.
    const ancla =
      filas.find((f) => f.label != null) ??
      filas.reduce((a, b) => (a.createdAt < b.createdAt || (a.createdAt.getTime() === b.createdAt.getTime() && a.id <= b.id) ? a : b));
    const ordenadas = [ancla, ...filas.filter((f) => f.id !== ancla.id)];

    const poblacionRegional = poblacionRegionalPorSlug.get(targetSlug) ?? 0;
    const primerReparto = ancla.lastUpdatedAtMinutes == null;
    const totalActual = ordenadas.reduce((suma, f) => suma + f.cantidad, 0);
    // Mismo ajuste gradual que un punto individual (`proximaCantidadPara`), aplicado al grupo entero
    // como un único "punto virtual" con la cantidad TOTAL y el reloj del ancla — el resto de filas
    // del grupo nunca llevan reloj propio, siempre se leen agregadas contra este.
    const puntoVirtual: ZonePointRow = { ...ancla, cantidad: totalActual };
    const { cantidad: objetivo } = proximaCantidadPara(puntoVirtual, poblacionRegional, fictionalMinutesActuales);

    if (!primerReparto && !relojPorRefrescar(puntoVirtual, objetivo, puntoVirtual.activo, poblacionRegional, fictionalMinutesActuales) && !(esZonaDeInicio && ordenadas.length > 1)) continue;

    const enGuarida = esZonaDeInicio && (await evitarAlColocar()).slugsHostiles.has(targetSlug);
    const resultado = enGuarida
      ? reconciliarEnGuarida(ordenadas.map((f) => f.cantidad), objetivo)
      : reconciliarGrupos(
          ordenadas.map((f) => f.cantidad),
          objetivo,
          primerReparto,
          random,
        );

    const cantidadPorIndex = new Map(resultado.actualizar.map((a) => [a.index, a.cantidad]));
    // El ancla SIEMPRE se toca — aunque su cantidad no cambie, es la única fila cuyo
    // `lastUpdatedAtMinutes` se lee la próxima vez (`puntoVirtual` arriba); sin esto, "minutos
    // transcurridos" se calcularía siempre desde un reloj viejo aunque el grupo ya esté al día.
    const cantidadAncla = cantidadPorIndex.get(0) ?? ancla.cantidad;
    operaciones.push(
      tx.zonePoint.update({
        where: { id: ancla.id },
        data: { cantidad: cantidadAncla, activo: cantidadAncla > 0, lastUpdatedAtMinutes: fictionalMinutesActuales },
      }),
    );

    for (const { index, cantidad } of resultado.actualizar) {
      if (index === 0) continue; // ancla ya actualizada arriba
      const fila = ordenadas[index];
      operaciones.push(
        tx.zonePoint.update({ where: { id: fila.id }, data: { cantidad, activo: cantidad > 0, lastUpdatedAtMinutes: fictionalMinutesActuales } }),
      );
    }
    for (const index of resultado.borrar) {
      operaciones.push(tx.zonePoint.delete({ where: { id: ordenadas[index].id } }));
    }

    const origenAncla = celdaDePixel({ x: ancla.origenX ?? ancla.x, y: ancla.origenY ?? ancla.y });
    const borradas = new Set(resultado.borrar);
    const celdasEspecie = ordenadas.filter((_, i) => !borradas.has(i)).map((f) => celdaDePixel({ x: f.x, y: f.y }));
    let ocupadasParaNuevos = ocupadas;
    if (resultado.crear.length > 0) {
      const { slugsHostiles, celdaJugadora, celdasSeguras } = await evitarAlColocar();
      if (celdaJugadora && slugsHostiles.has(targetSlug)) celdasEspecie.push(celdaJugadora);
      if (slugsHostiles.has(targetSlug)) ocupadasParaNuevos = new Set([...ocupadas, ...celdasSeguras]);
    }
    for (const cantidadNueva of resultado.crear) {
      const celda = celdaParaGrupoNuevo(origenAncla, ocupadasParaNuevos, celdasEspecie, random);
      if (ocupadasParaNuevos !== ocupadas) ocupadasParaNuevos.add(claveCelda(celda));
      ocupadas.add(claveCelda(celda));
      celdasEspecie.push(celda);
      const pixel = pixelDeCelda(celda);
      operaciones.push(
        tx.zonePoint.create({
          data: {
            locationId,
            saveId,
            targetSlug,
            tipo: 'FAUNA',
            plantillaEspecifica: ancla.plantillaEspecifica,
            label: null,
            x: pixel.x,
            y: pixel.y,
            origenX: pixel.x,
            origenY: pixel.y,
            cantidad: cantidadNueva,
            activo: true,
            lastUpdatedAtMinutes: fictionalMinutesActuales,
          },
        }),
      );
    }
  }

  await Promise.all(operaciones);
}

/// Sistema de movimiento por cuadrícula (2026-09-08, "estilo Mount & Blade") — avanza UN PASO a
/// todos los `ZonePoint` FAUNA/NPC de una `Location` (RECURSO/EDIFICIO nunca se mueven, son
/// inertes/estáticos) cada vez que el jugador se mueve una celda. Con `ruta` definida (array de
/// celdas en píxel), recorre esa ruta en bucle; sin ella, paseo aleatorio corto acotado a su
/// `origenX/Y` real de catálogo (nunca abandona su territorio). Llamado desde
/// `POST /saves/:id/zona/mover` — DISTINTO de `recalcularZonePointsDeLocation` (esa es cantidad/
/// actividad por tiempo de ficción transcurrido, cada turno de narración; esto es posición, cada
/// paso de movimiento del jugador dentro de la misma zona).
///
/// Persecución de AGRESIVO/ENEMIGO (2026-09-17) — antes de resolver ruta/plantilla normal, cada
/// punto agresivo efectivo comprueba si el jugador está a `RADIO_PERSECUCION_CELDAS` o menos; si sí,
/// avanza un paso hacia él en vez de su patrón habitual (ver `movementTemplates.ts` para el detalle
/// de prioridad completo).
/// Posiciones ya actualizadas (2026-09-09, bug real jugando en vivo — Álvaro: "los elementos se
/// mueven, pero no con animación de movimiento como yo ni a la vez que muevo yo... quería que todo
/// se moviera a la vez que yo me muevo") — antes esta función devolvía `Promise<void>`: el propio
/// endpoint (`POST /saves/:id/zona/mover`, zona.ts) la llamaba como puro efecto secundario en BD,
/// sin propagar nada a la respuesta HTTP. El frontend, durante la animación paso a paso del
/// jugador, solo actualizaba SU posición (`ZonaPanel.tsx` § `handleMoverA`) — la fauna/NPC del
/// mapa se quedaban con el snapshot del `GET /zona` inicial hasta el próximo refetch completo
/// (reabrir el panel), aunque el servidor ya los hubiera movido un paso por cada paso del jugador.
export interface ZonePointPasoResultado {
  id: string;
  x: number;
  y: number;
}

export async function avanzarZonePointsUnPaso(
  tx: Prisma.TransactionClient | PrismaClient,
  locationId: string,
  saveId: string,
  random: () => number = Math.random,
  // Persecución de AGRESIVO/ENEMIGO (2026-09-17) — posición actual del jugador y reputación de
  // facciones, ambas ya conocidas por el caller (`zona.ts`) en el momento de la llamada. Opcionales
  // (`undefined`) para no romper ningún otro caller/test existente que no necesite persecución —
  // sin jugador conocido, ningún ZonePoint persigue, se comporta exactamente como antes.
  jugador?: { x: number; y: number } | null,
  factionsStatus?: Record<string, number>,
  // Fauna diurna/nocturna (2026-09-17, bug real: un Kirelon Arenoso nocturno seguía moviéndose y
  // persiguiendo de pleno día, invisible en el mapa — ver comentario de `zonePointActivoAhora`).
  // Opcional por la misma razón que `jugador`/`factionsStatus`: sin momento conocido, ningún punto
  // se filtra por hora, se comporta exactamente como antes (comportamiento seguro por defecto).
  momento?: MomentoDelDia,
  // Celdas de las entradas ya calculadas por el caller en este mismo paso (P116); si no, se calculan.
  entradasConocidas?: Celda[],
): Promise<ZonePointPasoResultado[]> {
  await asegurarZonePointsDePartida(tx, saveId, locationId);
  const puntosCrudos = await tx.zonePoint.findMany({
    where: { saveId, locationId, tipo: { in: ['FAUNA', 'NPC'] }, activo: true },
  });
  if (puntosCrudos.length === 0) return [];
  // Gate de aparición narrativa (ver comentario junto a `zonePointVisiblePara` más arriba) — un
  // punto gateado sin su misión aceptada todavía no "patrulla": narrativamente no está en la zona.
  const questSlugsAceptados = await questSlugsAceptadosPara(tx, saveId);
  const puntos = puntosCrudos.filter(
    (p) => zonePointVisiblePara(p.targetSlug, questSlugsAceptados) && (!momento || zonePointActivoAhora(p.targetSlug, momento)),
  );
  if (puntos.length === 0) return [];

  // Sistema de plantillas de movimiento (2026-09-17) — Npc cargados en batch por `targetSlug`
  // (nunca FK real, mismo criterio de siempre) para poder inferir la plantilla GENERAL de cada
  // punto sin ruta artesanal ni plantilla específica asignada. `faction` (2026-09-17, persecución)
  // se carga a la vez para resolver `effectiveTemperamento` sin una segunda query. `worldId` no
  // hace falta filtrarlo aparte: `targetSlug` ya es único dentro de un mundo y esta función solo
  // opera sobre puntos de UNA Location concreta, que ya pertenece a un único World.
  const npcsPorSlug = new Map(
    (
      await tx.npc.findMany({
        where: { slug: { in: [...new Set(puntos.map((p) => p.targetSlug))] } },
        select: { slug: true, kind: true, role: true, temperamento: true, faunaCategoria: true, medio: true, faction: true },
      })
    ).map((n) => [n.slug, n]),
  );
  const celdaJugador = jugador ? celdaDePixel(jugador) : null;
  // P116 (QA-27): la fauna hostil no persigue ni entra en el radio seguro de las entradas.
  const entradas = entradasConocidas ?? (await celdasDeEntrada(tx, saveId, locationId));
  const esZonaDeInicioMov = ZONAS_DE_INICIO.has((await tx.location.findUnique({ where: { id: locationId }, select: { slug: true } }))?.slug ?? '');
  // B30 (pruebas 2026-09-28): dos grupos de la misma especie deambulando acababan en la MISMA celda
  // (un pin tapaba al otro). Celdas ocupadas en este paso — el tramo de cada callback hasta su
  // primer `await` es síncrono y en orden, así que reservar aquí no tiene carreras.
  const celdasOcupadasPaso = new Set(puntos.map((p) => claveCelda(celdaDePixel({ x: p.x, y: p.y }))));

  const resultados = await Promise.all(
    puntos.map(async (punto) => {
      const actual = celdaDePixel({ x: punto.x, y: punto.y });
      const npc = npcsPorSlug.get(punto.targetSlug) ?? null;

      // Persecución (2026-09-17) — "cualquier enemigo en la zona" en el diseño de Álvaro; hoy el
      // único enemigo real detectable en Zona es el propio jugador (no hay Companions rivales ni
      // otros NPC agresivos entre sí todavía), así que el objetivo es siempre `celdaJugador` cuando
      // aplica. Rompe INCLUSO una `ruta`/`plantillaEspecifica` curada a mano — coherente con "que
      // se dirija hacia ti", no tiene sentido seguir patrullando con el enemigo real a 3 casillas.
      const esAgresivoEfectivo = npc ? ['AGRESIVO', 'ENEMIGO'].includes(effectiveTemperamento(npc.temperamento, npc.faction, factionsStatus ?? {})) : false;
      // P88: en la zona de inicio la fauna hostil defiende su guarida, no persigue.
      const faunaHostil = esAgresivoEfectivo && punto.tipo === 'FAUNA';
      const persigue = esAgresivoEfectivo && !(esZonaDeInicioMov && punto.tipo === 'FAUNA') && !(faunaHostil && celdaJugador && enRadioSeguro(celdaJugador, entradas));
      // P116: desde fuera, la fauna hostil no pisa el radio seguro de una entrada (espera este paso).
      const noPuedeEntrar = (celda: Celda) => faunaHostil && enRadioSeguro(celda, entradas) && !enRadioSeguro(actual, entradas);
      const objetivoPersecucion = persigue && celdaJugador && enRangoDePersecucion(actual, celdaJugador) ? celdaJugador : null;

      if (objetivoPersecucion) {
        const { celda: siguiente, nuevoPasoRuta } = siguienteCeldaDeZonePoint({
          plantillaEspecifica: null,
          npc: null,
          actual,
          origen: actual,
          pasoRuta: punto.pasoRuta,
          gridCols: GRID_COLS,
          gridRows: GRID_ROWS,
          objetivoPersecucion,
          random,
        });
        if (noPuedeEntrar(siguiente)) return null;
        const pixel = pixelDeCelda(siguiente);
        if (pixel.x === punto.x && pixel.y === punto.y) return null;
        await tx.zonePoint.update({ where: { id: punto.id }, data: { x: pixel.x, y: pixel.y, pasoRuta: nuevoPasoRuta } });
        return { id: punto.id, x: pixel.x, y: pixel.y };
      }

      const ruta = (punto.ruta as { x: number; y: number }[] | null) ?? null;

      // `ZonePoint.ruta` (curada directamente en la fila) sigue siendo el nivel de prioridad más
      // alto tras persecución, sin cambios — ya existía antes de las plantillas y algún punto real
      // puede seguir usándola tal cual. `plantillaEspecifica` (nueva) es la vía preferida para rutas
      // REUTILIZABLES entre varios ZonePoint; `ruta` suelta sigue viva para un caso puntual.
      if (ruta && ruta.length > 0) {
        const rutaCeldas = ruta.map((p) => celdaDePixel(p));
        const { celda, nuevoPasoRuta } = siguienteCeldaEnRuta(rutaCeldas, punto.pasoRuta % rutaCeldas.length);
        if (noPuedeEntrar(celda)) return null;
        const pixel = pixelDeCelda(celda);
        await tx.zonePoint.update({ where: { id: punto.id }, data: { x: pixel.x, y: pixel.y, pasoRuta: nuevoPasoRuta } });
        return { id: punto.id, x: pixel.x, y: pixel.y };
      }

      // `origenX/Y` null (fila sembrada antes de la Pieza 3, 2026-09-08) cae al propio `x`/`y`
      // actual como origen — comportamiento idéntico a antes: primer paso posible ya desde su
      // punto de siempre.
      const origen: Celda = celdaDePixel({ x: punto.origenX ?? punto.x, y: punto.origenY ?? punto.y });
      const { celda: siguiente, nuevoPasoRuta } = siguienteCeldaDeZonePoint({
        plantillaEspecifica: punto.plantillaEspecifica,
        npc: npc ? { kind: npc.kind, role: npc.role, temperamento: npc.temperamento, faunaCategoria: npc.faunaCategoria as FaunaCategoria | null, medio: npc.medio } : null,
        actual,
        origen,
        pasoRuta: punto.pasoRuta,
        gridCols: GRID_COLS,
        gridRows: GRID_ROWS,
        random,
      });
      if (noPuedeEntrar(siguiente)) return null;
      const pixel = pixelDeCelda(siguiente);
      if (pixel.x === punto.x && pixel.y === punto.y && nuevoPasoRuta === punto.pasoRuta) return null;
      const claveSiguiente = claveCelda(siguiente);
      const claveActual = claveCelda(actual);
      if (claveSiguiente !== claveActual) {
        if (celdasOcupadasPaso.has(claveSiguiente)) return null; // celda ya ocupada: espera este paso
        celdasOcupadasPaso.add(claveSiguiente);
      }
      await tx.zonePoint.update({ where: { id: punto.id }, data: { x: pixel.x, y: pixel.y, pasoRuta: nuevoPasoRuta } });
      return { id: punto.id, x: pixel.x, y: pixel.y };
    }),
  );
  return resultados.filter((r): r is ZonePointPasoResultado => r !== null);
}

/// `ZonePoint` alimenta al narrador (2026-08-27, Pieza 3 de "Dinamismo del mundo") — cierra el
/// hueco de auditoría "ningún panorama de población ambiental real, solo el NPC puntual detectado
/// por nombre". Solo puntos `activo` entran en el resumen; NPC/EDIFICIO resuelven nombre por
/// `Npc.name` (mismo criterio ya establecido en `zona.ts`), FAUNA/RECURSO por
/// `sourceDisplayNameFor` (catálogo de recolección/caza). `null` si no hay nada que contar —
/// el caller decide si empuja el bloque de contexto o lo omite.
///
/// Bug real (2026-09-15, jugando en vivo): la versión anterior devolvía una única lista plana sin
/// distinguir tipo (`"Colmena de Lebude, Orco Enfurecido, Veta de Yerreo"`), y el caller la
/// inyectaba bajo el encabezado "QUIÉN ESTÁ AQUÍ AHORA MISMO" — personificando fauna/recursos. El
/// modelo pequeño interpretó "Colmena de Lebude" (fauna, label de escenario) como el apellido de
/// una persona y narró "el pescador de Lebude", un NPC inventado sin respaldo. Ahora se devuelve
/// por tipo — el caller construye un bloque de contexto propio para cada uno, dejando claro que
/// solo NPC son personas con las que se puede hablar.
export interface ZonePointsSummaryPorTipo {
  npc: string | null;
  fauna: string | null;
  recurso: string | null;
  edificio: string | null;
}

export async function zonePointsSummaryFor(prisma: PrismaClient, locationId: string, saveId: string): Promise<ZonePointsSummaryPorTipo | null> {
  await asegurarZonePointsDePartida(prisma, saveId, locationId);
  const puntosCrudos = await prisma.zonePoint.findMany({ where: { saveId, locationId, activo: true } });
  if (puntosCrudos.length === 0) return null;
  // Gate de aparición narrativa — un punto sin su misión de desbloqueo aceptada tampoco debe
  // filtrarse al contexto del narrador (el LLM no debe "saber" que está ahí antes de tiempo).
  const questSlugsAceptados = await questSlugsAceptadosPara(prisma, saveId);
  const puntos = puntosCrudos.filter((p) => zonePointVisiblePara(p.targetSlug, questSlugsAceptados));
  if (puntos.length === 0) return null;

  const npcSlugs = [...new Set(puntos.filter((p) => p.tipo === 'NPC').map((p) => p.targetSlug))];
  const npcRows = npcSlugs.length ? await prisma.npc.findMany({ where: { slug: { in: npcSlugs } }, select: { slug: true, name: true } }) : [];
  const npcNameBySlug = new Map(npcRows.map((n) => [n.slug, n.name]));

  const nombreDe = (p: (typeof puntos)[number]): string => {
    // EDIFICIO no resuelve contra `Npc` — no tiene fila propia ahí (gobernado por
    // `Building`/`construction.ts`, fuera del alcance de esta pieza), solo `label` o el slug crudo.
    // Para NPC, el nombre real SIEMPRE gana sobre `label` (evita que un label de escenario tipo
    // "Punto de vigilancia (Orco Enfurecido)" sustituya al nombre de la persona) — para el resto,
    // `label` sigue ganando si existe, es descripción de escenario, no de identidad.
    const nombre = p.tipo === 'NPC' ? (npcNameBySlug.get(p.targetSlug) ?? p.targetSlug) : (p.label ?? (p.tipo === 'EDIFICIO' ? p.targetSlug : sourceDisplayNameFor(p.targetSlug)));
    return p.cantidad > 1 ? `${nombre} ×${p.cantidad}` : nombre;
  };
  // Grupos de fauna (2026-09-28): una especie repartida en varios `ZonePoint` (ver
  // `reconciliarGrupos`) se resume como UNA entrada con su total — el narrador no necesita saber
  // cómo está repartida en el lienzo, y listar "Gesgurio ×4, Gesgurio, Gesgurio ×3…" solo le
  // confunde. El nombre sale de la fila con `label` (la ancla de catálogo) si la hay.
  const listaDe = (tipo: 'NPC' | 'FAUNA' | 'RECURSO' | 'EDIFICIO'): string | null => {
    const porSlug = new Map<string, (typeof puntos)[number]>();
    for (const p of puntos.filter((p) => p.tipo === tipo)) {
      const previo = porSlug.get(p.targetSlug);
      if (!previo) porSlug.set(p.targetSlug, { ...p });
      else porSlug.set(p.targetSlug, { ...(previo.label != null ? previo : p), cantidad: previo.cantidad + p.cantidad });
    }
    const entradas = [...porSlug.values()].map(nombreDe);
    return entradas.length > 0 ? entradas.join(', ') + '.' : null;
  };

  return {
    npc: listaDe('NPC'),
    fauna: listaDe('FAUNA'),
    recurso: listaDe('RECURSO'),
    edificio: listaDe('EDIFICIO'),
  };
}
