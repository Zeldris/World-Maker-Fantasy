import type { Estacion } from '@prisma/client';

/// Reloj ficticio de la partida — hasta ahora `fictionalDateLabel` era un placeholder fijo
/// ("Día 1, mañana", ver el comentario que había en turn.ts) que nunca avanzaba. Puro y
/// determinista, mismo espíritu que death.ts/progression.ts: el backend avanza el reloj según
/// los minutos reales que cuesta cada turno (computeDuration/travel.minutos) — el modelo nunca
/// decide qué hora es. Fecha completa (mes/día del mes) todavía no implementada — solo el
/// conteo de "Día N" y, desde 2026-08-24, la estación (`estacionFor`, ver abajo).
const MINUTES_PER_DAY = 1440;

/// Sistema de estaciones (2026-08-24, Grupo 3 § Sistema de estaciones, diseño completo en
/// docs/rpgtarkor/estaciones.md) — calendario único y global (no desfasado por región: hoy solo
/// Las Llanuras del Viento Rojo tiene núcleo jugable real, así que un offset por región no
/// tendría forma de probarse en vivo). 120 días de ficción por año, 30 por estación, mismo
/// patrón puro que `dayForFictionalMinutes`/`franjaHorariaFor` (entorno.ts): nunca se guarda en
/// BD, se recalcula siempre a partir de `fictionalMinutes`.
const DIAS_POR_ESTACION = 30;
const ESTACIONES_ORDEN: Estacion[] = ['PRIMAVERA', 'VERANO', 'OTONO', 'INVIERNO'];
const DIAS_POR_ANO = DIAS_POR_ESTACION * ESTACIONES_ORDEN.length;

export function estacionFor(totalMinutes: number): Estacion {
  const dia = dayForFictionalMinutes(totalMinutes);
  const diaDelAno = (dia - 1) % DIAS_POR_ANO;
  const index = Math.floor(diaDelAno / DIAS_POR_ESTACION);
  return ESTACIONES_ORDEN[index];
}

/// Nombre Kektira (lengua propia de los clanes orcos, `areas.md`) para el personaje jugable
/// orco de hoy (Gorhorn, `razaFor` en berigLore.ts); glosa en lengua común como fallback para
/// cualquier otra raza o `raza` desconocida — mismo patrón que ya usa el motor para nombres de
/// habilidad condicionados por raza (dynamicAbilities.ts/npcCombatAbilities.ts). Puramente para
/// narrar: la mecánica (`estacionFor`) compara siempre contra la clave interna, nunca contra
/// este nombre.
const ESTACION_NOMBRE_KEKTIRA: Record<Estacion, string> = {
  PRIMAVERA: "Ur'gathek",
  VERANO: 'Sohkar',
  OTONO: 'Vungrat',
  INVIERNO: 'Krenoth',
};

const ESTACION_GLOSA_COMUN: Record<Estacion, string> = {
  PRIMAVERA: 'la estación de las crecidas',
  VERANO: 'la estación seca',
  OTONO: 'la estación de la cosecha',
  INVIERNO: 'la estación larga',
};

export function estacionNombreFor(estacion: Estacion, raza: string | null): string {
  return raza === 'orcos' ? ESTACION_NOMBRE_KEKTIRA[estacion] : ESTACION_GLOSA_COMUN[estacion];
}

export function advanceFictionalMinutes(current: number, deltaMinutos: number): number {
  return current + Math.max(0, deltaMinutos);
}

/// Día de ficción real (1-indexado), misma cuenta que ya usa `formatFictionalDate` para el "Día N"
/// del texto — expuesto aparte (rework 2026-07-24, Diario agrupado por día) para no repetir la
/// cuenta a mano ni depender de parsear el string ya formateado.
export function dayForFictionalMinutes(totalMinutes: number): number {
  return Math.floor(totalMinutes / MINUTES_PER_DAY) + 1;
}

export function formatFictionalDate(totalMinutes: number): string {
  const day = Math.floor(totalMinutes / MINUTES_PER_DAY) + 1;
  const minuteOfDay = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `Día ${day}, ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
