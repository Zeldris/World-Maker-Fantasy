import type { PostCombatInteractionInfo } from '../types'
import { CONDICION_LABEL } from '../lib/health'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'

interface PostCombatInteractionModalProps {
  target: PostCombatInteractionInfo
  busy?: boolean
  onSalir: () => void
  onSaquear: () => void
}

/// Interacción con un NPC/fauna ya MUERTO, fuera de combate (docs/19-post-combate-y-recompensas-
/// mision.md pieza 2) — misma carcasa (overlay+panel+título) que el resto de modales de selección,
/// vía `SelectionModalShell` (checklist frontend 2026-08-27, B.3: este componente la reimplementaba
/// a mano desde cero pese a existir precisamente para eliminar esta duplicación).
///
/// Botón "Matar" retirado (2026-08-30, rediseño de "Matar" a intercambio real) — CONVALECIENTE ya
/// no llega a este modal (`PostCombatInteractionInfo.condicionFisica` es siempre 'MUERTO' ahora,
/// ver postCombatInteraction.ts backend); un convaleciente citado por nombre fluye como acción
/// normal de ataque (`explicitTargetVivo`), nunca a través de este atajo.
export function PostCombatInteractionModal({ target, busy, onSalir, onSaquear }: PostCombatInteractionModalProps) {
  return (
    <SelectionModalShell title={target.name} onCancel={onSalir} cancelDisabled={busy}>
      <p className="-mt-2 text-2xs uppercase tracking-[0.2em] text-wood-500">{CONDICION_LABEL[target.condicionFisica]}</p>
      <p className="text-xs leading-relaxed text-wood-400">
        {target.saqueado ? 'El cuerpo ya está registrado — no queda nada más que llevarse.' : 'Un cadáver, todavía sin registrar.'}
      </p>
      {!target.saqueado && (
        <button type="button" onClick={onSaquear} disabled={busy} className={confirmButtonClasses('accent')}>
          Saquear
        </button>
      )}
    </SelectionModalShell>
  )
}
