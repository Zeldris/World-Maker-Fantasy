import { useState, type ReactNode } from 'react'
import {
  resolveImageUrl,
  type DiscoveryFase,
  type EnciclopediaClassInfo,
  type EnciclopediaClassUnlock,
  type EnciclopediaConstructionRecipe,
  type EnciclopediaCraftingRecipe,
  type EnciclopediaFaunaFloraInfo,
  type EnciclopediaImageUrls,
  type EnciclopediaItemInfo,
  type EnciclopediaResponse,
} from '../../lib/api'
import { attributeLabels, especializacionLabel } from '../../lib/dice'
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
  /// Roadmap de especialización (2026-09-01) — el modal de elección obligatoria a nivel 10 enlaza
  /// "Ver en la Enciclopedia"; sin esto, el panel siempre abría en 'npcs' sin importar de dónde
  /// venía el clic. Solo aplica al abrir el panel (no fuerza la pestaña en cada re-render).
  initialCategory?: EnciclopediaCategory
}

// Buscador de la Enciclopedia (auditoría 2026-08-27) — quita acentos y normaliza mayúsculas para
// que "Espada" encuentre "espada" y "gargantua" encuentre "Gargántua".
function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
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
    key: 'magia',
    icon: '🔮',
    description: 'Fuerza destructiva pura de Tarkor, sin ningún matiz añadido — una de las 7 ramas en las que se divide su magia (la escuela Arcano). Usarlo siempre conlleva un pequeño riesgo, incluso cuando sale bien.',
  },
]

// Mismo orden que `ATTRIBUTE_RING` en backend/src/services/attributeWheel.ts — se duplica aquí
// porque es una constante de diseño (no contenido de partida servido por la API); si cambia
// allí, hay que actualizar este array a mano.
//
// Renombrado de "árbol/anillo de DEBILIDADES" a "árbol de VENTAJAS" (petición explícita,
// 2026-08-20: "ya que ahora solo multiplicamos y no dividimos") — el nombre viejo venía de un
// diseño anterior donde el tipo perdedor SÍ dividía su atributo (una desventaja real); desde el
// rediseño de combate de 2026-08-15 (`typeMultiplierFor`, backend) el lado que no tiene ventaja
// se queda en ×1 neutro, nunca en malus — "debilidades" describía un castigo que ya no existe.
const ADVANTAGE_RING: Attribute[] = ['fuerza', 'destreza', 'inteligencia', 'magia', 'constitucion', 'voluntad', 'carisma']

const ADVANTAGE_RING_COLOR: Record<Attribute, string> = {
  fuerza: 'var(--color-fuerza-500)',
  destreza: 'var(--color-destreza-500)',
  constitucion: 'var(--color-constitucion-500)',
  inteligencia: 'var(--color-inteligencia-500)',
  voluntad: 'var(--color-voluntad-500)',
  carisma: 'var(--color-carisma-500)',
  magia: 'var(--color-magia-500)',
}

