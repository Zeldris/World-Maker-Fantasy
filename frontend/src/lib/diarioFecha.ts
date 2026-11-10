import type { EstacionKey } from '../types'

const ESTACIONES_ORDEN: EstacionKey[] = ['PRIMAVERA', 'VERANO', 'OTONO', 'INVIERNO']
const DIAS_POR_ESTACION = 30 // mismo calendario que backend/src/services/worldClock.ts

interface FechaDiario {
  year: number
  estacion: EstacionKey
  diaRelativo: number
}

/// P380: el día de partida (1-indexado) que corresponde a una fecha del Diario; el mismo «Día 36» que enseña el juego
/// (el de las pestañas, antes, era el día DENTRO de la estación: «Día 6» de Verano).
export function diaAbsolutoDeFecha(f: FechaDiario): number {
  return (f.year - 1) * DIAS_POR_ESTACION * ESTACIONES_ORDEN.length + ESTACIONES_ORDEN.indexOf(f.estacion) * DIAS_POR_ESTACION + f.diaRelativo
}

/// P380: la fecha más reciente entre las entradas, por fecha y no por posición (los capítulos van detrás de las
/// entradas en la respuesta, y el último de la lista no es el último en el tiempo).
const ESTACION_NOMBRE: Record<EstacionKey, string> = { PRIMAVERA: 'Primavera', VERANO: 'Verano', OTONO: 'Otoño', INVIERNO: 'Invierno' }

/// P380 (usuaria, 2026-11-10): la pestaña del día dice «Día 6 de Verano, año 1», no el día de partida.
export function etiquetaDiaDiario(f: FechaDiario): string {
  return `Día ${f.diaRelativo} de ${ESTACION_NOMBRE[f.estacion]}, año ${f.year}`
}

export function fechaMasReciente<T extends FechaDiario>(items: readonly T[]): FechaDiario | null {
  let mejor: T | null = null
  for (const it of items) if (mejor === null || diaAbsolutoDeFecha(it) > diaAbsolutoDeFecha(mejor)) mejor = it
  return mejor && { year: mejor.year, estacion: mejor.estacion, diaRelativo: mejor.diaRelativo }
}
