/// Mismo criterio que backend/src/lib/slugify.ts — necesario en el frontend para reconstruir la
/// entitySlug de una habilidad (sin slug propio en código) al pedir su prompt de imagen bajo
/// demanda (checklist 2026-07-21/22, punto 7). Debe producir EXACTAMENTE la misma clave que el
/// backend o el POST /world/:slug/image-prompt no encontrará la habilidad.
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
