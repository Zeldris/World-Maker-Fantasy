// Índice de menciones enlazables (2026-07-22, petición explícita: "alli donde se cite algo de la
// enciclopedia, en las narraciones o descripciones que tengamos... que esos textos sean
// clickables"). Construye, a partir de UNA respuesta de /world/:slug/enciclopedia, un único regex
// (alternativa larga-a-corta para que gane siempre la coincidencia más específica, p.ej.
// "Kort'ikar Torgash" antes que "Torgash" a secas) más un mapa de texto normalizado → DetailTarget.
//
// Deliberadamente NO se indexan razas: "orco"/"Orcos" es prácticamente un sustantivo común en
// este mundo (aparecería subrayado en casi cada frase de combate) — el ruido visual no
// compensaría. (Gorhorn SÍ se indexa desde 2026-08-13, petición explícita de la usuaria, pese a
// que sale en casi cada línea del diario — decisión consciente de asumir ese ruido visual.)
//
// Tampoco se indexan "Facciones"/"Historia" (2026-08-06, decisión explícita al construir esas
// secciones, no un olvido): nombres como "Concordia de Hierro" ya aparecen constantemente en bios
// y descripciones de NPC existentes — este proyecto ya se ha encontrado varias veces con bugs
// reales de colisión de alias en este mismo índice (ver memoria de sesión), así que se prefirió no
// arriesgar otro falso positivo sin que la usuaria lo pidiera explícitamente. Ninguna de las dos
// tiene siquiera campo `aliases` en su tipo (api.ts) — coherente con esta decisión, no un hueco.
import type { EnciclopediaResponse } from './api'
import type { RecipeStatusInfo } from '../types'
import type { DetailTarget } from '../components/DetailModal'
import {
  npcToDetailTarget,
  itemToDetailTarget,
  faunaFloraToDetailTarget,
  locationToDetailTarget,
  personajeToDetailTarget,
  craftingToDetailTarget,
  constructionToDetailTarget,
} from './enciclopediaTargets'

export type EnciclopediaLinkTarget = Extract<DetailTarget, { kind: 'info' }>

export interface EnciclopediaIndex {
  regex: RegExp | null
  entries: Map<string, EnciclopediaLinkTarget>
  /// Mismas entradas que `entries`, pero por `entityType:entitySlug` en vez de por nombre/alias
  /// (rework 2026-07-24, persistencia de banners) — reconstruir el banner de una LogEntry ya
  /// guardada llega con la referencia que persistió el backend, no con el texto original.
  bySlugKey: Map<string, EnciclopediaLinkTarget>
  /// Claves de nombres propios (NPC, lugar, personaje) que solo se enlazan si en el texto llevan
  /// alguna mayúscula («Tira», «el Manco»; no «tira» ni «la hondonada») (Fase G del 0.1, 2026-10-02): el NPC «Tira» se enlazaba en «algo que tira de
  /// él». Opcional para que los índices vacíos o de test escritos a mano sigan valiendo.
  soloConMayuscula?: Set<string>
}

export interface MencionEnciclopedia {
  inicio: number
  /// Texto tal cual aparece (se muestra este, no el nombre canónico, para no romper la frase:
  /// «las rocas» no puede pasar a «las Roca de Llanura Roja»).
  texto: string
  target: EnciclopediaLinkTarget
}

/// Menciones enlazables de `text`, ya filtradas — único sitio que decide qué cuenta como mención
/// (lo usan la narración, el composer y el banner de entidad mencionada).
export function buscarMenciones(index: EnciclopediaIndex, text: string): MencionEnciclopedia[] {
  if (!index.regex) return []
  const menciones: MencionEnciclopedia[] = []
  for (const match of text.matchAll(index.regex)) {
    const texto = match[0]
    const clave = texto.toLowerCase()
    const target = index.entries.get(clave)
    if (!target) continue
    if (index.soloConMayuscula?.has(clave) && texto === clave) continue
    menciones.push({ inicio: match.index ?? 0, texto, target })
  }
  return menciones
}

export const EMPTY_ENCICLOPEDIA_INDEX: EnciclopediaIndex = { regex: null, entries: new Map(), bySlugKey: new Map() }

