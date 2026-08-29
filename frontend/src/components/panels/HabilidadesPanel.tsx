import { useEffect, useRef, useState } from 'react'
import type { ProfessionProgressInfo, ProfessionRecipeInfo, RecipeStatusInfo, SavedActionCategory, SavedActionInfo } from '../../types'
import { professions } from '../../data/professions'
import { REINO_ABILITY_RECIPE_KEY } from '../../data/reinoRecipes'
import { professionSpan, MAX_PROFESSION_LEVEL } from '../../lib/professionLevels'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'
import { IconCard } from '../IconCard'
import { AbilityForm } from '../AbilityForm'
import { CombatAbilityBelt, CombatAbilityToggleGrid } from '../CombatAbilityBelt'
import { abilityBonusSuffix } from '../../lib/abilityBonusSuffix'

interface HabilidadesPanelProps {
  savedActions: SavedActionInfo[]
  combatSlots: number
  /// "Cinturón de combate" (2026-08-28, pendiente 2026-08-27 punto 3) — nombres activos AHORA
  /// MISMO, ya resueltos por el backend (ver GET /saves/:id § activeCombatAbilityNames).
  activeCombatAbilityNames: string[]
  onChangeActiveCombatAbilityNames: (names: string[]) => void
  professionProgress: ProfessionProgressInfo[]
  professionRecipes: ProfessionRecipeInfo[]
  /// Estado real de materiales/atributos/ubicación de cada receta EN ESTA PARTIDA (2026-08-13,
  /// petición explícita: "que salgan deshabilitadas si no cumples las condiciones... el hover
  /// con... 5/10") — ver GET /saves/:id/recipes-status.
  recipesStatus: RecipeStatusInfo[]
  onUse: (ability: SavedActionInfo) => void
  onCreate: (params: { name: string; promptText: string; icon: string; description: string; category: SavedActionCategory }) => Promise<void>
  onDetail: (ability: SavedActionInfo) => void
}

// Tooltip combinado: descripción + qué hace falta (2026-08-13) — "tipo 5/10" por ingrediente,
// siempre visible (incluso ya cumplido, para poder planificar), más atributos/ubicación que
// falten si los hay. Sin receta asociada (habilidades 'general' de siempre, sin materiales),
// se queda con la descripción tal cual.
function readinessTooltip(description: string, status: RecipeStatusInfo | undefined): string {
  if (!status) return description
  const parts: string[] = []
  if (status.ingredients.length > 0) {
    parts.push(`Necesita: ${status.ingredients.map((i) => `${i.label} ${i.tienes}/${i.necesitas}`).join(', ')}.`)
  }
  if (status.missingRequisitos.length > 0) {
    parts.push(`Falta: ${status.missingRequisitos.join(', ')}.`)
  }
  if (!status.locationOk && status.requiredLocationName) {
    parts.push(`Debes estar en ${status.requiredLocationName}.`)
  }
  // Reglas de reino (auditoría 2026-08-13) — Ayuntamiento/región/distancia/cupo, ver recipesStatus.ts.
  if (status.blockedReason) {
    parts.push(`${status.blockedReason[0].toUpperCase()}${status.blockedReason.slice(1)}.`)
  }
  return parts.length > 0 ? `${description} — ${parts.join(' ')}` : description
}

// Cuadrícula de tarjetas repetida 8 veces en este panel (auditoría de deuda técnica, 2026-08-12)
// — solo cambiaban la lista de origen y, en las pestañas de combate (sin receta real detrás), el
// que la tarjeta abriera el detalle en vez de ejecutar la habilidad. `statusFor` queda fuera a
// propósito (undefined): esas pestañas nunca deshabilitan ni añaden el aviso de materiales.
// Desollar pasa a pasiva (2026-08-25, petición explícita: "la habilidad de desollar debe pasar a
// pasiva") — al reutilizar el saqueo/desuello clásico para los caídos de un CombatEncounter (ver
// turnResolution.ts), tener un botón activo aparte se volvió redundante: los cadáveres (de
// combate o narrativos) ya avisan solos en la escena (GameView.tsx § carcassPending). Solo esta
// habilidad concreta, mismo criterio de nombre-fijo que ya usa `HARVEST_ABILITY_OFICIO` en
// GameView.tsx para el resto de oficios recolectores.
const PASSIVE_ABILITY_NAMES = new Set(['Desollar'])
const PASSIVE_TOOLTIP_SUFFIX = ' Pasiva: no se pulsa — los cadáveres pendientes avisan solos en la escena.'

