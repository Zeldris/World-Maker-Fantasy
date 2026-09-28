import type { Estacion, EstadoClima } from '@prisma/client';

/// Reloj ficticio de la partida — hasta ahora `fictionalDateLabel` era un placeholder fijo
/// ("Día 1, mañana", ver el comentario que había en turn.ts) que nunca avanzaba. Puro y
/// determinista, mismo espíritu que death.ts/progression.ts: el backend avanza el reloj según
/// los minutos reales que cuesta cada turno (computeDuration/travel.minutos) — el modelo nunca
/// decide qué hora es. Fecha completa (mes/día del mes) todavía no implementada — solo el
/// conteo de "Día N" y, desde 2026-08-24, la estación (`estacionFor`, ver abajo).
const MINUTES_PER_DAY = 1440;

/// Sistema de estaciones (2026-08-24, Grupo 3 § Sistema de estaciones, diseño completo en
/// docs/rpgtarkor/lore-mundo/estaciones.md) — calendario único y global (no desfasado por región: hoy solo
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

/// Clima real, por región (2026-08-24, Grupo 3 § Eventos de clima puntuales, diseño completo en
/// docs/rpgtarkor/lore-mundo/clima-tormentas.md; ampliado a las 8 regiones el 2026-09-21, docs/rpgtarkor/
/// mundo-vivo-x4.md § 5-bis punto 13 — bloqueaba § 4.5) — eje de tiempo DISTINTO de `Estacion`,
/// por región desde el principio. Mismo mecanismo determinista reutilizado en las 8 (mismo
/// `EstadoClima`, mismo `climaSeveridadAlMenos`, sin ampliar el enum — decisión explícita de
/// Álvaro: "utilizar lo que hay si se puede, pero respetar el lore de cada zona" — lo que cambia
/// por región es la PROPORCIÓN de severidad dentro del ciclo, coherente con su geografía real
/// (`areas.md`), y el nombre/glosa de cada estado, nunca el mecanismo). Mismo año de 120 días que
/// `estacionFor` (`DIAS_POR_ANO`, reutilizado). Región desconocida (fuera de las 8, o `null`) →
/// `null`, nunca bloquea (mismo criterio que `pasaFiltroTerreno` sin dato).
const CICLO_CLIMA_DIAS = 3;

/// Cada región tiene su propio offset de fase (para que dos regiones vecinas no compartan el
/// mismo día de tormenta exacto, más creíble que un reloj de clima único para todo el mundo) y su
/// propia proporción de severidad `extremaCada` (1 de cada N tormentas es Extrema — Llanuras usa 3
/// como ya tenía, el resto se ajusta a su lore real: una región más hostil tiene extremas más
/// frecuentes, una más protegida por su propia geografía las tiene más raras).
const REGION_CLIMA_CONFIG: Record<string, { offsetDias: number; extremaCada: number }> = {
  // Llanuras del Viento Rojo — sin cambios (ya real desde 2026-08-24): "duro vivir aquí", 1 de
  // cada 3 tormentas es extrema (40/120 días).
  'Las Llanuras del Viento Rojo': { offsetDias: 0, extremaCada: 3 },
  // Cristal Helado — tundra de Clan Helsig (areas.md: "piel pálida azulada... más grasa para
  // retener calor"), ventiscas de nieve constantes por diseño de raza, extremas más frecuentes
  // que en Llanuras (2 de cada 3, no 3): el propio lore de adaptación física de los Helsig solo
  // tiene sentido si el frío extremo es la norma, no la excepción.
  'Cristal Helado': { offsetDias: 1, extremaCada: 2 },
  // Ciénaga Troncal — pantano húmedo (areas.md: "terreno húmedo, en gran parte inhabitable"),
  // tormentas de lluvia/crecida más que viento — severidad normal, sin extremas más frecuentes
  // que Llanuras (el peligro real del lugar es el terreno, no el clima en sí).
  'Ciénaga Troncal': { offsetDias: 2, extremaCada: 3 },
  // La Meseta del Orden — desierto de piedra gris (areas.md), clima más estable/controlado,
  // coherente con el orden Goirnte impuesto hasta al propio territorio — extremas raras (1 de
  // cada 5).
  'La Meseta del Orden': { offsetDias: 0, extremaCada: 5 },
  // El Margen Silencioso — selva/pantanos/coníferas donde "el sonido se apaga sin eco ni rebote"
  // (areas.md, dominio de Kroj) — clima denso y opresivo más que violento, extremas raras (1 de
  // cada 4): el peligro real es el laberinto y Kroj, no la tormenta.
  'El Margen Silencioso': { offsetDias: 1, extremaCada: 4 },
  // La Cicatriz de Cristal — valle de prismas de cristal, territorio Kelife (areas.md: "los
  // cristales refractan la luz... iluminando las noches") — región protegida por su propia
  // formación geológica, clima el más estable de las 8 (1 de cada 6).
  'La Cicatriz de Cristal': { offsetDias: 2, extremaCada: 6 },
  // El Susurro de las Raíces — bosque colosal donde "la luz del sol rara vez toca el suelo"
  // (areas.md, territorio Jusaly), microclima cerrado bajo la copa de los árboles — severidad
  // normal, misma proporción que Llanuras.
  'El Susurro de las Raíces': { offsetDias: 0, extremaCada: 3 },
  // La Costa del Azabache — acantilados negros "tallados por un oleaje furioso" (areas.md,
  // territorio Kalisar) — el oleaje violento es la norma del lugar, extremas más frecuentes que
  // Llanuras (1 de cada 2, igual que Cristal Helado: dos regiones hostiles por naturaleza propia).
  'La Costa del Azabache': { offsetDias: 1, extremaCada: 2 },
};

