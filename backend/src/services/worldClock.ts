import type { Estacion, EstadoClima } from '@prisma/client';

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

/// Diario en pestañas jerárquicas (2026-09-04, petición explícita ya anotada en sesión de pruebas
/// del 2026-09-03) — `estacionFor` ya descartaba el cociente de año al calcular `diaDelAno`; aquí
/// se recupera. 1-indexado, igual que `dayForFictionalMinutes` (Año 1, no Año 0).
export function yearFor(totalMinutes: number): number {
  const dia = dayForFictionalMinutes(totalMinutes);
  return Math.floor((dia - 1) / DIAS_POR_ANO) + 1;
}

/// Día relativo DENTRO de la estación actual (1-30), no el día absoluto de partida — distinto de
/// `dayForFictionalMinutes` (usado en el resto del juego): la pestaña de tercer nivel del Diario
/// muestra "Día 3 de Primavera", no "Día 63 de partida".
export function diaRelativoEnEstacionFor(totalMinutes: number): number {
  const dia = dayForFictionalMinutes(totalMinutes);
  const diaDelAno = (dia - 1) % DIAS_POR_ANO;
  return (diaDelAno % DIAS_POR_ESTACION) + 1;
}

/// Agregador de los tres de arriba (2026-09-04) — evita recalcular `dayForFictionalMinutes` tres
/// veces por caller y evita que dos callers (log.ts/chapterSummary.ts) diverjan si la fórmula
/// cambia algún día.
export function calendarioFor(totalMinutes: number): { year: number; estacion: Estacion; diaRelativo: number; diaAbsoluto: number } {
  return {
    year: yearFor(totalMinutes),
    estacion: estacionFor(totalMinutes),
    diaRelativo: diaRelativoEnEstacionFor(totalMinutes),
    diaAbsoluto: dayForFictionalMinutes(totalMinutes),
  };
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

/// Clima real de Las Llanuras del Viento Rojo (2026-08-24, Grupo 3 § Eventos de clima puntuales,
/// diseño completo en docs/rpgtarkor/clima-tormentas.md) — eje de tiempo DISTINTO de `Estacion`,
/// por región desde el principio (a diferencia del calendario único de estaciones): hoy solo Las
/// Llanuras tiene números reales, cualquier otra región da `null` (nunca bloquea, mismo criterio
/// que `pasaFiltroTerreno` sin dato). Mismo año de 120 días que `estacionFor` (`DIAS_POR_ANO`,
/// reutilizado). Ciclo repetido de 3 días (Tormenta/Viento/Calma) da exactamente 40 días de cada
/// uno en el año; 1 de cada 3 días de tormenta es Extrema (petición explícita de la usuaria: de
/// 120 días, 40 de gran tormenta, 40 de vientos fuertes, solo 40 llevables — "duro vivir aquí").
const LLANURAS_REGION = 'Las Llanuras del Viento Rojo';
const CICLO_CLIMA_DIAS = 3;

export function climaFor(totalMinutes: number, region: string | null): EstadoClima | null {
  if (region !== LLANURAS_REGION) return null;
  const dia = dayForFictionalMinutes(totalMinutes);
  const diaDelAno = (dia - 1) % DIAS_POR_ANO;
  const posicionCiclo = diaDelAno % CICLO_CLIMA_DIAS;
  if (posicionCiclo === 1) return 'VIENTO_FUERTE';
  if (posicionCiclo === 2) return 'CLIMA_LLEVABLE';
  const numeroTormenta = Math.floor(diaDelAno / CICLO_CLIMA_DIAS);
  return numeroTormenta % 3 === 0 ? 'TORMENTA_EXTREMA' : 'TORMENTA_GRANDE';
}

/// Orden de severidad, de menos a más — `HarvestYield.climaRequerido` compara "al menos esta
/// severidad", nunca por igualdad exacta (a diferencia de `estacionRequerida`): un día de
/// Tormenta Extrema también satisface un yield que solo pide Tormenta Grande. `climaActual: null`
/// (región sin clima diseñado) nunca satisface ningún `climaRequerido` — fallo cerrado, mismo
/// criterio que "sin región conocida, ninguna fuente es candidata" en recolectar.ts.
const ESTADO_CLIMA_SEVERIDAD: Record<EstadoClima, number> = {
  CLIMA_LLEVABLE: 0,
  VIENTO_FUERTE: 1,
  TORMENTA_GRANDE: 2,
  TORMENTA_EXTREMA: 3,
};

export function climaSeveridadAlMenos(climaActual: EstadoClima | null, climaRequerido: EstadoClima): boolean {
  if (!climaActual) return false;
  return ESTADO_CLIMA_SEVERIDAD[climaActual] >= ESTADO_CLIMA_SEVERIDAD[climaRequerido];
}

/// Nombre Kektira (mismo patrón que `estacionNombreFor`) — `Rok'ithek` deriva a propósito de
/// `Rokthar` (misma raíz, terminación distinta): es la versión intensificada de la misma
/// tormenta, no un fenómeno narrativo aparte.
const CLIMA_NOMBRE_KEKTIRA: Record<EstadoClima, string> = {
  CLIMA_LLEVABLE: 'Ghurmek',
  VIENTO_FUERTE: "Sek'tar",
  TORMENTA_GRANDE: 'Rokthar',
  TORMENTA_EXTREMA: "Rok'ithek",
};

const CLIMA_GLOSA_COMUN: Record<EstadoClima, string> = {
  CLIMA_LLEVABLE: 'el respiro',
  VIENTO_FUERTE: 'el viento cortante',
  TORMENTA_GRANDE: 'la gran tormenta',
  TORMENTA_EXTREMA: 'la ira del viento',
};

export function climaNombreFor(estado: EstadoClima, raza: string | null): string {
  return raza === 'orcos' ? CLIMA_NOMBRE_KEKTIRA[estado] : CLIMA_GLOSA_COMUN[estado];
}

/// Momento del día (2026-08-27, imágenes de día/noche por Location/Zona — ver
/// docs/rpgtarkor/imagenes-prompts.md) — eje binario, deliberadamente MÁS simple que las 6 franjas
/// horarias de `entorno.ts` (madrugada/mañana/mediodía/tarde/atardecer/noche, pensadas para prosa
/// ambiental): una imagen solo puede ser de día o de noche, no hay "atardecer" intermedio que
/// generar aparte. Corte a las 6:00/20:00 — coincide con dónde `franjaHorariaFor` empieza
/// 'madrugada' y 'noche' (los dos tramos ya oscuros), sin depender de esa función para no acoplar
/// dos ejes pensados para cosas distintas.
export type MomentoDelDia = 'dia' | 'noche';

export function momentoDelDiaFor(totalMinutes: number): MomentoDelDia {
  const minuteOfDay = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(minuteOfDay / 60);
  return hour >= 6 && hour < 20 ? 'dia' : 'noche';
}

/// Estación/clima actuales, listos para exponer al frontend (2026-08-27, auditoría backend↔
/// frontend: "estación y clima reales... ni siquiera llegan a la narración, mucho menos a un
/// panel", pese a que ya gatean de verdad qué se puede recolectar/craftear). Un solo punto de
/// cálculo reutilizado por `GET /saves/:id` (detail.ts) y por cada respuesta de turno
/// (turnResolution.ts) — mismo criterio que `fictionalDate`, refrescado siempre fresco en vez de
/// guardado en ningún sitio.
export interface EntornoTemporal {
  estacion: { key: Estacion; nombre: string };
  /// null si la región no tiene clima real diseñado todavía (solo Las Llanuras del Viento Rojo
  /// hoy, ver `climaFor`) — nunca inventar "clima llevable" por defecto donde no hay datos.
  clima: { key: EstadoClima; nombre: string } | null;
}

export function entornoTemporalFor(totalMinutes: number, region: string | null, raza: string | null): EntornoTemporal {
  const estacionKey = estacionFor(totalMinutes);
  const climaKey = climaFor(totalMinutes, region);
  return {
    estacion: { key: estacionKey, nombre: estacionNombreFor(estacionKey, raza) },
    clima: climaKey ? { key: climaKey, nombre: climaNombreFor(climaKey, raza) } : null,
  };
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
