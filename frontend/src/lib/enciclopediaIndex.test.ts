import { describe, it, expect } from 'vitest'
import { buildEnciclopediaIndex, buscarMenciones, MIN_PATTERN_LENGTH } from './enciclopediaIndex'
import type {
  EnciclopediaConstructionRecipe,
  EnciclopediaCraftingRecipe,
  EnciclopediaNpcInfo,
  EnciclopediaResponse,
} from './api'
import type { AttributeBlock } from '../types'

// Datos sintéticos mínimos — ninguno de estos NPCs/objetos/recetas existe en el mundo real, solo
// cumplen el shape de EnciclopediaResponse para poder ejercitar buildEnciclopediaIndex().
const DUMMY_ATTRIBUTES: AttributeBlock = {
  fuerza: 1,
  destreza: 1,
  constitucion: 1,
  inteligencia: 1,
  voluntad: 1,
  carisma: 1,
  magia: 1,
}

function makeNpc(overrides: Partial<EnciclopediaNpcInfo> & Pick<EnciclopediaNpcInfo, 'slug' | 'name'>): EnciclopediaNpcInfo {
  return {
    kind: 'PRINCIPAL',
    role: 'Rol de prueba',
    faction: null,
    level: 1,
    bio: 'Bio de prueba.',
    aliases: [],
    imagePrompts: { thumbnail: null, banner: null },
    imageUrls: { thumbnail: null, banner: null },
    discovered: true,
    fase: 'DESCUBIERTO',
    attributes: DUMMY_ATTRIBUTES,
    ataqueBase: { icon: '⚔️', name: 'Golpe', description: 'Golpe de prueba.', preferredAttribute: 'fuerza' },
    items: [],
    ...overrides,
  }
}

function makeCraftingRecipe(overrides: Partial<EnciclopediaCraftingRecipe> & Pick<EnciclopediaCraftingRecipe, 'key' | 'name'>): EnciclopediaCraftingRecipe {
  return {
    description: 'Receta de prueba.',
    oficio: null,
    tier: null,
    requirements: [],
    imagePrompts: { thumbnail: null, banner: null },
    imageUrls: { thumbnail: null, banner: null },
    ...overrides,
  }
}

function makeConstructionRecipe(
  overrides: Partial<EnciclopediaConstructionRecipe> & Pick<EnciclopediaConstructionRecipe, 'key' | 'name'>,
): EnciclopediaConstructionRecipe {
  return {
    description: 'Construcción de prueba.',
    raza: null,
    oficio: null,
    tier: null,
    requirements: [],
    imagePrompts: { thumbnail: null, banner: null },
    imageUrls: { thumbnail: null, banner: null },
    ...overrides,
  }
}

function emptyResponse(overrides: Partial<EnciclopediaResponse> = {}): EnciclopediaResponse {
  return {
    npcs: [],
    items: [],
    faunaFlora: [],
    locations: [],
    razas: [],
    personajes: [],
    classes: [],
    constructionRecipes: [],
    craftingRecipes: [],
    factions: [],
    historia: [],
    combate: [],
    reputacion: [],
    ...overrides,
  }
}

