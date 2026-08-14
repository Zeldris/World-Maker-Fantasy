import type { PostCombatInteractionInfo } from '../types'
import { CONDICION_LABEL } from '../lib/health'

interface PostCombatInteractionModalProps {
  target: PostCombatInteractionInfo
  busy?: boolean
  onSalir: () => void
  onSaquear: () => void
  onDecapitar: () => void
}

/// Interacción con un NPC/fauna ya incapacitado o muerto, fuera de combate (docs/19-post-combate-
/// y-recompensas-mision.md pieza 2) — misma carcasa de overlay que CombatSelectionModal.tsx, pero
/// sin checkboxes: un solo objetivo ya resuelto, solo hace falta elegir qué hacer con él.
/// "Decapitar" solo si sigue INCAPACITADO (un cadáver ya no hace falta rematarlo); "Saquear" solo
/// si `!saqueado` — mismo criterio que ya usa CombatPanel.tsx para el mismo botón en combate.
export function PostCombatInteractionModal({ target, busy, onSalir, onSaquear, onDecapitar }: PostCombatInteractionModalProps) {
  return (
    <div className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onSalir}>
      <div
        className="plank-panel animate-combat-enter relative flex w-full max-w-md flex-col gap-4 rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="font-serif text-lg text-wood-100">{target.name}</h3>
          <p className="mt-1 text-2xs uppercase tracking-[0.2em] text-wood-500">{CONDICION_LABEL[target.condicionFisica]}</p>
        </div>
        <p className="text-xs leading-relaxed text-wood-400">
          {target.condicionFisica === 'INCAPACITADO'
            ? 'Sigue inconsciente, a tu merced — no puede oponer resistencia.'
            : target.saqueado
              ? 'El cuerpo ya está registrado — no queda nada más que llevarse.'
              : 'Un cadáver, todavía sin registrar.'}
        </p>
        <div className="flex flex-col gap-2">
          {!target.saqueado && (
            <button
              onClick={onSaquear}
              disabled={busy}
              className="tactile w-full rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
            >
              Saquear
            </button>
          )}
          {target.condicionFisica === 'INCAPACITADO' && (
            <button
              onClick={onDecapitar}
              disabled={busy}
              className="tactile w-full rounded-lg border border-danger-600 bg-danger-600/20 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-danger-300 transition-colors hover:bg-danger-600/35 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Matar
            </button>
          )}
          <button
            onClick={onSalir}
            disabled={busy}
            className="tactile w-full rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  )
}
