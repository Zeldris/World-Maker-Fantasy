import { useEnciclopediaLink } from '../context/useEnciclopediaLink'
import { resolveImageUrl } from '../lib/api'

/// MOD-6 (hito 0.2, roadmap-front.md § 5, H27) — miniatura de un objeto, NPC, criatura o recurso
/// en las filas de los modales: la imagen pequeña de su ficha de la enciclopedia si existe, si no
/// el icono de su categoría. Busca por `entityType:slug` y, si no hay slug, por el nombre.
export function Miniatura({ nombre, entityType, slug, icono }: { nombre: string; entityType?: string; slug?: string; icono: string }) {
  const { enciclopediaIndex } = useEnciclopediaLink()
  const ficha =
    (entityType && slug ? enciclopediaIndex.bySlugKey.get(`${entityType}:${slug}`) : undefined) ??
    enciclopediaIndex.entries.get(nombre.trim().toLowerCase())
  const url = resolveImageUrl(ficha?.imageUrls?.thumbnail ?? null)
  if (url) return <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-md border border-iron-700 object-cover" />
  return (
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-iron-800 bg-wood-950/50 text-base leading-none">
      {ficha?.icon ?? icono}
    </span>
  )
}
