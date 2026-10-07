/// Economía de Reino (sesión de diseño 2026-07-23) — TICK puro: fórmulas deterministas de
/// producción/consumo, cero IA, aplicadas una vez por día de ficción cruzado (ver turnResolution.ts,
/// donde ya se actualiza `WorldState.fictionalMinutes`). Solo se aplica si ya existe una fila
/// `KingdomStats` para la partida (se crea al fundar el primer Territory) — "el vacío es un estado
/// válido" (docs/mecanicas/10-niveles-xp-reino.md § 5.1): sin reino todavía, no hay nada que tiquear.
import { comidaDelDia, porcionDelDia, repartoDeFaccion } from './cronista/comidaOficios.js';

export interface KingdomStatsBlock {
  poblacion: number;
  felicidad: number;
  comida: number;
  bebida: number;
  riqueza: number;
  soldados: number;
  trabajadores: number;
  visitantes: number;
  /// Rachas de días consecutivos en banda alta/baja de felicidad (2026-08-23, Grupo 3 §
  /// Territory.control) — ver comentario del campo homónimo en schema.prisma.
  diasFelicidadAlta: number;
  diasFelicidadBaja: number;
  /// CR-12 (12c): días seguidos con déficit de comida. Opcional (bloques antiguos sin él = 0).
  diasHambre?: number;
  /// CR-53 53d: días seguidos sin agua (sed).
  diasSed?: number;
}

/// CR-12 (12c): días seguidos de hambre que hacen una `HAMBRUNA` (y otra cada tantos más).
export const DIAS_PARA_HAMBRUNA = 3;

/// Puro: ¿la racha de hambre ha cruzado un múltiplo de `DIAS_PARA_HAMBRUNA` en estos `dias`? (como
/// mucho una hambruna por llamada, aunque un viaje largo cruce varias).
export function hambrunaNueva(antes: number, despues: number, dias: number): boolean {
  if (despues < DIAS_PARA_HAMBRUNA) return false;
  // Si la racha se rompió en medio, solo cuenta la de ahora.
  const base = despues === antes + dias ? antes : 0;
  return Math.floor(despues / DIAS_PARA_HAMBRUNA) > Math.floor(base / DIAS_PARA_HAMBRUNA);
}

export const DEFAULT_KINGDOM_STATS: KingdomStatsBlock = {
  poblacion: 0,
  felicidad: 50,
  comida: 0,
  bebida: 0,
  riqueza: 0,
  soldados: 0,
  trabajadores: 0,
  visitantes: 0,
  diasFelicidadAlta: 0,
  diasFelicidadBaja: 0,
  diasHambre: 0,
  diasSed: 0,
};

const FELICIDAD_MIN = 0;
const FELICIDAD_MAX = 100;
/// Cada trabajador produce esto al día; cada "boca" (población + soldados + visitantes) consume
/// esto al día. Cifras deliberadamente pequeñas y redondas — se ajustan jugando, igual que el
/// resto de tablas deterministas del proyecto (XP_BY_DIFFICULTY, etc.), no pretenden ser un
/// balance final cerrado.
/// CR-61: ya no hay comida pasiva por trabajador; la comida sale de sus tareas
/// (`cronista/comidaOficios.ts`) y llega aquí como `SuministrosDia.comidaDia` o `extra.comida`.
export const RIQUEZA_POR_TRABAJADOR = 1;
const CONSUMO_POR_BOCA = 1;
const MANTENIMIENTO_POR_SOLDADO = 1;

/// Bandas de felicidad que alimentan Territory.control/population (2026-08-23, Grupo 3 —
/// docs/mecanicas/10-niveles-xp-reino.md § 5.4 ya reservaba 300 XP para "Territory pasa a CONSOLIDADO" y
/// preveía PERDIDO por "bajas de población", pero nunca se conectó con nada real). Todo cifra de
/// partida, primera pasada ajustable jugando — igual criterio que el resto de constantes de este
/// archivo.
export const FELICIDAD_ALTA_UMBRAL = 70;
export const FELICIDAD_BAJA_UMBRAL = 20;
/// Días seguidos en la banda alta/baja antes de consolidar/perder un territorio — ver el bloque de
/// `diasCruzados` en turnResolution.ts, que lee estos contadores tras cada `tickKingdom`.
export const DIAS_PARA_CONSOLIDAR = 7;
export const DIAS_PARA_REBELION = 7;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/// Puro: lo que gana (o pierde, si es negativo) un reino en un día sin contar su reserva: trabajadores
/// y `extra` (producción de edificios de una facción) frente a bocas y soldados. Mismas cifras que
/// `tickKingdomOneDay`; lo usan las carencias de las decisiones de facción (CR-34).
export function balanceDiario(stats: KingdomStatsBlock, extra: { comida: number; riqueza: number } = { comida: 0, riqueza: 0 }): { comida: number; bebida: number; riqueza: number; consumoComida: number; sueldos: number } {
  const bocas = stats.poblacion + stats.soldados + stats.visitantes;
  return {
    comida: extra.comida - bocas * CONSUMO_POR_BOCA,
    bebida: -bocas * CONSUMO_POR_BOCA,
    riqueza: stats.trabajadores * RIQUEZA_POR_TRABAJADOR + extra.riqueza - stats.soldados * MANTENIMIENTO_POR_SOLDADO,
    consumoComida: bocas * CONSUMO_POR_BOCA,
    sueldos: stats.soldados * MANTENIMIENTO_POR_SOLDADO,
  };
}

