// Construcción de DetailTarget a partir de una entrada real de la Enciclopedia (2026-07-22,
// extraído de EnciclopediaPanel.tsx para poder reutilizarlo también desde el enlazado de texto
// en narraciones/descripciones — ver enciclopediaIndex.ts). Única fuente de verdad: tanto el
// panel como el enlazado de texto abren SIEMPRE el mismo detalle para la misma entidad.
import { slugify } from './slugify'
import { attributeLabels, statBonusLabels } from './dice'
import { secondaryAttributeLabels } from './secondaryAttributes'
import type {
  EnciclopediaAbilityInfo,
  EnciclopediaConstructionRecipe,
  EnciclopediaFaunaFloraInfo,
  EnciclopediaItemInfo,
  EnciclopediaLocationInfo,
  EnciclopediaNpcInfo,
  EnciclopediaPersonajeInfo,
  EnciclopediaRazaInfo,
} from './api'
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

export function npcToDetailTarget(npc: EnciclopediaNpcInfo): EnciclopediaLinkTarget {
  return {
    kind: 'info',
    icon: npcIcon(),
    name: npc.name,
    meta: `${npc.role}${npc.faction ? ` — ${npc.faction}` : ''} · nivel ${npc.level}`,
    description: npc.bio,
    extra: npc.aliases.length ? `También reconocido como: ${npc.aliases.join(', ')}.` : undefined,
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
    meta: faunaFloraMeta(entry),
    description: entry.description ?? yieldsSummary(entry),
    extra: [
      entry.description ? `Recursos: ${yieldsSummary(entry)}` : null,
      entry.aliases.length ? `También reconocido como: ${entry.aliases.join(', ')}.` : null,
    ]
      .filter(Boolean)
      .join(' '),
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
  }
}

export function constructionToDetailTarget(recipe: EnciclopediaConstructionRecipe): EnciclopediaLinkTarget {
  const requisitos = recipe.requirements.map((r) => `${r.cantidad} de ${r.label}`).join(', ')
  return {
    kind: 'info',
    icon: '🏗️',
    name: recipe.name,
    meta: 'Construcción',
    description: recipe.description,
    extra: `Necesita: ${requisitos}.`,
    imagePrompts: recipe.imagePrompts,
    imageUrls: recipe.imageUrls,
    entityType: 'construccion',
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
