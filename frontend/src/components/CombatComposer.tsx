import type { ActiveEffect, CondicionFisica } from '../types'

export interface CombatNpcDisplay {
  slug: string
  name: string
  // Botón "Decapitar" (2026-07-30) — antes se colapsaba MUERTO a CONVALECIENTE al mostrarlo (un
  // enemigo rematado con una habilidad REMATE se veía igual que uno solo convaleciente); ahora que
  // el jugador puede rematar a propósito desde el resumen de combate, el estado real se muestra
  // tal cual, mismo criterio que el resto de la ficha de combate.
  condicion: CondicionFisica
  yaSaqueado: boolean
  // Saqueo parcial (2026-07-31) — qué objetos concretos ya se llevó el jugador de este NPC, para
  // que el modal de saqueo (CombatPanel.tsx) no vuelva a ofrecerlos.
  lootedItemNames: string[]
  // Rediseño de combate (2026-08-09, "Analizar rival") — gatea qué muestra la ficha del rival
  // (CombatPanel.tsx § EnemyFicha).
  analizado: boolean
  // CONVALECIENTE deja de ser "victoria automática" (2026-08-26) — true tras "Capturar" o
  // "Dejarlo vivir": el NPC deja de contar como pendiente de resolver (useCombatFlow.ts §
  // combatEnded), pero su `condicion` NO cambia — sigue CONVALECIENTE de verdad.
  dismissed?: boolean
  // Rediseño de "Matar" (2026-08-30, ver tarkor_rediseno_matar_combate_real_2026-08-30): pulsar
  // "Matar" ya NO remata directo — solo marca al NPC como objetivo elegido para desbloquear el
  // panel (`combatHasPendingConvalecientes`) y ocultar su tarjeta persistente del log, dejando que
  // el jugador ataque de verdad (habilidad/texto libre) con riesgo real de tirada, igual que
  // cualquier otro combate. Sigue CONVALECIENTE hasta que un intercambio real lo mate — nunca se
  // reescribe `condicion` aquí, a diferencia del diseño viejo (remate determinista sin tirada).
  targetedForKill?: boolean
  /// Fase 2 de efectos de clase (2026-08-27, indicador de combate en CombatPanel.tsx) — AUMENTO/
  /// DEBILIDAD activos sobre este NPC ahora mismo.
  activeEffects: ActiveEffect[]
  /// Identificador de combatientes duplicados (2026-08-27) — ver comentario completo en
  /// `NpcInSceneInfo`, types.ts. `participantId` sustituye a `slug` como key/identificador real en
  /// CombatPanel.tsx; `instanceNumber` (1/2/3...) solo se muestra cuando hace falta desambiguar.
  participantId?: string
  instanceNumber?: number | null
  /// Tarjeta persistente de Convaleciente (fix 2026-08-28, ver LogPanel.tsx) — mismo dato estático
  /// del catálogo (`atributoResistencia !== null`) que ya usaba `entry.convalecienteOffers` para
  /// decidir si ofrecer el botón "Capturar", ahora disponible aquí para no depender de la LogEntry.
  capturable?: boolean
}

interface CombatComposerProps {
  freeText: string
  onFreeTextChange: (text: string) => void
  onSubmit: () => void
  busy: boolean
  ended: boolean
  /// CONVALECIENTE deja de ser "victoria automática" (2026-08-26, petición explícita: "se bloquea
  /// todo hasta responder la tarjeta o tarjetas de los enemigos convalecientes") — true mientras
  /// quede al menos un NPC CONVALECIENTE sin Matar/Capturar/Clemente (ver
  /// `combatHasPendingConvalecientes`, useCombatFlow.ts). El input sigue visible pero deshabilitado,
  /// con un aviso — a diferencia de `ended`, que oculta el composer entero.
  pendingDecisions?: boolean
}

/// Recortado a solo texto libre (rediseño de la vista de combate, 2026-07-28, petición explícita:
/// "la barra de abajo queda libre para el texto") — la lista de enemigos, la ficha, las
/// habilidades/objetos y el botón Actuar suben a `CombatPanel.tsx`, que sustituye al LogPanel "El
/// mundo" mientras dura el combate. El estado de selección vive en GameView.tsx, compartido entre
/// ambos; este componente ya no tiene estado propio.
export function CombatComposer({ freeText, onFreeTextChange, onSubmit, busy, ended, pendingDecisions }: CombatComposerProps) {
  if (ended) return null

  return (
    <div className="border-t border-red-900/50 bg-wood-950/90 px-4 pb-3 pt-3">
      {pendingDecisions && (
        <p className="mb-2 text-2xs text-danger-300">Resuelve a los rivales convalecientes antes de seguir.</p>
      )}
      <div className="flex gap-2">
        <input
          value={freeText}
          onChange={(e) => onFreeTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit()
          }}
          placeholder="O describe tu acción..."
          disabled={busy || pendingDecisions}
          className="flex-1 rounded-lg border border-iron-700 bg-wood-950/60 px-3 py-2 text-sm text-wood-100 outline-none disabled:opacity-50"
        />
        <button type="button"
          onClick={onSubmit}
          disabled={busy || pendingDecisions || !freeText.trim()}
          className="tactile shrink-0 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
        >
          Actuar
        </button>
      </div>
    </div>
  )
}
