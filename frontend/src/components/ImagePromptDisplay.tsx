import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { requestImagePrompt, type ImagePromptEntityType, type ImagePromptSizeProfile } from '../lib/api'

/// Extraído de DetailModal.tsx (auditoría 2026-07-22): la generación de prompts de imagen (red +
/// su propio estado de carga/error) es un asunto separado de "mostrar el detalle de un objeto/
/// habilidad/selector de hueco" — vivía mezclado en el mismo archivo de 580 líneas sin ninguna
/// razón funcional, solo porque nació ahí. Mismo comportamiento, ningún cambio visual.

// Reserva de espacio para una futura imagen generada (roadmap de imágenes, todavía sin API de
// prompts) — hoy solo enseña el icono grande centrado; el día que exista la API, esta caja es
// donde se pinta la imagen real, sin rehacer el layout del modal (petición explícita, 2026-07-21).
// `variant="placeholder"` (Enciclopedia, Fable 2026-07-21): borde discontinuo — hoy todo comparte
// un emoji genérico por categoría, no arte propio de cada entrada, así que se marca honestamente
// como "hueco de exhibición pendiente" en vez de "esta es la imagen final del objeto/habilidad".
// Visor a pantalla completa (petición explícita, 2026-07-22): clic en el banner de la Enciclopedia
// abre la imagen entera sin recortar, con botón para pasar a fullscreen real vía Fullscreen API.
// z-[60] porque vive por encima del propio DetailModal (z-50).
function ImageLightbox({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      containerRef.current?.requestFullscreen().catch(() => {})
    }
  }

  // Portal a document.body (mismo motivo que TooltipAnchor): DetailModal tiene
  // `animate-combat-enter`, cuya animación deja `transform: scale(1)` puesto al terminar
  // (fill-mode `both`) — cualquier transform, aunque sea la identidad, convierte al ancestro en
  // el contenedor de posicionamiento de sus descendientes `fixed`. Sin portal, este overlay
  // quedaba encajonado dentro del propio modal en vez de cubrir toda la pantalla (bug real,
  // 2026-07-22: el popup salía recortado con las esquinas redondeadas del modal).
  return createPortal(
    <div className="animate-overlay-in fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <div
        ref={containerRef}
        className={
          isFullscreen
            ? 'relative flex h-full w-full items-center justify-center bg-black'
            : 'relative inline-block leading-none'
        }
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt=""
          className={isFullscreen ? 'max-h-full max-w-full object-contain' : 'block max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] object-contain'}
        />
        <div className="absolute right-2 top-2 flex gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="tactile rounded-lg border border-iron-700 bg-wood-950/80 px-2.5 py-1.5 text-xs text-wood-200 transition-colors hover:border-accent-600/60 hover:text-accent-300"
          >
            {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="tactile rounded-lg border border-iron-700 bg-wood-950/80 px-2.5 py-1.5 text-xs text-wood-200 transition-colors hover:border-accent-600/60 hover:text-accent-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function MediaSlot({ icon, variant = 'active', imageUrl }: { icon: string; variant?: 'active' | 'placeholder'; imageUrl?: string | null }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  if (imageUrl) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          title="Ver imagen completa"
          className="h-40 w-full shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-iron-700 bg-wood-950/60 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]"
        >
          <img src={imageUrl} alt="" className="h-full w-full object-cover object-top" />
        </button>
        {lightboxOpen && <ImageLightbox imageUrl={imageUrl} onClose={() => setLightboxOpen(false)} />}
      </>
    )
  }
  return (
    <div
      className={`flex h-32 w-full shrink-0 items-center justify-center rounded-lg bg-wood-950/60 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] ${
        variant === 'placeholder' ? 'border border-dashed border-iron-700/60' : 'border border-iron-700'
      }`}
    >
      <span className="text-5xl leading-none opacity-90">{icon}</span>
    </div>
  )
}

// Caja de prompt de imagen (roadmap 2026-07-21/22, punto 7): la API solo genera el TEXTO del
// prompt (en inglés, para pegar en cualquier generador externo) — todavía no renderiza nada, así
// que la única acción útil aquí es copiarlo. Estado de "copiado" propio, no comparte el de editing.
// `onRegenerate` (petición explícita de la usuaria, 2026-07-22): opcional porque solo tiene
// sentido una vez ya existe un prompt — vuelve a generarlo con la info actual de la entrada,
// sobrescribiendo el guardado (ver /world/:slug/image-prompt con `regenerate: true`).
function ImagePromptBox({
  label,
  prompt,
  onRegenerate,
  regenerating,
}: {
  label: string
  prompt: string
  onRegenerate?: () => void
  regenerating?: boolean
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-iron-700/60 bg-wood-950/40 p-2.5">
      <p className="text-2xs uppercase tracking-[0.1em] text-wood-500">{label} (inglés)</p>
      <p className="font-mono text-xs leading-relaxed text-wood-300">{prompt}</p>
      <div className="flex gap-2">
        <button
          onClick={() => {
            navigator.clipboard.writeText(prompt)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="tactile self-start rounded-lg border border-iron-700 px-2.5 py-1 text-2xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
        >
          {copied ? 'Copiado ✓' : 'Copiar prompt'}
        </button>
        {onRegenerate && (
          <button
            disabled={regenerating}
            onClick={onRegenerate}
            className="tactile self-start rounded-lg border border-iron-700 px-2.5 py-1 text-2xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:opacity-60"
          >
            {regenerating ? 'Regenerando…' : 'Regenerar'}
          </button>
        )}
      </div>
    </div>
  )
}

// Un slot por perfil de talla (thumbnail/banner, ver imagePromptGenerator.ts en el backend) —
// caja+botón con estado propio, key'd por entidad+perfil desde el padre para que cambiar de
// entrada en la Enciclopedia remonte esto limpio (sin arrastrar el resultado de la anterior).
// Estado `prompt` propio (ya no `existingPrompt ?? generatedPrompt`, 2026-07-22): regenerar
// sobrescribe este valor directamente, sin que el prop original `existingPrompt` vuelva a ganar.
export function ImagePromptSlot({
  label,
  existingPrompt,
  worldSlug,
  entityType,
  entitySlug,
  sizeProfile,
}: {
  label: string
  existingPrompt: string | null
  worldSlug: string
  entityType: ImagePromptEntityType
  entitySlug: string
  sizeProfile: ImagePromptSizeProfile
}) {
  const [prompt, setPrompt] = useState<string | null>(existingPrompt)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async (regenerate: boolean) => {
    setGenerating(true)
    setError(null)
    try {
      const result = await requestImagePrompt(worldSlug, entityType, entitySlug, sizeProfile, regenerate)
      setPrompt(result.prompt)
    } catch {
      setError('No se pudo generar — inténtalo de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  if (prompt) {
    return (
      <div className="flex flex-col gap-1.5">
        <ImagePromptBox label={label} prompt={prompt} onRegenerate={() => generate(true)} regenerating={generating} />
        {error && <p className="text-2xs text-red-400/80">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        disabled={generating}
        onClick={() => generate(false)}
        className="tactile self-start rounded-lg border border-dashed border-iron-700/60 px-3 py-1.5 text-xs text-wood-400 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:opacity-60"
      >
        {generating ? 'Generando…' : `Generar ${label.toLowerCase()}`}
      </button>
      {error && <p className="text-2xs text-red-400/80">{error}</p>}
    </div>
  )
}
