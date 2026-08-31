// Construcción de DetailTarget a partir de una entrada real de la Enciclopedia (2026-07-22,
// extraído de EnciclopediaPanel.tsx para poder reutilizarlo también desde el enlazado de texto
// en narraciones/descripciones — ver enciclopediaIndex.ts). Única fuente de verdad: tanto el
// panel como el enlazado de texto abren SIEMPRE el mismo detalle para la misma entidad.
import { slugify } from './slugify'
import { attributeLabels, statBonusLabels } from './dice'
import { secondaryAttributeLabels } from './secondaryAttributes'
import { professions } from '../data/professions'
import type {
  EnciclopediaAbilityInfo,
  EnciclopediaConstructionRecipe,
  EnciclopediaCraftingRecipe,
  EnciclopediaFaccionInfo,
  EnciclopediaFaunaFloraInfo,
  EnciclopediaHistoriaInfo,
  EnciclopediaInteraccion,
  EnciclopediaItemInfo,
  EnciclopediaLocationInfo,
  EnciclopediaNpcInfo,
  EnciclopediaPersonajeInfo,
  EnciclopediaRazaInfo,
} from './api'
import type { RecipeStatusInfo } from '../types'
import type { EnciclopediaLinkTarget } from './enciclopediaIndex'
import type { ItemTipo } from '../types'

// Sesión de diseño 2026-07-23 (tier/requisitos de objetos) — mapa combinado para resolver
// cualquier clave de `requisitos` (atributo jugable o secundario) a su etiqueta en español.
const ALL_ATTRIBUTE_LABELS: Record<string, string> = { ...attributeLabels, ...secondaryAttributeLabels }

// Categorización mecánica (2026-07-29) — subtipo fino (`category`) dentro de cada `tipo` amplio.
// "material"/"medicinal" desaparecen como categorías propias: "material" genérico se dividió en
// tipos de recurso/material más finos (piel/hueso/madera/piedra/mena/hierba/pluma/quitina/resina,
// metal/bloque), "medicinal" sigue viviendo dentro de tipo=CONSUMIBLE, no en esta lista de arriba.
export const ITEM_CATEGORY_ORDER = [
  'especial',
  'arma',
  'herramienta',
  'ropa',
  'cosmetico',
  'consumible',
  'medicinal',
  'documento',
  'valor',
  'piel',
  'hueso',
  'madera',
  'piedra',
  'mena',
  'hierba',
  'pluma',
  'quitina',
  'resina',
  'metal',
  'bloque',
]
export const ITEM_CATEGORY_LABEL: Record<string, string> = {
  especial: 'Especiales',
  arma: 'Armas',
  herramienta: 'Herramientas',
  ropa: 'Ropa',
  cosmetico: 'Cosméticos',
  consumible: 'Consumibles',
  medicinal: 'Medicinales',
  documento: 'Documentos',
  valor: 'Objetos de valor',
  piel: 'Pieles',
  hueso: 'Huesos',
  madera: 'Madera',
  piedra: 'Piedra',
  mena: 'Mena',
  hierba: 'Hierbas',
  pluma: 'Plumas',
  quitina: 'Quitina',
  resina: 'Resina',
  metal: 'Metal',
  bloque: 'Bloques',
}
const ITEM_CATEGORY_ICON: Record<string, string> = {
  especial: '✨',
  arma: '⚔️',
  herramienta: '🔨',
  ropa: '👕',
  cosmetico: '📿',
  consumible: '🍖',
  medicinal: '💊',
  documento: '📜',
  valor: '💰',
  piel: '🧵',
  hueso: '🦴',
  madera: '🪵',
  piedra: '🪨',
  mena: '⛏️',
  hierba: '🌿',
  pluma: '🪶',
  quitina: '🦂',
  resina: '🟤',
  metal: '🔩',
  bloque: '🧱',
}

