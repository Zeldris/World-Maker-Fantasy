import { useState } from 'react'
import type { Clase, Especializacion } from '../types'
import { claseLabel, especializacionLabel } from '../lib/dice'
import { MediaSlot } from './ImagePromptDisplay'
import { useSubmitError } from '../hooks/useSubmitError'

interface EspecializacionModalProps {
  clase: Clase
  especializaciones: { especializacion: Especializacion; resumenMecanico: string }[]
  onConfirm: (especializacion: Especializacion) => Promise<void>
  onOpenEnciclopedia: () => void
}

/// Elección obligatoria de especialización a nivel 10 (2026-09-01, diseño acordado: lista →
/// detalle con banner → confirmación de irreversibilidad → PATCH). Mismo patrón visual/estructural
/// que KingdomFoundingModal.tsx (overlay + plank-panel), pero SIN `onCancel` — a diferencia de
/// fundar reino, esta decisión no se puede posponer una vez a nivel 10 (ver GameView.tsx, sustituye
/// al composer normal mientras `pendingEspecializacionChoice` sea `true`).
export function EspecializacionModal({ clase, especializaciones, onConfirm, onOpenEnciclopedia }: EspecializacionModalProps) {
  const [seleccionada, setSeleccionada] = useState<Especializacion | null>(null)
  const [confirmando, setConfirmando] = useState(false)
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
    <div className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="plank-panel animate-combat-enter relative flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-xl p-5">
        {!detalle ? (
          <>
            <div>
              <h3 className="font-serif text-lg text-wood-100">Elige tu especialización</h3>
              <p className="mt-1 text-xs text-wood-400">
                Nivel 10 alcanzado — como {claseLabel(clase)}, tu personaje debe especializarse antes de seguir.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {especializaciones.map((e) => (
                <button
                  key={e.especializacion}
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
            <MediaSlot icon="🎓" />
            <div>
              <h3 className="font-serif text-lg text-wood-100">{especializacionLabel(detalle.especializacion)}</h3>
              <p className="mt-1 text-xs text-wood-400">{claseLabel(clase)}</p>
            </div>
            <p className="text-sm leading-relaxed text-wood-300">{detalle.resumenMecanico}</p>

            {confirmando && (
              <div className="rounded-lg border border-danger-600/50 bg-danger-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-danger-300">
                No podrás cambiar de especialización más adelante — ¿confirmas {especializacionLabel(detalle.especializacion)}?
              </div>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => (confirmando ? setConfirmando(false) : setSeleccionada(null))}
                disabled={busy}
                className="tactile flex-1 rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={() => (confirmando ? handleAceptar() : setConfirmando(true))}
                disabled={busy}
                className="tactile flex-1 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 transition-colors disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
              >
                {busy ? '...' : confirmando ? 'Confirmar' : 'Aceptar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
