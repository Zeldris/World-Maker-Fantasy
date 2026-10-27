import { useState } from 'react'
import type { Attribute } from '../types'
import { postIntentarTameo, postConfirmarTameo, postSoltarTameo, postAlCorral, type TameoPendiente, type OpposedRollInfo } from '../lib/api'
import { attributeLabels, opposedRollToSides } from '../lib/dice'
import { DiceRollVs } from './DiceRoll'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'
import { useSubmitError } from '../hooks/useSubmitError'

const ATTRIBUTES: Attribute[] = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'voluntad', 'carisma', 'magia']

interface TameoModalProps {
  saveId: string
  pendiente: TameoPendiente
  /// `aviso`: lo que el backend cuenta de lo ocurrido (P349: «El Múrgol entra en los Corrales del Ganadero.»).
  onConfirmado: (aviso?: string) => void
  onSoltado: () => void
  onCancel: () => void
  /// DAD-4 (hito 0.1) — nombre real del personaje en su lado de la tirada (sin él, "Tú").
  characterName?: string
}

const MOTIVO_SIN_CORRAL = 'Construye un Corral del Ganadero'

/// Tameo/persuasión (Grupo 3 § Compañeros y supervivencia, 2026-08-25, docs/rpgtarkor/
/// companeros-y-supervivencia.md § 2/3) — elegir un atributo propio, tirada opuesta real contra el
/// atributo de resistencia del objetivo, Felicidad sube o baja según el resultado. Mutación 100%
/// determinista, sin narración de por medio (mismo criterio que CapturaModal.tsx).
export function TameoModal({ saveId, pendiente: initial, onConfirmado, onSoltado, onCancel, characterName }: TameoModalProps) {
  const [pendiente, setPendiente] = useState(initial)
  // DAD-1/DAD-2 (hito 0.1, H18/H19) — `seq` da una `key` nueva a cada tirada (sin ella React
  // reutilizaba el `DiceRollVs` y la segunda tirada no se animaba) y `aterrizada` difiere el
  // veredicto, el color y la subida de Felicidad hasta que los dos dados han caído.
  const [tirada, setTirada] = useState<{ seq: number; roll: OpposedRollInfo; felicidad: number; aterrizada: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const { error, runCatchingError } = useSubmitError()

  const umbralCompletado = pendiente.felicidad >= pendiente.umbral
  const sinCorral = pendiente.hayCorral === false

  async function handleIntentar(attribute: Attribute) {
    setBusy(true)
    const res = await runCatchingError(() => postIntentarTameo(saveId, pendiente.npcSlug, attribute), 'No se pudo intentar — puede que ya no esté capturado.')
    if (!res) {
      setBusy(false)
      return
    }
    // `busy` sigue activo hasta que caigan los dados (`handleAterrizada`): sin solapar tiradas.
    setTirada((prev) => ({ seq: (prev?.seq ?? 0) + 1, roll: res.roll, felicidad: res.felicidad, aterrizada: false }))
  }

  function handleAterrizada(seq: number, felicidad: number) {
    setTirada((prev) => (prev && prev.seq === seq ? { ...prev, aterrizada: true } : prev))
    setPendiente((prev) => ({ ...prev, felicidad }))
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

  /// CR-55 (Q3): el ganado puede ir al corral en vez de ser compañero.
  async function handleAlCorral() {
    setBusy(true)
    const ok = await runCatchingError(() => postAlCorral(saveId, pendiente.npcSlug), 'No se pudo llevar al corral.')
    if (ok === undefined) {
      setBusy(false)
      return
    }
    onConfirmado(ok.aviso)
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
          <>
            <button type="button" onClick={handleConfirmar} disabled={busy} className={confirmButtonClasses('accent')}>
              {busy ? 'Confirmando...' : 'Confirmar compañero'}
            </button>
            {pendiente.alCorral && (
              <>
                {/* P347: sin Corral del Ganadero no se ofrece; el motivo se ve, no solo en el tooltip. */}
                <button
                  type="button"
                  onClick={handleAlCorral}
                  disabled={busy || sinCorral}
                  title={sinCorral ? MOTIVO_SIN_CORRAL : undefined}
                  className={confirmButtonClasses('accent')}
                >
                  🐑 Al corral
                </button>
                {sinCorral && <span className="text-2xs text-wood-400">{MOTIVO_SIN_CORRAL}</span>}
              </>
            )}
          </>
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

      {tirada &&
        (() => {
          const { left, right } = opposedRollToSides(tirada.roll)
          const { seq, felicidad, aterrizada } = tirada
          const tono = !aterrizada
            ? 'border-iron-700 bg-wood-950/30 text-wood-300'
            : tirada.roll.gano
              ? 'border-emerald-700 bg-emerald-500/10 text-emerald-300'
              : 'border-red-800 bg-red-500/10 text-red-300'
          return (
            <div key={seq} className={`rounded-lg border p-2.5 text-2xs transition-colors ${tono}`}>
              <p className="mb-0.5 font-medium">{!aterrizada ? 'Tirando…' : tirada.roll.gano ? '¡Gana confianza!' : 'No cede esta vez.'}</p>
              <DiceRollVs
                key={seq}
                left={left}
                right={right}
                leftLabel={characterName ?? 'Tú'}
                rightLabel={`${pendiente.name} · resistencia`}
                leftFirst
                showDifficulty={false}
                onAllLanded={() => handleAterrizada(seq, felicidad)}
              />
            </div>
          )
        })()}

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