// Categorización mecánica (2026-07-29) — tipo amplio, exterior a `category` (subtipo fino de
// arriba). "equipable"/"consumible"/"narrativo" agrupan lo que ya existía; "recurso"/"material"
// son la distinción nueva (crudo vs. procesado) que antes vivía toda bajo un único "material".
// ESPECIAL (2026-08-03) va primero a propósito — son los objetos con más peso real (efecto de
// juego, no solo sabor), tiene sentido que aparezcan antes que equipables comunes.
export const ITEM_TIPO_ORDER: ItemTipo[] = ['ESPECIAL', 'EQUIPABLE', 'CONSUMIBLE', 'MATERIAL', 'RECURSO', 'NARRATIVO']
export const ITEM_TIPO_LABEL: Record<ItemTipo, string> = {
  // "Especiales" (2026-08-03) se muda aquí, a `tipo: ESPECIAL` de verdad — antes lo llevaba
  // NARRATIVO sin serlo realmente (cosméticos/documentos/valor no tienen ningún efecto de juego).
  ESPECIAL: 'Especiales',
  EQUIPABLE: 'Equipables',
  CONSUMIBLE: 'Consumibles',
  MATERIAL: 'Materiales',
  RECURSO: 'Recursos',
  NARRATIVO: 'Narrativos',
}

export function itemIcon(category: string): string {
  return ITEM_CATEGORY_ICON[category] ?? '📦'
}

export function npcIcon(): string {
  return '🧑'
}

// Bug real (2026-07-22): usar `cazable` (¿tiene ficha de combate?) como proxy de "¿es un
// animal?" categorizaba mal fauna sin Npc propio (Espina del Viento, Cornante, Sombra de Kroj)
// como flora/material. `esFauna` es la señal correcta — independiente de si ya es cazable de verdad.
export function faunaFloraIcon(entry: EnciclopediaFaunaFloraInfo): string {
  return entry.esFauna ? '🐾' : '🌿'
}

export function faunaFloraMeta(entry: EnciclopediaFaunaFloraInfo): string {
  if (entry.cazable) return 'Fauna cazable'
  if (entry.esFauna) return 'Fauna (sin ficha de combate todavía)'
  return 'Flora / material'
}

export function yieldsSummary(entry: EnciclopediaFaunaFloraInfo): string {
  if (entry.yields.length === 0) return 'Sin recursos catalogados todavía.'
  return entry.yields.map((y) => `${y.cantidad} ${y.itemName}${y.condicion ? ` (${y.condicion})` : ''}`).join(', ')
}

const INTERACCION_LABELS: Record<keyof Omit<EnciclopediaInteraccion, 'atributoResistencia'>, string> = {
  comerciablePct: 'Comerciable',
  reclutablePct: 'Reclutable',
  domesticablePct: 'Domesticable',
  capturablePct: 'Capturable',
  cortejablePct: 'Cortejable',
}

// Corrección 2026-08-27: nivel/atributos/ataque base/loadout son mecánica de combate, no lore —
// se quitaron de la Enciclopedia (viven correctamente en CombatPanel.tsx, "Analizar Rival").
// Las probabilidades de interacción SÍ se quedan (decisión explícita): saber que algo es
// domesticable/reclutable es información del mundo, no un número de dificultad de combate.
function interaccionLine(interaccion?: EnciclopediaInteraccion): string | null {
  if (!interaccion) return null
  const entries = (Object.entries(INTERACCION_LABELS) as [keyof typeof INTERACCION_LABELS, string][])
    .filter(([key]) => interaccion[key] > 0)
    .map(([key, label]) => `${label} ${interaccion[key]}%`)
  if (entries.length === 0) return null
  const resistencia = interaccion.atributoResistencia ? ALL_ATTRIBUTE_LABELS[interaccion.atributoResistencia] ?? interaccion.atributoResistencia : null
  return `Interacción: ${entries.join(', ')}${resistencia ? ` (resistencia: ${resistencia})` : ''}.`
}

