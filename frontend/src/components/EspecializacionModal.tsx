import { useState } from 'react'
import type { Clase, Especializacion } from '../types'
import { claseLabel, especializacionLabel } from '../lib/dice'
import { MediaSlot, ImagePromptSlot } from './ImagePromptDisplay'
import { resolveImageUrl } from '../lib/api'
import { useSubmitError } from '../hooks/useSubmitError'
import { ModalShell } from './ModalShell'
import { BotonMantener } from './BotonMantener'

interface EspecializacionModalProps {
  clase: Clase
  especializaciones: { especializacion: Especializacion; resumenMecanico: string; iconoUrl: string | null }[]
  worldSlug: string
  onConfirm: (especializacion: Especializacion) => Promise<void>
  onOpenEnciclopedia: () => void
}

/// Elección obligatoria de especialización a nivel 10 (2026-09-01, diseño acordado: lista →
/// detalle con banner → confirmación de irreversibilidad → PATCH). Mismo patrón visual/estructural
/// que KingdomFoundingModal.tsx (overlay + plank-panel), pero SIN `onCancel` — a diferencia de
/// fundar reino, esta decisión no se puede posponer una vez a nivel 10 (ver GameView.tsx, sustituye
/// al composer normal mientras `pendingEspecializacionChoice` sea `true`).
export function EspecializacionModal({ clase, especializaciones, worldSlug, onConfirm, onOpenEnciclopedia }: EspecializacionModalProps) {
  const [seleccionada, setSeleccionada] = useState<Especializacion | null>(null)
  const [busy, setBusy] = useState(false)
  const { error, runCatchingError } = useSubmitError()

  const detalle = especializaciones.find((e) => e.especializacion === seleccionada) ?? null

  async function handleAceptar() {
    if (!seleccionada) return
    setBusy(true)
    await runCatchingError(() => onConfirm(seleccionada), 'No se pudo fijar la especialización')
    setBusy(false)
  }

  return (
    // MOD-1/MOD-4 (hito 0.2): modal de ceremonia sobre ModalShell. Elección obligatoria e
    // irreversible: sin ✕ ni cierre; se confirma manteniendo pulsado 1 s (BotonMantener).
    <ModalShell
      title={detalle ? especializacionLabel(detalle.especializacion) : 'Elige tu especialización'}
      subtitle={detalle ? claseLabel(clase) : `Nivel 10 alcanzado — como ${claseLabel(clase)}, tu personaje debe especializarse antes de seguir.`}
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
              {busy ? '...' : `Mantén para elegir ${especializacionLabel(detalle.especializacion)}`}
            </BotonMantener>
          </>
        ) : undefined
      }
    >
        {!detalle ? (
          <>
                <div className="flex flex-col gap-2">
                  {especializaciones.map((e) => (
                    <button
                      key={e.especializacion}
                  data-opcion
                      type="button"
                      onClick={() => setSeleccionada(e.especializacion)}
                      className="tactile flex flex-col gap-1 rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2.5 text-left transition-colors hover:border-accent-600/60"
                    >
                      <span className="text-sm font-bold text-wood-100">{especializacionLabel(e.especializacion)}</span>
                      <span className="text-xs text-wood-400">{e.resumenMecanico}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onOpenEnciclopedia}
                  className="tactile self-start text-xs text-accent-400 transition-colors hover:text-accent-300"
                >
                  ⓘ Ver clases en la Enciclopedia
                </button>
          </>
        ) : (
          <>
                <MediaSlot icon="🎓" imageUrl={resolveImageUrl(detalle.iconoUrl)} />
                <p className="text-sm leading-relaxed text-wood-300">{detalle.resumenMecanico}</p>
                {!detalle.iconoUrl && (
                  <ImagePromptSlot
                    label="Icono"
                    existingPrompt={null}
                    worldSlug={worldSlug}
                    entityType="especializacion"
                    entitySlug={detalle.especializacion}
                    sizeProfile="icono"
                  />
                )}

                <p className="rounded-lg border border-danger-600/50 bg-danger-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-danger-300">
                    No podrás cambiar de especialización más adelante.
                  </p>
                {error && <p className="text-xs text-red-400">{error}</p>}

          </>
        )}
    </ModalShell>
  )
}
