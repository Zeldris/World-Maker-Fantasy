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

  return {
    ...stats,
    comida: Math.max(0, comidaNeta),
    bebida: Math.max(0, bebidaNeta),
    riqueza: Math.max(0, riquezaNeta),
    felicidad: clamp(stats.felicidad + felicidadDelta, FELICIDAD_MIN, FELICIDAD_MAX),
  };
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
