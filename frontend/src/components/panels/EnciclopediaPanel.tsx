import { useState, type ReactNode } from 'react'
import {
  resolveImageUrl,
  type EnciclopediaConstructionRecipe,
  type EnciclopediaCraftingRecipe,
  type EnciclopediaFaunaFloraInfo,
  type EnciclopediaImageUrls,
  type EnciclopediaItemInfo,
  type EnciclopediaResponse,
} from '../../lib/api'
import { attributeLabels } from '../../lib/dice'
import { secondaryAttributeLabels } from '../../lib/secondaryAttributes'
import type { Attribute, RecipeStatusInfo, SecondaryAttribute } from '../../types'
import { PanelEmptyState } from '../PanelEmptyState'
import { PanelSection } from '../PanelSection'
import { TooltipAnchor } from '../TooltipAnchor'
import type { DetailTarget } from '../DetailModal'
import { beriRegions } from '../../data/map'
import { professions } from '../../data/professions'
import {
  ITEM_CATEGORY_LABEL,
  ITEM_CATEGORY_ORDER,
  ITEM_TIPO_LABEL,
  ITEM_TIPO_ORDER,
  abilityToDetailTarget,
  constructionToDetailTarget,
  craftingToDetailTarget,
  faccionToDetailTarget,
  faunaFloraIcon,
  faunaFloraToDetailTarget,
  historiaEntryToDetailTarget,
  itemIcon,
  itemToDetailTarget,
  locationToDetailTarget,
  npcIcon,
  npcToDetailTarget,
  oficioRequirementLine,
  personajeToDetailTarget,
  razaToDetailTarget,
  yieldsSummary,
} from '../../lib/enciclopediaTargets'

type EnciclopediaCategory =
  | 'npcs'
  | 'items'
  | 'fauna'
  | 'flora'
  | 'locations'
  | 'classes'
  | 'construction'
  | 'attributes'
  | 'razas'
  | 'personajes'
  | 'facciones'
  | 'historia'
  | 'crafteo'
  | 'combate'

