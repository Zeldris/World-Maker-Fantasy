import { useState } from 'react'
import type { SavedActionCategory, SavedActionInfo } from '../../types'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'
import { IconCard } from '../IconCard'
import { AbilityForm } from '../AbilityForm'

interface HabilidadesPanelProps {
  savedActions: SavedActionInfo[]
  combatSlots: number
  onUse: (ability: SavedActionInfo) => void
  onCreate: (params: { name: string; promptText: string; icon: string; description: string; category: SavedActionCategory }) => Promise<void>
  onDetail: (ability: SavedActionInfo) => void
}

export function HabilidadesPanel({ savedActions, combatSlots, onUse, onCreate, onDetail }: HabilidadesPanelProps) {
  const [tab, setTab] = useState<SavedActionCategory>('combate')
  // Ver la cuadrícula y crear una nueva ya no se muestran a la vez (petición explícita de la
  // usuaria, 2026-07-21) — solo aplica a "general" (combate no tiene formulario de creación).
  const [showCreateForm, setShowCreateForm] = useState(false)

  const inTab = savedActions.filter((a) => a.category === tab)
  // Las habilidades de combate son fijas por clase (las da el diseño, no la jugadora) — el cupo
  // por nivel sigue siendo información útil (cuántas de las de la clase están activas ahora),
  // pero ya no hay formulario de creación para esta categoría.
  const combatUsed = savedActions.filter((a) => a.category === 'combate' && !a.isStarting).length

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 border-b border-iron-700">
        <button
          onClick={() => setTab('combate')}
          className={`border-b-2 px-3 py-2 text-sm transition-colors ${
            tab === 'combate' ? 'border-accent-500 font-medium text-accent-300' : 'border-transparent text-wood-400 hover:text-wood-200'
          }`}
        >
          Combate
        </button>
        <button
          onClick={() => {
            setTab('general')
            setShowCreateForm(false)
          }}
          className={`border-b-2 px-3 py-2 text-sm transition-colors ${
            tab === 'general' ? 'border-accent-500 font-medium text-accent-300' : 'border-transparent text-wood-400 hover:text-wood-200'
          }`}
        >
          Generales
        </button>
      </div>

      {tab === 'general' && (
        <div className="flex gap-1.5 self-start rounded-lg border border-iron-700 bg-wood-950/40 p-1">
          <button
            onClick={() => setShowCreateForm(false)}
            className={`rounded-md px-3 py-1 text-xs transition-colors ${
              !showCreateForm ? 'bg-accent-500/15 text-accent-300' : 'text-wood-400 hover:text-wood-200'
            }`}
          >
            Ver habilidades
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className={`rounded-md px-3 py-1 text-xs transition-colors ${
              showCreateForm ? 'bg-accent-500/15 text-accent-300' : 'text-wood-400 hover:text-wood-200'
            }`}
          >
            + Crear nueva
          </button>
        </div>
      )}

      {tab === 'combate' || !showCreateForm ? (
        <>
          <p className="text-2xs text-wood-400">
            {tab === 'combate' ? `Habilidades de clase activas: ${combatUsed} / ${combatSlots} (crecen con el nivel)` : 'Sin límite de huecos.'}
          </p>

          {inTab.length === 0 ? (
            <PanelEmptyState
              icon={tab === 'combate' ? '⚔️' : '✨'}
              title={tab === 'combate' ? 'Sin habilidades de combate todavía' : 'Sin habilidades generales todavía'}
              hint={tab === 'combate' ? 'Se desbloquean solas al subir de nivel.' : 'Pulsa "+ Crear nueva" para guardar tu primera habilidad general.'}
            />
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {inTab.map((a) => (
                <IconCard key={a.id} icon={a.icon} name={a.name} tooltip={a.description} onUse={() => onUse(a)} onDetail={() => onDetail(a)} />
              ))}
            </div>
          )}

          {tab === 'combate' && (
            <PanelSection title="Habilidades de clase">
              <p className="text-xs text-wood-500 italic">
                Las habilidades de combate son fijas de tu clase — se desbloquean solas al subir de nivel, no se crean a mano.
              </p>
            </PanelSection>
          )}
        </>
      ) : (
        <PanelSection title="Guardar nueva (general)">
          <AbilityForm
            mode="create"
            onSubmit={async (params) => {
              await onCreate({ ...params, category: 'general' })
              setShowCreateForm(false)
            }}
            onCancel={() => setShowCreateForm(false)}
          />
        </PanelSection>
      )}
    </div>
  )
}
