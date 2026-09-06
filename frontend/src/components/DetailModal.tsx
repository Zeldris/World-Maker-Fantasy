import { useEffect, useState } from 'react'
import type { EquipSlot, IngredientStatusInfo, InventoryItemInfo, SavedActionInfo } from '../types'
import { statBonusLabels } from '../lib/dice'
import { itemIcon } from '../lib/enciclopediaTargets'
import {
  resolveImageUrl,
  type EnciclopediaImagePrompts,
  type EnciclopediaImageUrls,
  type EnciclopediaRazaVariante,
  type EnciclopediaSexoVariante,
  type EnciclopediaTiempoVariante,
  type ImagePromptEntityType,
} from '../lib/api'
import { AbilityForm, type AbilityFormParams } from './AbilityForm'
import { abilityBonusSuffix } from '../lib/abilityBonusSuffix'
import { EnciclopediaLinkedText } from './EnciclopediaLinkedText'
import { useEnciclopediaLink } from '../context/useEnciclopediaLink'
import { MediaSlot, ImagePromptSlot } from './ImagePromptDisplay'
import { TooltipAnchor } from './TooltipAnchor'

export type DetailTarget =
  | { kind: 'item'; item: InventoryItemInfo }
  | { kind: 'ability'; ability: SavedActionInfo }
  // Rediseño de equipar (2026-07-30, petición explícita: "que al clicarlo se abra un panel donde
  // aparece por qué lo puedo sustituir" — antes 'slotPicker' solo servía para ranuras VACÍAS y era
  // una lista pelada de nombres; una ranura OCUPADA abría el detalle simple del objeto (solo
  // "Quitar", sin forma de sustituirlo directo). Ahora una ranura cualquiera —ocupada o vacía—
  // abre este mismo panel: lo puesto ahora mismo (si lo hay) + candidatos compatibles reales, un
  // solo clic para sustituir (el backend ya lo hace atómico).
  | { kind: 'slotManager'; slot: EquipSlot; slotLabel: string; equipped: InventoryItemInfo | undefined; options: InventoryItemInfo[] }
  | {
      kind: 'info'
      icon: string
      name: string
      meta?: string
      description: string
      extra?: string
      /// Ingredientes/materiales de una receta de crafteo/construcción, con el conteo real
      /// tienes/necesitas EN ESTA PARTIDA (2026-08-13, petición explícita: "que ponga lo que
      /// tienes contra lo que falta 0/5... con un card en formato lista") — renderizado como lista
      /// propia, una fila por material, en vez de metido en `extra` como texto plano. Undefined
      /// fuera de una partida activa (sin inventario real contra el que contar).
      ingredients?: IngredientStatusInfo[]
      imagePrompts?: EnciclopediaImagePrompts
      /// Imagen real ya subida (checklist 2026-07-21/22, punto 7) — cuando existe, sustituye al
      /// emoji de MediaSlot; si no, el modal sigue mostrando el placeholder de siempre.
      imageUrls?: EnciclopediaImageUrls
      /// Presentes solo cuando esta entrada es candidata a generación bajo demanda (checklist
      /// 2026-07-21/22, punto 7) — sin ellos, el modal no ofrece los botones de generar.
      entityType?: ImagePromptEntityType
      entitySlug?: string
      /// Variantes regionales (2026-07-22, "al pulsar orcos aun pudiese elegir el tipo según la
      /// región") — presente solo en Orcos hoy. Cada variante tiene su propia imagen/prompt,
      /// independiente de la ficha general de la raza.
      variantes?: EnciclopediaRazaVariante[]
      /// Variantes por sexo (2026-07-22, "para fauna, npcs... con los símbolos de macho y
      /// hembra") — eje INDEPENDIENTE de `variantes` (nunca cruza con región): fauna de verdad,
      /// NPC de tipo PLANTILLA genéricos, y razas a nivel general. Nunca en flora/mineral ni en
      /// individuos únicos con nombre propio.
      variantesSexo?: EnciclopediaSexoVariante[]
      /// Día/noche/estación (2026-08-27, docs/rpgtarkor/imagenes-prompts.md) — SOLO en
      /// `entityType === 'location'` (petición explícita: "que se muestre la opción que marques en
      /// vez de todos de golpe" — pestañas de estación + toggle de día/noche, nunca los 8 prompts
      /// listados seguidos).
      variantesTiempo?: EnciclopediaTiempoVariante[]
      /// Asentamientos (2026-08-31, "las ciudades deben tener prompt de mapa como la zona y de
      /// icono, no de banner") — icono en vez del banner/thumbnail normales (el mapa ya se ofrecía
      /// para cualquier Location vía `variantesTiempo`). Ver `asentamientoImagesFor` en el backend
      /// (world.ts). Undefined para el resto de Locations.
      asentamiento?: {
        iconoPrompt: string | null
        iconoUrl: string | null
      }
    }

