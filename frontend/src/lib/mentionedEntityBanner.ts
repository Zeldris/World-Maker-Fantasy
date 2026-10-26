import { buscarMenciones, type EnciclopediaIndex, type EnciclopediaLinkTarget } from './enciclopediaIndex'

// Banner de elemento citado bajo la narración (petición explícita de la usuaria, 2026-07-24):
// reutiliza el MISMO índice que ya hace clicable el texto de la narración (EnciclopediaLinkedText)
// — nada nuevo que mantener sincronizado, solo una segunda lectura del mismo regex/mapa para
// decidir cuál de las menciones (si hay varias) se enseña como imagen debajo del texto.

// Orden de prioridad cuando la narración cita varias cosas a la vez: un personaje real pesa más
// que un lugar, que pesa más que fauna/flora, que pesa más que un objeto — un objeto citado es lo
// más frecuente y menos "evento" de los cuatro. `ability`/`raza`/`construccion` casi nunca se citan
// a mitad de una narración de turno normal, quedan al final por si acaso.
const TYPE_PRIORITY: Record<string, number> = {
  npc: 0,
  personaje: 0,
  location: 1,
  fauna: 2,
  item: 3,
  ability: 4,
  raza: 4,
  construccion: 4,
}

function keyFor(target: EnciclopediaLinkTarget): string {
  return `${target.entityType ?? 'info'}:${target.entitySlug ?? target.name}`
}

/// Bug real jugando en vivo (2026-07-24): Múrgol no mostró su banner en la narración pese a
/// tenerlo subido — `target.imageUrls.banner` es null (no hay imagen "genérica" sin sexo para
/// esta fauna, solo la variante "macho"), y el picker solo miraba ese campo plano. Mismo fallback
/// que ya usa `DetailModal.tsx` para decidir qué imagen enseñar (`effective.imageUrls`): si hay
/// variante regional, su primera variante de sexo o su propia imagen; si no, la primera variante
/// de sexo de la entidad; si no, la imagen plana. Siempre la PRIMERA de cada nivel — aquí no hay
/// pestaña seleccionada por la jugadora, es una elección automática.
function resolveBannerUrl(target: EnciclopediaLinkTarget): string | null {
  const variant = target.variantes?.[0] ?? null
  const sexoSource = variant?.variantesSexo ?? target.variantesSexo
  const sexoVariant = sexoSource?.[0] ?? null
  return sexoVariant?.imageUrls?.banner ?? variant?.imageUrls?.banner ?? target.imageUrls?.banner ?? null
}

/// P208 (usuaria, 2026-10-26): la ficha grande bajo la narración solo sale si el texto citado es el
/// nombre de la entrada o un alias de más de una palabra. Un alias de una palabra («piedra», «leña»)
/// sigue siendo un enlace subrayado en el texto, pero no abre una ficha: la palabra suelta es corriente
/// en la prosa y no quiere decir que la escena trate de esa entrada.
export function mencionAbreFicha(texto: string, target: EnciclopediaLinkTarget): boolean {
  const limpio = texto.trim().toLowerCase()
  if (limpio === target.name.trim().toLowerCase()) return true
  return limpio.split(/\s+/).length > 1
}

export interface MentionedEntityMatch {
  target: EnciclopediaLinkTarget
  bannerUrl: string
}

/// Puro: dado un texto (la narración de este turno) y el índice ya construido, decide cuál de las
/// entidades mencionadas (si hay alguna con imagen real subida, incluida la de variantes de
/// sexo/región) mostrar como banner — o null si no hay ninguna candidata nueva. `recentlyShown`
/// son las claves (ver `keyFor`) ya mostradas en los últimos turnos: si TODAS las candidatas ya se
/// enseñaron hace poco, no se repite ninguna (mejor no mostrar nada que insistir con la misma
/// imagen turno tras turno).
export function pickMentionedEntityBanner(
  text: string,
  index: EnciclopediaIndex,
  recentlyShown: ReadonlySet<string>,
): MentionedEntityMatch | null {
  if (!index.regex) return null

  const seen = new Set<string>()
  const candidates: MentionedEntityMatch[] = []
  for (const { target, texto } of buscarMenciones(index, text)) {
    if (!mencionAbreFicha(texto, target)) continue
    const bannerUrl = resolveBannerUrl(target)
    if (!bannerUrl) continue
    const key = keyFor(target)
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push({ target, bannerUrl })
  }
  if (candidates.length === 0) return null

  const fresh = candidates.filter((c) => !recentlyShown.has(keyFor(c.target)))
  if (fresh.length === 0) return null

  fresh.sort((a, b) => (TYPE_PRIORITY[a.target.entityType ?? ''] ?? 9) - (TYPE_PRIORITY[b.target.entityType ?? ''] ?? 9))
  return fresh[0]
}

/// Reconstruye el banner de una LogEntry ya guardada, a partir de la referencia persistida
/// (`entityBannerType`/`entityBannerSlug`, ver saves.ts) en vez de volver a analizar el texto —
/// rework 2026-07-24, "las imágenes que se muestran en la narración deben persistir de alguna
/// forma". Resuelve la imagen SIEMPRE en el momento de la lectura (mismo `resolveBannerUrl` que
/// usa el picker en vivo), nunca guarda la URL: una imagen subida después de crear la entrada
/// también se ve aquí.
export function resolveEntityBannerFromRef(
  entityType: string,
  entitySlug: string,
  index: EnciclopediaIndex,
): { name: string; icon: string; imageUrl: string } | null {
  const target = index.bySlugKey.get(`${entityType}:${entitySlug}`)
  if (!target) return null
  const bannerUrl = resolveBannerUrl(target)
  if (!bannerUrl) return null
  return { name: target.name, icon: target.icon, imageUrl: bannerUrl }
}

export { keyFor as mentionedEntityKey }
