// UX-41 — imágenes de la marca de Tarkor (pictogramas, marcos, cielo, carga). Las prepara
// `tools/interfaz/preparar-imagenes.py` en `assets/interfaz/` (WebP con alfa). Vite las empaqueta con hash;
// aquí solo se resuelve el nombre lógico → URL. Sin imagen para un id (p. ej. la pestaña «reputacion» o la
// categoría «piedra»), las funciones devuelven `undefined` y quien pinta usa su emoji de siempre.

const URLS = import.meta.glob<string>('../assets/interfaz/*.webp', { eager: true, query: '?url', import: 'default' })

/** URL de `assets/interfaz/<nombre>.webp`, o `undefined` si no existe. */
export function imagenInterfaz(nombre: string): string | undefined {
  return URLS[`../assets/interfaz/${nombre}.webp`]
}

/** Pestañas del rail y sub-pestañas (`PanelId` y `equipo`). */
export const imagenPestana = (id: string) => imagenInterfaz(`pestana-${id}`)

/** Fases de `lib/gamePhase.ts` (`libre` y `fin` no tienen). */
export const imagenFase = (fase: string) => imagenInterfaz(`fase-${fase}`)

/** Categorías de objeto de `lib/enciclopediaTargets.ts` (13 de las 36 tienen pictograma). */
export const imagenCategoria = (categoria: string) => imagenInterfaz(`categoria-${categoria}`)

export type EstadoInterfaz = 'aviso' | 'en-curso' | 'error' | 'hecho'
export const imagenEstado = (estado: EstadoInterfaz) => imagenInterfaz(`estado-${estado}`)