const ESTACION_LABEL: Record<EnciclopediaTiempoVariante['estacion'], string> = {
  primavera: '🌸 Primavera',
  verano: '☀️ Verano',
  otono: '🍂 Otoño',
  invierno: '❄️ Invierno',
}

// Deduplicado (auditoría de deuda técnica, 2026-08-12): el mapeo de statBonuses a chips estaba
// copiado 3 veces (objeto suelto, ranura equipada, candidato a equipar) — cada uno con su propio
// tamaño/relleno de chip y su propio elemento contenedor, así que ambos quedan parametrizados en
// vez de forzar una única apariencia.
function StatBonusList({
  bonuses,
  chipClassName,
  as: Tag = 'span',
}: {
  bonuses: InventoryItemInfo['statBonuses']
  chipClassName: string
  as?: 'span' | 'p'
}) {
  return (
    <>
      {Object.entries(bonuses ?? {}).map(
        ([attribute, amount]) =>
          !!amount && (
            <Tag key={attribute} className={chipClassName}>
              +{amount} {statBonusLabels[attribute] ?? attribute}
            </Tag>
          ),
      )}
    </>
  )
}

interface DetailModalProps {
  target: DetailTarget
  onClose: () => void
  onUnequip?: (item: InventoryItemInfo) => Promise<void>
  onEquip?: (item: InventoryItemInfo, slot: EquipSlot) => Promise<void>
  onSaveAbility?: (id: string, params: AbilityFormParams) => Promise<void>
  onDeleteAbility?: (id: string) => void
  /// Solo para `kind: 'info'` (Enciclopedia) — inserta este elemento como chip en el composer.
  onInsert?: () => void
  /// Mundo activo — necesario solo para el botón de generar prompt de imagen bajo demanda.
  worldSlug?: string | null
}