/// Puro: un solo día de reino. Superávit de comida Y bebida sube la felicidad; déficit de
/// cualquiera de las dos la baja — el propio défict de recursos ya se clampa en 0 (no hay hambruna
/// numérica negativa, la consecuencia real vive en la felicidad, no en un contador que se hunde).
/// CR-53 (hito 0.3, Q1-Q2): agua que entra al día (pozos, fuente natural) y topes del almacén.
export interface SuministrosDia {
  /// CR-61: comida que producen cada día las tareas de sus trabajadores (puede llevar decimales).
  comidaDia?: number;
  agua: number;
  topeComida: number;
  topeBebida: number;
  /// CR-53 53c: los soldados cobran por semana (`revisarSueldos`), no un mantenimiento diario.
  sueldosSemanales?: boolean;
}
/// Sin datos del Reino (tests de antes del 0.3): ni agua de fuera ni topes.
export const SIN_SUMINISTROS: SuministrosDia = { agua: 0, topeComida: Infinity, topeBebida: Infinity };

export function tickKingdomOneDay(stats: KingdomStatsBlock, s: SuministrosDia = SIN_SUMINISTROS): KingdomStatsBlock {
  const bocas = stats.poblacion + stats.soldados + stats.visitantes;
  const comidaNeta = stats.comida + (s.comidaDia ?? 0) - bocas * CONSUMO_POR_BOCA;
  const bebidaNeta = stats.bebida + s.agua - bocas * CONSUMO_POR_BOCA;
  const riquezaNeta = stats.riqueza + stats.trabajadores * RIQUEZA_POR_TRABAJADOR - (s.sueldosSemanales ? 0 : stats.soldados * MANTENIMIENTO_POR_SOLDADO);

  const hayDeficit = comidaNeta < 0 || bebidaNeta < 0;
  const haySuperavit = !hayDeficit && bocas > 0 && comidaNeta > bocas && bebidaNeta > bocas;
  const felicidadDelta = hayDeficit ? -5 : haySuperavit ? 2 : 0;
  const nuevaFelicidad = clamp(stats.felicidad + felicidadDelta, FELICIDAD_MIN, FELICIDAD_MAX);

  return {
    ...stats,
    // Lo que no cabe en el almacén se pierde (Q2).
    comida: Math.min(s.topeComida, Math.max(0, comidaNeta)),
    bebida: Math.min(s.topeBebida, Math.max(0, bebidaNeta)),
    riqueza: Math.max(0, riquezaNeta),
    felicidad: nuevaFelicidad,
    // Racha rota en cuanto se sale de la banda — sin premio parcial por días sueltos no
    // consecutivos, mismo criterio "todo o nada" que el resto de umbrales de este archivo.
    diasFelicidadAlta: nuevaFelicidad >= FELICIDAD_ALTA_UMBRAL ? stats.diasFelicidadAlta + 1 : 0,
    diasFelicidadBaja: nuevaFelicidad <= FELICIDAD_BAJA_UMBRAL ? stats.diasFelicidadBaja + 1 : 0,
    diasHambre: comidaNeta < 0 ? (stats.diasHambre ?? 0) + 1 : 0,
    diasSed: bebidaNeta < 0 ? (stats.diasSed ?? 0) + 1 : 0,
  };
}

/// Puro: aplica N días de golpe (un viaje largo o un descanso extendido puede cruzar más de un
/// día de ficción en un solo turno) — nunca lo decide el modelo, ver el enganche en turnResolution.ts.
export function tickKingdom(stats: KingdomStatsBlock, dias: number, s: SuministrosDia = SIN_SUMINISTROS, primerDia = 1): KingdomStatsBlock {
  let result = stats;
  // CR-61 / QA-19: la comida de las tareas puede traer medias (2,5 por recolector en primavera); se
  // reparten por el número de día (`porcionDelDia`), igual en un salto que día a día.
  for (let i = 0; i < dias; i++) {
    result = tickKingdomOneDay(result, { ...s, comidaDia: porcionDelDia(s.comidaDia ?? 0, primerDia + i) });
  }
  return result;
}

