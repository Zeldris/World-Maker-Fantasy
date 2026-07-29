import { useMemo, useState } from 'react'
import { CONDICION_LABEL } from '../lib/health'
import { attributeLabels, attributeColorClasses } from '../lib/dice'
import { resolveImageUrl, type EnciclopediaResponse } from '../lib/api'
import { resolveCombatAbilities, type ResolvedAbility } from '../lib/npcAbilities'
import { faunaFloraToDetailTarget } from '../lib/enciclopediaTargets'
import { useEnciclopediaLink } from '../context/EnciclopediaLinkContext'
import { HealthBar } from './HealthBar'
import { EnergyBar } from './EnergyBar'
import { MediaSlot } from './ImagePromptDisplay'
import { TooltipAnchor } from './TooltipAnchor'
import type { CombatNpcDisplay } from './CombatComposer'
import type { CondicionFisica, InventoryItemInfo, SavedActionInfo } from '../types'

interface CombatPanelProps {
  /// Nombre del personaje (2026-07-29, "nunca queda claro el estado del enemigo... quiero saber
  /// cómo estamos ambos") — para la barra de estado persistente de abajo.
  playerName: string
  playerCondicion: CondicionFisica
  /// Sistema de fatiga (2026-07-29) — para la barra de energía junto a la de salud y para
  /// deshabilitar/marcar el coste de las habilidades que no alcanzan.
  energia: number
  energiaMax: number
  npcs: CombatNpcDisplay[]
  selectedNpcSlug: string | null
  onSelectNpc: (slug: string) => void
  combatAbilities: SavedActionInfo[]
  selectedAbilityId: string | null
  onSelectAbility: (id: string | null) => void
  combatItems: InventoryItemInfo[]
  selectedItemId: string | null
  onSelectItem: (id: string | null) => void
  busy: boolean
  ended: boolean
  /// Rediseño del turno de combate (2026-07-28) — true cuando el NPC ganó la iniciativa del
  /// intercambio y el jugador debe elegir su defensa a ciegas: oculta objetivos/Huir/objetos y
  /// cambia la etiqueta del botón de acción.
  awaitingDefense: boolean
  /// Rediseño del turno de combate (2026-07-29, "quiero que sea más claro cuando es turno de
  /// ataque... indicándome qué salió en los dados para saber por qué ataco primero") — tirada real
  /// de iniciativa del último turno resuelto; null si se forzó sin dados o aún no hay ninguna.
  lastInitiativeRoll: { ganador: 'jugador' | 'npc'; jugadorTirada: number; npcTirada: number } | null
  onActuar: () => void
  onRegistrar: (npc: CombatNpcDisplay) => void
  onHuir: () => void
  onContinue: () => void
  onAbilityDetail: (ability: SavedActionInfo) => void
  onItemDetail: (item: InventoryItemInfo) => void
  enciclopedia: EnciclopediaResponse | null
}

/// Chip de habilidad de solo lectura (las del enemigo) — tooltip estilizado con la descripción
/// (rediseño de la vista de combate, 2026-07-28, petición explícita: "no falta un hover que
/// muestre la descripción") + icono "ⓘ" para abrir su ficha completa en la Enciclopedia, si tiene
/// una página real a la que enlazar (`detailTarget`, ver npcAbilities.ts).
function AbilityChip({ ability, onDetail }: { ability: ResolvedAbility; onDetail: (target: NonNullable<ResolvedAbility['detailTarget']>) => void }) {
  // Rediseño del turno de combate (2026-07-28, petición explícita: "añadir color por
  // estadística para que sea más claro") — el borde marca el "tipo" de la habilidad de un
  // vistazo, el mismo color que en el árbol de debilidades de la Enciclopedia.
  const colors = attributeColorClasses[ability.preferredAttribute]
  return (
    <span className={`flex items-center gap-1 rounded-lg border ${colors.border} bg-wood-950/40 px-2 py-1 text-2xs text-wood-300`}>
      <TooltipAnchor text={ability.description} className="flex items-center gap-1">
        <span aria-hidden="true">{ability.icon}</span> <span className={colors.text}>{ability.name}</span>
      </TooltipAnchor>
      {ability.detailTarget && (
        <button
          type="button"
          onClick={() => onDetail(ability.detailTarget!)}
          aria-label={`Consultar ${ability.name} en la Enciclopedia`}
          className="tactile flex h-4 w-4 items-center justify-center rounded-full border border-iron-700 text-2xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
        >
          ⓘ
        </button>
      )}
    </span>
  )
}

