import { useState } from 'react'
import type { KingdomFoundedInfo } from '../types'
import { useSubmitError } from '../hooks/useSubmitError'

interface KingdomFoundingModalProps {
  info: KingdomFoundedInfo
  onConfirm: (kingdomName: string, description?: string) => Promise<void>
  onCancel: () => void
}

const OUTCOME_LABEL: Record<KingdomFoundedInfo['outcome'], string> = {
  SIN_DUENO: 'Esta región no tenía ninguna facción dueña conocida — pasa a ser tuya sin oposición.',
  CONQUISTADA: 'Tu reputación con la(s) facción(es) de la región es buena — fundación pacífica.',
  CONFLICTO: 'Tu reputación con la(s) facción(es) de la región es mala — la región queda en conflicto, con más de una facción ocupando el mismo territorio.',
}

const OUTCOME_TONE: Record<KingdomFoundedInfo['outcome'], string> = {
  SIN_DUENO: 'border-iron-700 bg-wood-950/40 text-wood-300',
  CONQUISTADA: 'border-accent2-600/50 bg-accent2-600/10 text-accent2-300',
  CONFLICTO: 'border-danger-600/50 bg-danger-600/10 text-danger-300',
}

/// Popup de fundación de reino (2026-08-04, docs/17-reglas-construcciones-reino.md) — se abre al
/// terminar de construir el Ayuntamiento (tier 1). Gorhorn: nombre precargado y BLOQUEADO
/// ("Maktor", petición explícita) — el backend también lo fuerza, esto es solo UX, no la garantía
/// real (ver reino.ts). Cualquier otro personaje: campo en blanco, editable.
export function KingdomFoundingModal({ info, onConfirm, onCancel }: KingdomFoundingModalProps) {
  const [kingdomName, setKingdomName] = useState(info.suggestedName ?? '')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const { error, runCatchingError } = useSubmitError()

  async function handleConfirm() {
    if (!info.nameLocked && !kingdomName.trim()) return
    setBusy(true)
    await runCatchingError(
      () => onConfirm(info.nameLocked ? info.suggestedName! : kingdomName.trim(), description.trim() || undefined),
      'No se pudo fundar el reino',
    )
    setBusy(false)
  }

  return (
    <div className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="plank-panel animate-combat-enter relative flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-xl p-5">
        <div>
          <h3 className="font-serif text-lg text-wood-100">Fundación de reino</h3>
          <p className="mt-1 text-xs text-wood-400">
            Termina de construir {info.title} en {info.region} — el reino empieza a existir de verdad.
          </p>
        </div>

        <div className={`rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed ${OUTCOME_TONE[info.outcome]}`}>
          {OUTCOME_LABEL[info.outcome]}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-2xs font-medium uppercase tracking-wide text-wood-400">Nombre del reino</label>
          <input
            value={info.nameLocked ? (info.suggestedName ?? '') : kingdomName}
            onChange={(e) => setKingdomName(e.target.value)}
            disabled={info.nameLocked}
            placeholder="Nombre del reino"
            className="rounded-lg border border-iron-700 bg-wood-950/60 px-3 py-2 text-sm text-wood-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition-colors placeholder:text-wood-600 focus:border-accent-500 disabled:cursor-not-allowed disabled:text-wood-400"
          />
          {info.nameLocked && <p className="text-2xs italic text-wood-500">El nombre de Maktor no se puede cambiar.</p>}

          <label className="mt-1 text-2xs font-medium uppercase tracking-wide text-wood-400">Descripción (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Cómo es tu reino, qué lo define — se puede dejar en blanco."
            rows={3}
            className="resize-none rounded-lg border border-iron-700 bg-wood-950/60 px-3 py-2 text-sm text-wood-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition-colors placeholder:text-wood-600 focus:border-accent-500"
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button type="button"
            onClick={onCancel}
            disabled={busy}
            className="tactile flex-1 rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button type="button"
            onClick={handleConfirm}
            disabled={busy || (!info.nameLocked && !kingdomName.trim())}
            className="tactile flex-1 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 transition-colors disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
          >
            {busy ? '...' : 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  )
}
