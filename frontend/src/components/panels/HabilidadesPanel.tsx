import { useState } from 'react'
import type { ProfessionProgressInfo, ProfessionRecipeInfo, SavedActionCategory, SavedActionInfo } from '../../types'
import { professions } from '../../data/professions'
import { professionSpan, MAX_PROFESSION_LEVEL } from '../../lib/professionLevels'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'
import { IconCard } from '../IconCard'
import { AbilityForm } from '../AbilityForm'

interface HabilidadesPanelProps {
  savedActions: SavedActionInfo[]
  combatSlots: number
  professionProgress: ProfessionProgressInfo[]
  professionRecipes: ProfessionRecipeInfo[]
  onUse: (ability: SavedActionInfo) => void
  onCreate: (params: { name: string; promptText: string; icon: string; description: string; category: SavedActionCategory }) => Promise<void>
  onDetail: (ability: SavedActionInfo) => void
}

/// Objeto de habilidad "de previsualización" para una receta todavía bloqueada — no existe como
/// SavedAction real en BD (nunca se desbloqueó), así que no tiene id real; sirve solo para poder
/// abrir su ficha de solo lectura (rediseño de profesiones, 2026-08-07: "onDetail sigue
/// funcionando aunque esté bloqueada"). isStarting:true fuerza la rama "no editable" en DetailModal.
function previewAbilityFor(recipe: ProfessionRecipeInfo): SavedActionInfo {
  return {
    id: `preview:${recipe.recipeKey}`,
    name: recipe.ability.name,
    promptText: recipe.ability.promptText,
    icon: recipe.ability.icon,
    description: recipe.ability.description,
    isStarting: true,
    isDynamic: false,
    category: recipe.ability.category,
    preferredAttribute: null,
    energyCost: 0,
    energyRegen: 0,
    isGeneric: false,
    dualWield: false,
    recipeKey: recipe.recipeKey,
  }
}