interface EnciclopediaPanelProps {
  /// Datos crudos de la Enciclopedia (auditoría 2026-08-13, dedupe de doble fetch): antes este
  /// panel pedía por su cuenta lo mismo que ya había pedido `useEnciclopedia` en GameView.tsx para
  /// el enlazado de menciones en narración — sin ninguna razón real (ver useEnciclopedia.ts), y
  /// encima con `saveId` distinto entre ambas llamadas. Ahora GameView es la única fuente de red;
  /// este panel solo consume. `null` = todavía no ha llegado la primera respuesta.
  data: EnciclopediaResponse | null
  /// `true` mientras la petición (de GameView) sigue en vuelo — distinto de `data === null`, que
  /// también es el estado tras un fallo de red ya resuelto (ver comentario de useEnciclopedia.ts).
  loading: boolean
  /// Estado real de materiales/atributos/ubicación de cada receta EN ESTA PARTIDA (2026-08-13,
  /// petición explícita: "el hover... 5/10... en la propia enciclopedia también") — viene de
  /// GameView.tsx (GET /saves/:id/recipes-status, ya se recarga con el inventario), no se pide
  /// aparte aquí para no duplicar la petición ni arriesgar quedarse con datos viejos. Vacío = sin
  /// partida activa, las secciones de Crafteo/Construcciones se quedan con el listado estático.
  recipesStatus: RecipeStatusInfo[]
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
  {
    key: 'constitucion',
    icon: '🪨',
    description: 'Resistencia física pura — aguantar el castigo, el frío, el hambre, seguir en pie cuando otro ya habría caído.',
  },
  {
    key: 'inteligencia',
    icon: '🧠',
    description: 'Agudeza mental aplicada al combate — leer al enemigo, anticipar su siguiente movimiento, aprovechar una abertura calculada.',
  },
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

// Mismo orden que `ATTRIBUTE_RING` en backend/src/services/attributeWheel.ts — se duplica aquí
// porque es una constante de diseño (no contenido de partida servido por la API); si cambia
// allí, hay que actualizar este array a mano.
const WEAKNESS_RING: Attribute[] = ['fuerza', 'destreza', 'inteligencia', 'arcano', 'constitucion', 'voluntad', 'carisma']

const WEAKNESS_RING_COLOR: Record<Attribute, string> = {
  fuerza: 'var(--color-fuerza-500)',
  destreza: 'var(--color-destreza-500)',
  constitucion: 'var(--color-constitucion-500)',
  inteligencia: 'var(--color-inteligencia-500)',
  voluntad: 'var(--color-voluntad-500)',
  carisma: 'var(--color-carisma-500)',
  arcano: 'var(--color-arcano-500)',
}

// Rediseño del turno de combate (2026-07-28, petición explícita: "un tab para ver el árbol de
// debilidades") — visualiza el anillo de attributeWheel.ts: cada flecha apunta a quien tiene
// ventaja de tipo directa (distancia 1, ×1.5 en ambos árboles de ataque y defensa); saltarse
// un nodo (distancia 2) es un efecto más suave, mostrado solo en la tabla de debajo, no como
// flecha, para no saturar el dibujo con las 15 combinaciones posibles. Solo premia, nunca
// penaliza (rediseño 2026-08-15, ver el comentario largo de `typeMultiplierFor` en el backend):
// usar el tipo perdedor no divide nada, se queda en ×1 neutro.
function AttributeWheelDiagram() {
  const size = 260
  const center = size / 2
  const radius = 92
  const nodeRadius = 28
  const points = WEAKNESS_RING.map((attr, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / WEAKNESS_RING.length
    return { attr, x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) }
  })

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-xs">
        <defs>
          <marker id="weakness-ring-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="var(--color-wood-500)" />
          </marker>
        </defs>
        {points.map((p, i) => {
          const next = points[(i + 1) % points.length]
          const dx = next.x - p.x
          const dy = next.y - p.y
          const dist = Math.hypot(dx, dy)
          const ux = dx / dist
          const uy = dy / dist
          return (
            <line
              key={`edge-${p.attr}`}
              x1={p.x + ux * nodeRadius}
              y1={p.y + uy * nodeRadius}
              x2={next.x - ux * (nodeRadius + 8)}
              y2={next.y - uy * (nodeRadius + 8)}
              stroke="var(--color-wood-500)"
              strokeWidth={1.5}
              markerEnd="url(#weakness-ring-arrow)"
            />
          )
        })}
        {points.map((p) => {
          const info = ATTRIBUTES_INFO.find((a) => a.key === p.attr)
          return (
            <g key={p.attr}>
              <circle
                cx={p.x}
                cy={p.y}
                r={nodeRadius}
                fill={WEAKNESS_RING_COLOR[p.attr]}
                fillOpacity={0.18}
                stroke={WEAKNESS_RING_COLOR[p.attr]}
                strokeWidth={2}
              />
              <text x={p.x} y={p.y - 3} textAnchor="middle" style={{ fontSize: 15 }}>
                {info?.icon}
              </text>
              <text x={p.x} y={p.y + 14} textAnchor="middle" className="fill-wood-200" style={{ fontSize: 9 }}>
                {attributeLabels[p.attr]}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="max-w-sm text-center text-xs leading-relaxed text-wood-400">
        Cada flecha apunta a quien tiene ventaja directa (distancia 1 en el anillo): usar ese tipo contra el anterior
        multiplica tu atributo efectivo en la tirada. Usarlo al revés no te penaliza — tu tirada sigue siendo la
        normal, sin ningún descuento. Aplica por separado a la tirada de ataque y a la de defensa.
      </p>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-iron-800 text-wood-500">
              <th className="py-1 text-left font-medium">Distancia en el anillo</th>
              <th className="py-1 text-left font-medium">Ejemplo</th>
              <th className="py-1 text-right font-medium">Multiplicador (solo quien gana)</th>
            </tr>
          </thead>
          <tbody className="text-wood-300">
            <tr className="border-b border-iron-900">
              <td className="py-1.5">1 · contrario directo</td>
              <td className="py-1.5">Destreza vs Fuerza</td>
              <td className="py-1.5 text-right">×1.5</td>
            </tr>
            <tr className="border-b border-iron-900">
              <td className="py-1.5">2 · salta un nodo</td>
              <td className="py-1.5">Inteligencia vs Fuerza</td>
              <td className="py-1.5 text-right">×1.15</td>
            </tr>
            <tr>
              <td className="py-1.5">3 · máxima distancia (anillo de 7, sin antípoda exacta)</td>
              <td className="py-1.5">Arcano vs Fuerza</td>
              <td className="py-1.5 text-right">sin relación (×1)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Atributos secundarios (sesión de diseño 2026-07-23) — faltaban en esta pestaña aunque ya
// existían en la ficha de personaje: nunca mueven una tirada (dice.ts), solo comprueban umbrales
// de requisitos (craftear/equipar/construir/nivel de oficio, ver requisitos.ts en el backend).
const SECONDARY_ATTRIBUTES_INFO: { key: SecondaryAttribute; icon: string; description: string }[] = [
  { key: 'sigilo', icon: '🕵️', description: 'Discreción — moverse sin ser visto/oído, detectar rastros. Narrativo/de umbral, ya no mueve tiradas de combate.' },
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

// Colapsable genérico (2026-07-29, petición explícita: colapsables por tipo de objeto, zona de
// fauna/flora y raza de NPC) — mismo patrón visual ya usado para las clases (cabecera con flecha
// que rota + contenido que aparece/desaparece), extraído aquí para no repetirlo 4 veces.
function CollapsibleGroup({
  title,
  count,
  expanded,
  onToggle,
  children,
}: {
  title: string
  count: number
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-iron-800">
      <button
        onClick={onToggle}
        className="tactile flex w-full items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-left transition-colors hover:bg-wood-950/40"
      >
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-wood-400">
          {title} <span className="font-mono normal-case tracking-normal text-wood-600">({count})</span>
        </p>
        <span className={`shrink-0 text-wood-500 transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {expanded && <div className="flex flex-col gap-4 border-t border-iron-800 px-3.5 py-3">{children}</div>}
    </div>
  )
}

// Set de claves expandidas (2026-07-29) — un solo hook reutilizado por los 4 colapsables de este
// panel; Set en vez de un solo string porque abrir un grupo no debería cerrar otro.
function useToggleSet(): [Set<string>, (key: string) => void] {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  return [expanded, toggle]
}

const CATEGORY_TABS: { id: EnciclopediaCategory; label: string; icon: string }[] = [
  { id: 'npcs', label: 'NPCs', icon: '🧑' },
  { id: 'items', label: 'Objetos', icon: '📦' },
  { id: 'fauna', label: 'Fauna', icon: '🐾' },
  { id: 'flora', label: 'Flora', icon: '🌿' },
  { id: 'locations', label: 'Lugares', icon: '🗺️' },
  { id: 'razas', label: 'Razas', icon: '🏛️' },
  { id: 'personajes', label: 'Personajes', icon: '🎭' },
  { id: 'facciones', label: 'Facciones', icon: '🚩' },
  { id: 'historia', label: 'Historia', icon: '📜' },
  { id: 'classes', label: 'Clases', icon: '🎓' },
  { id: 'construction', label: 'Construcciones', icon: '🏗️' },
  { id: 'crafteo', label: 'Crafteo', icon: '🔨' },
  { id: 'attributes', label: 'Atributos', icon: '📊' },
  { id: 'combate', label: 'Combate', icon: '⚔️' },
]

// Enciclopedia consultable del mundo (roadmap 2026-07-21, petición explícita de la usuaria):
// catálogo categorizado — NPCs, objetos (por subcategoría), fauna/flora, lugares (por región),
// clases y habilidades, construcciones y atributos. Resuelve de paso el problema real de no saber
// qué nombre exacto usar para que el motor reconozca un NPC o presa (ver hallazgo del combate que
// nunca se disparaba por mencionar amenazas anónimas). Layout de sidebar + contenido (Fable,
// 2026-07-21, Nivel 2 de su roadmap): con 7 categorías y creciendo, una barra de tabs horizontal
// ya rompía a 2 líneas — la Enciclopedia es el único panel con subnavegación interna, así que
// merece su propio layout de dos columnas dentro del cajón.
export function EnciclopediaPanel({ data, loading, recipesStatus, onInsert, onDetail }: EnciclopediaPanelProps) {
  const [category, setCategory] = useState<EnciclopediaCategory>('npcs')
  // Derivados directos del prop `data` (ya no hay fetch/estado propio, ver comentario de la
  // interfaz de arriba) — arrays vacíos mientras `data` es null, mismo aspecto que el estado
  // inicial de antes.
  const npcs = data?.npcs ?? []
  const items = data?.items ?? []
  const faunaFlora = data?.faunaFlora ?? []
  const locations = data?.locations ?? []
  const razas = data?.razas ?? []
  const personajes = data?.personajes ?? []
  const classes = data?.classes ?? []
  const constructionRecipes = data?.constructionRecipes ?? []
  const craftingRecipes = data?.craftingRecipes ?? []
  const factions = data?.factions ?? []
  const historia = data?.historia ?? []
  const combate = data?.combate ?? []
  // Colapsables de clase (2026-07-22, petición explícita: "que cada clase sea un colapsable que al
  // pulsarlo veas el árbol de habilidades") — Set en vez de un solo string porque no hay razón
  // para que abrir una cierre la otra, a diferencia de las pestañas de arriba (sí exclusivas).
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())
  // Colapsables por tipo de objeto / zona de fauna-flora / raza de NPC (2026-07-29, petición
  // explícita) — mismo patrón que expandedClasses de arriba, vía el hook compartido de más abajo.
  const [expandedItemTipos, toggleItemTipo] = useToggleSet()
  const [expandedNpcRazas, toggleNpcRaza] = useToggleSet()
  const [expandedFaunaZonas, toggleFaunaZona] = useToggleSet()
  const [expandedFloraZonas, toggleFloraZona] = useToggleSet()
  const [expandedFaccionRazas, toggleFaccionRaza] = useToggleSet()
  const [expandedHistoriaPeriodos, toggleHistoriaPeriodo] = useToggleSet()
  // Sub-tabs de la categoría "Atributos" (2026-07-28, petición explícita: "mete un tab para ver
  // los atributos y otro para ver el árbol de debilidades") — exclusivas entre sí, a diferencia
  // de `expandedClasses` de arriba.
  const [attributesSubTab, setAttributesSubTab] = useState<'lista' | 'debilidades'>('lista')
  // Sub-tabs de "Historia" (2026-08-06, petición explícita: "la enciclopedia colocadas por años
  // cronologicamente en rangos de 500 años... antes de el año 0 no hay escritos en lengua común")
  // — mismo patrón que attributesSubTab, exclusivas entre sí.
  const [historiaEra, setHistoriaEra] = useState<'comun' | 'semillas'>('comun')

  // Agrupación en dos niveles (2026-07-29, categorización mecánica de objetos): tipo (amplio,
  // exterior) → categoría (subtipo fino, el groupBy de siempre, ahora anidado) — mismo patrón ya
  // usado para razas/construcciones (constructionsByRaza más abajo), no un mecanismo nuevo.
  const itemsByTipo = groupBy(items, (i) => i.tipo)
  const orderedItemTipos = [
    ...ITEM_TIPO_ORDER.filter((t) => itemsByTipo.has(t)),
    ...Array.from(itemsByTipo.keys()).filter((t) => !ITEM_TIPO_ORDER.includes(t as (typeof ITEM_TIPO_ORDER)[number])),
  ]
  function orderedCategoriesFor(itemsOfTipo: EnciclopediaItemInfo[]) {
    const byCategory = groupBy(itemsOfTipo, (i) => i.category)
    return [
      ...ITEM_CATEGORY_ORDER.filter((c) => byCategory.has(c)),
      ...Array.from(byCategory.keys()).filter((c) => !ITEM_CATEGORY_ORDER.includes(c)),
    ].map((cat) => [cat, byCategory.get(cat) ?? []] as const)
  }

  const locationsByRegion = groupBy(locations, (l) => l.region)
  const faunaEntries = faunaFlora.filter((e) => e.esFauna)
  const floraEntries = faunaFlora.filter((e) => !e.esFauna)

  // Colapsables por raza de NPC (2026-07-29, petición explícita: "a los NPC separarlos por
  // raza") — `razaNameBySlug` resuelve el nombre real desde `razas` (ya cargado para la propia
  // pestaña de razas); NPCs sin raza asignada (facciones humanas genéricas, patrullas...) caen en
  // un bucket aparte al final, nunca se pierden.
  const razaNameBySlug = new Map(razas.map((r) => [r.slug, r.name]))
  const SIN_RAZA = 'sin-raza'
  const npcsByRaza = groupBy(npcs, (n) => n.raza ?? SIN_RAZA)
  const orderedNpcRazas = [
    ...razas.map((r) => r.slug).filter((slug) => npcsByRaza.has(slug)),
    ...(npcsByRaza.has(SIN_RAZA) ? [SIN_RAZA] : []),
  ]

  // Facciones agrupadas por raza (2026-08-06, petición explícita: "las facciones agrupadas por
  // raza") — mismo patrón exacto que NPCs-por-raza de arriba; `Faction.raza` nunca es null, así
  // que no hace falta bucket "sin raza" aquí.
  const faccionesByRaza = groupBy(factions, (f) => f.raza)
  const orderedFaccionRazas = razas.map((r) => r.slug).filter((slug) => faccionesByRaza.has(slug))

  // Historia por era + bloques de 500 años (2026-08-06, petición explícita: "la enciclopedia
  // colocadas por años cronologicamente en rangos de 500 años cada periodo") — Era de las Semillas
  // (mítica, antes del año 0) se queda como lista plana, demasiado dispersa e imprecisa para
  // bloques fijos; Era Común sí se agrupa, mismo `groupBy` + `CollapsibleGroup` que fauna/flora
  // por zona más abajo.
  const historiaComun = historia.filter((h) => h.era === 'comun')
  const historiaSemillas = historia.filter((h) => h.era === 'semillas')
  const historiaByPeriodo = groupBy(historiaComun, (h) => String(Math.floor((h.year ?? 0) / 500) * 500))
  const orderedHistoriaPeriodos = Array.from(historiaByPeriodo.keys()).sort((a, b) => Number(a) - Number(b))

  // Colapsables por zona de fauna/flora (2026-07-29, petición explícita: "que fauna y flora
  // tenga colapsables separándolos por zona") — mismo orden de regiones que ya usa el backend
  // (discovery.ts, REGION_CORE_NAMES); lo que no tiene zona reconocible cae en un bucket aparte.
  const ZONA_ORDER = ['Llanuras del Viento Rojo', 'Cristal Helado', 'Ciénaga Troncal', 'Margen Silencioso', 'Meseta del Orden']
  const SIN_ZONA = 'sin-zona'
  function groupedByZona(entries: EnciclopediaFaunaFloraInfo[]) {
    const byZona = groupBy(entries, (e) => e.region ?? SIN_ZONA)
    const ordered = [...ZONA_ORDER.filter((z) => byZona.has(z)), ...(byZona.has(SIN_ZONA) ? [SIN_ZONA] : [])]
    return ordered.map((zona) => [zona, byZona.get(zona) ?? []] as const)
  }

  // División por raza (2026-07-23, petición explícita: "tiene que haber construcciones por
  // raza... el campamento va a ser la construcción básica y común") — `raza: null` es la única
  // común hoy (campamento); el resto de razas queda listo para recibir recetas propias más
  // adelante, sin mostrar una sección vacía mientras tanto.
  const commonConstructions = constructionRecipes.filter((r) => !r.raza)
  const constructionsByRaza = groupBy(
    constructionRecipes.filter((r): r is typeof constructionRecipes[number] & { raza: string } => !!r.raza),
    (r) => r.raza,
  )
  // División por oficio (2026-08-06, sección "Crafteo") — mismo criterio que construcciones por
  // raza (arriba): "Sin oficio" es la única común hoy (smokeMeat/fieldTorch), el resto de oficios
  // solo se muestra si tiene alguna receta de verdad.
  const oficioNameById = new Map(professions.map((p) => [p.id, p.name]))
  const sinOficioCrafting = craftingRecipes.filter((r) => !r.oficio)
  const craftingByOficio = groupBy(
    craftingRecipes.filter((r): r is typeof craftingRecipes[number] & { oficio: string } => !!r.oficio),
    (r) => r.oficio,
  )
  // Estado real de materiales EN ESTA PARTIDA (2026-08-13) — atenúa la tarjeta y sustituye el
  // listado estático "Necesita: X de Y" por el conteo real "Y: tienes/necesitas" cuando hay una
  // partida activa. Sin `saveId` (Enciclopedia fuera de partida), `recipesStatus` llega vacío y
  // todo cae al listado estático de siempre — nunca se rompe, solo deja de atenuar. Clave
  // compuesta `recipeCategory:recipeKey` (auditoría 2026-08-13, mismo criterio que
  // HabilidadesPanel.tsx) — hoy ningún `key` se repite entre crafteo y construcción, pero indexar
  // solo por recipeKey mostraría en silencio el estado de la receta equivocada si algún día colisionan.
  const recipeStatusByKey = new Map(recipesStatus.map((s) => [`${s.recipeCategory}:${s.recipeKey}`, s]))
  // Fila de lista de crafteo/construcción (auditoría 2026-08-13, dedupe de renderCraftingList/
  // renderConstructionList): las dos eran casi idénticas salvo icono/texto de inserción/categoría
  // de estado — y la línea "Requiere nivel X de Y" solo salía en construcción por una omisión real
  // (`oficioRequirementLine` ya soportaba ambas desde que `oficio`/`tier` llegaron a
  // EnciclopediaCraftingRecipe, ver enciclopediaTargets.ts). Genérico sobre el shape común a ambos
  // tipos de receta en vez de sobre uno concreto, para no tener que castear en las dos llamadas.
  function renderRecipeList<
    R extends { key: string; name: string; oficio: string | null; tier: number | null; requirements: { cantidad: number; label: string }[]; imageUrls: EnciclopediaImageUrls },
  >(recipes: R[], statusCategory: 'crafteo' | 'construccion', icon: string, insertValue: (recipe: R) => string, toDetailTarget: (recipe: R, status?: RecipeStatusInfo) => DetailTarget) {
    return (
      <div className="flex flex-col gap-2">
        {recipes.map((recipe) => {
          const status = recipeStatusByKey.get(`${statusCategory}:${recipe.key}`)
          const requisitos = status ? status.ingredients.map((i) => `${i.label} ${i.tienes}/${i.necesitas}`).join(', ') : recipe.requirements.map((r) => `${r.cantidad} de ${r.label}`).join(', ')
          const nivel = oficioRequirementLine(recipe.oficio, recipe.tier)
          const imageUrl = resolveImageUrl(recipe.imageUrls.thumbnail)
          const value = insertValue(recipe)
          return (
            <button
              key={recipe.key}
              onClick={(e) => {
                if (e.shiftKey) {
                  onInsert({ icon, label: recipe.name, value })
                } else {
                  onDetail(toDetailTarget(recipe, status), () => onInsert({ icon, label: recipe.name, value }))
                }
              }}
              className={`tactile flex items-center gap-3 rounded-lg border border-iron-800 bg-wood-950/40 px-3.5 py-2.5 text-left transition-colors hover:border-accent2-600/40 hover:bg-accent2-500/5 ${
                status && !status.met ? 'opacity-60' : ''
              }`}
            >
              {imageUrl ? (
                <img src={imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover object-top" />
              ) : (
                <span className="shrink-0 text-2xl leading-none">{icon}</span>
              )}
              <div>
                <p className="font-medium text-wood-100">{recipe.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-wood-400">
                  Necesita: {requisitos}.{nivel ? ` ${nivel}` : ''}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    )
  }
  const renderCraftingList = (recipes: EnciclopediaCraftingRecipe[]) =>
    renderRecipeList(recipes, 'crafteo', '🔨', (recipe) => `Crafteo ${recipe.name}`, craftingToDetailTarget)
  const renderConstructionList = (recipes: EnciclopediaConstructionRecipe[]) =>
    renderRecipeList(recipes, 'construccion', '🏗️', (recipe) => `Me pongo a construir ${recipe.name}`, constructionToDetailTarget)

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <nav className="flex w-11 shrink-0 flex-col gap-1 sm:w-28">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategory(tab.id)}
            title={tab.label}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
              category === tab.id ? 'bg-accent2-500/10 font-medium text-accent2-300' : 'text-wood-400 hover:bg-wood-950/40 hover:text-wood-200'
            }`}
          >
            <span className="text-sm leading-none">{tab.icon}</span>
            <span className="hidden leading-tight sm:inline">{tab.label}</span>
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
                <div className="flex flex-col gap-3">
                  {/* Colapsables por raza (2026-07-29, petición explícita: "a los NPC
                      separarlos por raza"). */}
                  {orderedNpcRazas.map((raza) => {
                    const razaNpcs = npcsByRaza.get(raza) ?? []
                    return (
                      <CollapsibleGroup
                        key={raza}
                        title={raza === SIN_RAZA ? 'Sin raza asignada' : (razaNameBySlug.get(raza) ?? raza)}
                        count={razaNpcs.length}
                        expanded={expandedNpcRazas.has(raza)}
                        onToggle={() => toggleNpcRaza(raza)}
                      >
                        <EntryCardGrid
                          items={razaNpcs}
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
                      </CollapsibleGroup>
                    )
                  })}
                </div>
              ))}

            {category === 'items' &&
              (items.length === 0 ? (
                <PanelEmptyState icon="📦" title="Sin objetos catalogados" hint="Todavía no hay ninguno en este mundo." />
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Colapsables por tipo (2026-07-29, petición explícita: "además de la
                      clasificación actual, quiero colapsables por tipo de item") — la
                      clasificación tipo→categoría de siempre se mantiene intacta DENTRO de cada
                      colapsable. */}
                  {orderedItemTipos.map((tipo) => {
                    const tipoItems = itemsByTipo.get(tipo) ?? []
                    return (
                      <CollapsibleGroup
                        key={tipo}
                        title={ITEM_TIPO_LABEL[tipo as (typeof ITEM_TIPO_ORDER)[number]] ?? tipo}
                        count={tipoItems.length}
                        expanded={expandedItemTipos.has(tipo)}
                        onToggle={() => toggleItemTipo(tipo)}
                      >
                        {orderedCategoriesFor(tipoItems).map(([cat, catItems]) => (
                          <PanelSection key={cat} title={ITEM_CATEGORY_LABEL[cat] ?? cat}>
                            <EntryCardGrid
                              items={catItems}
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
                      </CollapsibleGroup>
                    )
                  })}
                </div>
              ))}

            {category === 'fauna' &&
              (faunaEntries.length === 0 ? (
                <PanelEmptyState icon="🐾" title="Sin fauna catalogada" hint="Todavía no hay ninguna en este mundo." />
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Colapsables por zona (2026-07-29, petición explícita: "que fauna y flora
                      tenga colapsables separándolos por zona"). */}
                  {groupedByZona(faunaEntries).map(([zona, zonaEntries]) => (
                    <CollapsibleGroup
                      key={zona}
                      title={zona === SIN_ZONA ? 'Zona desconocida' : zona}
                      count={zonaEntries.length}
                      expanded={expandedFaunaZonas.has(zona)}
                      onToggle={() => toggleFaunaZona(zona)}
                    >
                      <EntryCardGrid
                        items={zonaEntries}
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
                    </CollapsibleGroup>
                  ))}
                </div>
              ))}

            {category === 'flora' &&
              (floraEntries.length === 0 ? (
                <PanelEmptyState icon="🌿" title="Sin flora catalogada" hint="Todavía no hay ninguna en este mundo." />
              ) : (
                <div className="flex flex-col gap-3">
                  {groupedByZona(floraEntries).map(([zona, zonaEntries]) => (
                    <CollapsibleGroup
                      key={zona}
                      title={zona === SIN_ZONA ? 'Zona desconocida' : zona}
                      count={zonaEntries.length}
                      expanded={expandedFloraZonas.has(zona)}
                      onToggle={() => toggleFloraZona(zona)}
                    >
                      <EntryCardGrid
                        items={zonaEntries}
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
                    </CollapsibleGroup>
                  ))}
                </div>
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

            {category === 'facciones' &&
              (factions.length === 0 ? (
                <PanelEmptyState icon="🚩" title="Sin facciones catalogadas" hint="Todavía no hay ninguna en este mundo." />
              ) : (
                <div className="flex flex-col gap-3">
                  {orderedFaccionRazas.map((raza) => {
                    const razaFactions = faccionesByRaza.get(raza) ?? []
                    return (
                      <CollapsibleGroup
                        key={raza}
                        title={razaNameBySlug.get(raza) ?? raza}
                        count={razaFactions.length}
                        expanded={expandedFaccionRazas.has(raza)}
                        onToggle={() => toggleFaccionRaza(raza)}
                      >
                        <EntryCardGrid
                          items={razaFactions}
                          keyOf={(f) => f.slug}
                          icon={() => '🚩'}
                          name={(f) => f.name}
                          tooltip={(f) => f.description}
                          imageUrl={(f) => resolveImageUrl(f.imageUrls.thumbnail)}
                          toDetailTarget={faccionToDetailTarget}
                          toChip={(f) => ({ icon: '🚩', label: f.name, description: f.description })}
                          onDetail={onDetail}
                          onInsert={onInsert}
                          discovered={(f) => f.discovered}
                        />
                      </CollapsibleGroup>
                    )
                  })}
                </div>
              ))}

            {category === 'historia' && (
              <div className="flex flex-col gap-4">
                <div className="flex gap-1 rounded-lg border border-iron-800 bg-wood-950/40 p-1">
                  {(
                    [
                      { id: 'comun', label: 'Era Común' },
                      { id: 'semillas', label: 'Era de las Semillas' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setHistoriaEra(tab.id)}
                      className={`tactile flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        historiaEra === tab.id ? 'bg-accent2-500/10 text-accent2-300' : 'text-wood-400 hover:text-wood-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {historiaEra === 'comun' &&
                  (historiaComun.length === 0 ? (
                    <PanelEmptyState icon="📜" title="Sin entradas de la Era Común" hint="Todavía no hay ninguna en este mundo." />
                  ) : (
                    orderedHistoriaPeriodos.map((periodo) => {
                      const entries = historiaByPeriodo.get(periodo) ?? []
                      return (
                        <CollapsibleGroup
                          key={periodo}
                          title={`Años ${periodo}-${Number(periodo) + 500}`}
                          count={entries.length}
                          expanded={expandedHistoriaPeriodos.has(periodo)}
                          onToggle={() => toggleHistoriaPeriodo(periodo)}
                        >
                          <EntryCardGrid
                            items={entries}
                            keyOf={(h) => h.slug}
                            icon={() => '📜'}
                            name={(h) => h.title}
                            tooltip={(h) => (h.unlocked ? (h.text ?? '') : 'Escrito sin traducir.')}
                            imageUrl={(h) => resolveImageUrl(h.imageUrls.thumbnail)}
                            toDetailTarget={historiaEntryToDetailTarget}
                            toChip={(h) => ({ icon: '📜', label: h.title })}
                            onDetail={onDetail}
                            onInsert={onInsert}
                            discovered={(h) => h.discovered}
                          />
                        </CollapsibleGroup>
                      )
                    })
                  ))}

                {historiaEra === 'semillas' &&
                  (historiaSemillas.length === 0 ? (
                    <PanelEmptyState
                      icon="📜"
                      title="Sin entradas de la Era de las Semillas"
                      hint="Un tiempo que ningún pueblo mortal puede fechar todavía no tiene ningún hallazgo registrado."
                    />
                  ) : (
                    <EntryCardGrid
                      items={historiaSemillas}
                      keyOf={(h) => h.slug}
                      icon={() => '📜'}
                      name={(h) => h.title}
                      tooltip={(h) => (h.unlocked ? (h.text ?? '') : 'Escrito sin traducir.')}
                      imageUrl={(h) => resolveImageUrl(h.imageUrls.thumbnail)}
                      toDetailTarget={historiaEntryToDetailTarget}
                      toChip={(h) => ({ icon: '📜', label: h.title })}
                      onDetail={onDetail}
                      onInsert={onInsert}
                      discovered={(h) => h.discovered}
                    />
                  ))}
              </div>
            )}

            {category === 'classes' &&
              (classes.length === 0 ? (
                <PanelEmptyState icon="🎓" title="Sin clases catalogadas" hint="Todavía no hay ninguna en este mundo." />
              ) : (
                <div className="flex flex-col gap-5">
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

            {category === 'crafteo' &&
              (craftingRecipes.length === 0 ? (
                <PanelEmptyState icon="🔨" title="Sin recetas de crafteo catalogadas" hint="Todavía no hay ninguna disponible." />
              ) : (
                <div className="flex flex-col gap-5">
                  {sinOficioCrafting.length > 0 && <PanelSection title="Sin oficio">{renderCraftingList(sinOficioCrafting)}</PanelSection>}
                  {professions.map((profession) => {
                    const list = craftingByOficio.get(profession.id) ?? []
                    if (list.length === 0) return null
                    return (
                      <PanelSection key={profession.id} title={oficioNameById.get(profession.id) ?? profession.id}>
                        {renderCraftingList(list)}
                      </PanelSection>
                    )
                  })}
                </div>
              ))}

            {category === 'attributes' && (
              <div className="flex flex-col gap-5">
                <div className="flex gap-1 rounded-lg border border-iron-800 bg-wood-950/40 p-1">
                  {(
                    [
                      { id: 'lista', label: 'Atributos' },
                      { id: 'debilidades', label: 'Árbol de debilidades' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setAttributesSubTab(tab.id)}
                      className={`tactile flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        attributesSubTab === tab.id ? 'bg-accent2-500/10 text-accent2-300' : 'text-wood-400 hover:text-wood-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {attributesSubTab === 'lista' ? (
                  <>
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
                  </>
                ) : (
                  <PanelSection title="Árbol de debilidades (combate)">
                    <AttributeWheelDiagram />
                  </PanelSection>
                )}
              </div>
            )}

            {/* "Combate" (petición explícita, 2026-08-15: "expliquemos con claridad... las
                mecánicas de las tiradas y cómo funcionan los combates... explicada para el
                jugador que juega") — filas simples, título siempre visible y corto (no "texto
                cargado" de fondo), la explicación completa vive en la ficha de detalle al pulsar,
                mismo `DetailTarget` genérico 'info' que ya usa Atributos justo arriba: no hace
                falta EntryCard (pensado para nombres cortos tipo "Fuerza", no para títulos largos
                como "El intercambio: dos tiradas, no una") ni un mapper propio en
                enciclopediaTargets.ts para 8 entradas estáticas sin imagen. */}
            {category === 'combate' &&
              (combate.length === 0 ? (
                <PanelEmptyState icon="⚔️" title="Sin reglas de combate catalogadas" hint="Todavía no hay ninguna documentada." />
              ) : (
                <PanelSection title="Cómo funciona el combate">
                  <div className="flex flex-col gap-2">
                    {combate.map((entry) => (
                      <button
                        key={entry.slug}
                        onClick={() => onDetail({ kind: 'info', icon: entry.icon, name: entry.title, description: entry.text })}
                        className="tactile flex items-center gap-3 rounded-lg border border-iron-800 bg-wood-950/40 px-3 py-2.5 text-left transition-colors hover:border-accent2-600/40 hover:bg-accent2-500/5"
                      >
                        <span className="text-xl leading-none">{entry.icon}</span>
                        <span className="text-sm text-wood-200">{entry.title}</span>
                      </button>
                    ))}
                  </div>
                </PanelSection>
              ))}
          </>
        )}
      </div>
    </div>
  )
}