export function npcToDetailTarget(npc: EnciclopediaNpcInfo): EnciclopediaLinkTarget {
  return {
    kind: 'info',
    icon: npcIcon(),
    name: npc.name,
    meta: `${npc.role}${npc.faction ? ` — ${npc.faction}` : ''}`,
    description: npc.bio,
    extra: [interaccionLine(npc.interaccion), npc.aliases.length ? `También reconocido como: ${npc.aliases.join(', ')}.` : null]
      .filter((line): line is string => !!line)
      .join('\n'),
    imagePrompts: npc.imagePrompts,
    imageUrls: npc.imageUrls,
    entityType: 'npc',
    entitySlug: npc.slug,
    variantesSexo: npc.variantesSexo,
  }
}

export function itemToDetailTarget(item: EnciclopediaItemInfo): EnciclopediaLinkTarget {
  const requisitosEntries = Object.entries(item.requisitos ?? {})
  const statBonusEntries = Object.entries(item.statBonuses ?? {}).filter(([, amount]) => !!amount)
  const extraLines = [
    statBonusEntries.length > 0
      ? `Bonificador: ${statBonusEntries.map(([k, v]) => `+${v} ${statBonusLabels[k] ?? k}`).join(', ')}.`
      : null,
    item.dimensiones ? `Medidas: ${item.dimensiones}` : null,
    item.lugarOrigen ? `Origen: ${item.lugarOrigen}` : null,
    // Sesión de diseño 2026-07-23 — tier 1 es común, no se resalta.
    item.tier && item.tier > 1 ? `Nivel: ${item.tier}` : null,
    requisitosEntries.length > 0
      ? `Requisitos para equipar: ${requisitosEntries.map(([k, v]) => `${ALL_ATTRIBUTE_LABELS[k] ?? k} ${v}`).join(', ')}.`
      : null,
    // Auditoría de Enciclopedia (2026-08-27) — antes invisible pese a ser "petición explícita"
    // según el propio comentario del schema. Son prefijos de oficio (sin raza/región, p.ej.
    // "curtidor"), no el id completo de `professions` — se muestran tal cual, capitalizados.
    item.herramientaParaOficio && item.herramientaParaOficio.length > 0
      ? `Herramienta requerida para: ${item.herramientaParaOficio.map((o) => o.charAt(0).toUpperCase() + o.slice(1)).join(', ')}.`
      : null,
  ].filter((line): line is string => !!line)
  return {
    kind: 'info',
    icon: itemIcon(item.category),
    name: item.name,
    meta: ITEM_CATEGORY_LABEL[item.category] ?? item.category,
    description: item.description,
    extra: extraLines.length > 0 ? extraLines.join('\n') : undefined,
    imagePrompts: item.imagePrompts,
    imageUrls: item.imageUrls,
    entityType: 'item',
    entitySlug: item.slug,
  }
}

export function faunaFloraToDetailTarget(entry: EnciclopediaFaunaFloraInfo): EnciclopediaLinkTarget {
  return {
    kind: 'info',
    icon: faunaFloraIcon(entry),
    name: entry.sourceName,
    // Corrección 2026-08-27: mismo criterio que npcToDetailTarget — nivel/atributos/ataque son
    // mecánica de combate, no lore, revertido de la pasada de la auditoría. `interaccionLine` sí
    // se queda (decisión explícita, ver comentario junto a esa función).
    meta: faunaFloraMeta(entry),
    description: entry.description ?? yieldsSummary(entry),
    extra: [
      entry.description ? `Recursos: ${yieldsSummary(entry)}` : null,
      interaccionLine(entry.interaccion),
      entry.aliases.length ? `También reconocido como: ${entry.aliases.join(', ')}.` : null,
    ]
      .filter((line): line is string => !!line)
      .join('\n'),
    imagePrompts: entry.imagePrompts,
    imageUrls: entry.imageUrls,
    entityType: 'fauna',
    entitySlug: entry.sourceSlug,
    variantesSexo: entry.variantesSexo,
  }
}

