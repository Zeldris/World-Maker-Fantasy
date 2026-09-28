import { useEffect, useMemo, useRef, useState } from 'react'
import { CONDICION_LABEL } from '../lib/health'
import { attributeLabels, attributeColorClasses, attributeAbbr } from '../lib/dice'
import { recommendedAttributeAgainst } from '../lib/attributeWheel'
import { resolveImageUrl, type EnciclopediaResponse } from '../lib/api'
import { resolveCombatAbilities } from '../lib/npcAbilities'
import { faunaFloraToDetailTarget } from '../lib/enciclopediaTargets'
import { useEnciclopediaLink } from '../context/useEnciclopediaLink'
import { HealthBar } from './HealthBar'
import { MediaSlot } from './ImagePromptDisplay'
import { TooltipAnchor } from './TooltipAnchor'
import { CombatSelectionModal } from './CombatSelectionModal'
import { DiceRollVs } from './DiceRoll'
import type { CombatNpcDisplay } from './CombatComposer'
import { combatKeyFor, combatDisplayNameFor } from '../lib/gameViewHelpers'
import type { ActiveEffect, AttributeBlock, CondicionFisica, InitiativeRollInfo, InventoryItemInfo, SavedActionInfo } from '../types'

interface CombatPanelProps {
  playerCondicion: CondicionFisica
  /// Fase 2 de efectos de clase (2026-08-27, indicador de combate — auditoría de diseño/UX
  /// 2026-08-27 § 2.1) — AUMENTO/DEBILIDAD activos del jugador ahora mismo.
  playerActiveEffects: ActiveEffect[]
  /// Rediseño de combate (2026-08-09, "Analizar rival") — para calcular el atributo recomendado
  /// contra el rival ya analizado (EnemyFicha), sin depender de ningún endpoint nuevo.
  playerAttributes: AttributeBlock
  /// Sistema de fatiga (2026-07-29) — para deshabilitar/marcar el coste de las habilidades que no
  /// alcanzan. Vida/energía propias quitadas de la barra de estado de aquí (petición explícita,
  /// 2026-08-15: "ya lo tenemos en la parte superior") — `energiaMax` ya no hace falta aquí, solo
  /// Personaje > Estadísticas la sigue usando.
  energia: number
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
  /// Bug real jugando en vivo (2026-08-27, "he perdido un combate...me sale victoria") — un
  /// respawn sobrevivible deja `playerCondicion` de vuelta en ILESO (turnResolution.ts § MUERTO),
  /// así que este panel no tenía ninguna señal propia para distinguir "morí y respawneé DENTRO de
  /// este combate" de "gané limpio". Ver `combatPlayerJustDied`, useCombatFlow.ts.
  playerJustDied: boolean
  /// CONVALECIENTE deja de ser "victoria automática" (2026-08-26) — mismo criterio que
  /// `CombatComposer.pendingDecisions`: bloquea también las acciones propias de este panel
  /// (Huir/habilidades/objetos/Actuar) mientras quede algún rival CONVALECIENTE sin resolver.
  pendingDecisions?: boolean
  /// Rediseño del turno de combate (2026-07-28) — true cuando el NPC ganó la iniciativa del
  /// intercambio y el jugador debe elegir su defensa a ciegas: oculta objetivos/Huir/objetos y
  /// cambia la etiqueta del botón de acción.
  awaitingDefense: boolean
  /// Rediseño del turno de combate (2026-07-29, "quiero que sea más claro cuando es turno de
  /// ataque... indicándome qué salió en los dados para saber por qué ataco primero") — tirada real
  /// de iniciativa del último turno resuelto; null si se forzó sin dados o aún no hay ninguna.
  lastInitiativeRoll: InitiativeRollInfo | null
  onActuar: () => void
  onRegistrar: (npc: CombatNpcDisplay) => void
  onHuir: () => void
  onContinue: () => void
  /// Resumen de combate (petición explícita, 2026-07-30, ajustado tras probarlo en vivo: "si le
  /// doy a saquear me tiene que aparecer todos los objetos a saquear y que pueda marcar los que
  /// me quiero quedar") — se llama con los NOMBRES ya confirmados desde el modal de selección
  /// (ver más abajo); el backend solo copia esos objetos concretos, no el loadout entero.
  /// `fullyLootedSlugs` (2026-07-31, saqueo parcial: "si no saqueas todo el botón sigue") — los
  /// NPC de los que se marcaron TODOS sus objetos conocidos, no solo alguno — el caller solo
  /// puede marcarlos `yaSaqueado` a ellos, dejando el resto disponible para una visita posterior.
  onSaquearSeleccion: (itemNames: string[], fullyLootedSlugs: string[], itemNamesByNpc: Record<string, string[]>) => void
  onAbilityDetail: (ability: SavedActionInfo) => void
  onItemDetail: (item: InventoryItemInfo) => void
  enciclopedia: EnciclopediaResponse | null
  /// Colapsar este panel (2026-08-14, petición explícita: "lo mismo con las de combate" — el
  /// mismo colapsar/expandir de los logs de personaje/mundo, también cuando este panel sustituye
  /// al de "El mundo" durante un combate). Sin `onCollapse`, no sale ningún botón.
  onCollapse?: () => void
  collapseIcon?: string
}

