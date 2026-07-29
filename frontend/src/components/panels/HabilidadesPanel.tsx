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
  // Rediseño "tope de 10" (2026-07-29): las habilidades de combate son fijas por raza/arma/clase
  // (las da el diseño, nunca la jugadora) — `combatSlots` ya no crece suave con el nivel (viejo
  // `habilidadSlotsForLevel`), es el tope real: 2 raciales + 2 de arma (4 desde el nivel de arma
  // avanzada) + 4 de clase. Defenderse/Esquivar (energyCost 0, sistema de fatiga) quedan FUERA de
  // este tope a propósito — son un fallback universal siempre disponible, no parte del reparto
  // curado por raza/arma/clase, así que no cuentan contra el cupo.
  const combatUsed = savedActions.filter((a) => a.category === 'combate' && a.energyCost > 0).length

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
            {tab === 'combate' ? `Habilidades activas: ${combatUsed} / ${combatSlots} (2 raciales + arma equipada + 4 de clase)` : 'Sin límite de huecos.'}
          </p>

          {inTab.length === 0 ? (
            <PanelEmptyState
              icon={tab === 'combate' ? '⚔️' : '✨'}
              title={tab === 'combate' ? 'Sin habilidades de combate todavía' : 'Sin habilidades generales todavía'}
              hint={tab === 'combate' ? 'Se conceden solas según tu raza, arma equipada y clase.' : 'Pulsa "+ Crear nueva" para guardar tu primera habilidad general.'}
            />
          ) : tab === 'combate' ? (
            // Rediseño "tope de 10" (2026-07-29, "UI reflejando el reparto"): separadas en sus dos
            // fuentes reales en vez de una cuadrícula plana — `isDynamic` (raciales + de arma, se
            // resincronizan solas) vs `isStarting` (de clase, fijas de por vida). Ninguna de las
            // dos es editable/borrable a mano (ver DetailModal.tsx).
            <div className="space-y-3">
              {inTab.some((a) => a.isDynamic) && (
                <div>
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">Raciales y de arma equipada</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {inTab
                      .filter((a) => a.isDynamic)
                      .map((a) => (
                        <IconCard key={a.id} icon={a.icon} name={a.name} tooltip={a.description} onUse={() => onUse(a)} onDetail={() => onDetail(a)} />
                      ))}
                  </div>
                </div>
              )}
              {inTab.some((a) => a.isStarting && !a.isDynamic && a.energyCost > 0) && (
                <div>
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">De clase</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {inTab
                      .filter((a) => a.isStarting && !a.isDynamic && a.energyCost > 0)
                      .map((a) => (
                        <IconCard key={a.id} icon={a.icon} name={a.name} tooltip={a.description} onUse={() => onUse(a)} onDetail={() => onDetail(a)} />
                      ))}
                  </div>
                </div>
              )}
              {inTab.some((a) => a.energyCost === 0) && (
                <div>
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">Siempre disponibles (gratis)</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {inTab
                      .filter((a) => a.energyCost === 0)
                      .map((a) => (
                        <IconCard key={a.id} icon={a.icon} name={a.name} tooltip={a.description} onUse={() => onUse(a)} onDetail={() => onDetail(a)} />
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {inTab.map((a) => (
                <IconCard key={a.id} icon={a.icon} name={a.name} tooltip={a.description} onUse={() => onUse(a)} onDetail={() => onDetail(a)} />
              ))}
            </div>
          )}

          {tab === 'combate' && (
            <PanelSection title="De dónde salen">
              <p className="text-xs text-wood-500 italic">
                Fijas, no se crean a mano: 2 raciales (ataque + defensa de tu raza), 2 del arma que llevas equipada (4 al alcanzar el nivel de arma
                avanzada — cambian solas si cambias de arma) y 4 de tu clase — todas gastan energía al usarlas. Defenderse y Esquivar son gratis y
                siempre están disponibles, aunque te quedes sin energía para el resto.
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