function AbilityGrid({
  abilities,
  onUse,
  onDetail,
  statusFor,
}: {
  abilities: SavedActionInfo[]
  onUse: (ability: SavedActionInfo) => void
  onDetail: (ability: SavedActionInfo) => void
  statusFor?: (abilityName: string) => RecipeStatusInfo | undefined
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {abilities.map((a) => {
        const status = statusFor?.(a.name)
        const passive = PASSIVE_ABILITY_NAMES.has(a.name)
        const baseTooltip = (statusFor ? readinessTooltip(a.description, status) : a.description) + abilityBonusSuffix(a)
        return (
          <IconCard
            key={a.id}
            icon={a.icon}
            name={a.name}
            tooltip={passive ? `${baseTooltip}${PASSIVE_TOOLTIP_SUFFIX}` : baseTooltip}
            onUse={() => onUse(a)}
            onDetail={() => onDetail(a)}
            disabled={!passive && !!(status && !status.met)}
            passive={passive}
            badge={passive ? <span className="absolute -left-1 -top-1 rounded-full border border-iron-700 bg-wood-950 px-1 text-[9px] text-wood-400">Pasiva</span> : undefined}
          />
        )
      })}
    </div>
  )
}

/// Pop en una subida real de nivel de profesión (2026-08-27, auditoría de diseño/UX § 3.3: "un
/// nivel de profesión que sube... es la misma categoría de evento que subir de nivel de personaje,
/// que sí tiene su chip animado en el header" — mismo patrón "pop counter" que `levelPop`/
/// `deathPop` en GameView.tsx, nunca al montar por primera vez).
function ProfessionLevelLabel({ nivel, label }: { nivel: number; label: string }) {
  const [pop, setPop] = useState(0)
  const prevRef = useRef(nivel)
  useEffect(() => {
    if (prevRef.current !== nivel) {
      setPop((p) => p + 1)
      prevRef.current = nivel
    }
  }, [nivel])

  return (
    <span key={pop} className={`font-mono tabular-nums text-wood-500 ${pop > 0 ? 'animate-pop-once' : ''}`}>
      {label}
    </span>
  )
}