/// Ficha de un enemigo — imagen, rol/facción/nivel, bio, atributos y habilidades resueltas
/// (rediseño de la vista de combate, 2026-07-28, petición explícita: "que al enemigo que clickeas
/// carge la imagen de este con una ficha de personaje con sus habilidades, pequeña descipción y
/// estadísticas"). Busca el enemigo por slug tanto en `npcs` (humanoides) como en `faunaFlora`
/// (fauna) — mismo slug que usa el motor de escena para los dos, ver worldCatalog.ts.
function EnemyFicha({
  slug,
  enciclopedia,
  onDetail,
}: {
  slug: string
  enciclopedia: EnciclopediaResponse | null
  onDetail: (target: NonNullable<ResolvedAbility['detailTarget']>) => void
}) {
  const [infoExpanded, setInfoExpanded] = useState(true)
  const target = useMemo(() => {
    if (!enciclopedia) return null
    const npc = enciclopedia.npcs.find((n) => n.slug === slug)
    if (npc) {
      return {
        name: npc.name,
        meta: `${npc.role}${npc.faction ? ` — ${npc.faction}` : ''} · nivel ${npc.level}`,
        bio: npc.bio,
        imageUrl: resolveImageUrl(npc.imageUrls.banner),
        attributes: npc.attributes,
        abilities: resolveCombatAbilities({ level: npc.level, ataqueBase: npc.ataqueBase, raza: npc.raza, clase: npc.clase }, enciclopedia),
      }
    }
    const fauna = enciclopedia.faunaFlora.find((f) => f.sourceSlug === slug)
    if (fauna) {
      return {
        name: fauna.sourceName,
        meta: 'Fauna',
        bio: fauna.description ?? '',
        imageUrl: resolveImageUrl(fauna.imageUrls.banner),
        attributes: fauna.attributes ?? null,
        abilities: resolveCombatAbilities(
          { ataqueBase: fauna.ataqueBase, habilidadesRaciales: fauna.habilidadesRaciales, selfTarget: faunaFloraToDetailTarget(fauna) },
          enciclopedia,
        ),
      }
    }
    return null
  }, [enciclopedia, slug])

  if (!target) return null

  return (
    <div className="space-y-2.5">
      <h3 className="font-serif text-base text-wood-100">{target.name}</h3>
      {/* Colapsable (petición explícita, 2026-07-28: "que sea colapsable con un Legend que sea
          'Información'... también las estadísticas y habilidades del NPC") — mismo patrón visual
          que las clases colapsables de EnciclopediaPanel.tsx (cabecera con flecha que rota +
          contenido que aparece/desaparece debajo). Imagen/meta/bio/atributos/habilidades del
          enemigo viven todos aquí dentro — todo es "sobre él", nada usable por el jugador.*/}
      <div className="rounded-lg border border-iron-800">
        <button
          type="button"
          onClick={() => setInfoExpanded((v) => !v)}
          className="tactile flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-wood-950/40"
        >
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-wood-500">Información</p>
          <span className={`shrink-0 text-wood-500 transition-transform ${infoExpanded ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {infoExpanded && (
          <div className="space-y-2.5 border-t border-iron-800 px-2.5 py-2.5">
            {/* Mismo recorte que el banner de narración (LogPanel.tsx) — petición explícita:
                "que se vea bien como en la narración". `MediaSlot` (h-40, object-top) recortaba
                mal algunas imágenes; este aspect-ratio ancho es el que ya se ve bien en el log. */}
            {target.imageUrl ? (
              <div className="overflow-hidden rounded-lg border border-iron-700 bg-wood-950/60">
                <img src={target.imageUrl} alt="" className="aspect-[2.5/1] w-full object-cover" />
              </div>
            ) : (
              <MediaSlot icon="⚔️" variant="placeholder" />
            )}
            <p className="text-2xs uppercase tracking-[0.1em] text-wood-500">{target.meta}</p>
            {target.bio && <p className="text-xs leading-relaxed text-wood-300">{target.bio}</p>}
            {target.attributes && (
              <div>
                <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-wood-500">Estadísticas</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(target.attributes) as (keyof typeof target.attributes)[]).map((attr) => (
                    <span
                      key={attr}
                      className={`rounded-full border ${attributeColorClasses[attr].border} bg-wood-950/50 px-2 py-0.5 font-mono text-2xs ${attributeColorClasses[attr].text}`}
                    >
                      {attributeLabels[attr]} {target.attributes![attr]}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {target.abilities.length > 0 && (
              <div>
                <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-wood-500">Habilidades</p>
                <div className="flex flex-wrap gap-1.5">
                  {target.abilities.map((ability, i) => (
                    <AbilityChip key={`${ability.name}-${i}`} ability={ability} onDetail={onDetail} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/// Sustituye al LogPanel "El mundo" mientras dura el combate (rediseño de la vista de combate,
/// 2026-07-28, petición explícita: "quiero que la sección de combate salga sustituyendo a los
/// logs de mundo"). Absorbe todo lo que antes vivía en CombatComposer.tsx salvo el texto libre,
/// que se queda en la barra inferior (petición explícita: "la barra de abajo queda libre para el
/// texto") — el estado de selección vive en GameView.tsx, compartido entre este panel y esa barra.
export function CombatPanel({
  playerName,
  playerCondicion,
  energia,
  energiaMax,
  npcs,
  selectedNpcSlug,
  onSelectNpc,
  combatAbilities,
  selectedAbilityId,
  onSelectAbility,
  combatItems,
  selectedItemId,
  onSelectItem,
  busy,
  ended,
  awaitingDefense,
  lastInitiativeRoll,
  onActuar,
  onRegistrar,
  onHuir,
  onContinue,
  onAbilityDetail,
  onItemDetail,
  enciclopedia,
}: CombatPanelProps) {
  const { onEntityDetail } = useEnciclopediaLink()

  return (
    <section className="plank-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
      <header className="relative flex items-center justify-between gap-2.5 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="gem animate-gem-breathe" />
          <h2 className="font-serif text-sm tracking-wide text-danger-400">⚔️ Combate</h2>
        </div>
        {!ended && !awaitingDefense && (
          <button onClick={onHuir} disabled={busy} className="text-2xs text-wood-400 transition-colors hover:text-accent-300 disabled:opacity-50">
            Huir
          </button>
        )}
      </header>

      {/* Barra de estado persistente (2026-07-29, "nunca queda claro el estado del enemigo...
          quiero saber cómo estamos ambos") — a diferencia de la lista de "Enemigos" de abajo,
          esta NUNCA se oculta en awaitingDefense: es justo cuando más falta hace verla. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-iron-800 px-4 pb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="max-w-24 truncate text-2xs text-wood-400">{playerName}</span>
          <HealthBar condicionFisica={playerCondicion} />
          <EnergyBar energia={energia} energiaMax={energiaMax} />
        </div>
        {npcs.map((npc) => (
          <div key={npc.slug} className="flex items-center gap-1.5">
            <span className="max-w-24 truncate text-2xs text-wood-400">{npc.name}</span>
            <HealthBar condicionFisica={npc.condicion} />
          </div>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {awaitingDefense && (
          // Rediseño del turno de combate (2026-07-28, petición explícita: "turno de defensa
          // donde elige una habilidad a ciegas") — sin objetivo que elegir, es reactivo: el NPC
          // ya decidió su ataque, oculto, y espera la respuesta del jugador.
          <div className="rounded-lg border border-danger-600/50 bg-danger-500/10 px-3 py-2 text-xs text-danger-200">
            ⚔️ Un enemigo actúa primero — elige a ciegas cómo defenderte.
          </div>
        )}

        {!awaitingDefense && lastInitiativeRoll && (
          // Equivalente en el turno de ATAQUE al banner de arriba (2026-07-29, "el de defensa es
          // claro pero el de ataque no tanto, indícame qué salió en los dados") — mismos números
          // reales que decidieron la iniciativa, para que quede claro por qué te toca golpear
          // primero (o, si perdiste la tirada, por qué el próximo turno será de defensa a ciegas).
          <div className="rounded-lg border border-accent-600/40 bg-accent-500/5 px-3 py-2 text-xs text-wood-300">
            🎲 Iniciativa: tú {lastInitiativeRoll.jugadorTirada} vs {lastInitiativeRoll.npcTirada} del enemigo —{' '}
            {lastInitiativeRoll.ganador === 'jugador' ? 'actúas primero.' : 'el enemigo actuará primero en tu próximo turno.'}
          </div>
        )}

        {!awaitingDefense && (
          <div>
            <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-wood-500">Enemigos</p>
            <div className="grid grid-cols-2 gap-2">
              {npcs.map((npc) => {
                const npcEnciclopedia =
                  enciclopedia?.npcs.find((n) => n.slug === npc.slug) ?? enciclopedia?.faunaFlora.find((f) => f.sourceSlug === npc.slug)
                const thumbnail = npcEnciclopedia ? resolveImageUrl(npcEnciclopedia.imageUrls.thumbnail ?? npcEnciclopedia.imageUrls.banner) : null
                return (
                  <button
                    key={npc.slug}
                    type="button"
                    disabled={busy}
                    onClick={() => onSelectNpc(npc.slug)}
                    className={`tactile flex items-center gap-2 rounded-lg border p-1.5 text-left text-xs transition-colors disabled:opacity-60 ${
                      selectedNpcSlug === npc.slug ? 'border-accent-500 bg-accent-500/15' : 'border-iron-700 bg-wood-950/40 hover:border-accent-600/40'
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-wood-950/60">
                      {thumbnail ? <img src={thumbnail} alt="" className="h-full w-full object-cover" /> : <span aria-hidden="true">⚔️</span>}
                    </span>
                    <span className="min-w-0">
                      <p className="truncate font-medium text-wood-100">{npc.name}</p>
                      <p className="text-2xs text-wood-400">{CONDICION_LABEL[npc.condicion]}</p>
                      {npc.condicion === 'INCAPACITADO' &&
                        (npc.yaSaqueado ? (
                          <span className="text-2xs text-wood-500">Ya saqueado</span>
                        ) : (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation()
                              onRegistrar(npc)
                            }}
                            className="inline-block text-2xs text-accent-300 underline"
                          >
                            Registrar
                          </span>
                        ))}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {!awaitingDefense && selectedNpcSlug && (
          <EnemyFicha
            slug={selectedNpcSlug}
            enciclopedia={enciclopedia}
            onDetail={(target) => onEntityDetail?.(target)}
          />
        )}

        {!ended && (combatAbilities.length > 0 || (!awaitingDefense && combatItems.length > 0)) && (
          // Bloque "usable" (petición explícita, 2026-07-28: "que destaque más... más claro que
          // son los elementos usables") — mismo tono accent que ya marca selección/foco en el
          // resto de la app, pero aquí permanente (no solo al seleccionar), para separarlo de
          // limpio de las secciones puramente informativas de arriba (Enemigos/Información).
          // En defensa a ciegas solo se ofrecen habilidades (petición explícita: "elige una
          // habilidad" para la "contra") — los objetos consumibles se ocultan en este sub-modo.
          <div className="space-y-2.5 rounded-lg border border-accent-600/50 bg-accent-500/5 p-2.5">
            {combatAbilities.length > 0 && (
              <div>
                <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-accent-300">
                  {awaitingDefense ? '🛡️ Elige cómo defenderte' : '⚡ Tus habilidades'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {combatAbilities.map((a) => {
                    // Null en habilidades 'general' o en partidas de antes de este campo — cae de
                    // vuelta al borde accent genérico de siempre, sin tinte de tipo.
                    const colors = a.preferredAttribute ? attributeColorClasses[a.preferredAttribute] : null
                    // Sistema de fatiga (2026-07-29, "aparecerá deshabilitada y solo podrás usar
                    // ataques normales o consumibles") — sin energía suficiente, el botón se
                    // deshabilita en vez de dejar elegirla.
                    const sinEnergia = a.energyCost > energia
                    return (
                      <span
                        key={a.id}
                        className={`flex items-center gap-1 rounded-lg border ${colors?.border ?? 'border-accent-600/40'} bg-wood-950/60 px-2 py-1 text-2xs ${
                          sinEnergia ? 'opacity-50' : ''
                        }`}
                      >
                        <TooltipAnchor text={a.description} className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              onSelectAbility(a.id)
                              onSelectItem(null)
                            }}
                            disabled={busy || sinEnergia}
                            title={sinEnergia ? 'No tienes energía suficiente' : undefined}
                            className={`tactile flex items-center gap-1 rounded-md px-1 py-0.5 text-2xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                              selectedAbilityId === a.id ? 'bg-accent-500/30 text-accent-100' : (colors?.text ?? 'text-wood-200')
                            }`}
                          >
                            <span>{a.icon}</span> {a.name}
                            {a.energyCost > 0 && <span className="font-mono text-wood-500">⚡{a.energyCost}</span>}
                          </button>
                        </TooltipAnchor>
                        <button
                          type="button"
                          onClick={() => onAbilityDetail(a)}
                          aria-label={`Consultar ${a.name} en la Enciclopedia`}
                          className="tactile flex h-4 w-4 items-center justify-center rounded-full border border-iron-700 text-2xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
                        >
                          ⓘ
                        </button>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
            {!awaitingDefense && combatItems.length > 0 && (
              <div>
                <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-accent-300">⚡ Tus objetos</p>
                <div className="flex flex-wrap gap-1.5">
                  {combatItems.map((item) => (
                    <span key={item.id} className="flex items-center gap-1 rounded-lg border border-accent-600/40 bg-wood-950/60 px-2 py-1 text-2xs">
                      <TooltipAnchor text={item.description} className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            onSelectItem(item.id)
                            onSelectAbility(null)
                          }}
                          disabled={busy}
                          className={`tactile flex items-center gap-1 rounded-md px-1 py-0.5 text-2xs transition-colors disabled:opacity-60 ${
                            selectedItemId === item.id ? 'bg-accent-500/30 text-accent-100' : 'text-wood-200'
                          }`}
                        >
                          <span>🎒</span> {item.name}
                        </button>
                      </TooltipAnchor>
                      <button
                        type="button"
                        onClick={() => onItemDetail(item)}
                        aria-label={`Consultar ${item.name} en la Enciclopedia`}
                        className="tactile flex h-4 w-4 items-center justify-center rounded-full border border-iron-700 text-2xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
                      >
                        ⓘ
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {!ended && (
          <button
            onClick={onActuar}
            disabled={busy || (awaitingDefense ? !selectedAbilityId : !selectedAbilityId && !selectedItemId)}
            className="tactile w-full rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
          >
            {awaitingDefense ? 'Defenderte' : 'Actuar'}
          </button>
        )}

        {ended && (
          <button
            onClick={onContinue}
            className="tactile w-full rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
          >
            Continuar
          </button>
        )}
      </div>
    </section>
  )
}