export function locationToDetailTarget(loc: EnciclopediaLocationInfo): EnciclopediaLinkTarget {
  return {
    kind: 'info',
    icon: '📍',
    name: loc.name,
    meta: `${loc.kind} · ${loc.region}`,
    description: loc.description,
    imagePrompts: loc.imagePrompts,
    imageUrls: loc.imageUrls,
    entityType: 'location',
    entitySlug: loc.slug,
    variantesTiempo: loc.variantesTiempo,
    asentamiento: loc.asentamiento,
  }
}

// Requisito de nivel de oficio, en texto (2026-08-13, petición explícita: "las habilidades de las
// cuales no tengamos suficiente nivel en profesión que no salgan [en Habilidades]... si quieres
// consultar el listado por nivel vas a la enciclopedia") — Habilidades ahora solo muestra lo ya
// desbloqueado, así que esta ficha es el único sitio que enseña el nivel que hace falta. Exportada
// (auditoría 2026-08-13, dedupe renderCraftingList/renderConstructionList) — EnciclopediaPanel.tsx
// también la usa para la fila de lista, no solo esta ficha de detalle.
export function oficioRequirementLine(oficio: string | null, tier: number | null): string | null {
  if (!oficio || !tier) return null
  const professionName = professions.find((p) => p.id === oficio)?.name ?? oficio
  return `Requiere nivel ${tier} de ${professionName}.`
}

// Ingredientes en formato lista, con conteo real tienes/necesitas (2026-08-13, petición explícita:
// "que ponga lo que tienes contra lo que falta 0/5... con un card en formato lista") — cuando hay
// `status` (partida activa), la ficha renderiza `ingredients` como una lista propia, una fila por
// material (ver DetailModal.tsx); `extra` se queda solo con el resto (nivel/atributos/ubicación).
// Sin `status` (Enciclopedia fuera de una partida activa), no hay ningún conteo real que mostrar —
// cae al texto plano de siempre dentro de `extra`, sin lista.
function extraLinesFor(
  requirements: { cantidad: number; label: string }[],
  nivel: string | null,
  status: RecipeStatusInfo | undefined,
): string | undefined {
  const parts: string[] = []
  if (!status) parts.push(`Necesita: ${requirements.map((r) => `${r.cantidad} de ${r.label}`).join(', ')}.`)
  if (nivel) parts.push(nivel)
  if (status) {
    if (status.missingRequisitos.length > 0) parts.push(`Falta: ${status.missingRequisitos.join(', ')}.`)
    if (!status.locationOk && status.requiredLocationName) parts.push(`Debes estar en ${status.requiredLocationName}.`)
    // Reglas de reino (auditoría 2026-08-13) — Ayuntamiento/región/distancia/cupo, ver recipesStatus.ts.
    if (status.blockedReason) parts.push(`${status.blockedReason[0].toUpperCase()}${status.blockedReason.slice(1)}.`)
  }
  return parts.length > 0 ? parts.join(' ') : undefined
}

export function constructionToDetailTarget(recipe: EnciclopediaConstructionRecipe, status?: RecipeStatusInfo): EnciclopediaLinkTarget {
  return {
    kind: 'info',
    icon: '🏗️',
    name: recipe.name,
    meta: 'Construcción',
    description: recipe.description,
    extra: extraLinesFor(recipe.requirements, oficioRequirementLine(recipe.oficio, recipe.tier), status),
    ingredients: status?.ingredients,
    imagePrompts: recipe.imagePrompts,
    imageUrls: recipe.imageUrls,
    entityType: 'construccion',
    entitySlug: recipe.key,
  }
}

export function craftingToDetailTarget(recipe: EnciclopediaCraftingRecipe, status?: RecipeStatusInfo): EnciclopediaLinkTarget {
  return {
    kind: 'info',
    icon: '🔨',
    name: recipe.name,
    meta: 'Objeto crafteado',
    description: recipe.description,
    extra: extraLinesFor(recipe.requirements, oficioRequirementLine(recipe.oficio, recipe.tier), status),
    ingredients: status?.ingredients,
    imagePrompts: recipe.imagePrompts,
    imageUrls: recipe.imageUrls,
    entityType: 'crafteo',
    entitySlug: recipe.key,
  }
}

