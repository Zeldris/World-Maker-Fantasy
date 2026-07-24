/// Reloj ficticio de la partida — hasta ahora `fictionalDateLabel` era un placeholder fijo
/// ("Día 1, mañana", ver el comentario que había en turn.ts) que nunca avanzaba. Puro y
/// determinista, mismo espíritu que death.ts/progression.ts: el backend avanza el reloj según
/// los minutos reales que cuesta cada turno (computeDuration/travel.minutos) — el modelo nunca
/// decide qué hora es. Año todavía no implementado (pendiente de que este flujo día/hora se
/// demuestre estable jugando primero).
const MINUTES_PER_DAY = 1440;

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
