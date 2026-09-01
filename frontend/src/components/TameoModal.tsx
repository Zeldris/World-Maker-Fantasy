import { useState } from 'react'
import type { Attribute } from '../types'
import { postIntentarTameo, postConfirmarTameo, postSoltarTameo, type TameoPendiente, type OpposedRollInfo } from '../lib/api'
import { attributeLabels } from '../lib/dice'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'
import { useSubmitError } from '../hooks/useSubmitError'

const ATTRIBUTES: Attribute[] = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'voluntad', 'carisma', 'magia']

interface TameoModalProps {
  saveId: string
  pendiente: TameoPendiente
  onConfirmado: () => void
  onSoltado: () => void
  onCancel: () => void
}

/// Tameo/persuasión (Grupo 3 § Compañeros y supervivencia, 2026-08-25, docs/rpgtarkor/
/// companeros-y-supervivencia.md § 2/3) — elegir un atributo propio, tirada opuesta real contra el
/// atributo de resistencia del objetivo, Felicidad sube o baja según el resultado. Mutación 100%
/// determinista, sin narración de por medio (mismo criterio que CapturaModal.tsx).
export function TameoModal({ saveId, pendiente: initial, onConfirmado, onSoltado, onCancel }: TameoModalProps) {
  const [pendiente, setPendiente] = useState(initial)
  const [lastRoll, setLastRoll] = useState<OpposedRollInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const { error, runCatchingError } = useSubmitError()

  const umbralCompletado = pendiente.felicidad >= pendiente.umbral

  async function handleIntentar(attribute: Attribute) {
    setBusy(true)
    await runCatchingError(async () => {
      const res = await postIntentarTameo(saveId, pendiente.npcSlug, attribute)
      setLastRoll(res.roll)
      setPendiente((prev) => ({ ...prev, felicidad: res.felicidad }))
    }, 'No se pudo intentar — puede que ya no esté capturado.')
    setBusy(false)
  }

  async function handleConfirmar() {
    setBusy(true)
    const ok = await runCatchingError(() => postConfirmarTameo(saveId, pendiente.npcSlug), 'No se pudo confirmar — puede que no tengas ningún slot de compañero libre.')
    if (ok === undefined) {
      setBusy(false)
      return
    }
    onConfirmado()
  }

  async function handleSoltar() {
    setBusy(true)
    const ok = await runCatchingError(() => postSoltarTameo(saveId, pendiente.npcSlug), 'No se pudo soltar.')
    if (ok === undefined) {
      setBusy(false)
      return
    }
    onSoltado()
  }

  const verbo = pendiente.tipo === 'FAUNA' ? 'Alimentar' : 'Persuadir'

  return (
    <SelectionModalShell
      title={`${pendiente.tipo === 'FAUNA' ? '🐾' : ''} ${pendiente.name}`}
      onCancel={onCancel}
      cancelDisabled={busy}
      footer={
        umbralCompletado && (
          <button type="button" onClick={handleConfirmar} disabled={busy} className={confirmButtonClasses('accent')}>
            {busy ? 'Confirmando...' : 'Confirmar compañero'}
          </button>
        )
      }
    >
      <div>
        <div className="mb-1 flex items-center justify-between text-2xs text-wood-400">
          <span>😊 Felicidad</span>
          <span className="font-mono tabular-nums">
            {pendiente.felicidad} / {pendiente.umbral}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-iron-800">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${umbralCompletado ? 'bg-emerald-500' : 'bg-accent-500'}`}
            style={{ width: `${Math.min(100, (pendiente.felicidad / pendiente.umbral) * 100)}%` }}
          />
        </div>
      </div>

      {pendiente.atributoResistencia && (
        <p className="text-2xs text-accent2-300">
          Ventaja de Domador: resiste con {attributeLabels[pendiente.atributoResistencia]}.
        </p>
      )}

      {lastRoll && (
        <div className={`rounded-lg border p-2.5 text-2xs ${lastRoll.gano ? 'border-emerald-700 bg-emerald-500/10 text-emerald-300' : 'border-red-800 bg-red-500/10 text-red-300'}`}>
          <p className="font-medium">
            {lastRoll.playerResult} ({attributeLabels[lastRoll.playerAttribute]}) vs {lastRoll.resistenciaResult} ({attributeLabels[lastRoll.resistenciaAttribute]})
          </p>
          <p className="mt-0.5">{lastRoll.gano ? '¡Gana confianza!' : 'No cede esta vez.'}</p>
        </div>
      )}

      {!umbralCompletado && (
        <div>
          <p className="mb-1.5 text-2xs text-wood-500">{verbo} eligiendo un atributo:</p>
          <div className="flex flex-wrap gap-1.5">
            {ATTRIBUTES.map((attr) => (
              <button type="button"
                key={attr}
                onClick={() => handleIntentar(attr)}
                disabled={busy}
                className="tactile rounded-lg border border-iron-700 px-2.5 py-1.5 text-2xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {attributeLabels[attr]}
              </button>
            ))}
          </div>
        </div>
      )}

      <button type="button"
        onClick={handleSoltar}
        disabled={busy}
        className="tactile w-full rounded-lg border border-danger-700/60 px-3 py-1.5 text-2xs font-medium uppercase tracking-wide text-danger-300 transition-colors hover:bg-danger-600/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Soltar
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </SelectionModalShell>
  )
}