describe('buildEnciclopediaIndex', () => {
  it('registra un NPC con alias en `entries`, con el patrón en minúsculas', () => {
    const npc = makeNpc({ slug: 'gruth', name: 'Gruth el Manco', aliases: ['El Manco'] })
    const index = buildEnciclopediaIndex(emptyResponse({ npcs: [npc] }))

    expect(index.entries.get('gruth el manco')?.entitySlug).toBe('gruth')
    expect(index.entries.get('el manco')?.entitySlug).toBe('gruth')
  })

  it('da precedencia al patrón más largo sobre el más corto (mismo caso que el comentario del archivo: "Kort\'ikar Torgash" vs "Torgash")', () => {
    const corto = makeNpc({ slug: 'torgash-corto', name: 'Torgash' })
    const largo = makeNpc({ slug: 'torgash-largo', name: "Kort'ikar Torgash" })
    const index = buildEnciclopediaIndex(emptyResponse({ npcs: [corto, largo] }))

    expect(index.regex).not.toBeNull()

    const textoConTitulo = "Vimos a Kort'ikar Torgash acercarse por la niebla."
    const matchConTitulo = index.regex!.exec(textoConTitulo)
    expect(matchConTitulo?.[0]).toBe("Kort'ikar Torgash")
    expect(index.entries.get(matchConTitulo![0].toLowerCase())?.entitySlug).toBe('torgash-largo')

    index.regex!.lastIndex = 0
    const textoSinTitulo = 'Torgash gruñó una advertencia.'
    const matchSinTitulo = index.regex!.exec(textoSinTitulo)
    expect(matchSinTitulo?.[0]).toBe('Torgash')
    expect(index.entries.get(matchSinTitulo![0].toLowerCase())?.entitySlug).toBe('torgash-corto')
  })

  it('no registra en `entries` patrones por debajo de MIN_PATTERN_LENGTH, pero sí los deja en `bySlugKey` si tienen entityType/entitySlug', () => {
    expect(MIN_PATTERN_LENGTH).toBe(4)
    const npcCorto = makeNpc({ slug: 'uxa', name: 'Uxa' }) // 3 letras, por debajo del mínimo
    const index = buildEnciclopediaIndex(emptyResponse({ npcs: [npcCorto] }))

    expect(index.entries.has('uxa')).toBe(false)
    expect(index.bySlugKey.get('npc:uxa')?.name).toBe('Uxa')
  })

  it('las recetas de crafteo/construcción solo acaban en `bySlugKey`, nunca en `entries`/el regex', () => {
    const crafting = makeCraftingRecipe({ key: 'antorcha-de-campo', name: 'Antorcha de campo' })
    const construction = makeConstructionRecipe({ key: 'campamento-base', name: 'Un campamento base' })
    const index = buildEnciclopediaIndex(emptyResponse({ craftingRecipes: [crafting], constructionRecipes: [construction] }))

    // Sin ninguna otra entidad indexable en esta respuesta sintética, el regex se queda nulo —
    // confirma que las recetas por sí solas no generan ninguna entrada de texto libre.
    expect(index.regex).toBeNull()
    expect(index.entries.size).toBe(0)

    expect(index.bySlugKey.get('crafteo:antorcha-de-campo')?.name).toBe('Antorcha de campo')
    expect(index.bySlugKey.get('construccion:campamento-base')?.name).toBe('Un campamento base')
  })
})

describe('buscarMenciones', () => {
  it('un nombre propio escrito todo en minúsculas no se enlaza (el NPC «Tira» en «algo que tira de él»)', () => {
    const tira = makeNpc({ slug: 'tira', name: 'Tira', aliases: ['tira'] })
    const manco = makeNpc({ slug: 'gruth', name: 'Gruth', aliases: ['el manco'] })
    const index = buildEnciclopediaIndex(emptyResponse({ npcs: [tira, manco] }))

    expect(buscarMenciones(index, 'Algo que tira de él.')).toEqual([])
    expect(buscarMenciones(index, 'Habla con Tira.').map((m) => m.target.entitySlug)).toEqual(['tira'])
    expect(buscarMenciones(index, 'Llega el Manco.').map((m) => m.texto)).toEqual(['el Manco'])
    expect(buscarMenciones(index, 'Llega el manco.')).toEqual([])
  })

  it('devuelve el texto tal cual aparece y la posición, no el nombre canónico', () => {
    const index = buildEnciclopediaIndex(
      emptyResponse({
        faunaFlora: [
          {
            kind: 'flora',
            sourceSlug: 'piedra',
            sourceName: 'Roca de Llanura Roja',
            aliases: ['rocas'],
            description: 'Roca rojiza.',
            yields: [],
          } as unknown as EnciclopediaResponse['faunaFlora'][number],
        ],
      }),
    )
    const [mencion] = buscarMenciones(index, 'Golpea las rocas.')
    expect(mencion.texto).toBe('rocas')
    expect(mencion.inicio).toBe(11)
    expect(mencion.target.name).toBe('Roca de Llanura Roja')
  })

  // P162 (QA-27): «Gorhorn ve Veta de Yerreo cerca» salía con dos chips, «Veta» (alias suelto de otra
  // veta) y «Yerreo». Con el nombre del punto como alias, gana el nombre entero.
  it('el nombre del punto del mapa gana a sus trozos', () => {
    const fuente = (sourceSlug: string, sourceName: string, aliases: string[]) =>
      ({ kind: 'flora', sourceSlug, sourceName, aliases, description: 'x', yields: [] }) as unknown as EnciclopediaResponse['faunaFlora'][number]
    const index = buildEnciclopediaIndex(
      emptyResponse({ faunaFlora: [fuente('veta-hierro', 'Veta de hierro', ['veta']), fuente('yerreo', 'Yerreo', ['yerreo', 'veta de yerreo'])] }),
    )
    const menciones = buscarMenciones(index, 'Gorhorn ve Veta de Yerreo cerca.')
    expect(menciones.map((m) => m.texto)).toEqual(['Veta de Yerreo'])
    expect(menciones[0].target.name).toBe('Yerreo')
  })
})
