import { useEffect, useState } from 'react'
import {
  getEnciclopedia,
  resolveImageUrl,
  type EnciclopediaAbilityInfo,
  type EnciclopediaClassInfo,
  type EnciclopediaConstructionRecipe,
  type EnciclopediaFaunaFloraInfo,
  type EnciclopediaItemInfo,
  type EnciclopediaLocationInfo,
  type EnciclopediaNpcInfo,
  type EnciclopediaPersonajeInfo,
  type EnciclopediaRazaInfo,
} from '../../lib/api'
import { attributeLabels } from '../../lib/dice'
import { secondaryAttributeLabels } from '../../lib/secondaryAttributes'
import type { Attribute, SecondaryAttribute } from '../../types'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'
import { TooltipAnchor } from '../TooltipAnchor'
import type { DetailTarget } from '../DetailModal'
import { beriRegions } from '../../data/map'
import {
  ITEM_CATEGORY_LABEL,
  ITEM_CATEGORY_ORDER,
  abilityToDetailTarget,
  constructionToDetailTarget,
  faunaFloraIcon,
  faunaFloraToDetailTarget,
  itemIcon,
  itemToDetailTarget,
  locationToDetailTarget,
  npcIcon,
  npcToDetailTarget,
  personajeToDetailTarget,
  razaToDetailTarget,
  yieldsSummary,
} from '../../lib/enciclopediaTargets'

type EnciclopediaCategory = 'npcs' | 'items' | 'fauna' | 'flora' | 'locations' | 'classes' | 'construction' | 'attributes' | 'razas' | 'personajes'

interface EnciclopediaPanelProps {
  worldSlug: string | null
  /// Enciclopedia progresiva (2026-07-23) — gatea NPCs/fauna/flora/objetos/lugares por lo ya
  /// descubierto en ESTA partida; null = todo visible (p.ej. pantallas fuera de una partida activa).
  saveId: string | null
  onInsert: (chip: { icon: string; label: string; description?: string; value?: string }) => void
  onDetail: (target: DetailTarget, onInsertForTarget?: () => void) => void
}

function groupBy<T>(list: T[], keyFor: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of list) {
    const key = keyFor(item)
    const group = map.get(key) ?? []
    group.push(item)
    map.set(key, group)
  }
  return map
}

const ATTRIBUTES_INFO: { key: Attribute; icon: string; description: string }[] = [
  { key: 'fuerza', icon: '💪', description: 'Potencia física — golpear con fuerza, cargar peso, forzar algo con el cuerpo.' },
  { key: 'destreza', icon: '🏹', description: 'Precisión y reflejos — puntería a distancia, agilidad, reaccionar rápido.' },
  { key: 'sigilo', icon: '🕵️', description: 'Discreción y percepción — moverse sin ser visto/oído, detectar rastros y peligros.' },
  {
    key: 'voluntad',
    icon: '🛡️',
    description: 'Determinación activa — aguantar, insistir, resistir presión externa (distinto de convencer a otros).',
  },
  { key: 'carisma', icon: '🗣️', description: 'Persuasión social — convencer, negociar, ganarse a alguien con las palabras.' },
  {
    key: 'arcano',
    icon: '🔮',
    description: 'El poder salvaje nacido de Tarkor — usarlo siempre conlleva un pequeño riesgo, incluso cuando sale bien.',
  },
]