// Rediseño del turno de combate (2026-07-28, petición explícita: "un tab para ver el árbol de
// ventajas") — visualiza el anillo de attributeWheel.ts: cada flecha apunta a quien tiene
// ventaja de tipo directa (distancia 1, ×1.5 en ambos árboles de ataque y defensa); saltarse
// un nodo (distancia 2) es un efecto más suave, mostrado solo en la tabla de debajo, no como
// flecha, para no saturar el dibujo con las 15 combinaciones posibles. Solo premia, nunca
// penaliza (rediseño 2026-08-15, ver el comentario largo de `typeMultiplierFor` en el backend):
// usar el tipo perdedor no divide nada, se queda en ×1 neutro — de ahí el renombrado de
// "debilidades" a "ventajas" (petición explícita, 2026-08-20).
function AttributeAdvantageDiagram() {
  const size = 260
  const center = size / 2
  const radius = 92
  const nodeRadius = 28
  const points = ADVANTAGE_RING.map((attr, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / ADVANTAGE_RING.length
    return { attr, x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) }
  })

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-xs">
        <defs>
          <marker id="advantage-ring-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="var(--color-wood-500)" />
          </marker>
        </defs>
        {points.map((p, i) => {
          // Flecha invertida (bug real, 2026-08-20: "las flechas están al revés") — `next` es
          // quien GANA la ventaja directa sobre `p` (confirmado en attributeWheel.test.ts:
          // `typeMultiplierFor('destreza', 'fuerza', 'ataque') === 1.5`, con 'destreza' como
          // "next" de 'fuerza' en ADVANTAGE_RING). La convención habitual de estos diagramas es
          // que la flecha SALGA de quien gana y APUNTE a quien vence — la versión anterior hacía
          // justo lo contrario (línea de `p` a `next`, punta en `next`, el propio ganador), lo
          // que se lee como "p vence a next" cuando es al revés. Ahora la línea va de `next` a
          // `p`, con la punta en `p` — "next vence a p".
          const next = points[(i + 1) % points.length]
          const dx = p.x - next.x
          const dy = p.y - next.y
          const dist = Math.hypot(dx, dy)
          const ux = dx / dist
          const uy = dy / dist
          return (
            <line
              key={`edge-${p.attr}`}
              x1={next.x + ux * nodeRadius}
              y1={next.y + uy * nodeRadius}
              x2={p.x - ux * (nodeRadius + 8)}
              y2={p.y - uy * (nodeRadius + 8)}
              stroke="var(--color-wood-500)"
              strokeWidth={1.5}
              markerEnd="url(#advantage-ring-arrow)"
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
                fill={ADVANTAGE_RING_COLOR[p.attr]}
                fillOpacity={0.18}
                stroke={ADVANTAGE_RING_COLOR[p.attr]}
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
      {/* Reordenado (petición explícita, 2026-08-20: "dale una pensada para que sea más claro
          aún") — "solo premia, nunca penaliza" pasa a ser la PRIMERA frase, no la segunda: es
          justo la idea que motivó el cambio de nombre (de "debilidades" a "ventajas"), así que
          debe ser lo primero que se lee, no algo que aclara un malentendido ya sembrado por leer
          "multiplica" antes sin saber que el otro lado nunca divide. */}
      <p className="max-w-sm text-center text-xs leading-relaxed text-wood-400">
        Solo premia, nunca penaliza: si tu tipo tiene ventaja sobre el del rival, tu atributo se multiplica en la
        tirada; si no la tienes, tiras con tu atributo normal, sin ningún descuento — el árbol nunca resta. Cada
        flecha SALE del tipo que gana la ventaja directa y APUNTA al que vence (distancia 1 en el anillo). Se
        aplica por separado a la tirada de ataque y a la de defensa.
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
              <td className="py-1.5">Magia vs Fuerza</td>
              <td className="py-1.5 text-right">sin relación (×1)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Atributos secundarios (sesión de diseño 2026-07-23, remodelados 2026-08-22) — nunca mueven una
// tirada (dice.ts), solo comprueban umbrales de requisitos (craftear/equipar/construir/nivel de
// oficio, ver requisitos.ts en el backend) o son color narrativo puro. Sigilo salió de aquí (pasa
// a ser habilidad activa de Destreza); Resistencia física/mágica/de semilla se eliminaron
// (duplicaban a Constitución); Magia/Poder de Semilla se RETIRARON de aquí el 2026-09-01: pasaron
// a vivir en el atributo primario Magia (antes Arcano, ver ATTRIBUTES_INFO arriba), con tirada
// real propia — dejan de ser color narrativo puro para ser un atributo jugable como los otros 6;
// Suerte/Honor son nuevos.
const SECONDARY_ATTRIBUTES_INFO: { key: SecondaryAttribute; icon: string; description: string }[] = [
  { key: 'moral', icon: '🕊️', description: 'Entereza pasiva ante el horror, la pérdida o el miedo — no quebrarse por dentro (distinta de Voluntad, que es aguantar presión activa).' },
  { key: 'resistenciaFrio', icon: '❄️', description: 'Capacidad de aguantar frío extremo — relevante en Cristal Helado.' },
  { key: 'resistenciaCalor', icon: '🔥', description: 'Capacidad de aguantar calor extremo — relevante en las Llanuras del Viento Rojo.' },
  { key: 'suerte', icon: '🍀', description: 'Fortuna narrativa pura — una coincidencia, un hallazgo fortuito. Nunca mueve una tirada.' },
  { key: 'honor', icon: '⚔️', description: 'Peso del honor y la palabra dada — deudas de honor, reputación ganada. Narrativo puro, muy presente en la cultura orca (el Signeran, la casta de Ketg).' },
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
  citado,
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
  /// 3 fases (2026-09-08, rediseño de Álvaro) — CITADO: nombre real ya visible (deja de ser
  /// "???"), pero SIN imagen todavía (icono genérico) — la ficha, si se abre, muestra solo
  /// nombre+región. Mutuamente excluyente con `locked` (NO_DESCUBIERTO gana si ambos llegaran
  /// true por error de caller).
  citado?: boolean
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
  if (citado) {
    return (
      <TooltipAnchor text="Citado, pero todavía no lo has visto en persona — solo se conoce el nombre." className="block">
        <button type="button"
          onClick={onDetail}
          className="tactile flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-iron-700 bg-wood-950/30 px-2 py-3 text-center opacity-80 transition-colors hover:border-accent2-600/40"
        >
          <span className="text-2xl leading-none">{icon}</span>
          <span className="text-2xs leading-tight text-wood-300">{name}</span>
        </button>
      </TooltipAnchor>
    )
  }
  return (
    <TooltipAnchor text={tooltip} className="block">
      <button type="button"
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

/// 3 fases (2026-09-08) — recorta un DetailTarget `kind: 'info'` completo a la versión MÍNIMA que
/// pide Álvaro para CITADO: "la información mínima de momento será el nombre y región, nada más"
/// — se conserva `icon`/`name`/`meta` (donde ya vive región/facción/rol según el tipo, sin
/// inventar un campo nuevo por entidad) y se descarta todo lo demás (bio/imagen/atributos/
/// variantes/ingredientes...). Un target que no sea `kind: 'info'` (ability/item de inventario/
/// slotManager) no pasa por aquí — esta pieza solo aplica a la Enciclopedia.
function citadoDetailTarget(target: DetailTarget): DetailTarget {
  if (target.kind !== 'info') return target
  return { kind: 'info', icon: target.icon, name: target.name, meta: target.meta, description: '' }
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
  fase,
  search,
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
  /// 3 fases (2026-09-08) — opcional, solo lo pasan las categorías con `DiscoveryFase` real
  /// (NPC/fauna/item/facción/historia). Ausente pero `discovered` presente = comportamiento
  /// binario de siempre (Location, gateada por otro eje). Presente = decide entre 3 renders.
  fase?: (item: T) => DiscoveryFase
  /// Buscador de la Enciclopedia (auditoría 2026-08-27, "no hay ninguna forma de filtrar por
  /// texto, solo navegar tab→colapsable→cuadrícula a ojo") — filtro por nombre, sin distinguir
  /// mayúsculas/acentos, aplicado uniformemente en las 13 categorías que usan esta grilla.
  search?: string
}) {
  const filtered = search ? items.filter((item) => normalizeSearchText(name(item)).includes(normalizeSearchText(search))) : items
  return (
    <div className={wide ? 'grid grid-cols-2 gap-2 sm:grid-cols-3' : 'grid grid-cols-3 gap-2 sm:grid-cols-4'}>
      {filtered.map((item) => {
        // 3 fases (2026-09-08): `fase` manda si el caller la pasa; `discovered` sigue siendo el
        // único gate para categorías sin `DiscoveryFase` real (Location, otro eje).
        const itemFase = fase?.(item)
        const isLocked = itemFase ? itemFase === 'NO_DESCUBIERTO' : discovered && !discovered(item)
        const isCitado = itemFase === 'CITADO'
        if (isLocked) {
          return <EntryCard key={keyOf(item)} icon={icon(item)} name={name(item)} tooltip={tooltip(item)} onDetail={() => {}} locked />
        }
        if (isCitado) {
          // CITADO (2026-09-08): ficha real se abre, pero recortada a lo mínimo (nombre+meta) —
          // ni imagen ni bio/atributos/variantes, ver `citadoDetailTarget`. `imageUrl` de la
          // tarjeta se omite a propósito aunque el backend ya la traiga, la fase decide qué se
          // enseña, no el dato.
          return (
            <EntryCard
              key={keyOf(item)}
              icon={icon(item)}
              name={name(item)}
              tooltip={tooltip(item)}
              onDetail={() => onDetail(citadoDetailTarget(toDetailTarget(item)))}
              citado
            />
          )
        }
        return (
          <EntryCard
            key={keyOf(item)}
            icon={icon(item)}
            name={name(item)}
            tooltip={tooltip(item)}
            imageUrl={imageUrl?.(item) ?? undefined}
            onDetail={() => onDetail(toDetailTarget(item), () => onInsert(toChip(item)))}
            onQuickInsert={() => onInsert(toChip(item))}
          />
        )
      })}
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
      <button type="button"
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
export function EnciclopediaPanel({ data, loading, recipesStatus, onInsert, onDetail, initialCategory }: EnciclopediaPanelProps) {
  const [category, setCategory] = useState<EnciclopediaCategory>(initialCategory ?? 'npcs')
  // Buscador (auditoría 2026-08-27) — se limpia al cambiar de categoría, mismo criterio que
  // cualquier filtro de lista: buscar "espada" en Objetos no debería seguir aplicado si luego se
  // entra en NPCs.
  const [search, setSearch] = useState('')
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
  // Colapsables por región (petición explícita, 2026-08-27: "asegúrate de que si hay categorías
  // con cosas bajo ellas sea colapsable su padre... como en location por región") — Lugares era la
  // única categoría con grupos padre que usaba PanelSection (siempre expandido) en vez de
  // CollapsibleGroup, mismo patrón que NPCs/Fauna/Flora/Facciones ya tenían.
  const [expandedLocationRegions, toggleLocationRegion] = useToggleSet()
  // Mismo criterio (2026-08-27) para Construcciones (por raza) y Crafteo (por oficio) — ambas
  // podían tener decenas de recetas repartidas en muchos grupos, siempre expandidos con PanelSection.
  const [expandedConstructionGroups, toggleConstructionGroup] = useToggleSet()
  const [expandedCraftingGroups, toggleCraftingGroup] = useToggleSet()
  // Sub-colapsables por especialización dentro de cada clase (petición explícita, 2026-08-27:
  // "sobre la genera de guerrero van las habs hasta lvl 10 luego las de especializaciones tendrás
  // que hacer collapsables con cada especialización") — clave compuesta `clase:especializacion`
  // para que abrir una especialización de Guerrero no afecte a la misma de Cazador.
  const [expandedSpecializations, toggleSpecialization] = useToggleSet()
  // Sub-tabs de la categoría "Atributos" (2026-07-28, petición explícita: "mete un tab para ver
  // los atributos y otro para ver el árbol de ventajas") — exclusivas entre sí, a diferencia
  // de `expandedClasses` de arriba.
  const [attributesSubTab, setAttributesSubTab] = useState<'lista' | 'ventajas'>('lista')
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
    const filtered = search ? recipes.filter((r) => normalizeSearchText(r.name).includes(normalizeSearchText(search))) : recipes
    return (
      <div className="flex flex-col gap-2">
        {filtered.map((recipe) => {
          const status = recipeStatusByKey.get(`${statusCategory}:${recipe.key}`)
          const requisitos = status ? status.ingredients.map((i) => `${i.label} ${i.tienes}/${i.necesitas}`).join(', ') : recipe.requirements.map((r) => `${r.cantidad} de ${r.label}`).join(', ')
          const nivel = oficioRequirementLine(recipe.oficio, recipe.tier)
          const imageUrl = resolveImageUrl(recipe.imageUrls.thumbnail)
          const value = insertValue(recipe)
          return (
            <button type="button"
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

  // Botón de habilidad individual dentro de la senda de nivel de una clase (2026-08-27) —
  // reutilizado entre la senda base (sin especialización) y cada sub-colapsable de especialización.
  function renderAbilityUnlock({ level, ability }: EnciclopediaClassUnlock) {
    return (
      <button type="button"
        key={ability.name}
        onClick={(e) => {
          if (e.shiftKey) {
            onInsert({ icon: ability.icon, label: ability.name, description: ability.description, value: ability.promptText })
          } else {
            onDetail(abilityToDetailTarget(ability, `Nivel ${level}`), () =>
              onInsert({ icon: ability.icon, label: ability.name, description: ability.description, value: ability.promptText }),
            )
          }
        }}
        className="tactile relative flex items-center gap-3 rounded-lg border border-iron-800 bg-wood-950/40 px-3 py-2 text-left transition-colors hover:border-accent2-600/40 hover:bg-accent2-500/5"
      >
        <span aria-hidden="true" className="absolute -left-[1.375rem] h-2 w-2 rounded-full border border-accent2-500 bg-wood-950" />
        <span className="rounded-full border border-iron-700 bg-wood-950/60 px-2 py-0.5 font-mono text-2xs text-wood-400">Nv. {level}</span>
        <span className="text-lg leading-none">{ability.icon}</span>
        <span className="text-sm text-wood-200">{ability.name}</span>
      </button>
    )
  }
  // Especializaciones dentro de una clase (petición explícita, 2026-08-27: "sobre la genera de
  // guerrero van las habs hasta lvl 10 luego las de especializaciones tendrás que hacer
  // collapsables con cada especialización") — ordenadas por primer nivel de desbloqueo, cada una
  // con sus unlocks ordenados por nivel.
  function specializationsFor(clase: EnciclopediaClassInfo): [string, EnciclopediaClassUnlock[]][] {
    const bySpec = new Map<string, EnciclopediaClassUnlock[]>()
    for (const unlock of clase.unlocks) {
      if (!unlock.especializacion) continue
      const list = bySpec.get(unlock.especializacion) ?? []
      list.push(unlock)
      bySpec.set(unlock.especializacion, list)
    }
    for (const list of bySpec.values()) list.sort((a, b) => a.level - b.level)
    return Array.from(bySpec.entries()).sort(([, a], [, b]) => a[0].level - b[0].level)
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <nav className="flex w-11 shrink-0 flex-col gap-1 sm:w-28">
        {CATEGORY_TABS.map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => {
              setCategory(tab.id)
              setSearch('')
            }}
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
            {/* Buscador (auditoría 2026-08-27) — solo en categorías con cuadrícula plana de
                EntryCardGrid; Clases/Atributos/Combate tienen su propio layout sin grilla. */}
            {category !== 'classes' && category !== 'attributes' && category !== 'combate' && (
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre..."
                className="mb-3 w-full rounded-lg border border-iron-700 bg-iron-900 px-3 py-1.5 text-sm text-wood-100 placeholder:text-wood-600 focus:border-accent2-500 focus:outline-none"
              />
            )}
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
                          fase={(npc) => npc.fase}
                          search={search}
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
                              fase={(item) => item.fase}
                              search={search}
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
                        fase={(entry) => entry.fase}
                        search={search}
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
                        fase={(entry) => entry.fase}
                        search={search}
                      />
                    </CollapsibleGroup>
                  ))}
                </div>
              ))}

            {category === 'locations' &&
              (locations.length === 0 ? (
                <PanelEmptyState icon="🗺️" title="Sin lugares catalogados" hint="Todavía no hay ninguno en este mundo." />
              ) : (
                <div className="flex flex-col gap-3">
                  {beriRegions.map((region) => {
                    const regionLocations = locationsByRegion.get(region.name) ?? []
                    if (regionLocations.length === 0) return null
                    return (
                      <CollapsibleGroup
                        key={region.name}
                        title={region.name}
                        count={regionLocations.length}
                        expanded={expandedLocationRegions.has(region.name)}
                        onToggle={() => toggleLocationRegion(region.name)}
                      >
                        <p className="-mt-1 text-xs italic leading-relaxed text-wood-500">{region.description}</p>
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
                          search={search}
                        />
                      </CollapsibleGroup>
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
                  search={search}
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
                  search={search}
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
                          fase={(f) => f.fase}
                          search={search}
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
                    <button type="button"
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
                            fase={(h) => h.fase}
                            search={search}
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
                      fase={(h) => h.fase}
                      search={search}
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
                        <button type="button"
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
                          <div className="flex flex-col gap-4 border-t border-iron-800 px-3.5 py-3">
                            {/* Senda de nivel (Fable, 2026-07-21): línea vertical que atraviesa
                                cada desbloqueo — progresión lineal real, no un árbol ramificado.
                                Solo habilidades comunes (sin especialización, hasta nivel 10) —
                                las de especialización se agrupan aparte, ver más abajo. */}
                            <div className="flex flex-col gap-1.5 border-l-2 border-iron-700 pl-4">
                              {[...clase.unlocks]
                                .filter((u) => !u.especializacion)
                                .sort((a, b) => a.level - b.level)
                                .map((unlock) => renderAbilityUnlock(unlock))}
                            </div>
                            {/* Especializaciones (petición explícita, 2026-08-27): a partir de
                                nivel 10 cada habilidad pertenece a una especialización concreta de
                                la clase — sub-colapsable por especialización, no todo listado
                                junto sin distinguir a cuál pertenece cada una. */}
                            {specializationsFor(clase).map(([especializacion, unlocks]) => {
                              const key = `${clase.name}:${especializacion}`
                              const specExpanded = expandedSpecializations.has(key)
                              return (
                                <div key={especializacion} className="rounded-lg border border-iron-800">
                                  <button type="button"
                                    onClick={() => toggleSpecialization(key)}
                                    className="tactile flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-wood-950/40"
                                  >
                                    <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-wood-400">
                                      {especializacionLabel(especializacion)}{' '}
                                      <span className="font-mono normal-case tracking-normal text-wood-600">({unlocks.length})</span>
                                    </p>
                                    <span className={`shrink-0 text-wood-500 transition-transform ${specExpanded ? 'rotate-180' : ''}`}>▾</span>
                                  </button>
                                  {specExpanded && (
                                    <div className="flex flex-col gap-1.5 border-t border-iron-800 px-3 py-2.5 pl-6">
                                      {unlocks.map((unlock) => renderAbilityUnlock(unlock))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
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
                <div className="flex flex-col gap-3">
                  {commonConstructions.length > 0 && (
                    <CollapsibleGroup
                      title="Común"
                      count={commonConstructions.length}
                      expanded={expandedConstructionGroups.has('común')}
                      onToggle={() => toggleConstructionGroup('común')}
                    >
                      {renderConstructionList(commonConstructions)}
                    </CollapsibleGroup>
                  )}
                  {razas.map((raza) => {
                    const list = constructionsByRaza.get(raza.slug) ?? []
                    if (list.length === 0) return null
                    return (
                      <CollapsibleGroup
                        key={raza.slug}
                        title={raza.name}
                        count={list.length}
                        expanded={expandedConstructionGroups.has(raza.slug)}
                        onToggle={() => toggleConstructionGroup(raza.slug)}
                      >
                        {renderConstructionList(list)}
                      </CollapsibleGroup>
                    )
                  })}
                </div>
              ))}

            {category === 'crafteo' &&
              (craftingRecipes.length === 0 ? (
                <PanelEmptyState icon="🔨" title="Sin recetas de crafteo catalogadas" hint="Todavía no hay ninguna disponible." />
              ) : (
                <div className="flex flex-col gap-3">
                  {sinOficioCrafting.length > 0 && (
                    <CollapsibleGroup
                      title="Sin oficio"
                      count={sinOficioCrafting.length}
                      expanded={expandedCraftingGroups.has('sin-oficio')}
                      onToggle={() => toggleCraftingGroup('sin-oficio')}
                    >
                      {renderCraftingList(sinOficioCrafting)}
                    </CollapsibleGroup>
                  )}
                  {professions.map((profession) => {
                    const list = craftingByOficio.get(profession.id) ?? []
                    if (list.length === 0) return null
                    return (
                      <CollapsibleGroup
                        key={profession.id}
                        title={oficioNameById.get(profession.id) ?? profession.id}
                        count={list.length}
                        expanded={expandedCraftingGroups.has(profession.id)}
                        onToggle={() => toggleCraftingGroup(profession.id)}
                      >
                        {renderCraftingList(list)}
                      </CollapsibleGroup>
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
                      { id: 'ventajas', label: 'Árbol de ventajas' },
                    ] as const
                  ).map((tab) => (
                    <button type="button"
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
                  <PanelSection title="Árbol de ventajas (combate)">
                    <AttributeAdvantageDiagram />
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
                      <button type="button"
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
