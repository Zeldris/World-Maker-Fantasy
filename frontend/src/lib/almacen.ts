import type { AlmacenItemInfo } from '../types'

/// REI-40 (hito 0.1, roadmap-front-reino.md R9) — el Almacén enseñaba una fila por unidad (30 maderas =
/// 30 filas). Agrupa por recurso: `catalogSlug` si lo tiene (es también la clave de los topes), si no
/// por nombre. Orden: más unidades primero, luego alfabético.
export interface GrupoAlmacen {
  clave: string
  catalogSlug: string | null
  nombre: string
  unidades: AlmacenItemInfo[]
}

export function agruparAlmacen(items: AlmacenItemInfo[]): GrupoAlmacen[] {
  const grupos = new Map<string, GrupoAlmacen>()
  for (const item of items) {
    const clave = item.catalogSlug ? `slug:${item.catalogSlug}` : `nombre:${item.name}`
    const grupo = grupos.get(clave)
    if (grupo) grupo.unidades.push(item)
    else grupos.set(clave, { clave, catalogSlug: item.catalogSlug, nombre: item.name, unidades: [item] })
  }
  return [...grupos.values()].sort((a, b) => b.unidades.length - a.unidades.length || a.nombre.localeCompare(b.nombre, 'es'))
}

/// Proporción para la barra `cantidad / tope` (REI-41); `null` sin tope.
export function proporcionTope(cantidad: number, tope: number | null): number | null {
  if (tope == null || tope <= 0) return null
  return Math.min(1, cantidad / tope)
}