// Atributos secundarios (sesión de diseño 2026-07-23) — faltaban en esta pestaña aunque ya
// existían en la ficha de personaje: nunca mueven una tirada (dice.ts), solo comprueban umbrales
// de requisitos (craftear/equipar/construir/nivel de oficio, ver requisitos.ts en el backend).
const SECONDARY_ATTRIBUTES_INFO: { key: SecondaryAttribute; icon: string; description: string }[] = [
  { key: 'inteligencia', icon: '🧠', description: 'Agudeza mental pura — memoria, resolución de problemas (distinta de Carisma, que es persuasión social).' },
  { key: 'magia', icon: '✨', description: 'Afinidad narrativa con las escuelas de magia del mundo (elementos/oscura/purificadora/naturaleza/dominio) — distinta de Arcano, el único poder que hoy tira dados.' },
  { key: 'poderSemilla', icon: '🌱', description: 'Fuerza de la conexión innata con la Semilla creadora de tu raza — los Orcos, nacidos del Estallido sin Semilla propia, lo tienen más bajo y errático.' },
  { key: 'moral', icon: '🕊️', description: 'Entereza pasiva ante el horror, la pérdida o el miedo — no quebrarse por dentro (distinta de Voluntad, que es aguantar presión activa).' },
  { key: 'resistenciaFisica', icon: '💪', description: 'Capacidad de aguantar daño físico directo.' },
  { key: 'resistenciaMagica', icon: '🔮', description: 'Capacidad de aguantar efectos de magia salvaje.' },
  { key: 'resistenciaSemilla', icon: '🌿', description: 'Capacidad de aguantar efectos ligados al poder de una Semilla.' },
  { key: 'resistenciaFrio', icon: '❄️', description: 'Capacidad de aguantar frío extremo — relevante en Cristal Helado.' },
  { key: 'resistenciaCalor', icon: '🔥', description: 'Capacidad de aguantar calor extremo — relevante en las Llanuras del Viento Rojo.' },
]

// Roadmap de rediseño (Fable, 2026-07-21): la Enciclopedia es contenido de REFERENCIA ("lo que
// existe en el mundo, lo sepa o no todavía"), no de posesión como Inventario/Habilidades — por
// eso una paleta más fría (iron-800/accent2 al 40% en vez de iron-700/accent2 al 60%) y el clic
// abre siempre el detalle (consultar es la acción principal); "Insertar en el mensaje" vive solo
// dentro del propio modal, no como atajo de un clic en la tarjeta.
function EntryCard({
  icon,
  name,
  tooltip,
  onDetail,
  onQuickInsert,
  imageUrl,
  locked,
}: {
  icon: string
  name: string
  tooltip: string
  onDetail: () => void
  /// Atajo de un solo gesto (petición explícita, 2026-07-22): Shift+clic izquierdo inserta el chip
  /// directamente en el composer, sin pasar por "abrir ficha → botón Insertar → cerrar ficha". Un
  /// clic normal (sin Shift) sigue abriendo la ficha como siempre.
  onQuickInsert?: () => void
  imageUrl?: string | null
  /// Enciclopedia progresiva (sesión de diseño 2026-07-23, petición explícita: "solo se verá una
  /// vez la AI lo mencione por primera vez en la narración") — tarjeta bloqueada tipo "???" en vez
  /// de nombre/icono real, sin abrir ficha (no hay nada real que mostrar todavía).
  locked?: boolean
}) {
  if (locked) {
    return (
      <TooltipAnchor text="Todavía no descubierto — aparecerá cuando lo menciones o lo encuentres en el juego." className="block">
        <div className="flex w-full cursor-default flex-col items-center gap-1 rounded-lg border border-iron-900 bg-wood-950/20 px-2 py-3 text-center opacity-60">
          <span className="text-2xl leading-none">🔒</span>
          <span className="text-2xs leading-tight text-wood-600">???</span>
        </div>
      </TooltipAnchor>
    )
  }
  return (
    <TooltipAnchor text={tooltip} className="block">
      <button
        onClick={(e) => {
          if (e.shiftKey && onQuickInsert) {
            onQuickInsert()
          } else {
            onDetail()
          }
        }}
        className="tactile flex w-full flex-col items-center gap-1 rounded-lg border border-iron-800 bg-wood-950/40 px-2 py-3 text-center transition-colors hover:border-accent2-600/40 hover:bg-accent2-500/5"
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-8 w-8 rounded object-cover object-top" />
        ) : (
          <span className="text-2xl leading-none">{icon}</span>
        )}
        <span className="text-2xs leading-tight text-wood-200">{name}</span>
      </button>
    </TooltipAnchor>
  )
}