/// Días de ficción completos entre dos marcas de `WorldState.fictionalMinutes` (1440 min/día) —
/// puro, para poder testearlo aparte de la resta real de turnResolution.ts.
export function daysCrossed(minutosAntes: number, minutosDespues: number): number {
  return Math.floor(minutosDespues / 1440) - Math.floor(minutosAntes / 1440);
}

/// (Se aplica desde `producirFacciones`, en el avance diario de cada partida — ya no en el turno.)
/// Producción de facción agregada (docs/rpgtarkor/sistemas-reino/edificios-de-oficio.md § 4/§ 7,
/// 2026-09-28, decisión de Álvaro): el Almacén de Reino (`AlmacenItem`) es solo del jugador (§
/// 4.4-ter) — las facciones NO tienen objetos reales, solo un número agregado por día a
/// `KingdomStats.comida`/`riqueza`, igual que hace X4 con la economía simulada de las IA. Cada
/// `FactionBuilding` (Building.factionId no null) `ACTIVO` suma según su clase: la(s) Cocina(s)
/// suman comida, el resto de edificios de oficio suman riqueza — un edificio quemado deja de sumar
/// de inmediato (consecuencia económica real de la guerra por estructuras, § 7.4 de
/// mundo-vivo-x4.md), sin necesidad de montar un almacén de objetos por facción.
const PRODUCCION_FACCION_POR_EDIFICIO_OFICIO = 2;
export const COCINA_RECIPE_KEYS = new Set(['cocina', 'cocina-obrador', 'cocina-gran-obrador', 'cocina-serhu', 'cocina-helsig']);
/// Resto de `Building.recipeKey` de facción que SÍ cuentan como "edificio de oficio" para este
/// agregado — el salón (`*-sedsar`) y la boca de mina/embarcadero cuentan igual que cualquier otro
/// taller (dan riqueza, no comida), pero el propio salón (`Ketg'sedsar`...) NO es un edificio de
/// oficio y no produce nada — se excluye explícitamente.
// CR-40: el tablón de avisos tampoco produce (no es un edificio de oficio).
const SALON_RECIPE_KEYS = new Set(['ketg-sedsar', 'helsig-sedsar', 'goshg-sedsar', 'tablon-avisos']);

export interface FactionBuildingForTick {
  recipeKey: string | null;
  status: string;
}

/// Puro: cuánto suma UN día de producción agregada de facción, a partir de sus `Building` reales.
/// CR-61: los edificios ya no dan comida (`comida` es siempre 0; la comida sale de las tareas,
/// `produccionDeFaccion`); se deja el campo porque es la forma de `tickFactionOneDay`.
export function tickFactionProduction(buildings: FactionBuildingForTick[]): { comida: number; riqueza: number } {
  let riqueza = 0;
  for (const b of buildings) {
    if (b.status !== 'ACTIVO' || !b.recipeKey || SALON_RECIPE_KEYS.has(b.recipeKey)) continue;
    // CR-61: la Cocina ya no da comida fija; la ganan sus cocineros (`comidaOficios.ts`).
    if (COCINA_RECIPE_KEYS.has(b.recipeKey)) continue;
    riqueza += PRODUCCION_FACCION_POR_EDIFICIO_OFICIO;
  }
  return { comida: 0, riqueza };
}

/// Escalón de una Cocina por su receta (las de facción del catálogo, Taller).
const ESCALON_COCINA: Record<string, number> = { 'cocina-obrador': 2, 'cocina-gran-obrador': 3 };
/// Escalón de la mejor Cocina activa (0 si no hay ninguna). La del Reino se mejora en la misma fila
/// (`recipeKey` 'cocina', `tier` 2 o 3).
export function escalonCocinaDe(buildings: (FactionBuildingForTick & { tier?: number | null })[]): number {
  return Math.max(0, ...buildings.filter((b) => b.status === 'ACTIVO' && b.recipeKey && COCINA_RECIPE_KEYS.has(b.recipeKey)).map((b) => Math.max(b.tier ?? 1, ESCALON_COCINA[b.recipeKey!] ?? 1)));
}

/// Puro (CR-61): producción de un día corriente de una facción para estimar su balance (carencias,
/// rearme del vasallo): la de sus edificios más la comida de las tareas de sus trabajadores, en una
/// estación media y con agua.
export function produccionDeFaccion(
  buildings: (FactionBuildingForTick & { tier?: number | null })[],
  raza: string | null,
  stats: { trabajadores: number; comida: number },
): { comida: number; riqueza: number } {
  const escalon = escalonCocinaDe(buildings);
  const cuadrilla = repartoDeFaccion(raza, stats.trabajadores, true, escalon > 0);
  const comida = comidaDelDia(cuadrilla, { estacion: 'OTONO', hayAgua: true, escalonCocina: escalon || null, comidaDisponible: stats.comida });
  return { comida: Math.floor(comida), riqueza: tickFactionProduction(buildings).riqueza };
}