/// Por debajo de esto no se registra — evita enlazar palabras cortas y genéricas (alias como
/// "el eco" o similares) que darían falsos positivos constantes en prosa normal. Exportada para
/// que el test (enciclopediaIndex.test.ts) no dependa de un número repetido a mano.
export const MIN_PATTERN_LENGTH = 4

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildEnciclopediaIndex(data: EnciclopediaResponse | null, recipesStatus: RecipeStatusInfo[] = []): EnciclopediaIndex {
  if (!data) return EMPTY_ENCICLOPEDIA_INDEX
  // Clave compuesta recipeCategory:recipeKey (auditoría 2026-08-13) — mismo criterio que
  // HabilidadesPanel.tsx/EnciclopediaPanel.tsx, evita mezclar el estado de una receta de crafteo
  // con una de construcción si algún día comparten `key`.
  const recipeStatusByKey = new Map(recipesStatus.map((s) => [`${s.recipeCategory}:${s.recipeKey}`, s]))

  const entries = new Map<string, EnciclopediaLinkTarget>()
  const bySlugKey = new Map<string, EnciclopediaLinkTarget>()
  const soloConMayuscula = new Set<string>()
  const register = (pattern: string, target: EnciclopediaLinkTarget, nombrePropio = false) => {
    const key = pattern.trim().toLowerCase()
    if (target.entityType && target.entitySlug) bySlugKey.set(`${target.entityType}:${target.entitySlug}`, target)
    if (key.length < MIN_PATTERN_LENGTH) return
    if (entries.has(key)) return
    entries.set(key, target)
    if (nombrePropio) soloConMayuscula.add(key)
  }

  for (const npc of data.npcs) {
    const target = npcToDetailTarget(npc)
    register(npc.name, target, true)
    npc.aliases.forEach((alias) => register(alias, target, true))
  }
  for (const item of data.items) {
    const target = itemToDetailTarget(item)
    register(item.name, target)
    item.aliases.forEach((alias) => register(alias, target))
  }
  for (const entry of data.faunaFlora) {
    const target = faunaFloraToDetailTarget(entry)
    register(entry.sourceName, target)
    entry.aliases.forEach((alias) => register(alias, target))
  }
  for (const loc of data.locations) {
    const target = locationToDetailTarget(loc)
    register(loc.name, target, true)
    loc.aliases.forEach((alias) => register(alias, target, true))
  }
  for (const pj of data.personajes) {
    const target = personajeToDetailTarget(pj)
    register(pj.name, target, true)
    ;(pj.aliases ?? []).forEach((alias) => register(alias, target, true))
  }

  // Recetas de crafteo/construcción (2026-08-13, bug real encontrado revisando el enlace "ⓘ Ver
  // receta en la Enciclopedia" de una habilidad de oficio/reino desde Habilidades: nunca abría
  // nada, para NINGUNA receta, desde que ese botón existe — bySlugKey nunca llegó a incluirlas,
  // solo npcs/items/faunaFlora/locations/personajes). SOLO en `bySlugKey` (nunca en `entries`/el
  // regex de menciones en texto libre): a diferencia de las demás entidades de arriba, un nombre
  // de receta como "un campamento base" o "Bloque de piedra tallada" no tiene sentido subrayado
  // dentro de la narración normal, y el propio comentario de cabecera de este archivo ya avisa del
  // riesgo real de colisiones de alias — no se arriesga sin que se haya pedido explícitamente.
  // `recipesStatus` (mismo día, "que ponga lo que tienes contra lo que falta") — con partida
  // activa, la ficha abierta desde este enlace lleva el conteo real tienes/necesitas, no solo el
  // listado estático.
  for (const recipe of data.craftingRecipes) {
    const target = craftingToDetailTarget(recipe, recipeStatusByKey.get(`crafteo:${recipe.key}`))
    if (target.entityType && target.entitySlug) bySlugKey.set(`${target.entityType}:${target.entitySlug}`, target)
  }
  for (const recipe of data.constructionRecipes) {
    const target = constructionToDetailTarget(recipe, recipeStatusByKey.get(`construccion:${recipe.key}`))
    if (target.entityType && target.entitySlug) bySlugKey.set(`${target.entityType}:${target.entitySlug}`, target)
  }

  if (entries.size === 0) return { regex: null, entries, bySlugKey, soloConMayuscula }

  // Más largas primero: la alternación de regex prueba en orden y se queda con la primera que
  // encaje en cada posición — sin esto, "torgash" ganaría siempre a "kort'ikar torgash".
  const patterns = Array.from(entries.keys()).sort((a, b) => b.length - a.length)
  const alternation = patterns.map(escapeRegExp).join('|')
  // Límite de palabra manual con \p{L}/\p{N} (con flag u) en vez de \b: \b de JS trata letras
  // acentuadas (á, é, ñ...) como "no palabra", rompiendo el límite justo en nombres propios de
  // este mundo. `i` + `u` juntos sí manejan bien el plegado de mayúsculas en vocales acentuadas.
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternation})(?![\\p{L}\\p{N}])`, 'giu')
  return { regex, entries, bySlugKey, soloConMayuscula }
}