/// Fase 2 de efectos de clase (2026-08-27, auditoría de diseño/UX 2026-08-27 § 2.1: "un AUMENTO/
/// DEBILIDAD activo cambia `side.value` sin que nada en la cadena lo señale — es el único
/// ingrediente de la fórmula que hoy queda mudo") — un chip por efecto activo, mismo criterio de
/// "siempre visible" que ya justifica que la barra de estado de aquí nunca se oculte. ↑ verde para
/// AUMENTO, ↓ rojo para DEBILIDAD, color del propio atributo afectado (mismo `attributeColorClasses`
/// que el resto de la app) para que se lea como parte de la misma cadena causal que ya conoce el
/// tooltip de malus por condición física, no como un sistema nuevo aparte.
function ActiveEffectChips({ effects }: { effects: ActiveEffect[] }) {
  if (effects.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {effects.map((effect, i) => (
        <TooltipAnchor
          key={`${effect.attribute}-${effect.sourceAbility}-${i}`}
          text={`${effect.sourceAbility}: ${effect.magnitude > 0 ? '+' : ''}${effect.magnitude} ${attributeLabels[effect.attribute]}, ${effect.turnsRemaining} turno${effect.turnsRemaining === 1 ? '' : 's'} restante${effect.turnsRemaining === 1 ? '' : 's'}.`}
        >
          <span
            className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-mono text-2xs ${attributeColorClasses[effect.attribute].border} ${attributeColorClasses[effect.attribute].bg} ${effect.magnitude > 0 ? 'text-moss-400' : 'text-danger-400'}`}
          >
            {effect.magnitude > 0 ? '↑' : '↓'}
            <span className={attributeColorClasses[effect.attribute].text}>{attributeAbbr[effect.attribute]}</span>
            <span className="text-wood-500">{effect.turnsRemaining}</span>
          </span>
        </TooltipAnchor>
      ))}
    </div>
  )
}

/// Ficha de un enemigo — imagen, rol/facción/nivel, bio y (solo si ya se analizó) el atributo
/// recomendado contra él (rediseño de combate, 2026-08-09, petición explícita: "las habilidades
/// del enemigo y sus stats ahora se ven por defecto, eso lo vamos a cambiar... cuando se usen
/// habilidades de tipo utilidad como 'Analizar rival'... lo desbloquea indicándote qué atributo es
/// el recomendado usar contra el rival"). Antes mostraba SIEMPRE estadísticas y habilidades
/// completas sin coste ninguno — ahora la ficha no revela nada de eso hasta usar Analizar rival
/// con éxito (`NpcInScene.analizado`, backend), y ni entonces vuelve a mostrar el roster completo,
/// solo el atributo recomendado. Busca el enemigo por slug tanto en `npcs` (humanoides) como en
/// `faunaFlora` (fauna) — mismo slug que usa el motor de escena para los dos, ver worldCatalog.ts.
function EnemyFicha({
  slug,
  analizado,
  playerAttributes,
  enciclopedia,
}: {
  slug: string
  analizado: boolean
  playerAttributes: AttributeBlock
  enciclopedia: EnciclopediaResponse | null
}) {
  const [infoExpanded, setInfoExpanded] = useState(true)
  // Pestañas Información/Análisis (2026-08-12, petición explícita: "el resultado de analizar a un
  // rival que salga en otro tab que será 'Análisis'... aparecerá vacía mientras no uses una
  // habilidad de análisis") — antes el atributo recomendado (o su placeholder) vivía mezclado con
  // imagen/bio dentro del mismo bloque "Información", sin distinguir "sobre el rival" de
  // "lo que YO he descubierto sobre él con Analizar rival".
  const [fichaTab, setFichaTab] = useState<'info' | 'analisis'>('info')
  const { onEntityDetail } = useEnciclopediaLink()
  const target = useMemo(() => {
    if (!enciclopedia) return null
    const npc = enciclopedia.npcs.find((n) => n.slug === slug)
    if (npc) {
      return {
        name: npc.name,
        meta: `${npc.role}${npc.faction ? ` — ${npc.faction}` : ''} · nivel ${npc.level}`,
        bio: npc.bio,
        // Bug real jugando en vivo (2026-08-08, habilidad "Cazar" nueva): con Corretolvas en
        // combate, la ficha se quedó sin imagen — `imageUrls.banner` es null cuando la especie
        // solo tiene subida la variante de sexo (aquí, solo "macho"), mismo hueco ya arreglado en
        // 2026-07-24 para el banner bajo la narración (`mentionedEntityBanner.ts` §
        // resolveBannerUrl) pero nunca portado a esta ficha, escrita 4 días después sin el mismo
        // fallback.
        imageUrl: resolveImageUrl(npc.variantesSexo?.[0]?.imageUrls.banner ?? npc.imageUrls.banner),
        attributes: npc.attributes,
        // Petición explícita (2026-08-13): "al analizar al enemigo no sale ni sus attrs ni sus
        // habilidades" — `resolveCombatAbilities` (lib/npcAbilities.ts) ya existía, escrita para
        // esto mismo, pero nunca se llamó desde ningún sitio real. Humanoide: se resuelve por
        // clase/raza (catálogos ya en la Enciclopedia), no por `habilidadesRaciales` (eso es solo
        // de fauna).
        abilities: resolveCombatAbilities(
          { level: npc.level, ataqueBase: npc.ataqueBase, raza: npc.raza, clase: npc.clase },
          enciclopedia,
        ),
      }
    }
    const fauna = enciclopedia.faunaFlora.find((f) => f.sourceSlug === slug)
    if (fauna) {
      return {
        name: fauna.sourceName,
        meta: 'Fauna',
        bio: fauna.description ?? '',
        imageUrl: resolveImageUrl(fauna.variantesSexo?.[0]?.imageUrls.banner ?? fauna.imageUrls.banner),
        attributes: fauna.attributes ?? null,
        abilities: resolveCombatAbilities(
          { level: fauna.level ?? undefined, ataqueBase: fauna.ataqueBase, habilidadesRaciales: fauna.habilidadesRaciales, selfTarget: faunaFloraToDetailTarget(fauna) },
          enciclopedia,
        ),
      }
    }
    return null
  }, [enciclopedia, slug])

  if (!target) return null

  const atributoRecomendado = analizado && target.attributes ? recommendedAttributeAgainst(playerAttributes, target.attributes) : null

  return (
    <div className="space-y-2.5">
      <h3 className="font-serif text-base text-wood-100">{target.name}</h3>
      {/* Colapsable (petición explícita, 2026-07-28: "que sea colapsable con un Legend que sea
          'Información'") — mismo patrón visual que las clases colapsables de EnciclopediaPanel.tsx
          (cabecera con flecha que rota + contenido que aparece/desaparece debajo). */}
      <div className="rounded-lg border border-iron-800">
        <button
          type="button"
          onClick={() => setInfoExpanded((v) => !v)}
          className="tactile flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-wood-950/40"
        >
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-wood-500">Ficha del rival</p>
          <span className={`shrink-0 text-wood-500 transition-transform ${infoExpanded ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {infoExpanded && (
          <div className="border-t border-iron-800">
            {/* Mismo patrón visual de pestañas que HabilidadesPanel.tsx (borde inferior que se
                enciende en la activa). */}
            <div className="flex gap-1 px-2.5 pt-1.5">
              <button
                type="button"
                onClick={() => setFichaTab('info')}
                className={`border-b-2 px-2 py-1 text-2xs transition-colors ${
                  fichaTab === 'info' ? 'border-accent-500 font-medium text-accent-300' : 'border-transparent text-wood-500 hover:text-wood-300'
                }`}
              >
                Información
              </button>
              <button
                type="button"
                onClick={() => setFichaTab('analisis')}
                className={`border-b-2 px-2 py-1 text-2xs transition-colors ${
                  fichaTab === 'analisis' ? 'border-accent-500 font-medium text-accent-300' : 'border-transparent text-wood-500 hover:text-wood-300'
                }`}
              >
                Análisis
              </button>
            </div>
            <div className="space-y-2.5 border-t border-iron-800 px-2.5 py-2.5">
              {fichaTab === 'info' ? (
                <>
                  {/* Mismo recorte que el banner de narración (LogPanel.tsx) — petición explícita:
                      "que se vea bien como en la narración". `MediaSlot` (h-40, object-top)
                      recortaba mal algunas imágenes; este aspect-ratio ancho es el que ya se ve
                      bien en el log. */}
                  {target.imageUrl ? (
                    <div className="overflow-hidden rounded-lg border border-iron-700 bg-wood-950/60">
                      <img src={target.imageUrl} alt="" className="aspect-[2.5/1] w-full object-cover" />
                    </div>
                  ) : (
                    <MediaSlot icon="⚔️" variant="placeholder" />
                  )}
                  <p className="text-2xs uppercase tracking-[0.1em] text-wood-500">{target.meta}</p>
                  {target.bio && <p className="text-xs leading-relaxed text-wood-300">{target.bio}</p>}
                </>
              ) : atributoRecomendado ? (
                <>
                  {/* Tarjeta propia, no solo texto suelto (petición explícita, 2026-08-14: "se ve
                      algo mal") — mismo tratamiento que la rejilla de atributos/habilidades de
                      abajo, para que el resultado principal del análisis no quede desnudo frente
                      al resto de bloques ya recuadrados de esta pestaña. */}
                  <p
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${attributeColorClasses[atributoRecomendado].border} ${attributeColorClasses[atributoRecomendado].bg}`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${attributeColorClasses[atributoRecomendado].dot}`} aria-hidden="true" />
                    <span className="font-semibold uppercase tracking-[0.08em] text-wood-400">Atributo recomendado</span>
                    <span className={`ml-auto font-semibold ${attributeColorClasses[atributoRecomendado].text}`}>
                      {attributeLabels[atributoRecomendado]}
                    </span>
                  </p>
                  {/* Atributos + habilidades del rival (2026-08-13, petición explícita: "al
                      analizar al enemigo no sale ni sus attrs ni sus habilidades") — solo se
                      revelan aquí, tras un análisis con éxito, nunca antes (mismo criterio que el
                      atributo recomendado de arriba). */}
                  {target.attributes && (
                    <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 rounded-lg border border-iron-800 bg-wood-950/40 p-2.5">
                      {/* Orden fijo (petición explícita, 2026-08-14: "se ve algo mal") — antes
                          `Object.entries` seguía el orden de inserción del JSON tal cual llegaba
                          del backend, que no coincide con el resto de la app (AttributeBars.tsx,
                          etc.): la rejilla salía revuelta (ARC/FUE/CAR, DES/VOL/CON, INT...) en
                          vez de en el mismo orden reconocible de siempre. */}
                      {(Object.keys(attributeLabels) as (keyof typeof attributeLabels)[])
                        .filter((attr) => target.attributes![attr] !== undefined)
                        .map((attr) => (
                          <p key={attr} className={`flex items-center gap-1.5 text-2xs ${attributeColorClasses[attr].text}`}>
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${attributeColorClasses[attr].dot}`} aria-hidden="true" />
                            <span className="text-wood-400">{attributeAbbr[attr]}</span>
                            <span className="font-mono font-semibold text-wood-200">{target.attributes![attr]}</span>
                          </p>
                        ))}
                    </div>
                  )}
                  {target.abilities.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-wood-500">Habilidades</p>
                      {target.abilities.map((a, i) => (
                        <div key={`${a.name}-${i}`} className="flex items-start gap-2 rounded-lg border border-iron-800 bg-wood-950/40 p-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-wood-800 text-xs" aria-hidden="true">
                            {a.icon}
                          </span>
                          <span className="min-w-0 flex-1 text-2xs">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-wood-200">{a.name}</span>
                              <span className={`inline-flex items-center gap-1 font-mono ${attributeColorClasses[a.preferredAttribute].text}`}>
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${attributeColorClasses[a.preferredAttribute].dot}`} aria-hidden="true" />
                                {attributeAbbr[a.preferredAttribute]}
                              </span>
                              {/* Efecto mecánico real (bug real, 2026-08-30: "en las descripciones
                                  de las habilidades no están saliendo los efectos reales") —
                                  gateado tras Análisis (mismo bloque que el atributo recomendado de
                                  arriba, nunca visible de antemano como en la Enciclopedia,
                                  decisión explícita de la usuaria). Solo habilidades de clase
                                  llevan estos datos — raciales/ataque base se quedan sin chip. */}
                              {!!a.attributeBonus && (
                                <span className="inline-flex items-center gap-0.5 font-mono text-moss-400" title="Bono fijo de esta habilidad, ya sumado a su tirada">
                                  +{a.attributeBonus}
                                </span>
                              )}
                            </span>
                            {!!a.effects && a.effects.length > 0 && (
                              <span className="mt-0.5 flex flex-wrap gap-1">
                                {a.effects.map((effect) => (
                                  <span key={effect} className="rounded-full border border-iron-700 px-1 font-mono text-2xs text-wood-500">
                                    {effect}
                                  </span>
                                ))}
                              </span>
                            )}
                            <span className="mt-0.5 block leading-snug text-wood-400">{a.description}</span>
                          </span>
                          {a.detailTarget && (
                            <button
                              type="button"
                              onClick={() => onEntityDetail?.(a.detailTarget!)}
                              aria-label={`Consultar ${a.name} en la Enciclopedia`}
                              className="tactile flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-iron-700 bg-wood-950/70 text-2xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
                            >
                              ⓘ
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-2xs italic text-wood-500">Analiza al rival para descubrir qué atributo conviene usar contra él.</p>
              )}
            </div>
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
  playerCondicion,
  playerActiveEffects,
  playerAttributes,
  energia,
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
  playerJustDied,
  pendingDecisions,
  awaitingDefense,
  lastInitiativeRoll,
  onActuar,
  onRegistrar,
  onHuir,
  onContinue,
  onSaquearSeleccion,
  onAbilityDetail,
  onItemDetail,
  enciclopedia,
  onCollapse,
  collapseIcon,
}: CombatPanelProps) {
  // Modal de selección (petición explícita, 2026-07-30, tras probar en vivo "Saquear todo" de un
  // solo clic: "tienes que marcar todos aquellos que quieras... un popup donde marcando con
  // checkbox puedas elegir y confirmarlo o cancelarlo"). El modal equivalente de "Decapitar" se
  // retiró (2026-08-26): Matar/Capturar/Clemente sobre un CONVALECIENTE ya vive en la tarjeta del
  // log, y `combatEnded` (useCombatFlow.ts) ya no deja llegar aquí con ningún CONVALECIENTE sin
  // resolver, así que ese botón nunca podía dispararse de verdad.
  const [saquearModalOpen, setSaquearModalOpen] = useState(false)

  // Bug real jugando en vivo (2026-09-06): "Actúas primero."/"El enemigo actuará primero..." se
  // mostraba en cuanto `lastInitiativeRoll` llegaba del backend, con el resultado YA decidido —
  // pero el dado del lado que tira en segundo lugar seguía mostrando "?" varios segundos, porque
  // `DiceRollVs` anima la tirada secuencialmente. Reseteado a `false` cada vez que cambia la
  // tirada (identidad del objeto, no solo su existencia) para que un turno nuevo vuelva a ocultar
  // la conclusión hasta que su propia animación termine — `onAllLanded` de `DiceRollVs` lo pone en
  // `true` cuando el segundo dado aterriza de verdad.
  const [initiativeRevealed, setInitiativeRevealed] = useState(false)
  useEffect(() => {
    setInitiativeRevealed(false)
  }, [lastInitiativeRoll])

  // Scroll al inicio al abrirse el panel (2026-08-31, "revisa bien todos los casos del foco/
  // scroll") — el panel se monta de nuevo cada vez que se entra en combate; sin esto, si el
  // contenido quedó scrolleado hacia abajo la vez anterior, no había garantía de arrancar viendo
  // el encabezado (rivales/estado del jugador). Sin foco de teclado aquí a propósito, a diferencia
  // de PanelDrawer — el jugador entra a pulsar un botón de acción, no a leer, y robar el foco justo
  // al abrir combate sería más intrusivo que útil.
  const contentScrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0 })
  }, [])

  // Resumen de combate (2026-07-30) — solo se ofrece "Saquear todo" si de verdad queda algo sin
  // saquear; si ya se registró todo uno a uno durante la pelea, el resumen solo ofrece salir.
  // Solo MUERTO es saqueable (2026-08-26, CONVALECIENTE deja de serlo) — mismo criterio que el
  // backend (`saquear-zona`/`turnResolution.ts § lootTargets`).
  //
  // Bug real (auditoría 2026-08-06): sin el filtro `enciclopedia?.npcs.some(...)`, un enemigo de
  // FAUNA derrotado también contaba como "lootable" — pero `lootOptions` de abajo solo mira
  // `enciclopedia.npcs` (nunca `enciclopedia.faunaFlora`, que ni siquiera tiene un campo `items`
  // con forma de loadout: la fauna se despieza por narración, harvest.ts, un mecanismo totalmente
  // aparte de este modal). Eso dejaba "Saquear todo" siempre visible tras derrotar fauna, abriendo
  // un modal sin ninguna opción que marcar — y como `fullyLootedSlugs` sale de `lootOptions`, esa
  // fauna nunca podía marcarse `yaSaqueado`, así que el botón reaparecía para siempre.
  const lootables = npcs.filter((n) => n.condicion === 'MUERTO' && !n.yaSaqueado && enciclopedia?.npcs.some((e) => e.slug === n.slug))
  const quedaAlgoPorSaquear = lootables.length > 0

  // Opciones del modal de saqueo (2026-07-30) — el loadout real de cada enemigo saqueable viene
  // de la Enciclopedia (catálogo, no depende de la partida — ver `EnciclopediaNpcInfo.items`).
  // `id` compuesto (npc+objeto) para que dos enemigos con un objeto de mismo nombre no colisionen
  // en el checkbox, aunque al confirmar solo se manden los NOMBRES (lo que espera el backend).
  const lootOptions = lootables.flatMap((npc) => {
    const npcEnciclopedia = enciclopedia?.npcs.find((n) => n.slug === npc.slug)
    // Bug real (2026-07-31, "saqueé 2 de 3 y la próxima vez me volvía a listar las 3"): el
    // catálogo de la Enciclopedia no sabe nada de la partida — sin filtrar por lo que
    // `NpcState.lootedItemNames` ya registra como tomado, el modal ofrecía siempre el loadout
    // completo, aunque el backend correctamente ya no duplicara nada al confirmar.
    return (npcEnciclopedia?.items ?? [])
      .filter((item) => !npc.lootedItemNames.includes(item.name))
      .map((item) => ({
        id: `${npc.slug}:${item.name}`,
        label: item.cantidad > 1 ? `${item.name} ×${item.cantidad}` : item.name,
        sublabel: item.notas ?? `De ${npc.name}`,
        itemName: item.name,
        // Saqueo parcial (2026-07-31) — para saber, al confirmar, de qué NPC era cada opción y así
        // calcular qué NPCs tuvieron el 100% de sus objetos marcados.
        npcSlug: npc.slug,
      }))
  })

  // Fondo azul en turno de defensa, madera normal en turno de ataque (petición explícita,
  // 2026-08-15, segunda vuelta tras "no en rojo todo... incluso en la imagen" — simplificado a
  // propósito: nada de overlay ni de rojo en ataque, solo `.plank-panel-defense` (index.css)
  // tiñendo el propio `background-image` de `.plank-panel` — un fondo SIEMPRE pinta detrás de su
  // contenido, así que la imagen del rival nunca se ve afectada, a diferencia del `<div>` overlay
  // del primer intento, que se quedaba fijo tapando lo que se desplazara bajo él al hacer scroll).
  // Bug real jugando en vivo (2026-09-06): el fondo cambiaba de color en cuanto `awaitingDefense`
  // pasaba a `true`, antes de que la animación de la tirada de iniciativa (`initiativeRevealed`)
  // terminara — mientras hay una tirada sin revelar, se mantiene el fondo neutro.
  const defenseBg = !ended && awaitingDefense && (!lastInitiativeRoll || initiativeRevealed)

  return (
    <section className={`plank-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ${defenseBg ? 'plank-panel-defense' : ''}`}>
      <header className="relative flex items-center justify-between gap-2.5 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="gem animate-gem-breathe" />
          <h2 className="font-serif text-sm tracking-wide text-danger-400">
            ⚔️ Combate{!ended && <span className="text-wood-400"> — {awaitingDefense ? 'Defensa' : 'Ataque'}</span>}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {!ended && !awaitingDefense && (
            <button type="button"
              onClick={onHuir}
              disabled={busy || pendingDecisions}
              // Contraste real (petición explícita, 2026-08-18: "hay que mejorar para que sea más
              // claro el botón Huir" — antes solo texto apagado sin fondo, igual de invisible que
              // el botón de colapsar antes de arreglarlo). Tono ámbar (cost-*) a propósito, para
              // no confundirse con el chip rojo de colapsar que tiene justo al lado.
              className="tactile flex items-center gap-1 rounded-full border border-cost-500/60 bg-cost-500/20 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-cost-400 shadow-[0_0_8px_-2px_var(--color-cost-500)] transition-colors hover:border-cost-400 hover:bg-cost-500/35 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden="true">🏃</span> Huir
            </button>
          )}
          {onCollapse && (
            <button type="button"
              onClick={onCollapse}
              title='Colapsar "Combate"'
              // Mismo chip con relleno de color que LogPanel.tsx (petición explícita, 2026-08-18:
              // "los botones para colapsar los logs no se ven nada claros" — un fondo casi tan
              // oscuro como el propio panel no basta, hace falta color real).
              className="tactile flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-danger-500/60 bg-danger-500/20 text-base text-danger-400 shadow-[0_0_8px_-2px_var(--color-danger-500)] transition-colors hover:border-danger-400 hover:bg-danger-500/35"
            >
              {collapseIcon}
            </button>
          )}
        </div>
      </header>

      {/* Barra de estado persistente (2026-07-29, "nunca queda claro el estado del enemigo...
          quiero saber cómo estamos ambos") — a diferencia de la lista de "Enemigos" de abajo,
          esta NUNCA se oculta en awaitingDefense: es justo cuando más falta hace verla. Vida/
          energía del propio jugador quitadas de aquí (petición explícita, 2026-08-15: "ya lo
          tenemos en la parte superior") — quedaba duplicado con Personaje > Estadísticas, esta
          fila se queda solo con el estado de los rivales. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-iron-800 px-4 pb-2.5">
        {/* Fase 2 de efectos de clase (2026-08-27) — fila propia del jugador, mismo criterio de
            "siempre visible" que el resto de esta barra; solo aparece si tiene algún efecto activo. */}
        {playerActiveEffects.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="max-w-24 truncate text-2xs text-wood-400">Tú</span>
            <ActiveEffectChips effects={playerActiveEffects} />
          </div>
        )}
        {npcs.map((npc) => (
          <div key={combatKeyFor(npc)} className="flex items-center gap-1.5">
            <span className="max-w-24 truncate text-2xs text-wood-400">{combatDisplayNameFor(npc)}</span>
            <HealthBar condicionFisica={npc.condicion} />
            <ActiveEffectChips effects={npc.activeEffects} />
          </div>
        ))}
      </div>

      <div ref={contentScrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {ended ? (
          // Resumen de combate (petición explícita, 2026-07-30: "no se entiende que vencí...
          // quiero una vista de victoria más vistosa y que no muestre el contenido del combate").
          // Sustituye TODO lo de abajo (Enemigos/Ficha/habilidades/Actuar) — ya no hace falta
          // nada de eso una vez la pelea terminó de verdad, solo el resultado y qué hacer después.
          // Bug real jugando en vivo (2026-07-31, "he ganado la batalla estando yo convaleciente
          // y el enemigo herido"): antes esta pantalla siempre decía "¡Victoria!" en cuanto el
          // ÚLTIMO enemigo caía, sin mirar si TÚ también habías caído en el proceso — un doble
          // K.O. se veía idéntico a una victoria limpia. Ahora distingue el caso: convaleciente
          // de verdad no es "victoria", aunque el enemigo también haya caído.
          //
          // Bug real jugando en vivo (2026-08-27, MÁS GRAVE: "he perdido un combate...me sale
          // victoria"): la comprobación de arriba solo distinguía CONVALECIENTE del resto — un
          // jugador MUERTO (combat_flow.ts pone `combatEnded` a true vía `justDied`, sin que el
          // rival llegara a ni siquiera perder salud) caía por descarte en la rama de "¡Victoria!"
          // con trofeo dorado, con el rival listado "Ileso". `playerCondicion === 'MUERTO'` NUNCA
          // ocurre de verdad tras un respawn sobrevivible (turnResolution.ts lo resetea a ILESO en
          // el mismo turno) — `playerJustDied` es la única señal real. Ahora se distinguen los 3
          // casos reales.
          (() => {
            const derrota = playerJustDied
            const casiDerrota = !derrota && playerCondicion === 'CONVALECIENTE'
            return (
              <div
                className={`flex flex-col items-center gap-4 rounded-xl border p-5 text-center ${
                  derrota || casiDerrota
                    ? 'border-danger-500/40 bg-gradient-to-b from-danger-500/10 via-wood-950/20 to-transparent'
                    : 'border-accent-500/40 bg-gradient-to-b from-accent-500/10 via-wood-950/20 to-transparent'
                }`}
              >
                <span className="animate-gem-breathe text-5xl" aria-hidden="true">
                  {derrota ? '💀' : casiDerrota ? '⚠️' : '🏆'}
                </span>
                <div>
                  <h3 className={`font-serif text-2xl tracking-wide ${derrota || casiDerrota ? 'text-danger-300' : 'text-accent-300'}`}>
                    {derrota ? 'Derrota' : casiDerrota ? 'Combate terminado' : '¡Victoria!'}
                  </h3>
                  <p className="mt-1 text-2xs uppercase tracking-[0.2em] text-wood-500">
                    {derrota ? 'Has caído en combate' : casiDerrota ? 'Sales convaleciente de la pelea' : 'Combate terminado'}
                  </p>
                </div>
                <ul className="w-full space-y-1.5">
                  {npcs.map((npc) => (
                    <li
                      key={combatKeyFor(npc)}
                      className="flex items-center justify-between gap-2 rounded-lg border border-iron-800 bg-wood-950/50 px-3 py-2 text-xs text-wood-200"
                    >
                      <span className="truncate font-medium">{combatDisplayNameFor(npc)}</span>
                      <span className="shrink-0 text-2xs text-wood-500">
                        {CONDICION_LABEL[npc.condicion]}
                        {npc.yaSaqueado ? ' · saqueado' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex w-full gap-2">
                  <button type="button"
                    onClick={onContinue}
                    disabled={busy}
                    className="tactile flex-1 rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Salir
                  </button>
                  {quedaAlgoPorSaquear && (
                    <button type="button"
                      onClick={() => setSaquearModalOpen(true)}
                      disabled={busy}
                      className="tactile flex-1 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
                    >
                      Saquear todo
                    </button>
                  )}
                </div>
              </div>
            )
          })()
        ) : (
          <>
        {playerCondicion === 'CONVALECIENTE' && (
          // Petición explícita de la usuaria (2026-07-31, tras el bug del malus a 0 — ver
          // death.ts § CONDICION_MALUS): puedes seguir intentándolo estando convaleciente, pero
          // muy penalizado — y ahora se avisa con claridad en vez de dejarlo solo en la barra de
          // vida, fácil de pasar por alto en pleno combate.
          <div className="rounded-lg border border-danger-600/50 bg-danger-500/10 px-3 py-2 text-xs text-danger-200">
            ⚠️ Estás convaleciente — puedes seguir intentándolo, pero muy penalizado.
          </div>
        )}

        {/* Rediseño del banner de iniciativa (petición explícita, 2026-08-15: "que la tirada
            iniciativa sea visible tanto en el turno de ataque como en el de defensa, además de
            que se vea mejor y llame más la atención") — antes eran DOS bloques mutuamente
            excluyentes, y solo el de ataque enseñaba los números reales; el de defensa se
            quedaba en un aviso genérico sin la tirada. Ahora es un único bloque que siempre
            muestra los números cuando existen (`lastInitiativeRoll`), con el mismo rojo/azul que
            ya tiñe el panel entero (ver el `<section>` de más abajo) para que el tono coincida de
            un vistazo con "de quién es este turno". `lastInitiativeRoll` puede faltar en defensa
            si el enemigo forzó el turno sin tirada real (Aturdimiento/Intimidación) — ahí se cae
            al aviso genérico de siempre. */}
        {/* Iniciativa animada en vivo (2026-09-04, centralización de todas las tiradas del juego —
            petición explícita: "como en D&D, que el efecto de los dados suceda de verdad") — antes
            un badge de texto plano ya resuelto; ahora el mismo `DiceRollVs` que ya usa el
            intercambio de ataque/defensa, con el copy explicativo fuera del componente. */}
        {awaitingDefense && !lastInitiativeRoll && (
          <div className="rounded-lg border-2 border-accent-600/50 bg-accent-500/10 px-3.5 py-2.5 text-sm font-semibold text-accent-200 shadow-[0_0_16px_-6px_var(--color-accent-500)]">
            ⚔️ Un enemigo actúa primero — elige a ciegas cómo defenderte.
          </div>
        )}

        {lastInitiativeRoll && (
          <div
            className={`rounded-lg border-2 px-3.5 py-2.5 text-sm font-semibold shadow-[0_0_16px_-6px_var(--color-accent-500)] ${
              awaitingDefense ? 'border-accent-500/70 bg-accent-500/15 text-accent-200' : 'border-danger-500/70 bg-danger-500/15 text-danger-200'
            }`}
          >
            {/* Bug real jugando en vivo (2026-09-07, "al acabar la tirada de iniciativa y cambiar
                el color del panel, está volviendo a repetir la tirada otra vez") — hasta ahora este
                era literalmente DOS bloques JSX distintos (`{awaitingDefense && (...)}` y
                `{!awaitingDefense && lastInitiativeRoll && (...)}`), cada uno con su propio
                `<DiceRollVs>`: pese a compartir la misma `key`, viven en posiciones distintas del
                árbol, así que cambiar `awaitingDefense` desmontaba el de un bloque y montaba el del
                otro como si fuera una tirada NUEVA — reiniciando la animación entera aunque
                `lastInitiativeRoll` (los datos reales) no hubiera cambiado. Ahora es un ÚNICO bloque
                real, con un solo `<DiceRollVs>` — solo el texto/color de alrededor varía con
                `awaitingDefense`, nunca la propia tirada. */}
            {initiativeRevealed
              ? awaitingDefense
                ? 'Un enemigo actúa primero, elige a ciegas cómo defenderte.'
                : lastInitiativeRoll.ganador === 'jugador'
                  ? 'Actúas primero.'
                  : 'El enemigo actuará primero en tu próximo turno.'
              : 'Tirando iniciativa...'}
            <DiceRollVs
              // Hallazgo 27 (revisar-partida-hallazgos.md 2026-09-07) — sin `key`, React reconcilia
              // la MISMA instancia de `DiceRollVs` turno tras turno (misma posición del árbol,
              // `CombatPanel` se monta una única vez por combate): el `useEffect(..., [])` interno de
              // `useScrollIntoViewOnMount` (DiceRoll.tsx) solo corre en el montaje real, así que el
              // scroll automático a la tirada solo funcionaba en la PRIMERA iniciativa del combate,
              // nunca en las siguientes. Los rolls crudos de esta tirada bastan como identidad —
              // cambian en cada tirada real (y ahora, con un único bloque, esta `key` es también lo
              // único que fuerza un remount real: un cambio de `awaitingDefense` solo no lo hace).
              key={`${lastInitiativeRoll.jugador.roll}-${lastInitiativeRoll.npc.roll}`}
              left={lastInitiativeRoll.jugador}
              right={lastInitiativeRoll.npc}
              leftLabel="Tú"
              rightLabel="el enemigo"
              leftFirst={lastInitiativeRoll.ganador === 'jugador'}
              showDifficulty={false}
              onAllLanded={() => setInitiativeRevealed(true)}
            />
          </div>
        )}

        {!awaitingDefense && (
          <div>
            <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-wood-500">Enemigos</p>
            <div className="grid grid-cols-2 gap-2">
              {npcs.map((npc) => {
                const npcEnciclopedia =
                  enciclopedia?.npcs.find((n) => n.slug === npc.slug) ?? enciclopedia?.faunaFlora.find((f) => f.sourceSlug === npc.slug)
                // Mismo fallback de variante de sexo que EnemyFicha más arriba (bug real
                // jugando en vivo, 2026-08-08) — sin esto, esta miniatura también se queda vacía
                // para cualquier especie sin imagen "neutra" subida.
                const sexoVariant = npcEnciclopedia?.variantesSexo?.[0]
                const thumbnail = npcEnciclopedia
                  ? resolveImageUrl(sexoVariant?.imageUrls.thumbnail ?? sexoVariant?.imageUrls.banner ?? npcEnciclopedia.imageUrls.thumbnail ?? npcEnciclopedia.imageUrls.banner)
                  : null
                const key = combatKeyFor(npc)
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={busy}
                    onClick={() => onSelectNpc(key)}
                    className={`tactile flex items-center gap-2 rounded-lg border p-1.5 text-left text-xs transition-colors disabled:opacity-60 ${
                      selectedNpcSlug === key ? 'border-accent-500 bg-accent-500/15' : 'border-iron-700 bg-wood-950/40 hover:border-accent-600/40'
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-wood-950/60">
                      {thumbnail ? <img src={thumbnail} alt="" className="h-full w-full object-cover" /> : <span aria-hidden="true">⚔️</span>}
                    </span>
                    <span className="min-w-0">
                      <p className="truncate font-medium text-wood-100">{combatDisplayNameFor(npc)}</p>
                      <p className="text-2xs text-wood-400">{CONDICION_LABEL[npc.condicion]}</p>
                      {/* "Registrar" (solo este enemigo, instantáneo) sigue existiendo MIENTRAS el
                          combate sigue activo de verdad (p. ej. derrotaste a uno pero otros siguen
                          en pie). Matar/Capturar/Clemente sobre un CONVALECIENTE ya NO viven aquí
                          (2026-08-26) — viven en la tarjeta del log ("Tu personaje"), que además
                          bloquea el composer hasta resolverse; "Registrar" solo tiene sentido sobre
                          MUERTO ahora, un CONVALECIENTE ya no es saqueable. */}
                      {npc.condicion === 'MUERTO' && !npc.yaSaqueado && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            onRegistrar(npc)
                          }}
                          className="mt-0.5 inline-block text-2xs text-accent-300 underline"
                        >
                          Registrar
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Ficha del rival (2026-08-12, petición explícita: "en el turno de defensa hay que añadir
            también la información del enemigo... en la de ataque sí") — antes se ocultaba entera
            en `awaitingDefense`, igual que el selector de objetivo (que sí tiene sentido ocultar:
            no eliges a quién defenderte). `selectedNpcSlug` no se resetea al entrar en defensa —
            sigue siendo el rival ya elegido, así que la ficha no necesita ningún dato nuevo. */}
        {selectedNpcSlug && (() => {
          // Identificador de combatientes duplicados (2026-08-27) — `selectedNpcSlug` puede ser un
          // `participantId` (no un slug de catálogo real) cuando hay más de un combatiente del
          // mismo Npc — `EnemyFicha` necesita el `slug` de catálogo de verdad para consultarlo.
          const selected = npcs.find((n) => combatKeyFor(n) === selectedNpcSlug)
          if (!selected) return null
          return <EnemyFicha slug={selected.slug} analizado={selected.analizado} playerAttributes={playerAttributes} enciclopedia={enciclopedia} />
        })()}

        {(combatAbilities.length > 0 || (!awaitingDefense && combatItems.length > 0)) && (
          // Bloque "usable" (petición explícita, 2026-07-28: "que destaque más... más claro que
          // son los elementos usables") — mismo tono accent que ya marca selección/foco en el
          // resto de la app, pero aquí permanente (no solo al seleccionar), para separarlo de
          // limpio de las secciones puramente informativas de arriba (Enemigos/Información).
          // En defensa a ciegas solo se ofrecen habilidades (petición explícita: "elige una
          // habilidad" para la "contra") — los objetos consumibles se ocultan en este sub-modo.
          //
          // Rediseño (petición explícita, 2026-07-30, tras verlo en vivo: "se ve fatal... no se
          // entiende nada... queda muy cargada de color"): antes cada habilidad era un chip con
          // el borde Y el texto enteros teñidos del color de su atributo (7 colores posibles a la
          // vez, en chips diminutos envueltos en una cuadrícula apretada) — un solo punto de color
          // por fila basta para seguir viendo el tipo de un vistazo, sin el efecto "confeti". Filas
          // en vez de chips envueltos: más fácil de leer de arriba abajo en un panel estrecho.
          <div className="space-y-3 rounded-lg border border-accent-600/50 bg-accent-500/5 p-2.5">
            {combatAbilities.length > 0 &&
              // Rediseño de combate (2026-08-09, petición explícita: "podamos crear tabs en el
              // combate con las habilidades de daño, las defensivas y las de utilidad más
              // separada") — sustituye el viejo agrupado por `isGeneric` (genéricas/reales) por
              // uno por `rol`: solo 'ataque' puede hacer daño incondicional, 'defensa' nunca hace
              // daño, 'utilidad' es reactiva/condicionada al rival (ver combatExchange.ts). Los 3
              // genéricos (Ataque Básico/Defenderse/Esquivar) ya encajan solos en su grupo real
              // por `rol` — dentro de cada grupo, genéricos primero (acción por defecto).
              (
                [
                  { key: 'ataque', label: '⚔️ Daño', list: combatAbilities.filter((a) => a.rol === 'ataque') },
                  { key: 'defensa', label: '🛡️ Defensivas', list: combatAbilities.filter((a) => a.rol === 'defensa') },
                  { key: 'utilidad', label: '🔮 Utilidad', list: combatAbilities.filter((a) => a.rol === 'utilidad') },
                  // Red de seguridad para partidas antiguas que no hayan resincronizado sus
                  // habilidades desde este rediseño (rol todavía null) — nunca desaparecen de la UI.
                  { key: 'otras', label: '✨ Otras', list: combatAbilities.filter((a) => a.rol === null) },
                ] as const
              ).map((group) => ({ ...group, list: [...group.list].sort((a, b) => Number(b.isGeneric) - Number(a.isGeneric)) })).map(
                (group) =>
                  group.list.length > 0 && (
                    <div key={group.key}>
                      <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-accent-300">{group.label}</p>
                      {/* 2 columnas + descripción siempre visible (2026-08-12, petición explícita:
                          "salga en 2 columnas con una abbr del attr y una descripción de la
                          habilidad") — sustituye la fila de una sola columna con la descripción
                          escondida detrás de un tooltip solo-hover (incómodo en un dispositivo
                          táctil/mando, la Steam Deck) por una tarjeta que la muestra siempre. */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {group.list.map((a) => {
                          // Null en habilidades 'general' o en partidas de antes de este campo —
                          // cae de vuelta a un punto neutro, sin tinte de tipo.
                          const colors = a.preferredAttribute ? attributeColorClasses[a.preferredAttribute] : null
                          // Sistema de fatiga (2026-07-29, "aparecerá deshabilitada y solo podrás
                          // usar ataques normales o consumibles") — sin energía suficiente, el
                          // botón se deshabilita en vez de dejar elegirla.
                          // B11 (pruebas 2026-09-28): con <5 de energía ni Ataque Básico se podía usar y en un combate
                          // forzado solo quedaba defenderse — la acción base (isGeneric) nunca se bloquea por energía
                          // (el backend ya deja la energía en 0 como mínimo).
                          const sinEnergia = !a.isGeneric && a.energyCost > energia
                          const isSelected = selectedAbilityId === a.id
                          // Tarjeta entera clickable (2026-08-12, petición explícita: "asegúrate de
                          // que el cuadro completo sea clickable") — antes solo la fila superior
                          // (icono+nombre) era un <button type="button">; la descripción y el resto del cuadro no
                          // reaccionaban al clic. Ahora la tarjeta entera es el elemento interactivo
                          // (div con role="button", no un <button type="button"> real: dentro va anidado el
                          // botón ⓘ, y un <button type="button"> no puede contener otro <button type="button"> válido en HTML)
                          // — el ⓘ para su propio clic con stopPropagation para no seleccionar la
                          // habilidad de paso al pedir su ficha de Enciclopedia.
                          const disabledCard = busy || sinEnergia || pendingDecisions
                          const selectThisAbility = () => {
                            if (disabledCard) return
                            onSelectAbility(a.id)
                            onSelectItem(null)
                          }
                          return (
                            <div
                              key={a.id}
                              role="button"
                              tabIndex={disabledCard ? -1 : 0}
                              aria-disabled={disabledCard}
                              aria-pressed={isSelected}
                              onClick={selectThisAbility}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  selectThisAbility()
                                }
                              }}
                              title={sinEnergia ? 'No tienes energía suficiente' : undefined}
                              className={`tactile relative flex flex-col gap-1 rounded-lg border p-2 pr-6 text-left transition-[transform,border-color,box-shadow,opacity] duration-150 ${
                                disabledCard ? 'cursor-not-allowed' : 'cursor-pointer'
                              } ${
                                isSelected
                                  ? 'animate-pop-once border-accent-500 bg-accent-500/15 shadow-[0_0_16px_-6px_var(--color-accent-500)]'
                                  : 'border-iron-700 bg-wood-950/50 hover:-translate-y-0.5 hover:border-accent-600/40'
                              } ${sinEnergia ? 'opacity-50' : ''}`}
                            >
                              <div className="flex w-full items-start gap-2 text-xs">
                                {/* Insignia de icono con tinte del atributo (2026-08-12, "se ve un
                                    poco feo") — sustituye al emoji suelto flotando en el texto por
                                    un bloque con peso visual propio, mismo criterio que los avatares
                                    de NPC de la lista de "Enemigos" de arriba. */}
                                <span
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm ${colors ? colors.bg : 'bg-wood-800'}`}
                                  aria-hidden="true"
                                >
                                  {a.icon}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1.5">
                                    <span className={`truncate ${isSelected ? 'font-medium text-accent-100' : 'text-wood-200'}`}>{a.name}</span>
                                    {/* Marca de "básica" (2026-08-12, petición explícita) — Ataque
                                        Básico/Defenderse/Esquivar las tiene cualquier personaje sin
                                        aprenderlas, a diferencia del resto (de clase/raciales/de
                                        arma); antes solo se distinguían por ir siempre primero en
                                        el grupo (orden sutil, fácil de no notar). */}
                                    {a.isGeneric && (
                                      <span
                                        className="shrink-0 rounded-full border border-wood-600 px-1 font-mono text-2xs text-wood-400"
                                        title="Habilidad básica: la tiene cualquier personaje, no hace falta aprenderla"
                                      >
                                        Básica
                                      </span>
                                    )}
                                  </span>
                                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs">
                                    {/* Abreviatura de atributo (sustituye al punto de color solo,
                                        2026-07-30) — mismo dato de un vistazo, pero legible sin
                                        tener que aprenderse qué color es cada atributo. */}
                                    {a.preferredAttribute && (
                                      <span className={`inline-flex items-center gap-1 font-mono ${colors?.text ?? 'text-wood-500'}`}>
                                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors ? colors.dot : 'bg-wood-600'}`} aria-hidden="true" />
                                        {attributeAbbr[a.preferredAttribute]}
                                      </span>
                                    )}
                                    {/* Doble arma (2026-07-31) — misma categoría en las dos manos: mejor dificultad al usarla, nunca un segundo golpe real. */}
                                    {a.dualWield && (
                                      <span
                                        className="rounded-full border border-accent-600/50 px-1 font-mono text-accent-300"
                                        title="Llevas 2 armas de este tipo — mejor dificultad al usarla"
                                      >
                                        ×2
                                      </span>
                                    )}
                                    {/* Rayo amarillo explícito (2026-08-12, "lo sigo viendo
                                        igual...no es amarillo ni es más grande") — el intento
                                        anterior de "sin color = amarillo natural del emoji" no
                                        funcionó: al vivir dentro del mismo span que `text-wood-500`,
                                        heredaba ese gris igual (la fuente de este sistema no trae
                                        glifo de emoji a color, así que el `color` de CSS sí le
                                        afecta). Color amarillo forzado + tamaño explícito mayor que
                                        el resto de la fila (`text-2xs`), en su propio span para no
                                        heredar nada del número. */}
                                    {a.energyCost > 0 && (
                                      <span className="inline-flex items-center gap-0.5 font-mono text-wood-500">
                                        -{a.energyCost}
                                        <span aria-hidden="true" className="text-base text-yellow-400">
                                          ⚡
                                        </span>
                                      </span>
                                    )}
                                    {/* Regen de Defenderse/Esquivar ("falta el +10 y +5") — estas
                                        dos no cuestan nada (energyCost 0) pero SÍ devuelven energía
                                        al usarlas de verdad en un intercambio (energy.ts §
                                        nextEnergia); sin esto la tarjeta no decía nada aunque su
                                        propia descripción prometa "recupera algo de energía". */}
                                    {a.energyRegen > 0 && (
                                      <span className="inline-flex items-center gap-0.5 font-mono text-moss-400">
                                        +{a.energyRegen}
                                        <span aria-hidden="true" className="text-base text-yellow-400">
                                          ⚡
                                        </span>
                                      </span>
                                    )}
                                    {/* Bono de atributo por habilidad (bug real, 2026-08-30: "en las
                                        descripciones de las habilidades no están saliendo los
                                        efectos reales" — el dato YA viajaba del backend, `+2`/`+4`
                                        para armas/clase, ver `attributeBonus` en `SavedActionInfo`,
                                        pero esta tarjeta nunca lo pintaba). Mismo color/patrón que
                                        el chip equivalente de `CombatExchangeBadge.tsx`
                                        (`moss-400`, "explica por qué el número sale más alto"). */}
                                    {!!a.attributeBonus && a.attributeBonus > 0 && (
                                      <span className="inline-flex items-center gap-0.5 font-mono text-moss-400" title="Bono fijo de esta habilidad, ya sumado a tu tirada">
                                        +{a.attributeBonus} hab
                                      </span>
                                    )}
                                  </span>
                                </span>
                              </div>
                              <p className="text-2xs leading-snug text-wood-400">{a.description}</p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onAbilityDetail(a)
                                }}
                                aria-label={`Consultar ${a.name} en la Enciclopedia`}
                                className="tactile absolute right-1.5 top-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-iron-700 bg-wood-950/70 text-2xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
                              >
                                ⓘ
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ),
              )}
            {!awaitingDefense && combatItems.length > 0 && (
              <div>
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-accent-300">⚡ Tus objetos</p>
                <div className="space-y-1">
                  {combatItems.map((item) => {
                    const isSelected = selectedItemId === item.id
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors ${
                          isSelected ? 'border-accent-500 bg-accent-500/15' : 'border-iron-700 bg-wood-950/50'
                        }`}
                      >
                        <TooltipAnchor text={item.description} className="min-w-0 flex-1">
                          <button type="button"
                            onClick={() => {
                              onSelectItem(item.id)
                              onSelectAbility(null)
                            }}
                            disabled={busy || pendingDecisions}
                            className="tactile flex w-full items-center gap-2 text-left text-xs disabled:cursor-not-allowed"
                          >
                            <span aria-hidden="true">🎒</span>
                            <span className={`truncate ${isSelected ? 'font-medium text-accent-100' : 'text-wood-200'}`}>{item.name}</span>
                          </button>
                        </TooltipAnchor>
                        <button
                          type="button"
                          onClick={() => onItemDetail(item)}
                          aria-label={`Consultar ${item.name} en la Enciclopedia`}
                          className="tactile flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-iron-700 text-2xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
                        >
                          ⓘ
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {/* "Actuar" fijo fuera del scroll (2026-08-12, petición explícita: "para no tener que ir al
          final al seleccionar una habilidad") — antes vivía como último elemento DENTRO del `div`
          con `overflow-y-auto` de arriba, así que con la lista de habilidades larga había que
          bajar del todo para pulsarlo tras elegir una. Ahora es un pie aparte, hermano de ese
          contenedor dentro del mismo `flex flex-col` del `<section>` — siempre visible, el scroll
          ya no lo afecta. Nunca se muestra en la pantalla de resumen (`ended`), igual que antes. */}
      {!ended && (
        <div className="border-t border-iron-800 px-4 py-3">
          <button type="button"
            onClick={onActuar}
            disabled={busy || pendingDecisions || (awaitingDefense ? !selectedAbilityId : !selectedAbilityId && !selectedItemId)}
            className="tactile w-full rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
          >
            {awaitingDefense ? 'Defenderte' : 'Actuar'}
          </button>
        </div>
      )}

      {saquearModalOpen && (
        <CombatSelectionModal
          title="¿Qué te quieres quedar?"
          description="Solo se registrarán en tu inventario los objetos que marques."
          options={lootOptions}
          defaultSelectedIds={lootOptions.map((o) => o.id)}
          confirmLabel="Saquear"
          busy={busy}
          onCancel={() => setSaquearModalOpen(false)}
          onConfirm={(selectedIds) => {
            const selected = lootOptions.filter((o) => selectedIds.includes(o.id))
            const itemNames = [...new Set(selected.map((o) => o.itemName))]
            // Saqueo parcial (2026-07-31, "si no saqueas todo el botón sigue") — un NPC solo
            // cuenta como saqueado del todo si TODAS sus opciones (no solo alguna) están marcadas.
            // De `lootables`, NO de `lootOptions` (auditoría 2026-08-07, bug real: un PRINCIPAL
            // con loadout vacío en catálogo — Vrask Ombra, Kael Dorn... — no aporta NINGUNA opción
            // a `lootOptions`, así que nunca aparecía aquí y "Saquear todo" lo seguía ofreciendo
            // como pendiente para siempre, aunque no hubiera nada que marcar). `.every()` sobre un
            // array vacío de opciones ya da `true` — se cuenta como saqueado del todo sin más.
            const npcSlugs = lootables.map((n) => n.slug)
            const fullyLootedSlugs = npcSlugs.filter((slug) => lootOptions.filter((o) => o.npcSlug === slug).every((o) => selectedIds.includes(o.id)))
            // Bug real (2026-08-01, "saqueé 2 de 3 y me volvía a listar los 3"): el backend no
            // siempre manda `combateIniciado` de vuelta en un turno de saqueo (depende de que el
            // modelo repita el slug en su narración, algo que un saqueo — ahora 100% determinista,
            // sin LLM — nunca hace), así que GameView.tsx no puede fiarse de esa respuesta para
            // refrescar `lootedItemNames` — necesita saber, YA, qué se marcó de cada NPC.
            const itemNamesByNpc: Record<string, string[]> = {}
            for (const slug of npcSlugs) itemNamesByNpc[slug] = selected.filter((o) => o.npcSlug === slug).map((o) => o.itemName)
            onSaquearSeleccion(itemNames, fullyLootedSlugs, itemNamesByNpc)
            setSaquearModalOpen(false)
          }}
        />
      )}
    </section>
  )
}
