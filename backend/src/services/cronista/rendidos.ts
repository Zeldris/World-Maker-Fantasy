// Quién era un rendido al morir (CR-14/CR-15): alguien que ya habías dejado convaleciente
// (COMBATE_GANADO) en el último día. Puro, sin Prisma; lo usan etiquetas y aprobación.

/// Ventana en minutos de ficción.
export const VENTANA_RENDIDO_MIN = 1440;

/// Puro: cuántas de las muertes fueron de rendidos (el mismo NPC quedó convaleciente ante ti hace
/// menos de un día).
export function muertesDeRendidos(sucesos: { tipo: string; minuto: number; victima: string | null }[]): number {
  let n = 0;
  for (const m of sucesos) {
    if (m.tipo !== 'MUERTE_CAUSADA' || !m.victima) continue;
    if (sucesos.some((g) => g.tipo === 'COMBATE_GANADO' && g.victima === m.victima && g.minuto <= m.minuto && m.minuto - g.minuto <= VENTANA_RENDIDO_MIN)) n++;
  }
  return n;
}

