import { useState } from 'react'
import type { Clase } from '../types'
import { claseLabel } from '../lib/dice'
import { MediaSlot, ImagePromptSlot } from './ImagePromptDisplay'
import { resolveImageUrl } from '../lib/api'
import { useSubmitError } from '../hooks/useSubmitError'
import { ModalShell } from './ModalShell'
import { BotonMantener } from './BotonMantener'

interface ClaseModalProps {
  clases: { clase: Clase; resumenMecanico: string; iconoUrl: string | null }[]
  worldSlug: string
  onConfirm: (clase: Clase) => Promise<void>
}

/// Elección obligatoria de clase al empezar a jugar (2026-09-01, fix de bug real: un personaje
/// custom se quedaba con `Save.clase: null` para siempre — `PATCH /saves/:id/clase` ya existía y
/// funcionaba, pero ningún punto de la UI lo llamaba nunca). Mismo patrón exacto que
/// EspecializacionModal.tsx (lista → detalle con banner → confirmación de irreversibilidad →
/// PATCH), sin enlace a Enciclopedia (no hace falta un segundo camino de descubrimiento aquí, la
/// lista ya es corta — 5 clases libres, o 6 si la raza tiene una exclusiva).
export function ClaseModal({ clases, worldSlug, onConfirm }: ClaseModalProps) {
  const [seleccionada, setSeleccionada] = useState<Clase | null>(null)
  const [busy, setBusy] = useState(false)
  const { error, runCatchingError } = useSubmitError()

  const detalle = clases.find((c) => c.clase === seleccionada) ?? null

  async function handleAceptar() {
    if (!seleccionada) return
    setBusy(true)
    await runCatchingError(() => onConfirm(seleccionada), 'No se pudo fijar la clase')
    setBusy(false)
  }

  return (
    // MOD-1/MOD-4 (hito 0.2): modal de ceremonia sobre ModalShell. Elección obligatoria e
    // irreversible: sin ✕ ni cierre; se confirma manteniendo pulsado 1 s (BotonMantener).
    <ModalShell
      title={detalle ? claseLabel(detalle.clase) : 'Elige tu clase'}
      subtitle={detalle ? undefined : 'Tu personaje debe elegir una clase de combate antes de seguir.'}
      onClose={() => {}}
      tamano="ceremonia"
      sinCerrar
      closeDisabled
      disableOverlayClose
      footer={
        detalle ? (
          <>
            <button
              type="button"
              onClick={() => setSeleccionada(null)}
              disabled={busy}
              className="tactile flex-1 rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Atrás
            </button>
            <BotonMantener onConfirmar={() => void handleAceptar()} disabled={busy}>
              {busy ? '...' : `Mantén para elegir ${claseLabel(detalle.clase)}`}
            </BotonMantener>
          </>
        ) : undefined
      }
    >
        {!detalle ? (
          <>
                <div className="flex flex-col gap-2">
                  {clases.map((c) => (
                    <button
                      key={c.clase}
                  data-opcion
                      type="button"
                      onClick={() => setSeleccionada(c.clase)}
                      className="tactile flex flex-col gap-1 rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2.5 text-left transition-colors hover:border-accent-600/60"
                    >
                      <span className="text-sm font-bold text-wood-100">{claseLabel(c.clase)}</span>
                      <span className="text-xs text-wood-400">{c.resumenMecanico}</span>
                    </button>
                  ))}
                </div>
          </>
        ) : (
          <>
                <MediaSlot icon="⚔️" imageUrl={resolveImageUrl(detalle.iconoUrl)} />
                <p className="text-sm leading-relaxed text-wood-300">{detalle.resumenMecanico}</p>
                {!detalle.iconoUrl && (
                  <ImagePromptSlot
                    label="Icono"
                    existingPrompt={null}
                    worldSlug={worldSlug}
                    entityType="clase"
                    entitySlug={detalle.clase}
                    sizeProfile="icono"
                  />
                )}

                <p className="rounded-lg border border-danger-600/50 bg-danger-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-danger-300">
                    No podrás cambiar de clase más adelante.
                  </p>
                {error && <p className="text-xs text-red-400">{error}</p>}

          </>
        )}
    </ModalShell>
  )
}
