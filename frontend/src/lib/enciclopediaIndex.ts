// Índice de menciones enlazables (2026-07-22, petición explícita: "alli donde se cite algo de la
// enciclopedia, en las narraciones o descripciones que tengamos... que esos textos sean
// clickables"). Construye, a partir de UNA respuesta de /world/:slug/enciclopedia, un único regex
// (alternativa larga-a-corta para que gane siempre la coincidencia más específica, p.ej.
// "Kort'ikar Torgash" antes que "Torgash" a secas) más un mapa de texto normalizado → DetailTarget.
//
// Deliberadamente NO se indexan razas ni el nombre propio de Gorhorn: "orco"/"Orcos" es
// prácticamente un sustantivo común en este mundo (aparecería subrayado en casi cada frase de
// combate) y "Gorhorn" sale en casi cada entrada del diario — el ruido visual no compensaría.
import type { EnciclopediaResponse } from './api'
import type { DetailTarget } from '../components/DetailModal'
import {
  npcToDetailTarget,
  itemToDetailTarget,
  faunaFloraToDetailTarget,
  locationToDetailTarget,
  personajeToDetailTarget,
} from './enciclopediaTargets'

export type EnciclopediaLinkTarget = Extract<DetailTarget, { kind: 'info' }>

export interface EnciclopediaIndex {
  regex: RegExp | null
  entries: Map<string, EnciclopediaLinkTarget>
  /// Mismas entradas que `entries`, pero por `entityType:entitySlug` en vez de por nombre/alias
  /// (rework 2026-07-24, persistencia de banners) — reconstruir el banner de una LogEntry ya
  /// guardada llega con la referencia que persistió el backend, no con el texto original.
  bySlugKey: Map<string, EnciclopediaLinkTarget>
}

export const EMPTY_ENCICLOPEDIA_INDEX: EnciclopediaIndex = { regex: null, entries: new Map(), bySlugKey: new Map() }

/// Por debajo de esto no se registra — evita enlazar palabras cortas y genéricas (alias como
/// "el eco" o similares) que darían falsos positivos constantes en prosa normal.
const MIN_PATTERN_LENGTH = 4

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildEnciclopediaIndex(data: EnciclopediaResponse | null): EnciclopediaIndex {
  if (!data) return EMPTY_ENCICLOPEDIA_INDEX

  const entries = new Map<string, EnciclopediaLinkTarget>()
  const bySlugKey = new Map<string, EnciclopediaLinkTarget>()
  const register = (pattern: string, target: EnciclopediaLinkTarget) => {
    const key = pattern.trim().toLowerCase()
    if (target.entityType && target.entitySlug) bySlugKey.set(`${target.entityType}:${target.entitySlug}`, target)
    if (key.length < MIN_PATTERN_LENGTH) return
    if (!entries.has(key)) entries.set(key, target)
  }

  for (const npc of data.npcs) {
    const target = npcToDetailTarget(npc)
    register(npc.name, target)
    npc.aliases.forEach((alias) => register(alias, target))
  }
  for (const item of data.items) {
    register(item.name, itemToDetailTarget(item))
  }
  for (const entry of data.faunaFlora) {
    const target = faunaFloraToDetailTarget(entry)
    register(entry.sourceName, target)
    entry.aliases.forEach((alias) => register(alias, target))
  }
  for (const loc of data.locations) {
    register(loc.name, locationToDetailTarget(loc))
  }
  for (const pj of data.personajes) {
    // Gorhorn queda fuera a propósito: es el protagonista, su nombre sale en casi cada línea de
    // narración — enlazarlo cada vez sería puro ruido visual, no ayuda real de navegación.
    if (pj.slug === 'gorhorn') continue
    register(pj.name, personajeToDetailTarget(pj))
  }

  if (entries.size === 0) return { regex: null, entries, bySlugKey }

  // Más largas primero: la alternación de regex prueba en orden y se queda con la primera que
  // encaje en cada posición — sin esto, "torgash" ganaría siempre a "kort'ikar torgash".
  const patterns = Array.from(entries.keys()).sort((a, b) => b.length - a.length)
  const alternation = patterns.map(escapeRegExp).join('|')
  // Límite de palabra manual con \p{L}/\p{N} (con flag u) en vez de \b: \b de JS trata letras
  // acentuadas (á, é, ñ...) como "no palabra", rompiendo el límite justo en nombres propios de
  // este mundo. `i` + `u` juntos sí manejan bien el plegado de mayúsculas en vocales acentuadas.
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternation})(?![\\p{L}\\p{N}])`, 'giu')
  return { regex, entries, bySlugKey }
}