export function razaToDetailTarget(raza: EnciclopediaRazaInfo): EnciclopediaLinkTarget {
  return {
    kind: 'info',
    icon: raza.icon,
    name: raza.name,
    meta: raza.rasgoFisico,
    description: raza.description,
    extra: raza.rasgoCaracter,
    imagePrompts: raza.imagePrompts,
    imageUrls: raza.imageUrls,
    entityType: 'raza',
    entitySlug: raza.slug,
    variantes: raza.variantes,
    variantesSexo: raza.variantesSexo,
  }
}

// Secciones "Facciones"/"Historia" (2026-08-06) — imagen bajo demanda igual que el resto de
// categorías con entidad real (auditoría 2026-08-06: "revisa que todo tiene banner/icono").
export function faccionToDetailTarget(faccion: EnciclopediaFaccionInfo): EnciclopediaLinkTarget {
  return {
    kind: 'info',
    icon: '🚩',
    name: faccion.name,
    // Auditoría de Enciclopedia (2026-08-27) — Facciones era la única categoría con entidad real
    // sin ningún `meta`, pese a que `raza` ya existe en el tipo (se usa para agrupar colapsables
    // en EnciclopediaPanel.tsx, nunca se pasaba a la propia ficha de detalle).
    meta: faccion.raza,
    description: faccion.description,
    imagePrompts: faccion.imagePrompts,
    imageUrls: faccion.imageUrls,
    entityType: 'faction',
    entitySlug: faccion.slug,
  }
}

// `unlocked` distingue "no encontrado" (la propia tarjeta ya sale bloqueada como "???", ver
// `discovered` en EntryCardGrid) de "encontrado pero sin traducir" (la tarjeta se ve, pero el
// texto real no ha llegado del backend — nunca viaja por la red hasta desbloquearse). Mismo
// criterio para la imagen: `entityType`/`entitySlug` solo se rellenan si `unlocked`, así que el
// botón de "generar imagen" del DetailModal ni siquiera aparece para una entrada sin traducir —
// generar una escena del contenido bloqueado sería otra forma de fugarlo antes de tiempo.
export function historiaEntryToDetailTarget(entry: EnciclopediaHistoriaInfo): EnciclopediaLinkTarget {
  return {
    kind: 'info',
    icon: '📜',
    name: entry.title,
    meta: entry.year != null ? `Año ${entry.year}` : 'Era de las Semillas',
    description: entry.unlocked
      ? (entry.text ?? '')
      : 'Escrito sin traducir — hace falta encontrar a alguien capaz de leer el idioma de las Semillas para desvelar su contenido.',
    imagePrompts: entry.imagePrompts,
    imageUrls: entry.imageUrls,
    entityType: entry.unlocked ? 'historia' : undefined,
    entitySlug: entry.unlocked ? entry.slug : undefined,
  }
}

export function personajeToDetailTarget(pj: EnciclopediaPersonajeInfo): EnciclopediaLinkTarget {
  return {
    kind: 'info',
    icon: pj.icon,
    name: pj.name,
    meta: pj.raza,
    description: pj.historia,
    extra: `Personalidad: ${pj.personalidad}\n\nFacultades: ${pj.facultades}\n\nVoz: ${pj.voz}`,
    imagePrompts: pj.imagePrompts,
    imageUrls: pj.imageUrls,
    entityType: 'personaje',
    entitySlug: pj.slug,
  }
}

export function abilityToDetailTarget(ability: EnciclopediaAbilityInfo, meta?: string): EnciclopediaLinkTarget {
  return {
    kind: 'info',
    icon: ability.icon,
    name: ability.name,
    meta,
    description: ability.description,
    extra: `"${ability.promptText}"`,
    imagePrompts: ability.imagePrompts,
    imageUrls: ability.imageUrls,
    entityType: 'ability',
    entitySlug: slugify(ability.name),
  }
}
