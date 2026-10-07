// Comida por oficios (CR-61 paso 61a, hito 0.3 — Q15 de la ronda de CR-55 y ronda de CR-61/CR-63).
// Se acaba la comida pasiva (2 por trabajador, +3 por Cocina de facción): la comida sale de lo que hace
// cada trabajador. Puro, sin base de datos; lo usan el Reino (por súbdito) y las facciones (en agregado).
//
// - Recolector: 2 al día; primavera y verano 2,5; invierno 1.
// - Pescador: 3, solo con agua (fuente natural, costa o el Cauce).
// - Cocinero: transforma 10 de comida cruda al día con el multiplicador de su Cocina (Taller ×1,5,
//   Obrador ×2, Gran obrador ×2,5): +5, +10 o +15 netos. Sin Cocina no cocina.
// - Ganadero y fibrero: los cuenta `CR-55` (su comida sale del ganado).
// - La caza no es un oficio: son partidas (`CR-63`). Hasta entonces, las facciones de orcos y Faerus
//   cazan en agregado (2,5 por cazador) para no pasar hambre.
import type { Estacion } from '@prisma/client';

export const TAREAS = ['recolector', 'pescador', 'cocinero', 'ganadero', 'fibrero'] as const;
export type Tarea = (typeof TAREAS)[number];
export const TAREA_POR_DEFECTO: Tarea = 'recolector';

export function esTarea(v: unknown): v is Tarea {
  return typeof v === 'string' && (TAREAS as readonly string[]).includes(v);
}

export function rendimientoRecolector(estacion: Estacion): number {
  if (estacion === 'PRIMAVERA' || estacion === 'VERANO') return 2.5;
  if (estacion === 'INVIERNO') return 1;
  return 2;
}

export const RENDIMIENTO_PESCADOR = 3;
/// Comida cruda que transforma un cocinero al día.
export const CRUDO_POR_COCINERO = 10;
/// Multiplicador de un plato por el escalón de su receta o de su Cocina (Q15 de CR-55).
export const MULTIPLICADOR_ESCALON: Record<number, number> = { 1: 1.5, 2: 2, 3: 2.5 };
export function multiplicadorEscalon(escalon: number | null | undefined): number {
  return MULTIPLICADOR_ESCALON[escalon ?? 0] ?? 1;
}
/// Lo que gana un cocinero al día (neto) con una Cocina de ese escalón; 0 sin Cocina.
export function gananciaCocinero(escalonCocina: number | null): number {
  if (!escalonCocina) return 0;
  return CRUDO_POR_COCINERO * (multiplicadorEscalon(escalonCocina) - 1);
}

/// Caza en agregado de las facciones hasta `CR-63` (Q3 de la ronda anterior): parte de los
/// trabajadores y rendimiento.
export const CAZA_AGREGADA: Record<string, number> = { orcos: 0.45, faerus: 0.5 };
export const RENDIMIENTO_CAZA_AGREGADA = 2.5;
/// Q4: reparto del resto de los trabajadores de una facción por la costumbre de su pueblo.
export const REPARTO_PUEBLO: Record<string, { recoleccion: number; pesca: number; cocina: number }> = {
  orcos: { recoleccion: 0.7, pesca: 0, cocina: 0.3 },
  faerus: { recoleccion: 0.8, pesca: 0, cocina: 0.2 },
  nabieus: { recoleccion: 0.4, pesca: 0.4, cocina: 0.2 },
  goirntes: { recoleccion: 0.6, pesca: 0.2, cocina: 0.2 },
};
const REPARTO_POR_DEFECTO = REPARTO_PUEBLO.orcos!;

export interface Cuadrilla {
  recolectores: number;
  pescadores: number;
  cocineros: number;
  /// Solo facciones, hasta `CR-63`.
  cazadores: number;
}

/// Reparto de los trabajadores de una facción (sin ganaderos ni fibreros). Sin agua, los pescadores
/// recolectan; sin Cocina, los cocineros también.
export function repartoDeFaccion(raza: string | null, trabajadores: number, hayAgua: boolean, hayCocina: boolean): Cuadrilla {
  const t = Math.max(0, trabajadores);
  const cazadores = Math.round(t * (CAZA_AGREGADA[raza ?? ''] ?? 0));
  const resto = t - cazadores;
  const r = REPARTO_PUEBLO[raza ?? ''] ?? REPARTO_POR_DEFECTO;
  let pescadores = hayAgua ? Math.round(resto * r.pesca) : 0;
  let cocineros = hayCocina ? Math.round(resto * r.cocina) : 0;
  if (pescadores + cocineros > resto) pescadores = Math.max(0, resto - cocineros);
  if (pescadores + cocineros > resto) cocineros = resto;
  return { cazadores, pescadores, cocineros, recolectores: resto - pescadores - cocineros };
}

/// Comida que produce una cuadrilla en un día. Los cocineros solo transforman la comida cruda que hay
/// (la de la reserva más la que entra hoy): cada uno necesita 10.
export function comidaDelDia(c: Cuadrilla, ctx: { estacion: Estacion; hayAgua: boolean; escalonCocina: number | null; comidaDisponible: number }): number {
  const cruda = c.recolectores * rendimientoRecolector(ctx.estacion) + (ctx.hayAgua ? c.pescadores * RENDIMIENTO_PESCADOR : 0) + c.cazadores * RENDIMIENTO_CAZA_AGREGADA;
  const cocinan = Math.min(c.cocineros, Math.floor((ctx.comidaDisponible + cruda) / CRUDO_POR_COCINERO));
  return cruda + cocinan * gananciaCocinero(ctx.escalonCocina);
}
