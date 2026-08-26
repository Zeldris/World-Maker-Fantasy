import { useEffect, useState } from 'react'
import { getZona, resolveImageUrl, type ZonaResponse, type ZonePointInfo } from '../../lib/api'
import { PanelEmptyState } from '../PanelEmptyState'
import { ImagePromptSlot } from '../ImagePromptDisplay'

interface ZonaPanelProps {
  saveId: string
  /// Para `ImagePromptSlot` (2026-08-26) — mismo prop que ya recibe MapaPanel.tsx, `null` mientras
  /// GameView.tsx todavía no ha resuelto el slug del mundo actual.
  worldSlug: string | null
}

/// Grupo 3 § Mundo determinista, Capa 1 (2026-08-25, docs/rpgtarkor/mundo-determinista.md) —
/// zonas navegables, PROTOTIPO en una sola zona (La Hondonada del Eco) antes de repetir en el
/// resto. Deliberadamente simple: solo muestra DÓNDE vive algo dentro de la zona actual (posición
/// real + nombre real de catálogo), nunca decide disponibilidad — eso es trabajo de las Capas 2-3
/// del documento, construidas encima de esto. Lienzo 800×600, misma convención que el mapa de
/// mundo (`InteractiveMap.tsx`) para poder reutilizar el mismo criterio de overlay SVG.
const TIPO_COLOR: Record<ZonePointInfo['tipo'], string> = {
  FAUNA: '#c0392b',
  RECURSO: '#2e86c1',
  NPC: '#d4af37',
}

const TIPO_LABEL: Record<ZonePointInfo['tipo'], string> = {
  FAUNA: 'Fauna',
  RECURSO: 'Recurso',
  NPC: 'NPC',
}

export function ZonaPanel({ saveId, worldSlug }: ZonaPanelProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ZonaResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getZona(saveId)
      .then(setData)
      .catch(() => setError('No se pudo cargar la zona.'))
      .finally(() => setLoading(false))
  }, [saveId])

  if (loading) return <p className="text-xs text-wood-500">Cargando la zona...</p>
  if (error) return <p className="text-xs text-red-400">{error}</p>
  if (!data?.disponible) {
    return (
      <PanelEmptyState
        icon="🧭"
        title="Sin datos de esta zona todavía"
        hint="Las posiciones reales de fauna, recursos y NPCs solo existen hoy en La Hondonada del Eco — el resto de zonas llegarán más adelante."
      />
    )
  }

  const imageUrl = resolveImageUrl(data.imageUrl ?? null)
  const dinamicos = data.dinamicos ?? []

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-wood-100">{data.locationName}</p>
      {/* Imágenes propias de Zona (2026-08-26, petición explícita: "uno genera banner, otro icono
          y otro una zona a modo de mapa dibujado... pintada y clara") — estilo cartografía pintada
          a mano, distinto del banner/miniatura fotorrealista que esta misma ubicación ya tiene en
          la Enciclopedia (entityType 'location'). Mismo componente/patrón que DetailModal.tsx. */}
      {worldSlug && data.locationSlug && (
        <div className="flex flex-col gap-2">
          {data.imageUrls?.thumbnail && <p className="text-2xs italic text-wood-500">Miniatura real cargada ✓</p>}
          <ImagePromptSlot
            key={`zona-${data.locationSlug}-thumbnail`}
            label="Miniatura (icono)"
            existingPrompt={data.imagePrompts?.thumbnail ?? null}
            worldSlug={worldSlug}
            entityType="zona"
            entitySlug={data.locationSlug}
            sizeProfile="thumbnail"
          />
          {data.imageUrls?.banner && <p className="text-2xs italic text-wood-500">Banner real cargado ✓</p>}
          <ImagePromptSlot
            key={`zona-${data.locationSlug}-banner`}
            label="Banner (detalle)"
            existingPrompt={data.imagePrompts?.banner ?? null}
            worldSlug={worldSlug}
            entityType="zona"
            entitySlug={data.locationSlug}
            sizeProfile="banner"
          />
          {imageUrl && <p className="text-2xs italic text-wood-500">Mapa real cargado ✓</p>}
          <ImagePromptSlot
            key={`zona-${data.locationSlug}-mapa`}
            label="Mapa (fondo de esta vista)"
            existingPrompt={data.imagePrompts?.mapa ?? null}
            worldSlug={worldSlug}
            entityType="zona"
            entitySlug={data.locationSlug}
            sizeProfile="mapa"
          />
        </div>
      )}
      {/* Solo hay mapa/pines de verdad si hay algún ZonePoint fijo — una zona con SOLO NPCs
          dinámicos (sin catálogo de puntos sembrado, "generalizar más allá de Hondonada" sin
          hacer todavía) no tiene posiciones reales que dibujar, ver comentario de
          `ZonaDinamicoInfo`. */}
      {data.puntos.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border border-iron-700 bg-wood-950/60">
            <svg viewBox="0 0 800 600" className="h-auto w-full">
              {imageUrl ? (
                <image href={imageUrl} x={0} y={0} width={800} height={600} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <rect x={0} y={0} width={800} height={600} fill="#1a1410" />
              )}
              {data.puntos.map((p) => (
                <g key={p.id}>
                  <circle cx={p.x} cy={p.y} r={8} fill={TIPO_COLOR[p.tipo]} stroke="white" strokeWidth={1.5} />
                  <title>{`${p.nombre} (${TIPO_LABEL[p.tipo]})`}</title>
                </g>
              ))}
            </svg>
          </div>
          <div className="flex flex-col gap-1.5">
            {data.puntos.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-1.5 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TIPO_COLOR[p.tipo] }} />
                <span className="text-wood-100">{p.nombre}</span>
                <span className="ml-auto text-2xs uppercase tracking-wide text-wood-500">{TIPO_LABEL[p.tipo]}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {/* NPCs presentados de forma determinista (2026-08-26) — sin posición real, así que nunca
          como pin: una lista aparte, siempre visible aunque no haya mapa de puntos fijos. */}
      {dinamicos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">Presentes ahora</p>
          {dinamicos.map((d) => (
            <div key={d.slug} className="flex items-center gap-2 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-1.5 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TIPO_COLOR[d.tipo] }} />
              <span className="text-wood-100">{d.nombre}</span>
              <span className="ml-auto text-2xs uppercase tracking-wide text-wood-500">{TIPO_LABEL[d.tipo]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