// Modal genérico de detalle (roadmap de rediseño de paneles, Fable 2026-07-20/21): un solo
// componente para lo que antes vivía repartido (ver descripción completa de un objeto, ver/editar
// una habilidad propia, elegir qué equipar en un hueco vacío del paperdoll, y ahora consultar una
// entrada de la Enciclopedia) — centrado en pantalla como CombatModal, no otro PanelDrawer
// apilado (evita "cajón dentro de cajón"). Misma carcasa (plank-panel + animate-combat-enter) sin
// la vestidura de combate.
export function DetailModal({ target, onClose, onUnequip, onEquip, onSaveAbility, onDeleteAbility, onInsert, worldSlug }: DetailModalProps) {
  // Texto clicable dentro de la propia ficha (2026-07-22, petición explícita: "descripciones que
  // tengamos") — una bio que menciona a otro NPC/lugar/objeto navega a SU ficha, sustituyendo el
  // contenido de este mismo modal (mismo patrón que un enlace de wiki, no un modal apilado).
  const { enciclopediaIndex, onEntityDetail, onEntityQuickInsert } = useEnciclopediaLink()
  const [editing, setEditing] = useState(false)
  // Gate de requisitos al equipar (sesión de diseño 2026-07-23): antes `onEquip`/`onUnequip` no
  // se esperaban ni podían fallar visiblemente — con el backend rechazando el PATCH si no se
  // cumplen los requisitos de atributo, hace falta poder mostrar POR QUÉ, en vez de que el objeto
  // "se desequipe solo" en silencio (GameView.tsx hace rollback optimista sin explicación).
  const [actionError, setActionError] = useState<string | null>(null)
  // Bug real (auditoría de bugs, 2026-08-21): ningún botón de aquí se deshabilitaba mientras la
  // petición estaba en vuelo — un doble clic rápido en "Quitar" o en dos candidatos de equipar
  // distintos disparaba dos `runEquipAction` concurrentes, cada uno con su propio rollback
  // optimista en GameView.tsx (`previous = inventory` capturado en closures distintos), lo que
  // podía dejar el inventario en un estado inconsistente o disparar `getSave` dos veces seguidas.
  // Mismo patrón de `busy` que ya usan AbilityForm.tsx y CharacterSaves.tsx (deletingId/restartingId)
  // en el resto de la app — este modal era la única pieza de este tipo sin él.
  const [busy, setBusy] = useState(false)
  async function runEquipAction(action: () => Promise<void>) {
    if (busy) return
    setActionError(null)
    setBusy(true)
    try {
      await action()
      onClose()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo completar la acción.')
    } finally {
      setBusy(false)
    }
  }
  // Selector de variante regional (2026-07-22, "al pulsar orcos aun pudiese elegir el tipo según
  // la región"; ajustado el mismo día, "no quiero tab general y luego cada aspecto... quiero tab
  // por aspecto"): sin vista "General" — si hay variantes, siempre hay una seleccionada (la
  // primera por defecto), y se resetea a esa primera cada vez que se abre una entrada distinta,
  // para no arrastrar el aspecto elegido la última vez que se consultó, p.ej., Orcos.
  const [selectedVariantSlug, setSelectedVariantSlug] = useState<string | null>(null)
  // Selector de sexo (2026-07-22, "con los símbolos de macho y hembra"; ajustado el mismo día,
  // "sí, cruzar para Orcos"): fila de pestañas propia — su fuente puede ser el sexo general de la
  // raza o el de la variante regional por defecto (si esta trae el suyo propio, como Orcos), misma
  // lógica de "siempre uno seleccionado, el primero por defecto, se resetea al abrir otra entrada".
  const [selectedSexo, setSelectedSexo] = useState<'macho' | 'hembra' | null>(null)
  // Día/noche/estación (2026-08-27, petición explícita: "añade un header a modo de tab para poder
  // elegir estacion y luego un togle para dia y noche... que eso muestre la opcion que marques en
  // vez de todos de golpe") — mismo criterio "siempre una seleccionada, primera por defecto" que
  // variante/sexo de arriba, SOLO relevante en `entityType === 'location'`.
  const [selectedEstacion, setSelectedEstacion] = useState<EnciclopediaTiempoVariante['estacion']>('primavera')
  const [selectedMomento, setSelectedMomento] = useState<EnciclopediaTiempoVariante['momento']>('dia')
  const targetKey = target.kind === 'info' ? target.entitySlug : undefined
  useEffect(() => {
    if (target.kind !== 'info') {
      setSelectedVariantSlug(null)
      setSelectedSexo(null)
      setSelectedEstacion('primavera')
      setSelectedMomento('dia')
      return
    }
    const firstVariant = target.variantes?.[0] ?? null
    setSelectedVariantSlug(firstVariant?.slug ?? null)
    setSelectedSexo((firstVariant?.variantesSexo ?? target.variantesSexo)?.[0]?.sexo ?? null)
    setSelectedEstacion('primavera')
    setSelectedMomento('dia')
    // Deliberadamente solo `targetKey` (2026-07-22): resetear variante/sexo debe pasar al abrir
    // una ENTRADA distinta (slug distinto), no cada vez que `target` cambia de referencia por un
    // re-render del padre con el mismo slug — eso arrastraría de vuelta la selección del usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey])

  return (
    <div className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="plank-panel animate-combat-enter relative flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {target.kind === 'item' && (
          <>
            {/* Bug real jugando en vivo (2026-08-07): mismo fallo que InventarioPanel.tsx — un
                objeto equipado mostraba siempre el icono de espadas cruzadas, sin importar qué
                fuera de verdad ("Raciones de viaje" equipada salía con icono de arma). */}
            <MediaSlot
              icon={target.item.tipo === 'ESPECIAL' ? '✨' : itemIcon(target.item.category ?? '')}
              variant="placeholder"
              imageUrl={resolveImageUrl(target.item.imageUrls?.banner ?? null)}
            />
            <div>
              <h2 className="font-serif text-lg text-wood-100">{target.item.name}</h2>
              {target.item.slot && <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-moss-400">Equipado</p>}
            </div>
            <p className="text-sm leading-relaxed text-wood-300">{target.item.description}</p>
            {/* Efecto especial (2026-08-03, `tipo: ESPECIAL`) — diferenciado a propósito del resto
                (petición explícita: "que se describan claramente... no sé si era mejor meterle un
                algo especial que lo diferencie y muestre solo el efecto especial"), mismo estilo
                visual que ya usa el aviso de misión nueva en LogPanel.tsx. */}
            {!!target.item.effectDescription && (
              <div className="rounded-lg border border-quest-600/50 bg-quest-500/10 px-3 py-2.5">
                <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-quest-400">✨ Efecto especial</p>
                <p className="text-sm leading-relaxed text-wood-200">{target.item.effectDescription}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              <StatBonusList
                bonuses={target.item.statBonuses}
                as="p"
                chipClassName="self-start rounded-full border border-accent-600/50 bg-accent-500/10 px-2.5 py-1 font-mono text-xs text-accent-300"
              />
              {!!target.item.tier && target.item.tier > 1 && (
                <p className="self-start rounded-full border border-accent2-600/50 bg-accent2-500/10 px-2.5 py-1 font-mono text-xs text-accent2-300">
                  Nivel {target.item.tier}
                </p>
              )}
            </div>
            {!!target.item.origin && <p className="text-2xs uppercase tracking-[0.1em] text-wood-600">{target.item.origin}</p>}
            {actionError && <p className="text-xs text-red-400">{actionError}</p>}
            {target.item.slot && onUnequip && (
              <button type="button"
                onClick={() => runEquipAction(() => onUnequip(target.item))}
                disabled={busy}
                className="tactile self-start rounded-lg border border-iron-700 px-3 py-1.5 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-wood-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Quitar
              </button>
            )}
          </>
        )}

        {target.kind === 'ability' && !editing && (
          <>
            <MediaSlot icon={target.ability.icon} />
            <h2 className="font-serif text-lg text-wood-100">{target.ability.name}</h2>
            {/* Bug real (2026-09-01, checklist "Bonus de atributo por habilidad"): este modal de
                detalle — el camino más visible al pulsar el botón ⓘ de una habilidad — mostraba
                `description` a secas, sin el sufijo "(+N de bono fijo al usarla)" que sí llevan
                los `title` nativos de AbilityGrid/CombatAbilityBelt (abilityBonusSuffix.ts). El
                bono en sí SIEMPRE se aplicó en combate; solo faltaba aquí, el sitio que de verdad
                se ve al jugar. */}
            <p className="text-sm leading-relaxed text-wood-300">{(target.ability.description || 'Sin descripción.') + abilityBonusSuffix(target.ability)}</p>
            <p className="rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2 text-xs italic text-wood-400">"{target.ability.promptText}"</p>
            {target.ability.recipeKey &&
              (() => {
                const recipeTarget = enciclopediaIndex.bySlugKey.get(`${target.ability.recipeCategory ?? 'crafteo'}:${target.ability.recipeKey}`)
                return (
                  recipeTarget && (
                    <button type="button"
                      onClick={() => onEntityDetail?.(recipeTarget)}
                      className="tactile self-start rounded-lg border border-iron-700 px-3 py-1.5 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
                    >
                      ⓘ Ver receta en la Enciclopedia
                    </button>
                  )
                )
              })()}
            {target.ability.isStarting || target.ability.isDynamic ? (
              <p className="text-2xs italic text-wood-500">
                {target.ability.isDynamic
                  ? 'Habilidad racial/de arma — se actualiza sola al cambiar de equipo o subir de nivel, no editable.'
                  : target.ability.category === 'combate'
                    ? 'Habilidad de clase — no editable.'
                    : target.ability.category === 'profesion'
                      ? 'Habilidad de oficio — se desbloquea sola al subir de nivel, no editable.'
                      : target.ability.category === 'reino'
                        ? 'Habilidad de reino — disponible desde el inicio o al subir de nivel de oficio, no editable.'
                        : 'Habilidad de partida inicial — no editable.'}
              </p>
            ) : (
              <div className="flex gap-2">
                {onSaveAbility && (
                  <button type="button"
                    onClick={() => setEditing(true)}
                    className="tactile rounded-lg border border-accent-600/60 px-3 py-1.5 text-xs text-accent-300 transition-colors hover:bg-accent-500/10"
                  >
                    Editar
                  </button>
                )}
                {onDeleteAbility && (
                  <button type="button"
                    onClick={() => {
                      onDeleteAbility(target.ability.id)
                      onClose()
                    }}
                    className="tactile rounded-lg border border-red-900/60 px-3 py-1.5 text-xs text-red-400/80 transition-colors hover:border-red-700 hover:text-red-400"
                  >
                    Borrar
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {target.kind === 'ability' && editing && onSaveAbility && (
          <AbilityForm
            mode="edit"
            initial={target.ability}
            onCancel={() => setEditing(false)}
            onSubmit={async (params) => {
              await onSaveAbility(target.ability.id, params)
              setEditing(false)
            }}
          />
        )}

        {target.kind === 'slotManager' &&
          (() => {
            const equippedTarget = target.equipped?.catalogSlug ? enciclopediaIndex.bySlugKey.get(`item:${target.equipped.catalogSlug}`) : undefined
            return (
              <>
                <h2 className="font-serif text-lg text-wood-100">{target.slotLabel}</h2>
                {actionError && <p className="text-xs text-red-400">{actionError}</p>}

                {target.equipped ? (
                  <div className="rounded-lg border border-accent-600/40 bg-accent-500/5 p-3">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-wood-100">{target.equipped.name}</p>
                        <p className="text-2xs uppercase tracking-[0.1em] text-moss-400">Puesto ahora mismo</p>
                      </div>
                      {equippedTarget && (
                        <button
                          type="button"
                          onClick={() => onEntityDetail?.(equippedTarget)}
                          aria-label={`Consultar ${target.equipped!.name} en la Enciclopedia`}
                          className="tactile flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-iron-700 text-xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
                        >
                          ⓘ
                        </button>
                      )}
                    </div>
                    <p className="mb-2 text-xs leading-relaxed text-wood-400">{target.equipped.description}</p>
                    {/* Bug real jugando en vivo (2026-08-07, "no salen las stats de lo que llevas
                        equipado y de lo que puedes equipar"): este modal nunca mostraba
                        statBonuses, a diferencia de la ficha de un objeto suelto (rama 'item' más
                        arriba) y de las tarjetas del panel de Inventario. */}
                    {Object.entries(target.equipped.statBonuses ?? {}).some(([, amount]) => !!amount) && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <StatBonusList
                          bonuses={target.equipped.statBonuses}
                          chipClassName="rounded-full border border-accent-600/50 bg-accent-500/10 px-2 py-0.5 font-mono text-2xs text-accent-300"
                        />
                      </div>
                    )}
                    {onUnequip && (
                      <button type="button"
                        onClick={() => runEquipAction(() => onUnequip(target.equipped!))}
                        disabled={busy}
                        className="tactile rounded-lg border border-iron-700 px-3 py-1.5 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-wood-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs italic text-wood-500">Nada puesto ahí ahora mismo.</p>
                )}

                <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-wood-500">
                  {target.equipped ? 'Sustituir por' : 'Equipar'}
                </p>
                {target.options.length === 0 ? (
                  <p className="text-xs italic text-wood-500">No tienes ningún objeto compatible con esta ranura.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {target.options.map((item) => {
                      const candidateTarget = item.catalogSlug ? enciclopediaIndex.bySlugKey.get(`item:${item.catalogSlug}`) : undefined
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-1.5 rounded-lg border border-iron-700 bg-wood-950/40 px-1.5 py-1.5 transition-colors hover:border-accent-600/60"
                        >
                          <TooltipAnchor text={item.description} className="min-w-0 flex-1">
                            <button type="button"
                              onClick={() => onEquip && runEquipAction(() => onEquip(item, target.slot))}
                              disabled={busy}
                              className="tactile flex w-full flex-col items-start gap-1 text-left text-sm text-wood-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="flex w-full items-center justify-between gap-2">
                                <span className="truncate">{item.name}</span>
                                {!!item.tier && item.tier > 1 && (
                                  <span className="ml-2 shrink-0 rounded-full border border-accent2-600/50 bg-accent2-500/10 px-2 py-0.5 font-mono text-2xs text-accent2-300">
                                    Nivel {item.tier}
                                  </span>
                                )}
                              </span>
                              {/* Bug real jugando en vivo (2026-08-07): sin esto no había forma de
                                  comparar lo puesto contra las opciones antes de equipar. */}
                              {Object.entries(item.statBonuses ?? {}).some(([, amount]) => !!amount) && (
                                <span className="flex flex-wrap gap-1">
                                  <StatBonusList
                                    bonuses={item.statBonuses}
                                    chipClassName="rounded-full border border-accent-600/50 bg-accent-500/10 px-1.5 py-0.5 font-mono text-2xs text-accent-300"
                                  />
                                </span>
                              )}
                            </button>
                          </TooltipAnchor>
                          {candidateTarget && (
                            <button
                              type="button"
                              onClick={() => onEntityDetail?.(candidateTarget)}
                              aria-label={`Consultar ${item.name} en la Enciclopedia`}
                              className="tactile flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-iron-700 text-2xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
                            >
                              ⓘ
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )
          })()}

        {target.kind === 'info' &&
          (() => {
            const selectedVariant = target.variantes?.find((v) => v.slug === selectedVariantSlug) ?? null
            // Fuente del sexo (ajustado 2026-07-22, "sí, cruzar para Orcos"): si la variante
            // regional seleccionada trae su PROPIO `variantesSexo` (hoy solo Orcos), el sexo se
            // resuelve DENTRO de esa región — cada clan tiene su propio macho/hembra. Si no, cae
            // al sexo general de la raza (Goirntes/Nabieus/Faerus, sin variantes de región).
            const sexoSource = selectedVariant?.variantesSexo ?? target.variantesSexo
            const selectedSexoVariant = sexoSource?.find((v) => v.sexo === selectedSexo) ?? null
            // Contenido efectivo (ajustado 2026-07-22, "quiero tab por aspecto y que cada aspecto
            // tenga la descripción completa general + las especificaciones del aspecto", luego
            // "con los símbolos de macho y hembra", y luego "cruzar para Orcos"): ya no sustituye,
            // COMBINA — región y sexo se suman a lo general en vez de reemplazarlo, para que cada
            // combinación de pestañas se lea completa por sí sola. El icono y el botón de
            // "Insertar" siguen siendo los de la entidad padre (una variante no es insertable como
            // chip aparte). Imagen: la más específica manda — si hay sexo (cruzado con región o
            // general) con su propia imagen, esa; si no, la de la región; si no, la general.
            const image = selectedSexoVariant ?? selectedVariant ?? null
            const sexoBaseSlug = selectedVariant?.slug ?? target.entitySlug
            // Día/noche/estación (2026-08-27) — SOLO en `location` (nunca cruza con
            // variantes/sexo, que son de npc/fauna/raza). Sin texto curado que combinar (a
            // diferencia de región/sexo): la imagen de la combinación manda entera, sin mezclar
            // con la de otra.
            const selectedTiempoVariant =
              target.entityType === 'location'
                ? (target.variantesTiempo?.find((v) => v.momento === selectedMomento && v.estacion === selectedEstacion) ?? null)
                : null
            const effective = {
              name: selectedVariant?.name ?? target.name,
              meta: [target.meta, selectedVariant?.rasgoFisico, selectedSexoVariant?.rasgoFisico].filter(Boolean).join(' — ') || undefined,
              description: [target.description, selectedVariant?.description, selectedSexoVariant?.description].filter(Boolean).join('\n\n'),
              imagePrompts: selectedTiempoVariant?.imagePrompts ?? image?.imagePrompts ?? target.imagePrompts,
              imageUrls: selectedTiempoVariant?.imageUrls ?? image?.imageUrls ?? target.imageUrls,
              entitySlug: selectedTiempoVariant
                ? `${target.entitySlug}-${selectedTiempoVariant.momento}-${selectedTiempoVariant.estacion}`
                : selectedSexoVariant && sexoBaseSlug
                  ? `${sexoBaseSlug}-${selectedSexoVariant.sexo}`
                  : (selectedVariant?.slug ?? target.entitySlug),
            }
            return (
              <>
                <MediaSlot
                  icon={target.icon}
                  variant="placeholder"
                  // Bug real jugando en vivo (2026-09-06, "muchas locations en la preview del mapa
                  // no se ven aunque ya las descubrí y la imagen ya está añadida"): un asentamiento
                  // exigía únicamente su `iconoUrl` (asset propio, nuevo, mucho menos probable de
                  // estar generado) e ignoraba el banner ya generado que alimenta el mapa de Zona.
                  imageUrl={resolveImageUrl(
                    (target.asentamiento ? target.asentamiento.iconoUrl : null) ?? effective.imageUrls?.banner ?? effective.imageUrls?.thumbnail ?? null,
                  )}
                />
                <div>
                  <h2 className="font-serif text-lg text-wood-100">{effective.name}</h2>
                  {effective.meta && <p className="text-2xs uppercase tracking-[0.1em] text-wood-500">{effective.meta}</p>}
                </div>
                {target.variantes && target.variantes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {target.variantes.map((v) => (
                      <button type="button"
                        key={v.slug}
                        onClick={() => setSelectedVariantSlug(v.slug)}
                        className={`tactile rounded-full border px-2.5 py-1 text-2xs transition-colors ${
                          selectedVariant?.slug === v.slug
                            ? 'border-accent-600/60 bg-accent-500/10 text-accent-300'
                            : 'border-iron-700 text-wood-400 hover:border-accent-600/60 hover:text-accent-300'
                        }`}
                      >
                        {v.shortLabel}
                      </button>
                    ))}
                  </div>
                )}
                {sexoSource && sexoSource.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sexoSource.map((v) => (
                      <button type="button"
                        key={v.sexo}
                        onClick={() => setSelectedSexo(v.sexo)}
                        className={`tactile rounded-full border px-2.5 py-1 text-2xs transition-colors ${
                          selectedSexo === v.sexo
                            ? 'border-accent-600/60 bg-accent-500/10 text-accent-300'
                            : 'border-iron-700 text-wood-400 hover:border-accent-600/60 hover:text-accent-300'
                        }`}
                      >
                        {v.sexo === 'macho' ? '♂ Macho' : '♀ Hembra'}
                      </button>
                    ))}
                  </div>
                )}
                {/* Día/noche/estación (2026-08-27) — header de pestañas por estación + toggle de
                    día/noche, mostrando SOLO la combinación marcada (nunca los 8 prompts seguidos).
                    Solo en `location`, y solo si el backend trae variantes (partidas viejas antes
                    de este campo no las tienen). */}
                {target.entityType === 'location' && target.variantesTiempo && target.variantesTiempo.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {(['primavera', 'verano', 'otono', 'invierno'] as const).map((estacion) => (
                        <button type="button"
                          key={estacion}
                          onClick={() => setSelectedEstacion(estacion)}
                          className={`tactile rounded-full border px-2.5 py-1 text-2xs transition-colors ${
                            selectedEstacion === estacion
                              ? 'border-accent-600/60 bg-accent-500/10 text-accent-300'
                              : 'border-iron-700 text-wood-400 hover:border-accent-600/60 hover:text-accent-300'
                          }`}
                        >
                          {ESTACION_LABEL[estacion]}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMomento(selectedMomento === 'dia' ? 'noche' : 'dia')}
                      aria-label={`Cambiar a ${selectedMomento === 'dia' ? 'noche' : 'día'}`}
                      className="tactile flex w-fit items-center gap-0.5 self-start rounded-full border border-iron-700 p-0.5 text-2xs transition-colors hover:border-accent-600/60"
                    >
                      <span className={`rounded-full px-2 py-1 transition-colors ${selectedMomento === 'dia' ? 'bg-accent-500/10 text-accent-300' : 'text-wood-500'}`}>
                        ☀️ Día
                      </span>
                      <span className={`rounded-full px-2 py-1 transition-colors ${selectedMomento === 'noche' ? 'bg-accent-500/10 text-accent-300' : 'text-wood-500'}`}>
                        🌙 Noche
                      </span>
                    </button>
                  </div>
                )}
                {selectedSexoVariant && (
                  <p className="text-2xs uppercase tracking-[0.1em] text-wood-500">
                    {selectedSexoVariant.medidaCm} cm · hasta {selectedSexoVariant.edadMaxima} años
                  </p>
                )}
                <p className="whitespace-pre-line text-sm leading-relaxed text-wood-300">
                  <EnciclopediaLinkedText
                    text={effective.description}
                    index={enciclopediaIndex}
                    onDetail={(t) => onEntityDetail?.(t)}
                    onQuickInsert={(t) => onEntityQuickInsert?.(t)}
                  />
                </p>
                {/* `extra` NUNCA se enlaza (2026-07-22, bug real): para NPCs/fauna-flora este
                    campo suele ser justo la lista de sus propios alias ("También reconocido
                    como: roca, rocas, piedra..."), y cada alias es a su vez un patrón registrado
                    — enlazarlo generaba una fila de chips repetidos/cruzados sin sentido. Ya
                    siempre visible (2026-07-22): con la vista combinada de aspectos ya no tiene
                    sentido ocultar el rasgo de carácter general solo por haber elegido un aspecto. */}
                {target.ingredients && target.ingredients.length > 0 && (
                  <div className="flex flex-col gap-1 rounded-lg border border-iron-700 bg-wood-950/40 p-2.5">
                    {target.ingredients.map((i) => (
                      <div key={i.label} className="flex items-center justify-between gap-3 text-xs">
                        <span className={i.met ? 'text-wood-300' : 'text-red-400'}>{i.label}</span>
                        <span className={`font-mono tabular-nums ${i.met ? 'text-accent-300' : 'text-red-400'}`}>
                          {i.tienes}/{i.necesitas}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {target.extra && (
                  <p className="whitespace-pre-line text-xs leading-relaxed text-wood-400">{target.extra}</p>
                )}
                {target.entityType && effective.entitySlug && worldSlug && (
                  <div className="flex flex-col gap-2">
                    {/* El prompt sigue visible aunque ya haya imagen real subida (petición
                        explícita, 2026-07-22: "quiero seguir viendo los prompts aunque la imagen
                        ya esté incluida") — antes, en cuanto existía `imageUrls`, el prompt
                        desaparecía del todo detrás de un simple "cargada ✓", sin forma de
                        consultarlo o regenerarlo. */}
                    {/* Asentamientos (2026-08-31, "las ciudades deben tener prompt de mapa como la
                        zona y de icono, no de banner") — Miniatura/Banner normales se ocultan del
                        todo, sustituidos por Icono (más abajo, junto a Mapa). */}
                    {!target.asentamiento && (
                      <>
                        {effective.imageUrls?.thumbnail && <p className="text-2xs italic text-wood-500">Miniatura real cargada ✓</p>}
                        <ImagePromptSlot
                          key={`${target.entityType}-${effective.entitySlug}-thumbnail`}
                          label="Miniatura (icono)"
                          existingPrompt={effective.imagePrompts?.thumbnail ?? null}
                          worldSlug={worldSlug}
                          entityType={target.entityType}
                          entitySlug={effective.entitySlug}
                          sizeProfile="thumbnail"
                        />
                        {effective.imageUrls?.banner && <p className="text-2xs italic text-wood-500">Banner real cargado ✓</p>}
                        <ImagePromptSlot
                          key={`${target.entityType}-${effective.entitySlug}-banner`}
                          label="Banner (detalle)"
                          existingPrompt={effective.imagePrompts?.banner ?? null}
                          worldSlug={worldSlug}
                          entityType={target.entityType}
                          entitySlug={effective.entitySlug}
                          sizeProfile="banner"
                        />
                      </>
                    )}
                    {target.asentamiento && (
                      <>
                        {target.asentamiento.iconoUrl && <p className="text-2xs italic text-wood-500">Icono real cargado ✓</p>}
                        <ImagePromptSlot
                          key={`location-${effective.entitySlug}-icono`}
                          label="Icono (emblema plano)"
                          existingPrompt={target.asentamiento.iconoPrompt}
                          worldSlug={worldSlug}
                          entityType="location"
                          entitySlug={effective.entitySlug}
                          sizeProfile="icono"
                        />
                      </>
                    )}
                    {/* "Mapa" (2026-08-26, corrección de sitio: vivía en ZonaPanel.tsx, se retiró
                        de ahí) — SOLO en Localización, petición explícita: "Los 3 botones SOLO en
                        Enciclopedia > Localización". Reutiliza `entityType:'zona'` (no
                        `target.entityType`, que aquí es 'location') con el mismo `entitySlug` —
                        mismo estilo cartográfico pintado a mano que ya usa ZonaPanel.tsx para
                        pintar el fondo de esa vista, un solo generador, no dos. */}
                    {target.entityType === 'location' && (
                      <>
                        {/* `mapaImageUrl` (2026-08-27) solo se conoce cuando hay una variante de
                            tiempo seleccionada (viaja en `variantesTiempo`, no en `target` a secas)
                            — sin selección de variante (partidas viejas sin `variantesTiempo`),
                            se queda igual que antes: sin checkmark previo, siempre "Generar". */}
                        {selectedTiempoVariant?.mapaImageUrl && <p className="text-2xs italic text-wood-500">Mapa real cargado ✓</p>}
                        <ImagePromptSlot
                          key={`zona-${effective.entitySlug}-mapa`}
                          label="Mapa (fondo de la vista Zona)"
                          existingPrompt={selectedTiempoVariant?.mapaImagePrompt ?? null}
                          worldSlug={worldSlug}
                          entityType="zona"
                          entitySlug={effective.entitySlug}
                          sizeProfile="mapa"
                        />
                      </>
                    )}
                  </div>
                )}
                {onInsert && (
                  <button type="button"
                    onClick={() => {
                      onInsert()
                      onClose()
                    }}
                    className="tactile self-start rounded-lg border border-accent-600/60 px-3 py-1.5 text-xs text-accent-300 transition-colors hover:bg-accent-500/10"
                  >
                    Insertar en el mensaje
                  </button>
                )}
              </>
            )
          })()}

        <button type="button"
          onClick={onClose}
          className="tactile self-end rounded-lg border border-iron-700 bg-wood-950/50 px-3 py-1.5 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