// Cuadrícula genérica de EntryCard (auditoría 2026-07-22): las 7 categorías simples de la
// Enciclopedia (NPCs/objetos/fauna/flora/lugares/razas/personajes) repetían la misma forma
// exacta — vacío-o-cuadrícula, mismo `onDetail`/`onQuickInsert` construidos a partir del mismo
// chip — con la única diferencia real de qué campo usar para icono/nombre/tooltip/imagen y a qué
// DetailTarget/chip convierte cada entrada. Esto colapsa esas ~160 líneas de JSX casi idéntico en
// un solo componente declarativo por categoría.
function EntryCardGrid<T>({
  items,
  keyOf,
  icon,
  name,
  tooltip,
  imageUrl,
  toDetailTarget,
  toChip,
  onDetail,
  onInsert,
  wide,
  discovered,
}: {
  items: T[]
  keyOf: (item: T) => string
  icon: (item: T) => string
  name: (item: T) => string
  tooltip: (item: T) => string
  imageUrl?: (item: T) => string | null | undefined
  toDetailTarget: (item: T) => DetailTarget
  toChip: (item: T) => { icon: string; label: string; description?: string; value?: string }
  onDetail: (target: DetailTarget, onInsertForTarget?: () => void) => void
  onInsert: (chip: { icon: string; label: string; description?: string; value?: string }) => void
  /// grid-cols-2 sm:grid-cols-3 (razas/personajes, cartas algo más anchas) en vez del
  /// grid-cols-3 sm:grid-cols-4 por defecto del resto de categorías.
  wide?: boolean
  /// Enciclopedia progresiva (2026-07-23) — solo lo pasan las categorías gateadas (NPCs/fauna/
  /// flora/lugares); ausente = todo visible, como hasta ahora (razas/personajes/atributos...).
  discovered?: (item: T) => boolean
}) {
  return (
    <div className={wide ? 'grid grid-cols-2 gap-2 sm:grid-cols-3' : 'grid grid-cols-3 gap-2 sm:grid-cols-4'}>
      {items.map((item) =>
        discovered && !discovered(item) ? (
          <EntryCard key={keyOf(item)} icon={icon(item)} name={name(item)} tooltip={tooltip(item)} onDetail={() => {}} locked />
        ) : (
          <EntryCard
            key={keyOf(item)}
            icon={icon(item)}
            name={name(item)}
            tooltip={tooltip(item)}
            imageUrl={imageUrl?.(item) ?? undefined}
            onDetail={() => onDetail(toDetailTarget(item), () => onInsert(toChip(item)))}
            onQuickInsert={() => onInsert(toChip(item))}
          />
        ),
      )}
    </div>
  )
}

const CATEGORY_TABS: { id: EnciclopediaCategory; label: string; icon: string }[] = [
  { id: 'npcs', label: 'NPCs', icon: '🧑' },
  { id: 'items', label: 'Objetos', icon: '📦' },
  { id: 'fauna', label: 'Fauna', icon: '🐾' },
  { id: 'flora', label: 'Flora', icon: '🌿' },
  { id: 'locations', label: 'Lugares', icon: '🗺️' },
  { id: 'razas', label: 'Razas', icon: '🏛️' },
  { id: 'personajes', label: 'Personajes', icon: '🎭' },
  { id: 'classes', label: 'Clases', icon: '🎓' },
  { id: 'construction', label: 'Construcciones', icon: '🏗️' },
  { id: 'attributes', label: 'Atributos', icon: '📊' },
]

