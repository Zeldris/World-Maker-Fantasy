import { useEffect, useState } from 'react'
import type { EquipSlot, InventoryItemInfo, SavedActionInfo } from '../types'
import { attributeLabels } from '../lib/dice'
import {
  resolveImageUrl,
  type EnciclopediaImagePrompts,
  type EnciclopediaImageUrls,
  type EnciclopediaRazaVariante,
  type EnciclopediaSexoVariante,
  type ImagePromptEntityType,
} from '../lib/api'
import { AbilityForm, type AbilityFormParams } from './AbilityForm'
import { EnciclopediaLinkedText } from './EnciclopediaLinkedText'
import { useEnciclopediaLink } from '../context/EnciclopediaLinkContext'
import { MediaSlot, ImagePromptSlot } from './ImagePromptDisplay'

export type DetailTarget =
  | { kind: 'item'; item: InventoryItemInfo }
  | { kind: 'ability'; ability: SavedActionInfo }
  | { kind: 'slotPicker'; slot: EquipSlot; slotLabel: string; options: InventoryItemInfo[] }
  | {
      kind: 'info'
      icon: string
      name: string
      meta?: string
      description: string
      extra?: string
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
  async function runEquipAction(action: () => Promise<void>) {
    setActionError(null)
    try {
      await action()
      onClose()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo completar la acción.')
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
  const targetKey = target.kind === 'info' ? target.entitySlug : undefined
  useEffect(() => {
    if (target.kind !== 'info') {
      setSelectedVariantSlug(null)
      setSelectedSexo(null)
      return
    }
    const firstVariant = target.variantes?.[0] ?? null
    setSelectedVariantSlug(firstVariant?.slug ?? null)
    setSelectedSexo((firstVariant?.variantesSexo ?? target.variantesSexo)?.[0]?.sexo ?? null)
  }, [targetKey])

  return (
    <div className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="plank-panel animate-combat-enter relative flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {target.kind === 'item' && (
          <>
            <MediaSlot
              icon={target.item.slot ? '⚔️' : '🎒'}
              variant="placeholder"
              imageUrl={resolveImageUrl(target.item.imageUrls?.banner ?? null)}
            />
            <div>
              <h2 className="font-serif text-lg text-wood-100">{target.item.name}</h2>
              {target.item.slot && <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-moss-400">Equipado</p>}
            </div>
            <p className="text-sm leading-relaxed text-wood-300">{target.item.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {!!target.item.statBonusAttribute && !!target.item.statBonusAmount && (
                <p className="self-start rounded-full border border-accent-600/50 bg-accent-500/10 px-2.5 py-1 font-mono text-xs text-accent-300">
                  +{target.item.statBonusAmount} {attributeLabels[target.item.statBonusAttribute]}
                </p>
              )}
              {!!target.item.tier && target.item.tier > 1 && (
                <p className="self-start rounded-full border border-accent2-600/50 bg-accent2-500/10 px-2.5 py-1 font-mono text-xs text-accent2-300">
                  Nivel {target.item.tier}
                </p>
              )}
            </div>
            {!!target.item.origin && <p className="text-2xs uppercase tracking-[0.1em] text-wood-600">{target.item.origin}</p>}
            {actionError && <p className="text-xs text-red-400">{actionError}</p>}
            {target.item.slot && onUnequip && (
              <button
                onClick={() => runEquipAction(() => onUnequip(target.item))}
                className="tactile self-start rounded-lg border border-iron-700 px-3 py-1.5 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-wood-100"
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
            <p className="text-sm leading-relaxed text-wood-300">{target.ability.description || 'Sin descripción.'}</p>
            <p className="rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2 text-xs italic text-wood-400">"{target.ability.promptText}"</p>
            {target.ability.isStarting ? (
              <p className="text-2xs italic text-wood-500">
                {target.ability.category === 'combate' ? 'Habilidad de clase — no editable.' : 'Habilidad de partida inicial — no editable.'}
              </p>
            ) : (
              <div className="flex gap-2">
                {onSaveAbility && (
                  <button
                    onClick={() => setEditing(true)}
                    className="tactile rounded-lg border border-accent-600/60 px-3 py-1.5 text-xs text-accent-300 transition-colors hover:bg-accent-500/10"
                  >
                    Editar
                  </button>
                )}
                {onDeleteAbility && (
                  <button
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

        {target.kind === 'slotPicker' && (
          <>
            <h2 className="font-serif text-lg text-wood-100">Equipar en {target.slotLabel}</h2>
            {actionError && <p className="text-xs text-red-400">{actionError}</p>}
            {target.options.length === 0 ? (
              <p className="text-xs italic text-wood-500">No hay objetos sin equipar para asignar aquí.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {target.options.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onEquip && runEquipAction(() => onEquip(item, target.slot))}
                    className="tactile flex items-center justify-between rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2 text-left text-sm text-wood-200 transition-colors hover:border-accent-600/60 hover:text-accent-300"
                  >
                    {item.name}
                    {!!item.tier && item.tier > 1 && (
                      <span className="ml-2 shrink-0 rounded-full border border-accent2-600/50 bg-accent2-500/10 px-2 py-0.5 font-mono text-2xs text-accent2-300">
                        Nivel {item.tier}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

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
            const effective = {
              name: selectedVariant?.name ?? target.name,
              meta: [target.meta, selectedVariant?.rasgoFisico, selectedSexoVariant?.rasgoFisico].filter(Boolean).join(' — ') || undefined,
              description: [target.description, selectedVariant?.description, selectedSexoVariant?.description].filter(Boolean).join('\n\n'),
              imagePrompts: image?.imagePrompts ?? target.imagePrompts,
              imageUrls: image?.imageUrls ?? target.imageUrls,
              entitySlug:
                selectedSexoVariant && sexoBaseSlug
                  ? `${sexoBaseSlug}-${selectedSexoVariant.sexo}`
                  : (selectedVariant?.slug ?? target.entitySlug),
            }
            return (
              <>
                <MediaSlot icon={target.icon} variant="placeholder" imageUrl={resolveImageUrl(effective.imageUrls?.banner ?? null)} />
                <div>
                  <h2 className="font-serif text-lg text-wood-100">{effective.name}</h2>
                  {effective.meta && <p className="text-2xs uppercase tracking-[0.1em] text-wood-500">{effective.meta}</p>}
                </div>
                {target.variantes && target.variantes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {target.variantes.map((v) => (
                      <button
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
                      <button
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
                  </div>
                )}
                {onInsert && (
                  <button
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

        <button
          onClick={onClose}
          className="tactile self-end rounded-lg border border-iron-700 bg-wood-950/50 px-3 py-1.5 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
