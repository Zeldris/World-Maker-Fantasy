import { duracionTirada } from './duracionTirada'
import type { LogEntry } from '../types'

/// UX-11 (hito 0.2, roadmap-front-ux.md § 4.3) — presentación en orden del turno. Cuánto esperan
/// las consecuencias de una entrada en vivo (misión, ofertas, XP, reputación): lo que tarda en
/// aterrizar su tirada (doble en un intercambio de combate) más una pausa corta tras el texto.
export function retrasoConsecuencias(entry: Pick<LogEntry, 'roll' | 'combatExchange'>): number {
  const tirada = entry.combatExchange ? 2 * duracionTirada() : entry.roll ? duracionTirada() : 0
  return tirada + 300
}

/// Solo se escalona una entrada que acaba de llegar: si el registro se vuelve a montar (plegar y
/// desplegar el panel), lo ya visto aparece de una vez. Devuelve el retraso en ms, o null.
export function retrasoEnVivo(entry: Pick<LogEntry, 'roll' | 'combatExchange' | 'createdAt'>, enVivo: boolean, ahora = Date.now()): number | null {
  if (!enVivo) return null
  const retraso = retrasoConsecuencias(entry)
  return ahora - new Date(entry.createdAt).getTime() < retraso + 1000 ? retraso : null
}