export function climaFor(totalMinutes: number, region: string | null): EstadoClima | null {
  const config = region ? REGION_CLIMA_CONFIG[region] : undefined;
  if (!config) return null;
  const dia = dayForFictionalMinutes(totalMinutes);
  const diaDelAno = (dia - 1 + config.offsetDias) % DIAS_POR_ANO;
  const posicionCiclo = diaDelAno % CICLO_CLIMA_DIAS;
  if (posicionCiclo === 1) return 'VIENTO_FUERTE';
  if (posicionCiclo === 2) return 'CLIMA_LLEVABLE';
  const numeroTormenta = Math.floor(diaDelAno / CICLO_CLIMA_DIAS);
  return numeroTormenta % config.extremaCada === 0 ? 'TORMENTA_EXTREMA' : 'TORMENTA_GRANDE';
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
/// tormenta, no un fenómeno narrativo aparte. Genérico para cualquier clan orco (Kektira es la
/// lengua orca común a Maktor/Serhu/Helsig/Goshg, ver razas.md) — "tormenta" en Kektira no cambia
/// de palabra según el terreno, a diferencia de la glosa común de abajo.
const CLIMA_NOMBRE_KEKTIRA: Record<EstadoClima, string> = {
  CLIMA_LLEVABLE: 'Ghurmek',
  VIENTO_FUERTE: "Sek'tar",
  TORMENTA_GRANDE: 'Rokthar',
  TORMENTA_EXTREMA: "Rok'ithek",
};

/// Glosa común, específica por región (2026-09-21, § 5-bis punto 13) — mismo `EstadoClima`
/// mecánico, pero el mismo fenómeno se nombra distinto según la geografía real de cada zona
/// (areas.md): viento de arena en Llanuras no es lo mismo que ventisca de nieve en Cristal Helado
/// ni que oleaje en Costa del Azabache. `'default'` cubre Llanuras (glosa original, sin cambios) y
/// cualquier región futura sin entrada propia todavía.
const CLIMA_GLOSA_COMUN_POR_REGION: Record<string, Record<EstadoClima, string>> = {
  default: {
    CLIMA_LLEVABLE: 'el respiro',
    VIENTO_FUERTE: 'el viento cortante',
    TORMENTA_GRANDE: 'la gran tormenta',
    TORMENTA_EXTREMA: 'la ira del viento',
  },
  // Ventisca de nieve (Clan Helsig, tundra) — mismo mecanismo que Llanuras, léxico de frío.
  'Cristal Helado': {
    CLIMA_LLEVABLE: 'la calma helada',
    VIENTO_FUERTE: 'el cierzo cortante',
    TORMENTA_GRANDE: 'la ventisca',
    TORMENTA_EXTREMA: 'la ventisca blanca',
  },
  // Pantano/crecida (Clan Goshg) — el agua sube, no el viento.
  'Ciénaga Troncal': {
    CLIMA_LLEVABLE: 'las aguas quietas',
    VIENTO_FUERTE: 'la llovizna densa',
    TORMENTA_GRANDE: 'la crecida',
    TORMENTA_EXTREMA: 'la gran crecida',
  },
  // Desierto de piedra Goirnte — clima raro pero severo cuando llega, coherente con su orden.
  'La Meseta del Orden': {
    CLIMA_LLEVABLE: 'el aire quieto',
    VIENTO_FUERTE: 'el viento de piedra',
    TORMENTA_GRANDE: 'la tormenta de arena gris',
    TORMENTA_EXTREMA: 'la tormenta de arena gris absoluta',
  },
  // El sonido se apaga (dominio de Kroj) — clima denso/opresivo, no ruidoso.
  'El Margen Silencioso': {
    CLIMA_LLEVABLE: 'el silencio llano',
    VIENTO_FUERTE: 'la bruma espesa',
    TORMENTA_GRANDE: 'la tormenta muda',
    TORMENTA_EXTREMA: 'la tormenta muda absoluta',
  },
  // Prismas de cristal Kelife — clima raro, la propia formación protege la región.
  'La Cicatriz de Cristal': {
    CLIMA_LLEVABLE: 'el brillo quieto',
    VIENTO_FUERTE: 'el viento entre cristales',
    TORMENTA_GRANDE: 'la tormenta de esquirlas',
    TORMENTA_EXTREMA: 'la lluvia de cristal',
  },
  // Bosque colosal Jusaly, la luz apenas toca el suelo — clima de goteo/humedad bajo la copa.
  'El Susurro de las Raíces': {
    CLIMA_LLEVABLE: 'la quietud del musgo',
    VIENTO_FUERTE: 'el goteo constante',
    TORMENTA_GRANDE: 'la tormenta bajo la copa',
    TORMENTA_EXTREMA: 'el diluvio de raíces',
  },
  // Acantilados y oleaje furioso Kalisar — el mar manda, no el viento.
  'La Costa del Azabache': {
    CLIMA_LLEVABLE: 'la marea baja',
    VIENTO_FUERTE: 'el oleaje fuerte',
    TORMENTA_GRANDE: 'la marea brava',
    TORMENTA_EXTREMA: 'la furia del acantilado',
  },
};

export function climaNombreFor(estado: EstadoClima, raza: string | null, region: string | null = null): string {
  if (raza === 'orcos') return CLIMA_NOMBRE_KEKTIRA[estado];
  const glosa = (region && CLIMA_GLOSA_COMUN_POR_REGION[region]) || CLIMA_GLOSA_COMUN_POR_REGION.default;
  return glosa[estado];
}

/// Momento del día (2026-08-27, imágenes de día/noche por Location/Zona — ver
/// docs/rpgtarkor/items-y-catalogo/imagenes-prompts.md) — eje binario, deliberadamente MÁS simple que las 6 franjas
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
    clima: climaKey ? { key: climaKey, nombre: climaNombreFor(climaKey, raza, region) } : null,
  };
}

export function advanceFictionalMinutes(current: number, deltaMinutos: number): number {
  return current + Math.max(0, deltaMinutos);
}

/// Habilidad "Descansar en campamento" (2026-09-08, diseño de Álvaro: "despertarte en el siguiente
/// día a la 08:00") — SIEMPRE salta al 08:00 del día SIGUIENTE, nunca al de hoy aunque `current` ya
/// sea antes de las 08:00 (dormir toda la noche real, no un simple "avanza hasta las 8"). Mismo
/// `MINUTES_PER_DAY` que el resto de este archivo.
export function nextMorning8am(current: number): number {
  const day = Math.floor(current / MINUTES_PER_DAY);
  return (day + 1) * MINUTES_PER_DAY + 8 * 60;
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