export function HabilidadesPanel({ savedActions, combatSlots, professionProgress, professionRecipes, onUse, onCreate, onDetail }: HabilidadesPanelProps) {
  // Generales primero (2026-08-07, reordenado junto con la pestaña nueva de Profesiones) — el
  // tab por defecto sigue la misma pestaña, para no abrir en una que no sea la resaltada visualmente.
  const [tab, setTab] = useState<SavedActionCategory>('general')
  // Ver la cuadrícula y crear una nueva ya no se muestran a la vez (petición explícita de la
  // usuaria, 2026-07-21) — solo aplica a "general" (combate no tiene formulario de creación).
  const [showCreateForm, setShowCreateForm] = useState(false)

  const inTab = savedActions.filter((a) => a.category === tab)
  // Rediseño "tope de 10" (2026-07-29): las habilidades de combate son fijas por raza/arma/clase
  // (las da el diseño, nunca la jugadora) — `combatSlots` ya no crece suave con el nivel (viejo
  // `habilidadSlotsForLevel`), es el tope real: 2 raciales + 2 de arma (4 desde el nivel de arma
  // avanzada) + 4 de clase. Los 3 genéricos (Ataque Básico/Defenderse/Esquivar) quedan FUERA de
  // este tope a propósito — son la acción base de cualquier personaje, no parte del reparto curado
  // por raza/arma/clase, así que no cuentan contra el cupo. Antes se usaba `energyCost > 0` para
  // esto (dejó de servir en cuanto Ataque Básico pasó a costar 5, 2026-07-31) — ahora `isGeneric`.
  const combatUsed = savedActions.filter((a) => a.category === 'combate' && !a.isGeneric).length

  // Rediseño de profesiones (2026-08-07): profesiones creadoras que el jugador practica de verdad
  // (fila en professionProgress, nivel ≥ 1 — sin fila = nunca aprendida). Cada una muestra su
  // barra + TODAS sus recetas (roster estático professionRecipes), bloqueadas o no según el nivel.
  const progressByOficio = new Map(professionProgress.map((p) => [p.professionId, p]))
  const creacionProfessions = professions.filter((p) => p.category === 'creacion' && progressByOficio.has(p.id))
  // Habilidades de oficio ya desbloqueadas que NO pertenecen a ninguna profesión creadora (p.ej.
  // "Preparar antídoto" de sanador, que no tiene categoría en este rediseño) — se siguen mostrando,
  // en un bloque aparte más simple, para no dejarlas invisibles.
  const coveredNames = new Set(professionRecipes.filter((r) => creacionProfessions.some((p) => p.id === r.oficio)).map((r) => r.ability.name))
  const otherProfessionAbilities = inTab.filter((a) => !coveredNames.has(a.name))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 border-b border-iron-700">
        <button
          onClick={() => setTab('general')}
          className={`border-b-2 px-3 py-2 text-sm transition-colors ${
            tab === 'general' ? 'border-accent-500 font-medium text-accent-300' : 'border-transparent text-wood-400 hover:text-wood-200'
          }`}
        >
          Generales
        </button>
        <button
          onClick={() => setTab('combate')}
          className={`border-b-2 px-3 py-2 text-sm transition-colors ${
            tab === 'combate' ? 'border-accent-500 font-medium text-accent-300' : 'border-transparent text-wood-400 hover:text-wood-200'
          }`}
        >
          Combate
        </button>
        <button
          onClick={() => setTab('profesion')}
          className={`border-b-2 px-3 py-2 text-sm transition-colors ${
            tab === 'profesion' ? 'border-accent-500 font-medium text-accent-300' : 'border-transparent text-wood-400 hover:text-wood-200'
          }`}
        >
          Profesiones
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

      {tab === 'general' && showCreateForm ? (
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
      ) : tab === 'profesion' ? (
        creacionProfessions.length === 0 && otherProfessionAbilities.length === 0 ? (
          <PanelEmptyState
            icon="🛠️"
            title="Sin oficios todavía"
            hint="Crafteando o construyendo con un oficio empieza a subir su nivel de verdad."
          />
        ) : (
          <div className="space-y-5">
            {creacionProfessions.map((profession) => {
              const progress = progressByOficio.get(profession.id)!
              const { current, span } = professionSpan(progress.nivel, progress.xp)
              const percent = span > 0 ? Math.min(100, (current / span) * 100) : 100
              const recipes = professionRecipes.filter((r) => r.oficio === profession.id).sort((a, b) => a.nivel - b.nivel)
              return (
                <div key={profession.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-wood-100">{profession.name}</span>
                    <span className="font-mono tabular-nums text-wood-500">
                      {progress.nivel >= MAX_PROFESSION_LEVEL ? `Nivel ${progress.nivel} (máximo)` : `Nivel ${progress.nivel} — ${current}/${span} XP`}
                    </span>
                  </div>
                  <div className="mb-2 h-1 overflow-hidden rounded-full bg-iron-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400 transition-[width] duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mb-2 text-2xs leading-relaxed text-wood-400">{profession.description}</p>
                  {recipes.length === 0 ? (
                    <p className="text-2xs italic text-wood-600">Todavía sin recetas propias.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {recipes.map((recipe) => {
                        const unlocked = progress.nivel >= recipe.nivel
                        const realAbility = unlocked ? savedActions.find((a) => a.name === recipe.ability.name) : undefined
                        return (
                          <IconCard
                            key={recipe.recipeKey}
                            icon={recipe.ability.icon}
                            name={recipe.ability.name}
                            tooltip={recipe.ability.description}
                            onUse={() => (realAbility ? onUse(realAbility) : undefined)}
                            onDetail={() => onDetail(realAbility ?? previewAbilityFor(recipe))}
                            locked={unlocked ? undefined : { reason: `Necesitas nivel ${recipe.nivel} de ${profession.name}` }}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {otherProfessionAbilities.length > 0 && (
              <div>
                <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">Otras habilidades de oficio</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {otherProfessionAbilities.map((a) => (
                    <IconCard key={a.id} icon={a.icon} name={a.name} tooltip={a.description} onUse={() => onUse(a)} onDetail={() => onDetail(a)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        <>
          <p className="text-2xs text-wood-400">
            {tab === 'combate'
              ? `Habilidades activas: ${combatUsed} / ${combatSlots} (2 raciales + 1-2 de arma equipada + 4 de clase) — solo consulta, para atacar usa el panel de Combate durante un enfrentamiento.`
              : 'Sin límite de huecos.'}
          </p>

          {inTab.length === 0 ? (
            <PanelEmptyState
              icon={tab === 'combate' ? '⚔️' : '✨'}
              title={tab === 'combate' ? 'Sin habilidades de combate todavía' : 'Sin habilidades generales todavía'}
              hint={tab === 'combate' ? 'Se conceden solas según tu raza, arma equipada y clase.' : 'Pulsa "+ Crear nueva" para guardar tu primera habilidad general.'}
            />
          ) : tab === 'combate' ? (
            // Rediseño "tope de 10" (2026-07-29, "UI reflejando el reparto"), extendido 2026-07-31
            // (petición explícita: "ataque básico no es una habilidad como las demás... son
            // acciones que tienen todos los personajes... en un bloque, y en otro las
            // habilidades") — 3 fuentes reales en vez de una cuadrícula plana: `isGeneric` (Ataque
            // Básico/Defenderse/Esquivar, primero, la acción base de cualquier personaje),
            // `isDynamic && !isGeneric` (raciales + de arma real, se resincronizan solas) e
            // `isStarting` (de clase, fijas de por vida). Ninguna de las tres es editable/borrable
            // a mano (ver DetailModal.tsx).
            //
            // Solo información (petición explícita, 2026-08-07: "las de combate pasará a ser solo
            // de informacion, para saber y elegir las habilidades que quieres usar") — pulsar la
            // tarjeta ya no manda la acción (eso solo tenía sentido fuera de combate); ahora abre
            // la misma ficha que el botón ⓘ. El combate real se sigue eligiendo y atacando desde
            // CombatPanel durante un enfrentamiento, sin cambios ahí.
            <div className="space-y-3">
              {inTab.some((a) => a.isGeneric) && (
                <div>
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">Acciones básicas</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {inTab
                      .filter((a) => a.isGeneric)
                      .map((a) => (
                        <IconCard key={a.id} icon={a.icon} name={a.name} tooltip={a.description} onUse={() => onDetail(a)} onDetail={() => onDetail(a)} />
                      ))}
                  </div>
                </div>
              )}
              {inTab.some((a) => a.isDynamic && !a.isGeneric) && (
                <div>
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">Raciales y de arma equipada</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {inTab
                      .filter((a) => a.isDynamic && !a.isGeneric)
                      .map((a) => (
                        <IconCard key={a.id} icon={a.icon} name={a.name} tooltip={a.description} onUse={() => onDetail(a)} onDetail={() => onDetail(a)} />
                      ))}
                  </div>
                </div>
              )}
              {inTab.some((a) => a.isStarting && !a.isDynamic && !a.isGeneric && a.energyCost > 0) && (
                <div>
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">De clase</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {inTab
                      .filter((a) => a.isStarting && !a.isDynamic && !a.isGeneric && a.energyCost > 0)
                      .map((a) => (
                        <IconCard key={a.id} icon={a.icon} name={a.name} tooltip={a.description} onUse={() => onDetail(a)} onDetail={() => onDetail(a)} />
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
                Ataque Básico, Defenderse y Esquivar los tiene cualquier personaje, siempre disponibles: Ataque Básico cuesta poca energía y se adapta
                al arma que lleves equipada; Defenderse y Esquivar no cuestan nada y encima recuperan energía. El resto son fijas, no se crean a mano:
                2 raciales (ataque + defensa de tu raza), 1-2 del arma que llevas equipada (una por categoría distinta en cada mano — llevar 2 del
                mismo tipo da solo una, pero mejor) + 1 más al alcanzar el nivel avanzado, y 4 de tu clase — todas gastan energía real al usarlas.
              </p>
            </PanelSection>
          )}
        </>
      )}
    </div>
  )
}
