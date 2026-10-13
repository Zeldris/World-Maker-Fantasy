import { useState } from 'react'
import type { QuestInfo } from '../../types'
import { diaDeFiccion } from '../../lib/noticias'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'

interface MisionesPanelProps {
  quests: QuestInfo[]
  /// CR-40 (40g): entregar lo que pide una misión de Entregar (donde se aceptó) y abandonar una
  /// misión del motor. Sin ellos, no salen los botones.
  onEntregar?: (questId: string) => Promise<void>
  onAbandonar?: (questId: string) => Promise<void>
}

/// CR-40 (40g): progreso, plazo y acciones de una misión secundaria del motor.
function AccionesMision({ quest, onEntregar, onAbandonar }: { quest: QuestInfo; onEntregar?: (id: string) => Promise<void>; onAbandonar?: (id: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmarAbandono, setConfirmarAbandono] = useState(false)
  const run = async (fn: (id: string) => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn(quest.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar')
    } finally {
      setBusy(false)
      setConfirmarAbandono(false)
    }
  }
  const cantidad = quest.cantidad ?? 1
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <p className="flex flex-wrap gap-x-3 text-xs text-wood-300">
        {quest.encarga && <span><span className="text-2xs font-semibold uppercase tracking-wide text-wood-500">Encarga: </span>{quest.encarga}</span>}
        {cantidad > 1 && <span><span className="text-2xs font-semibold uppercase tracking-wide text-wood-500">Progreso: </span>{quest.progreso ?? 0}/{cantidad}</span>}
        {quest.venceEn != null && quest.status === 'ACTIVA' && <span><span className="text-2xs font-semibold uppercase tracking-wide text-wood-500">Hasta el día </span>{diaDeFiccion(quest.venceEn)}</span>}
      </p>
      {quest.status === 'ACTIVA' && (
        <div className="flex flex-wrap items-center gap-2">
          {quest.tipoMision === 'ENTREGAR' && onEntregar && (
            <button type="button" disabled={busy} onClick={() => run(onEntregar)} className="rounded border border-accent-600/60 bg-accent-500/15 px-2.5 py-1 text-xs text-accent-100 hover:bg-accent-500/25 disabled:opacity-50">
              Entregar
            </button>
          )}
          {onAbandonar &&
            (confirmarAbandono ? (
              <>
                <span className="text-2xs text-wood-400">¿Seguro? Perderás reputación.</span>
                <button type="button" disabled={busy} onClick={() => run(onAbandonar)} className="rounded border border-red-900/60 px-2.5 py-1 text-xs text-red-300 hover:bg-red-900/20 disabled:opacity-50">
                  Abandonar
                </button>
                <button type="button" disabled={busy} onClick={() => setConfirmarAbandono(false)} className="rounded border border-iron-700 px-2.5 py-1 text-xs text-wood-300">
                  No
                </button>
              </>
            ) : (
              <button type="button" disabled={busy} onClick={() => setConfirmarAbandono(true)} className="rounded border border-iron-700 px-2.5 py-1 text-xs text-wood-300 hover:bg-wood-800/40 disabled:opacity-50">
                Abandonar
              </button>
            ))}
          {error && <span className="text-2xs text-red-300">{error}</span>}
        </div>
      )}
    </div>
  )
}

const STATUS_LABEL: Record<QuestInfo['status'], string> = {
  ACTIVA: 'Activa',
  COMPLETADA: 'Completada',
  FALLIDA: 'Fallida',
  ABANDONADA: 'Abandonada',
}

const STATUS_CLASS: Record<QuestInfo['status'], string> = {
  ACTIVA: 'border-accent2-600/60 text-accent2-300',
  COMPLETADA: 'border-yellow-600/60 text-yellow-300',
  FALLIDA: 'border-red-900/60 text-red-400/80',
  ABANDONADA: 'border-iron-600/60 text-wood-400',
}

// Fondo amarillo para misión completada (petición explícita, docs/19-post-combate-y-recompensas-
// mision.md pieza 4) — antes "Completada" se pintaba con el mismo gris neutro que "Fallida", sin
// ningún tratamiento especial que marcara el logro. Solo en la propia tarjeta, no en la pastilla
// de estado (ya lleva su propio color arriba).
const CARD_CLASS: Record<QuestInfo['status'], string> = {
  ACTIVA: 'border-iron-700 bg-wood-950/40',
  COMPLETADA: 'border-yellow-600/40 bg-yellow-500/10',
  FALLIDA: 'border-iron-700 bg-wood-950/40',
  ABANDONADA: 'border-iron-700 bg-wood-950/40',
}

export function MisionesPanel({ quests, onEntregar, onAbandonar }: MisionesPanelProps) {
  if (quests.length === 0) {
    return (
      <PanelEmptyState
        icon="🎯"
        title="Todavía no hay misiones"
        hint="Los objetivos que surjan jugando —de largo o corto recorrido— aparecerán aquí."
      />
    )
  }

  const activas = quests.filter((q) => q.status === 'ACTIVA')
  const cerradas = quests.filter((q) => q.status !== 'ACTIVA')

  function QuestCard({ quest }: { quest: QuestInfo }) {
    return (
      <div className={`rounded-lg border px-3.5 py-2.5 ${CARD_CLASS[quest.status]}`}>
        <p className="flex items-center justify-between gap-2 font-medium text-wood-100">
          {quest.title}
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-2xs uppercase tracking-wide ${STATUS_CLASS[quest.status]}`}>
            {STATUS_LABEL[quest.status]}
          </span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-wood-400">{quest.description}</p>
        {quest.objetivo && (
          <p className="mt-1.5 text-xs leading-relaxed text-wood-300">
            <span className="text-2xs font-semibold uppercase tracking-wide text-wood-500">Objetivo: </span>
            {quest.objetivo}
          </p>
        )}
        {quest.tipoMision && <AccionesMision quest={quest} onEntregar={onEntregar} onAbandonar={onAbandonar} />}
        {(quest.rewardXp || quest.rewardItems.length > 0) && (
          <p className="mt-1 text-xs leading-relaxed text-accent-300">
            <span className="text-2xs font-semibold uppercase tracking-wide text-wood-500">Recompensa: </span>
            {[...quest.rewardItems, quest.rewardXp ? `+${quest.rewardXp} XP` : null, quest.recompensa?.goirnos ? `${quest.recompensa.goirnos} Goirnos` : null, quest.recompensa?.reputacion ? `reputación +${quest.recompensa.reputacion}` : null].filter(Boolean).join(', ')}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {activas.length > 0 && (
        <PanelSection title="Activas">
          <div className="flex flex-col gap-2">
            {activas.map((q) => (
              <QuestCard key={q.id} quest={q} />
            ))}
          </div>
        </PanelSection>
      )}

      {cerradas.length > 0 && (
        <PanelSection title="Cerradas">
          <div className="flex flex-col gap-2">
            {cerradas.map((q) => (
              <QuestCard key={q.id} quest={q} />
            ))}
          </div>
        </PanelSection>
      )}
    </div>
  )
}