export function HabilidadesPanel({
  savedActions,
  combatSlots,
  activeCombatAbilityNames,
  onChangeActiveCombatAbilityNames,
  professionProgress,
  professionRecipes,
  recipesStatus,
  onUse,
  onCreate,
  onDetail,
}: HabilidadesPanelProps) {
  // Generales primero (2026-08-07, reordenado junto con la pestaña nueva de Profesiones) — el
  // tab por defecto sigue la misma pestaña, para no abrir en una que no sea la resaltada visualmente.
  const [tab, setTab] = useState<SavedActionCategory>('general')
  // Ver la cuadrícula y crear una nueva ya no se muestran a la vez (petición explícita de la
  // usuaria, 2026-07-21) — solo aplica a "general" (combate no tiene formulario de creación).
  const [showCreateForm, setShowCreateForm] = useState(false)

  // "Cinturón de combate" (2026-08-28) — añade/quita un nombre, siempre al final si se añade
  // (arrastrar dentro del cinturón decide el orden después, si el jugador quiere reordenar).
  function toggleActiveCombatAbility(name: string) {
    const next = activeCombatAbilityNames.includes(name)
      ? activeCombatAbilityNames.filter((n) => n !== name)
      : [...activeCombatAbilityNames, name]
    onChangeActiveCombatAbilityNames(next)
  }

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
  // barra + SOLO las recetas ya desbloqueadas de verdad (petición explícita, 2026-08-13: "las
  // habilidades de las cuales no tengamos suficiente nivel en profesión que no salgan, si quieres
  // consultar el listado por nivel vas a la enciclopedia") — antes se mostraban TODAS con un
  // candado; ahora Habilidades es solo lo usable, y la Enciclopedia (§ Crafteo/Construcciones,
  // ambas con su nivel requerido, ver enciclopediaTargets.ts) es el único sitio con el roster
  // completo. Como una receta desbloqueada YA existe como SavedAction real (isStarting:true,
  // creada al subir de nivel — turnResolution.ts), basta con cruzar `inTab` contra
  // professionRecipes por nombre para saber a qué oficio pertenece cada una, sin necesitar ningún
  // objeto de "previsualización" bloqueada.
  const progressByOficio = new Map(professionProgress.map((p) => [p.professionId, p]))
  const creacionProfessions = professions.filter((p) => p.category === 'creacion' && progressByOficio.has(p.id))
  const recipeByAbilityName = new Map(professionRecipes.map((r) => [r.ability.name, r]))
  // Estado de materiales/atributos/ubicación por receta (2026-08-13) — cubre tanto las CON oficio
  // (professionRecipes) como las de reino SIN oficio (REINO_ABILITY_RECIPE_KEY, Campamento/
  // Ayuntamiento). `undefined` = habilidad sin receta asociada (general de siempre), nunca se
  // deshabilita. Clave compuesta `recipeCategory:recipeKey` (auditoría 2026-08-13) — hoy ningún
  // `key` se repite entre CRAFTING_RECIPES y CONSTRUCTION_RECIPES (backend), pero indexar solo por
  // recipeKey mostraría en silencio el estado de la receta equivocada el día que colisionen.
  const statusByRecipeKey = new Map(recipesStatus.map((s) => [`${s.recipeCategory}:${s.recipeKey}`, s]))
  function statusFor(abilityName: string) {
    const matched = recipeByAbilityName.get(abilityName)
    if (matched) return statusByRecipeKey.get(`${matched.recipeCategory}:${matched.recipeKey}`)
    const reinoRecipeKey = REINO_ABILITY_RECIPE_KEY[abilityName]
    return reinoRecipeKey ? statusByRecipeKey.get(`construccion:${reinoRecipeKey}`) : undefined
  }
  // Recetas de construction.ts (recipeCategory 'construccion', ej. la Choza) quedan FUERA de este
  // tab — 2026-08-13, van a la pestaña "Reino" en vez de aquí (ver más abajo), aunque compartan el
  // mismo mecanismo de desbloqueo por nivel de oficio.
  const coveredNames = new Set(
    professionRecipes
      .filter((r) => r.recipeCategory !== 'construccion' && creacionProfessions.some((p) => p.id === r.oficio))
      .map((r) => r.ability.name),
  )
  // Habilidades de oficio ya desbloqueadas que NO pertenecen a ninguna profesión creadora (p.ej.
  // "Preparar antídoto" de sanador, que no tiene categoría en este rediseño) — se siguen mostrando,
  // en un bloque aparte más simple, para no dejarlas invisibles.
  const otherProfessionAbilities = inTab.filter((a) => !coveredNames.has(a.name) && recipeByAbilityName.get(a.name)?.recipeCategory !== 'construccion')

  // Pestaña "Reino" (2026-08-13, petición explícita: "hay que añadir un tab en habilidades para
  // las habilidades de reino") — Campamento/Ayuntamiento (siempre disponibles desde el inicio) y
  // la Choza (una vez desbloqueada por nivel de oficio) ya son `savedActions` reales de categoría
  // 'reino' en cuanto existen — mismo criterio de "solo lo usable" que en Profesiones, arriba.
  const reinoConOficio = inTab.filter((a) => recipeByAbilityName.has(a.name))
  const reinoLibreAcceso = inTab.filter((a) => !recipeByAbilityName.has(a.name))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 border-b border-iron-700">
        <button type="button"
          onClick={() => setTab('general')}
          className={`border-b-2 px-3 py-2 text-sm transition-colors ${
            tab === 'general' ? 'border-accent-500 font-medium text-accent-300' : 'border-transparent text-wood-400 hover:text-wood-200'
          }`}
        >
          Generales
        </button>
        <button type="button"
          onClick={() => setTab('combate')}
          className={`border-b-2 px-3 py-2 text-sm transition-colors ${
            tab === 'combate' ? 'border-accent-500 font-medium text-accent-300' : 'border-transparent text-wood-400 hover:text-wood-200'
          }`}
        >
          Combate
        </button>
        <button type="button"
          onClick={() => setTab('profesion')}
          className={`border-b-2 px-3 py-2 text-sm transition-colors ${
            tab === 'profesion' ? 'border-accent-500 font-medium text-accent-300' : 'border-transparent text-wood-400 hover:text-wood-200'
          }`}
        >
          Profesiones
        </button>
        <button type="button"
          onClick={() => setTab('reino')}
          className={`border-b-2 px-3 py-2 text-sm transition-colors ${
            tab === 'reino' ? 'border-accent-500 font-medium text-accent-300' : 'border-transparent text-wood-400 hover:text-wood-200'
          }`}
        >
          Reino
        </button>
      </div>

      {tab === 'general' && (
        <div className="flex gap-1.5 self-start rounded-lg border border-iron-700 bg-wood-950/40 p-1">
          <button type="button"
            onClick={() => setShowCreateForm(false)}
            className={`rounded-md px-3 py-1 text-xs transition-colors ${
              !showCreateForm ? 'bg-accent-500/15 text-accent-300' : 'text-wood-400 hover:text-wood-200'
            }`}
          >
            Ver habilidades
          </button>
          <button type="button"
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
              return (
                <div key={profession.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-wood-100">{profession.name}</span>
                    <ProfessionLevelLabel
                      nivel={progress.nivel}
                      label={progress.nivel >= MAX_PROFESSION_LEVEL ? `Nivel ${progress.nivel} (máximo)` : `Nivel ${progress.nivel} — ${current}/${span} XP`}
                    />
                  </div>
                  <div className="mb-2 h-1 overflow-hidden rounded-full bg-iron-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400 transition-[width] duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mb-2 text-2xs leading-relaxed text-wood-400">{profession.description}</p>
                  {(() => {
                    const unlockedRecipes = inTab.filter((a) => recipeByAbilityName.get(a.name)?.oficio === profession.id)
                    return unlockedRecipes.length === 0 ? (
                      <p className="text-2xs italic text-wood-600">
                        Todavía sin recetas desbloqueadas — consulta la Enciclopedia § Crafteo para ver el listado completo por nivel.
                      </p>
                    ) : (
                      <AbilityGrid abilities={unlockedRecipes} onUse={onUse} onDetail={onDetail} statusFor={statusFor} />
                    )
                  })()}
                </div>
              )
            })}
            {otherProfessionAbilities.length > 0 && (
              <div>
                <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">Otras habilidades de oficio</p>
                <AbilityGrid abilities={otherProfessionAbilities} onUse={onUse} onDetail={onDetail} statusFor={statusFor} />
              </div>
            )}
          </div>
        )
      ) : tab === 'reino' ? (
        reinoConOficio.length === 0 && reinoLibreAcceso.length === 0 ? (
          <PanelEmptyState
            icon="🏰"
            title="Sin habilidades de reino todavía"
            hint="Levantar un campamento o un ayuntamiento las desbloquea — consulta la Enciclopedia § Construcciones para ver el listado completo por nivel."
          />
        ) : (
          <div className="space-y-5">
            {reinoLibreAcceso.length > 0 && (
              <div>
                <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">Edificios de libre acceso</p>
                <AbilityGrid abilities={reinoLibreAcceso} onUse={onUse} onDetail={onDetail} statusFor={statusFor} />
              </div>
            )}
            {reinoConOficio.length > 0 && (
              <div>
                <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">Edificios que requieren oficio</p>
                <AbilityGrid abilities={reinoConOficio} onUse={onUse} onDetail={onDetail} statusFor={statusFor} />
              </div>
            )}
          </div>
        )
      ) : (
        <>
          <p className="text-2xs text-wood-400">
            {tab === 'combate'
              ? `Aprendidas: ${combatUsed} / ${combatSlots} (2 raciales + 1-2 de arma equipada + 4 de clase) — marca cuáles quieres en el cinturón de combate, abajo.`
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
            // "Cinturón de combate" (2026-08-28, pendiente 2026-08-27 punto 3) — las genéricas
            // siguen solo-consulta (siempre disponibles en combate, nunca ocupan slot); las
            // raciales/de arma y de clase ahora se ACTIVAN/DESACTIVAN con un click (ver
            // CombatAbilityToggleGrid) en vez de solo abrir el detalle — eso se hace con el botón ⓘ.
            <div className="space-y-4">
              <CombatAbilityBelt
                abilities={inTab.filter((a) => !a.isGeneric)}
                activeNames={activeCombatAbilityNames}
                onChange={onChangeActiveCombatAbilityNames}
              />
              {inTab.some((a) => a.isGeneric) && (
                <div>
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">Acciones básicas (siempre disponibles)</p>
                  <AbilityGrid abilities={inTab.filter((a) => a.isGeneric)} onUse={onDetail} onDetail={onDetail} />
                </div>
              )}
              {inTab.some((a) => a.isDynamic && !a.isGeneric) && (
                <div>
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">Raciales y de arma equipada</p>
                  <CombatAbilityToggleGrid
                    abilities={inTab.filter((a) => a.isDynamic && !a.isGeneric)}
                    activeNames={activeCombatAbilityNames}
                    onToggle={toggleActiveCombatAbility}
                    onDetail={onDetail}
                    atMax={activeCombatAbilityNames.length >= 6}
                  />
                </div>
              )}
              {inTab.some((a) => a.isStarting && !a.isDynamic && !a.isGeneric && a.energyCost > 0) && (
                <div>
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">De clase</p>
                  <CombatAbilityToggleGrid
                    abilities={inTab.filter((a) => a.isStarting && !a.isDynamic && !a.isGeneric && a.energyCost > 0)}
                    activeNames={activeCombatAbilityNames}
                    onToggle={toggleActiveCombatAbility}
                    onDetail={onDetail}
                    atMax={activeCombatAbilityNames.length >= 6}
                  />
                </div>
              )}
            </div>
          ) : (
            <AbilityGrid abilities={inTab} onUse={onUse} onDetail={onDetail} />
          )}

          {tab === 'combate' && (
            <PanelSection title="De dónde salen">
              {/* C.13 (checklist frontend 2026-08-27) — párrafo denso reestructurado en lista escaneable,
                  mismo lenguaje visual de badge+texto que el resto del panel. */}
              <ul className="space-y-2 text-xs text-wood-400">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 rounded-full border border-iron-700 bg-iron-800 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-wood-400">
                    Siempre
                  </span>
                  <span>
                    Ataque Básico, Defenderse y Esquivar — cualquier personaje las tiene. Ataque Básico cuesta poca energía y se adapta al arma
                    equipada; Defenderse y Esquivar no cuestan nada y encima recuperan energía.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 rounded-full border border-iron-700 bg-iron-800 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-wood-400">
                    2 raciales
                  </span>
                  <span>Ataque y defensa fijas de tu raza.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 rounded-full border border-iron-700 bg-iron-800 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-wood-400">
                    1-2 de arma
                  </span>
                  <span>
                    Una por categoría distinta en cada mano equipada (2 del mismo tipo dan solo una, pero mejor), + 1 más al alcanzar el nivel
                    avanzado.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 rounded-full border border-iron-700 bg-iron-800 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-wood-400">
                    4 de clase
                  </span>
                  <span>Fijas según tu clase.</span>
                </li>
              </ul>
              <p className="mt-2 text-2xs italic text-wood-500">Ninguna se crea a mano — todas menos Defenderse/Esquivar gastan energía real al usarlas.</p>
            </PanelSection>
          )}
        </>
      )}
    </div>
  )
}
