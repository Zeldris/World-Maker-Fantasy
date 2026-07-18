import type { Attribute, AttributeBlock, LogEntry } from '../types'
import { rollCheck } from './dice'

let counter = 0
function nextId(prefix: string) {
  counter += 1
  return `${prefix}-${Date.now()}-${counter}`
}

const keywordAttribute: Array<[RegExp, Attribute]> = [
  [/fuerz|romp|derrib|empuj|golpe|levant/i, 'fuerza'],
  [/sigil|escond|acech|furtiv|sin ser vist/i, 'sigilo'],
  [/convenc|habl|negoci|engañ|persuad|intimid/i, 'carisma'],
  [/hechiz|arcano|magia|invoc|conjur/i, 'arcano'],
  [/resist|aguant|concentra|medita/i, 'voluntad'],
]

function guessAttribute(action: string): Attribute {
  for (const [pattern, attr] of keywordAttribute) {
    if (pattern.test(action)) return attr
  }
  return 'destreza'
}

const successTemplates = [
  (action: string) => `Consigues ${action.toLowerCase()}, aunque no sin esfuerzo. Sientes que has ganado algo de ventaja en lo que sea que venga después.`,
  (action: string) => `Tu intento sale mejor de lo esperado: ${action.toLowerCase()}, con más margen del que creías tener.`,
  (action: string) => `Lo logras. ${action} — limpio, sin llamar la atención de más de lo necesario.`,
]

const failTemplates = [
  (action: string) => `Lo intentas, pero algo se tuerce: ${action.toLowerCase()} no sale como esperabas, y ahora tienes un problema nuevo.`,
  (action: string) => `No es suficiente. ${action} queda a medias, y el coste de intentarlo ya está hecho.`,
  (action: string) => `Fallas por poco. ${action.toLowerCase()}, pero el ruido, el tiempo o la torpeza te delatan de algún modo.`,
]

export function generateCharacterResponse(action: string, attributes: AttributeBlock, timeLabel: string): LogEntry {
  const attribute = guessAttribute(action)
  const roll = rollCheck(attributes, attribute)
  const templates = roll.success ? successTemplates : failTemplates
  const template = templates[Math.floor(Math.random() * templates.length)]
  return {
    id: nextId('c'),
    channel: 'character',
    text: template(action),
    timeLabel,
    roll,
    isPlayerAction: false,
    createdAt: new Date().toISOString(),
  }
}

const worldEventPool = [
  'En la Meseta del Orden, la facción radical de la Concordia de Hierro exige nuevos contingentes de las llanuras.',
  'Un mensajero cruza la frontera de la Alianza de la Rama Blanca con noticias que nadie quiere escuchar todavía.',
  'En Vaelira, las casas Kelife compiten de nuevo por el control de los yacimientos de cristal.',
  'Un pescador de la costa del estrecho jura haber visto luces bajo el agua donde no debería haberlas. Nadie le cree.',
  'Una tregua menor entre dos clanes se rompe por un motivo que en unos días parecerá absurdo.',
]

export function generateWorldEvent(timeLabel: string): LogEntry {
  const text = worldEventPool[Math.floor(Math.random() * worldEventPool.length)]
  return {
    id: nextId('w'),
    channel: 'world',
    text,
    timeLabel,
    createdAt: new Date().toISOString(),
  }
}

export function playerActionEntry(action: string, timeLabel: string): LogEntry {
  return {
    id: nextId('p'),
    channel: 'character',
    text: action,
    timeLabel,
    isPlayerAction: true,
    createdAt: new Date().toISOString(),
  }
}