// Enciclopedia consultable del mundo (roadmap 2026-07-21, petición explícita de la usuaria):
// catálogo categorizado — NPCs, objetos (por subcategoría), fauna/flora, lugares (por región),
// clases y habilidades, construcciones y atributos. Resuelve de paso el problema real de no saber
// qué nombre exacto usar para que el motor reconozca un NPC o presa (ver hallazgo del combate que
// nunca se disparaba por mencionar amenazas anónimas). Layout de sidebar + contenido (Fable,
// 2026-07-21, Nivel 2 de su roadmap): con 7 categorías y creciendo, una barra de tabs horizontal
// ya rompía a 2 líneas — la Enciclopedia es el único panel con subnavegación interna, así que
// merece su propio layout de dos columnas dentro del cajón.
export function EnciclopediaPanel({ worldSlug, saveId, onInsert, onDetail }: EnciclopediaPanelProps) {
  const [category, setCategory] = useState<EnciclopediaCategory>('npcs')
  const [npcs, setNpcs] = useState<EnciclopediaNpcInfo[]>([])
  const [items, setItems] = useState<EnciclopediaItemInfo[]>([])
  const [faunaFlora, setFaunaFlora] = useState<EnciclopediaFaunaFloraInfo[]>([])
  const [locations, setLocations] = useState<EnciclopediaLocationInfo[]>([])
  const [razas, setRazas] = useState<EnciclopediaRazaInfo[]>([])
  const [personajes, setPersonajes] = useState<EnciclopediaPersonajeInfo[]>([])
  const [startingAbilities, setStartingAbilities] = useState<EnciclopediaAbilityInfo[]>([])
  const [classes, setClasses] = useState<EnciclopediaClassInfo[]>([])
  const [constructionRecipes, setConstructionRecipes] = useState<EnciclopediaConstructionRecipe[]>([])
  const [loading, setLoading] = useState(true)
  // Colapsables de clase (2026-07-22, petición explícita: "que cada clase sea un colapsable que al
  // pulsarlo veas el árbol de habilidades") — Set en vez de un solo string porque no hay razón
  // para que abrir una cierre la otra, a diferencia de las pestañas de arriba (sí exclusivas).
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!worldSlug) return
    let cancelled = false
    setLoading(true)
    getEnciclopedia(worldSlug, saveId)
      .then((data) => {
        if (cancelled) return
        setNpcs(data.npcs)
        setItems(data.items)
        setFaunaFlora(data.faunaFlora)
        setLocations(data.locations)
        setRazas(data.razas)
        setPersonajes(data.personajes)
        setStartingAbilities(data.startingAbilities)
        setClasses(data.classes)
        setConstructionRecipes(data.constructionRecipes)
      })
      .catch(() => {
        // Sin conexión al backend: la enciclopedia se queda vacía en vez de romper el panel.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [worldSlug, saveId])

  const itemsByCategory = groupBy(items, (i) => i.category)
  const orderedItemCategories = [
    ...ITEM_CATEGORY_ORDER.filter((c) => itemsByCategory.has(c)),
    ...Array.from(itemsByCategory.keys()).filter((c) => !ITEM_CATEGORY_ORDER.includes(c)),
  ]

  const locationsByRegion = groupBy(locations, (l) => l.region)
  const faunaEntries = faunaFlora.filter((e) => e.esFauna)
  const floraEntries = faunaFlora.filter((e) => !e.esFauna)

  // División por raza (2026-07-23, petición explícita: "tiene que haber construcciones por
  // raza... el campamento va a ser la construcción básica y común") — `raza: null` es la única
  // común hoy (campamento); el resto de razas queda listo para recibir recetas propias más
  // adelante, sin mostrar una sección vacía mientras tanto.
  const commonConstructions = constructionRecipes.filter((r) => !r.raza)
  const constructionsByRaza = groupBy(
    constructionRecipes.filter((r): r is typeof constructionRecipes[number] & { raza: string } => !!r.raza),
    (r) => r.raza,
  )
  function renderConstructionList(recipes: EnciclopediaConstructionRecipe[]) {
    return (
      <div className="flex flex-col gap-2">
        {recipes.map((recipe) => {
          const requisitos = recipe.requirements.map((r) => `${r.cantidad} de ${r.label}`).join(', ')
          const imageUrl = resolveImageUrl(recipe.imageUrls.thumbnail)
          return (
            <button
              key={recipe.key}
              onClick={(e) => {
                if (e.shiftKey) {
                  onInsert({ icon: '🏗️', label: recipe.name, value: `Me pongo a construir ${recipe.name}` })
                } else {
                  onDetail(constructionToDetailTarget(recipe), () =>
                    onInsert({ icon: '🏗️', label: recipe.name, value: `Me pongo a construir ${recipe.name}` }),
                  )
                }
              }}
              className="tactile flex items-center gap-3 rounded-lg border border-iron-800 bg-wood-950/40 px-3.5 py-2.5 text-left transition-colors hover:border-accent2-600/40 hover:bg-accent2-500/5"
            >
              {imageUrl ? (
                <img src={imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover object-top" />
              ) : (
                <span className="shrink-0 text-2xl leading-none">🏗️</span>
              )}
              <div>
                <p className="font-medium text-wood-100">{recipe.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-wood-400">Necesita: {requisitos}.</p>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <nav className="flex w-28 shrink-0 flex-col gap-1">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategory(tab.id)}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
              category === tab.id ? 'bg-accent2-500/10 font-medium text-accent2-300' : 'text-wood-400 hover:bg-wood-950/40 hover:text-wood-200'
            }`}
          >
            <span className="text-sm leading-none">{tab.icon}</span>
            <span className="leading-tight">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-sm italic text-wood-500">Cargando enciclopedia...</p>
        ) : (
          <>
            {category === 'npcs' &&
              (npcs.length === 0 ? (
                <PanelEmptyState icon="🧑" title="Sin NPCs catalogados" hint="Todavía no hay ninguno en este mundo." />
              ) : (
                <EntryCardGrid
                  items={npcs}
                  keyOf={(npc) => npc.slug}
                  icon={npcIcon}
                  name={(npc) => npc.name}
                  tooltip={(npc) => `${npc.role}${npc.faction ? ` — ${npc.faction}` : ''}`}
                  imageUrl={(npc) => resolveImageUrl(npc.imageUrls.thumbnail)}
                  toDetailTarget={npcToDetailTarget}
                  toChip={(npc) => ({ icon: npcIcon(), label: npc.name, description: npc.bio })}
                  onDetail={onDetail}
                  onInsert={onInsert}
                  discovered={(npc) => npc.discovered}
                />
              ))}

            {category === 'items' &&
              (items.length === 0 ? (
                <PanelEmptyState icon="📦" title="Sin objetos catalogados" hint="Todavía no hay ninguno en este mundo." />
              ) : (
                <div className="flex flex-col gap-5">
                  {orderedItemCategories.map((cat) => (
                    <PanelSection key={cat} title={ITEM_CATEGORY_LABEL[cat] ?? cat}>
                      <EntryCardGrid
                        items={itemsByCategory.get(cat) ?? []}
                        keyOf={(item) => item.slug}
                        icon={(item) => itemIcon(item.category)}
                        name={(item) => item.name}
                        tooltip={(item) => item.description}
                        imageUrl={(item) => resolveImageUrl(item.imageUrls.thumbnail)}
                        toDetailTarget={itemToDetailTarget}
                        toChip={(item) => ({ icon: itemIcon(item.category), label: item.name, description: item.description })}
                        onDetail={onDetail}
                        onInsert={onInsert}
                        discovered={(item) => item.discovered}
                      />
                    </PanelSection>
                  ))}
                </div>
              ))}

            {category === 'fauna' &&
              (faunaEntries.length === 0 ? (
                <PanelEmptyState icon="🐾" title="Sin fauna catalogada" hint="Todavía no hay ninguna en este mundo." />
              ) : (
                <EntryCardGrid
                  items={faunaEntries}
                  keyOf={(entry) => entry.sourceSlug}
                  icon={faunaFloraIcon}
                  name={(entry) => entry.sourceName}
                  tooltip={yieldsSummary}
                  imageUrl={(entry) => resolveImageUrl(entry.imageUrls.thumbnail)}
                  toDetailTarget={faunaFloraToDetailTarget}
                  toChip={(entry) => ({ icon: faunaFloraIcon(entry), label: entry.sourceName })}
                  onDetail={onDetail}
                  onInsert={onInsert}
                  discovered={(entry) => entry.discovered}
                />
              ))}

            {category === 'flora' &&
              (floraEntries.length === 0 ? (
                <PanelEmptyState icon="🌿" title="Sin flora catalogada" hint="Todavía no hay ninguna en este mundo." />
              ) : (
                <EntryCardGrid
                  items={floraEntries}
                  keyOf={(entry) => entry.sourceSlug}
                  icon={faunaFloraIcon}
                  name={(entry) => entry.sourceName}
                  tooltip={yieldsSummary}
                  imageUrl={(entry) => resolveImageUrl(entry.imageUrls.thumbnail)}
                  toDetailTarget={faunaFloraToDetailTarget}
                  toChip={(entry) => ({ icon: faunaFloraIcon(entry), label: entry.sourceName })}
                  onDetail={onDetail}
                  onInsert={onInsert}
                  discovered={(entry) => entry.discovered}
                />
              ))}

            {category === 'locations' &&
              (locations.length === 0 ? (
                <PanelEmptyState icon="🗺️" title="Sin lugares catalogados" hint="Todavía no hay ninguno en este mundo." />
              ) : (
                <div className="flex flex-col gap-5">
                  {beriRegions.map((region) => {
                    const regionLocations = locationsByRegion.get(region.name) ?? []
                    if (regionLocations.length === 0) return null
                    return (
                      <PanelSection key={region.name} title={region.name}>
                        <p className="mb-2 text-xs italic leading-relaxed text-wood-500">{region.description}</p>
                        <EntryCardGrid
                          items={regionLocations}
                          keyOf={(loc) => loc.slug}
                          icon={() => '📍'}
                          name={(loc) => loc.name}
                          tooltip={(loc) => loc.description}
                          imageUrl={(loc) => resolveImageUrl(loc.imageUrls.thumbnail)}
                          toDetailTarget={locationToDetailTarget}
                          toChip={(loc) => ({ icon: '📍', label: loc.name, description: loc.description })}
                          onDetail={onDetail}
                          onInsert={onInsert}
                          discovered={(loc) => loc.discovered}
                        />
                      </PanelSection>
                    )
                  })}
                </div>
              ))}

            {category === 'razas' &&
              (razas.length === 0 ? (
                <PanelEmptyState icon="🏛️" title="Sin razas catalogadas" hint="Todavía no hay ninguna en este mundo." />
              ) : (
                <EntryCardGrid
                  wide
                  items={razas}
                  keyOf={(raza) => raza.slug}
                  icon={(raza) => raza.icon}
                  name={(raza) => raza.name}
                  tooltip={(raza) => raza.rasgoCaracter}
                  imageUrl={(raza) => resolveImageUrl(raza.imageUrls.thumbnail)}
                  toDetailTarget={razaToDetailTarget}
                  toChip={(raza) => ({ icon: raza.icon, label: raza.name, description: raza.description })}
                  onDetail={onDetail}
                  onInsert={onInsert}
                />
              ))}

            {category === 'personajes' &&
              (personajes.length === 0 ? (
                <PanelEmptyState icon="🎭" title="Sin personajes catalogados" hint="Todavía no hay ninguno en este mundo." />
              ) : (
                <EntryCardGrid
                  wide
                  items={personajes}
                  keyOf={(pj) => pj.slug}
                  icon={(pj) => pj.icon}
                  name={(pj) => pj.name}
                  tooltip={(pj) => pj.raza}
                  imageUrl={(pj) => resolveImageUrl(pj.imageUrls.thumbnail)}
                  toDetailTarget={personajeToDetailTarget}
                  toChip={(pj) => ({ icon: pj.icon, label: pj.name, description: pj.historia })}
                  onDetail={onDetail}
                  onInsert={onInsert}
                />
              ))}

            {category === 'classes' &&
              (classes.length === 0 ? (
                <PanelEmptyState icon="🎓" title="Sin clases catalogadas" hint="Todavía no hay ninguna en este mundo." />
              ) : (
                <div className="flex flex-col gap-5">
                  {startingAbilities.length > 0 && (
                    <PanelSection title="Habilidades iniciales de Gorhorn">
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {startingAbilities.map((ability) => (
                          <EntryCard
                            key={ability.name}
                            icon={ability.icon}
                            name={ability.name}
                            tooltip={ability.description}
                            imageUrl={resolveImageUrl(ability.imageUrls.thumbnail)}
                            onDetail={() =>
                              onDetail(abilityToDetailTarget(ability, 'Habilidad inicial'), () =>
                                onInsert({ icon: ability.icon, label: ability.name, description: ability.description, value: ability.promptText }),
                              )
                            }
                            onQuickInsert={() =>
                              onInsert({ icon: ability.icon, label: ability.name, description: ability.description, value: ability.promptText })
                            }
                          />
                        ))}
                      </div>
                    </PanelSection>
                  )}

                  {/* Colapsables por clase (2026-07-22, petición explícita: "Guerrero es una
                      clase y Cazador es otra con sus propias habilidades... que cada clase sea un
                      colapsable que al pulsarlo veas el árbol de habilidades") — Gorhorn aprende
                      de las dos (variante especial), pero cada una tiene su propio árbol. */}
                  {classes.map((clase) => {
                    const isExpanded = expandedClasses.has(clase.name)
                    return (
                      <div key={clase.name} className="rounded-lg border border-iron-800">
                        <button
                          onClick={() =>
                            setExpandedClasses((prev) => {
                              const next = new Set(prev)
                              if (next.has(clase.name)) next.delete(clase.name)
                              else next.add(clase.name)
                              return next
                            })
                          }
                          className="tactile flex w-full items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-left transition-colors hover:bg-wood-950/40"
                        >
                          <div>
                            <h3 className="font-serif text-base text-wood-100">{clase.name}</h3>
                            <p className="mt-1 text-xs leading-relaxed text-wood-400">{clase.description}</p>
                          </div>
                          <span className={`shrink-0 text-wood-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-iron-800 px-3.5 py-3">
                            {/* Senda de nivel (Fable, 2026-07-21): línea vertical que atraviesa
                                cada desbloqueo — progresión lineal real, no un árbol ramificado. */}
                            <div className="flex flex-col gap-1.5 border-l-2 border-iron-700 pl-4">
                              {[...clase.unlocks]
                                .sort((a, b) => a.level - b.level)
                                .map(({ level, ability }) => (
                                  <button
                                    key={ability.name}
                                    onClick={(e) => {
                                      if (e.shiftKey) {
                                        onInsert({
                                          icon: ability.icon,
                                          label: ability.name,
                                          description: ability.description,
                                          value: ability.promptText,
                                        })
                                      } else {
                                        onDetail(abilityToDetailTarget(ability, `Nivel ${level}`), () =>
                                          onInsert({
                                            icon: ability.icon,
                                            label: ability.name,
                                            description: ability.description,
                                            value: ability.promptText,
                                          }),
                                        )
                                      }
                                    }}
                                    className="tactile relative flex items-center gap-3 rounded-lg border border-iron-800 bg-wood-950/40 px-3 py-2 text-left transition-colors hover:border-accent2-600/40 hover:bg-accent2-500/5"
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="absolute -left-[1.375rem] h-2 w-2 rounded-full border border-accent2-500 bg-wood-950"
                                    />
                                    <span className="rounded-full border border-iron-700 bg-wood-950/60 px-2 py-0.5 font-mono text-2xs text-wood-400">
                                      Nv. {level}
                                    </span>
                                    <span className="text-lg leading-none">{ability.icon}</span>
                                    <span className="text-sm text-wood-200">{ability.name}</span>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}

            {category === 'construction' &&
              (constructionRecipes.length === 0 ? (
                <PanelEmptyState icon="🏗️" title="Sin construcciones catalogadas" hint="Todavía no hay ninguna disponible." />
              ) : (
                <div className="flex flex-col gap-5">
                  <PanelSection title="Común">{renderConstructionList(commonConstructions)}</PanelSection>
                  {razas.map((raza) => {
                    const list = constructionsByRaza.get(raza.slug) ?? []
                    if (list.length === 0) return null
                    return (
                      <PanelSection key={raza.slug} title={raza.name}>
                        {renderConstructionList(list)}
                      </PanelSection>
                    )
                  })}
                </div>
              ))}

            {category === 'attributes' && (
              <div className="flex flex-col gap-5">
                <PanelSection title="Atributos jugables">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {ATTRIBUTES_INFO.map((attr) => (
                      <EntryCard
                        key={attr.key}
                        icon={attr.icon}
                        name={attributeLabels[attr.key]}
                        tooltip={attr.description}
                        onDetail={() => onDetail({ kind: 'info', icon: attr.icon, name: attributeLabels[attr.key], description: attr.description })}
                      />
                    ))}
                  </div>
                </PanelSection>
                <PanelSection title="Atributos secundarios">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {SECONDARY_ATTRIBUTES_INFO.map((attr) => (
                      <EntryCard
                        key={attr.key}
                        icon={attr.icon}
                        name={secondaryAttributeLabels[attr.key]}
                        tooltip={attr.description}
                        onDetail={() =>
                          onDetail({ kind: 'info', icon: attr.icon, name: secondaryAttributeLabels[attr.key], description: attr.description })
                        }
                      />
                    ))}
                  </div>
                </PanelSection>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
