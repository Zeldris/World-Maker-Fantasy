import type { QuestInfo } from '../../types'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'

interface MisionesPanelProps {
  quests: QuestInfo[]
}

const STATUS_LABEL: Record<QuestInfo['status'], string> = {
  ACTIVA: 'Activa',
  COMPLETADA: 'Completada',
  FALLIDA: 'Fallida',
}

const STATUS_CLASS: Record<QuestInfo['status'], string> = {
  ACTIVA: 'border-accent2-600/60 text-accent2-300',
  COMPLETADA: 'border-yellow-600/60 text-yellow-300',
  FALLIDA: 'border-red-900/60 text-red-400/80',
}

// Fondo amarillo para misión completada (petición explícita, docs/19-post-combate-y-recompensas-
// mision.md pieza 4) — antes "Completada" se pintaba con el mismo gris neutro que "Fallida", sin
// ningún tratamiento especial que marcara el logro. Solo en la propia tarjeta, no en la pastilla
// de estado (ya lleva su propio color arriba).
const CARD_CLASS: Record<QuestInfo['status'], string> = {
  ACTIVA: 'border-iron-700 bg-wood-950/40',
  COMPLETADA: 'border-yellow-600/40 bg-yellow-500/10',
  FALLIDA: 'border-iron-700 bg-wood-950/40',
}

export function MisionesPanel({ quests }: MisionesPanelProps) {
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
        {(quest.rewardXp || quest.rewardItems.length > 0) && (
          <p className="mt-1 text-xs leading-relaxed text-accent-300">
            <span className="text-2xs font-semibold uppercase tracking-wide text-wood-500">Recompensa: </span>
            {[...quest.rewardItems, quest.rewardXp ? `+${quest.rewardXp} XP` : null].filter(Boolean).join(', ')}
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
