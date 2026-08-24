/// Economía de Reino (sesión de diseño 2026-07-23) — TICK puro: fórmulas deterministas de
/// producción/consumo, cero IA, aplicadas una vez por día de ficción cruzado (ver turnResolution.ts,
/// donde ya se actualiza `WorldState.fictionalMinutes`). Solo se aplica si ya existe una fila
/// `KingdomStats` para la partida (se crea al fundar el primer Territory) — "el vacío es un estado
/// válido" (docs/10-niveles-xp-reino.md § 5.1): sin reino todavía, no hay nada que tiquear.
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
};

const FELICIDAD_MIN = 0;
const FELICIDAD_MAX = 100;
/// Cada trabajador produce esto al día; cada "boca" (población + soldados + visitantes) consume
/// esto al día. Cifras deliberadamente pequeñas y redondas — se ajustan jugando, igual que el
/// resto de tablas deterministas del proyecto (XP_BY_DIFFICULTY, etc.), no pretenden ser un
/// balance final cerrado.
const COMIDA_POR_TRABAJADOR = 2;
const RIQUEZA_POR_TRABAJADOR = 1;
const CONSUMO_POR_BOCA = 1;
const MANTENIMIENTO_POR_SOLDADO = 1;

/// Bandas de felicidad que alimentan Territory.control/population (2026-08-23, Grupo 3 —
/// docs/10-niveles-xp-reino.md § 5.4 ya reservaba 300 XP para "Territory pasa a CONSOLIDADO" y
/// preveía PERDIDO por "bajas de población", pero nunca se conectó con nada real). Todo cifra de
/// partida, primera pasada ajustable jugando — igual criterio que el resto de constantes de este
/// archivo.
export const FELICIDAD_ALTA_UMBRAL = 70;
export const FELICIDAD_BAJA_UMBRAL = 20;
/// Días seguidos en la banda alta/baja antes de consolidar/perder un territorio — ver el bloque de
/// `diasCruzados` en turnResolution.ts, que lee estos contadores tras cada `tickKingdom`.
export const DIAS_PARA_CONSOLIDAR = 7;
export const DIAS_PARA_REBELION = 7;
const TERRITORIO_POBLACION_CRECE_POR_DIA = 2;
const TERRITORIO_POBLACION_DECRECE_POR_DIA = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/// Puro: un solo día de reino. Superávit de comida Y bebida sube la felicidad; déficit de
/// cualquiera de las dos la baja — el propio défict de recursos ya se clampa en 0 (no hay hambruna
/// numérica negativa, la consecuencia real vive en la felicidad, no en un contador que se hunde).
export function tickKingdomOneDay(stats: KingdomStatsBlock): KingdomStatsBlock {
  const bocas = stats.poblacion + stats.soldados + stats.visitantes;
  const comidaNeta = stats.comida + stats.trabajadores * COMIDA_POR_TRABAJADOR - bocas * CONSUMO_POR_BOCA;
  const bebidaNeta = stats.bebida - bocas * CONSUMO_POR_BOCA;
  const riquezaNeta = stats.riqueza + stats.trabajadores * RIQUEZA_POR_TRABAJADOR - stats.soldados * MANTENIMIENTO_POR_SOLDADO;

  const hayDeficit = comidaNeta < 0 || bebidaNeta < 0;
  const haySuperavit = !hayDeficit && bocas > 0 && comidaNeta > bocas && bebidaNeta > bocas;
  const felicidadDelta = hayDeficit ? -5 : haySuperavit ? 2 : 0;
  const nuevaFelicidad = clamp(stats.felicidad + felicidadDelta, FELICIDAD_MIN, FELICIDAD_MAX);

  return {
    ...stats,
    comida: Math.max(0, comidaNeta),
    bebida: Math.max(0, bebidaNeta),
    riqueza: Math.max(0, riquezaNeta),
    felicidad: nuevaFelicidad,
    // Racha rota en cuanto se sale de la banda — sin premio parcial por días sueltos no
    // consecutivos, mismo criterio "todo o nada" que el resto de umbrales de este archivo.
    diasFelicidadAlta: nuevaFelicidad >= FELICIDAD_ALTA_UMBRAL ? stats.diasFelicidadAlta + 1 : 0,
    diasFelicidadBaja: nuevaFelicidad <= FELICIDAD_BAJA_UMBRAL ? stats.diasFelicidadBaja + 1 : 0,
  };
}

/// Puro: cuánto crece/decrece la población anónima de CADA territorio del reino tras `dias` días,
/// según la felicidad ya tickeada (2026-08-23) — mismo criterio de bandas que arriba, nunca un
/// porcentaje (a diferencia de WorldPopulation.growAllPopulations): partiendo de una población
/// inicial pequeña, un crecimiento porcentual se queda pegado a 0 durante demasiado tiempo.
export function territoryPopulationDelta(felicidad: number, dias: number): number {
  if (felicidad >= FELICIDAD_ALTA_UMBRAL) return TERRITORIO_POBLACION_CRECE_POR_DIA * dias;
  if (felicidad <= FELICIDAD_BAJA_UMBRAL) return -TERRITORIO_POBLACION_DECRECE_POR_DIA * dias;
  return 0;
}

/// Puro: aplica N días de golpe (un viaje largo o un descanso extendido puede cruzar más de un
/// día de ficción en un solo turno) — nunca lo decide el modelo, ver el enganche en turnResolution.ts.
export function tickKingdom(stats: KingdomStatsBlock, dias: number): KingdomStatsBlock {
  let result = stats;
  for (let i = 0; i < dias; i++) {
    result = tickKingdomOneDay(result);
  }
  return result;
}

/// Días de ficción completos entre dos marcas de `WorldState.fictionalMinutes` (1440 min/día) —
/// puro, para poder testearlo aparte de la resta real de turnResolution.ts.
export function daysCrossed(minutosAntes: number, minutosDespues: number): number {
  return Math.floor(minutosDespues / 1440) - Math.floor(minutosAntes / 1440);
}
