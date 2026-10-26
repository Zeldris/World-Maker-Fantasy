import { describe, it, expect } from 'vitest'
import { pickMentionedEntityBanner, mentionedEntityKey, resolveEntityBannerFromRef } from './mentionedEntityBanner'
import { buildEnciclopediaIndex, type EnciclopediaLinkTarget } from './enciclopediaIndex'
import type { EnciclopediaNpcInfo, EnciclopediaResponse, EnciclopediaSexoVariante } from './api'
import type { AttributeBlock } from '../types'

/// Cobertura nueva (2026-09-03) — puro y sin cobertura unitaria propia hasta ahora, pese a ser el
/// motor real de los banners de entidad citada bajo la narración (ya ejercitado indirectamente vía
/// useEntityBanner.test.tsx, pero sin cubrir sus propios casos límite: orden de prioridad entre
/// tipos, fallback de variante regional/sexo, colisión de claves).
const DUMMY_ATTRIBUTES: AttributeBlock = { fuerza: 1, destreza: 1, constitucion: 1, inteligencia: 1, voluntad: 1, carisma: 1, magia: 1 }

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

describe('pickMentionedEntityBanner', () => {
  it('devuelve la única candidata con banner real citada en el texto', () => {
    const npc = makeNpc({ slug: 'gruth', name: 'Gruth', imageUrls: { thumbnail: null, banner: '/gruth-banner.png' } })
    const index = buildEnciclopediaIndex(emptyResponse({ npcs: [npc] }))

    const match = pickMentionedEntityBanner('Gruth te mira fijamente.', index, new Set())
    expect(match?.bannerUrl).toBe('/gruth-banner.png')
    expect(match?.target.entitySlug).toBe('gruth')
  })

  // P208 (usuaria, 2026-10-26): «piedra» (alias de una palabra de una roca) no abre una ficha grande.
  function fuente(sourceSlug: string, sourceName: string, aliases: string[]): EnciclopediaResponse['faunaFlora'][number] {
    return { kind: 'flora', sourceSlug, sourceName, aliases, description: 'x', yields: [], imagePrompts: { thumbnail: null, banner: null }, imageUrls: { thumbnail: null, banner: `/${sourceSlug}.png` } } as unknown as EnciclopediaResponse['faunaFlora'][number]
  }

  it('P208: un alias de una palabra no abre la ficha; el nombre de la entrada o un alias de varias palabras, sí', () => {
    const index = buildEnciclopediaIndex(emptyResponse({ faunaFlora: [fuente('roca-pilares-rotos', 'Roca de Llanura Roja', ['piedra', 'piedras', 'piedra roja'])] }))

    expect(pickMentionedEntityBanner('Levantas la primera piedra del ayuntamiento.', index, new Set())).toBeNull()
    expect(pickMentionedEntityBanner('Apilas las piedras junto al muro.', index, new Set())).toBeNull()
    expect(pickMentionedEntityBanner('Levantas la primera piedra roja del ayuntamiento.', index, new Set())?.target.entitySlug).toBe('roca-pilares-rotos')
    expect(pickMentionedEntityBanner('Levantas la roca de llanura roja.', index, new Set())?.target.entitySlug).toBe('roca-pilares-rotos')
  })

  it('P208: el nombre de una sola palabra sigue abriendo la ficha; su alias de una palabra, no', () => {
    const index = buildEnciclopediaIndex(emptyResponse({ faunaFlora: [fuente('yerreo', 'Yerreo', ['mineral'])] }))

    expect(pickMentionedEntityBanner('Hay mineral en la pared.', index, new Set())).toBeNull()
    expect(pickMentionedEntityBanner('Hay yerreo en la pared.', index, new Set())?.target.entitySlug).toBe('yerreo')
  })

  // Revisión de P208: casos límite. Mayúsculas y tildes no cambian nada; un plural o un alias con guion o
  // apóstrofo es una sola palabra: solo enlace, como «piedra».
  it('P208: mayúsculas, tildes, plurales y alias con guion', () => {
    const index = buildEnciclopediaIndex(emptyResponse({ faunaFlora: [fuente('murgol', 'Múrgol', ['múrgoles', 'medio-múrgol', 'múrgol del clan'])] }))

    expect(pickMentionedEntityBanner('Un MÚRGOL te mira.', index, new Set())?.target.entitySlug).toBe('murgol')
    expect(pickMentionedEntityBanner('Los Múrgoles pastan.', index, new Set())).toBeNull()
    expect(pickMentionedEntityBanner('Un medio-múrgol se aparta.', index, new Set())).toBeNull()
    expect(pickMentionedEntityBanner('El MÚRGOL DEL CLAN bala.', index, new Set())?.target.entitySlug).toBe('murgol')
  })

  it('P208: el alias de una palabra de un NPC es un nombre propio y sí abre la ficha', () => {
    const npc = makeNpc({ slug: 'torgash-ketg', name: 'Torgash el Viejo', aliases: ['Torgash'], imageUrls: { thumbnail: null, banner: '/torgash.png' } })
    const index = buildEnciclopediaIndex(emptyResponse({ npcs: [npc] }))

    expect(pickMentionedEntityBanner('Torgash te saluda con la cabeza.', index, new Set())?.target.entitySlug).toBe('torgash-ketg')
  })

  it('sin regex (índice vacío), devuelve null', () => {
    const match = pickMentionedEntityBanner('Cualquier texto.', { regex: null, entries: new Map(), bySlugKey: new Map() }, new Set())
    expect(match).toBeNull()
  })

  it('candidata citada pero SIN imagen real (banner null en toda la cadena de fallback) se descarta', () => {
    const npc = makeNpc({ slug: 'sin-imagen', name: 'Anónimo', imageUrls: { thumbnail: null, banner: null } })
    const index = buildEnciclopediaIndex(emptyResponse({ npcs: [npc] }))

    const match = pickMentionedEntityBanner('Anónimo pasa de largo.', index, new Set())
    expect(match).toBeNull()
  })

  it('prioridad de tipo: NPC (0) gana sobre ITEM (3) cuando ambos se citan a la vez', () => {
    const npc = makeNpc({ slug: 'gruth', name: 'Gruth', imageUrls: { thumbnail: null, banner: '/gruth.png' } })
    const index = buildEnciclopediaIndex(
      emptyResponse({
        npcs: [npc],
        items: [
          {
            slug: 'hacha',
            name: 'Hacha vieja',
            aliases: [],
            description: 'x',
            equipSlot: null,
            category: 'arma',
            statBonuses: {},
            requisitos: {},
            imagePrompts: { thumbnail: null, banner: null },
            imageUrls: { thumbnail: null, banner: '/hacha.png' },
          } as never,
        ],
      }),
    )

    const match = pickMentionedEntityBanner('Gruth desenvaina su Hacha vieja.', index, new Set())
    expect(match?.target.entitySlug).toBe('gruth')
  })

  it('recentlyShown excluye candidatas ya mostradas — con una única candidata en la ventana, devuelve null en vez de repetir', () => {
    const npc = makeNpc({ slug: 'gruth', name: 'Gruth', imageUrls: { thumbnail: null, banner: '/gruth.png' } })
    const index = buildEnciclopediaIndex(emptyResponse({ npcs: [npc] }))
    const key = mentionedEntityKey({ entityType: 'npc', entitySlug: 'gruth' } as EnciclopediaLinkTarget)

    const match = pickMentionedEntityBanner('Gruth vuelve a aparecer.', index, new Set([key]))
    expect(match).toBeNull()
  })

  it('recentlyShown solo excluye la candidata YA mostrada — una segunda candidata fresca en el mismo texto sí se elige', () => {
    const gruth = makeNpc({ slug: 'gruth', name: 'Gruth', imageUrls: { thumbnail: null, banner: '/gruth.png' } })
    const yerin = makeNpc({ slug: 'yerin', name: 'Yerin', imageUrls: { thumbnail: null, banner: '/yerin.png' } })
    const index = buildEnciclopediaIndex(emptyResponse({ npcs: [gruth, yerin] }))
    const key = mentionedEntityKey({ entityType: 'npc', entitySlug: 'gruth' } as EnciclopediaLinkTarget)

    const match = pickMentionedEntityBanner('Gruth y Yerin caminan juntos.', index, new Set([key]))
    expect(match?.target.entitySlug).toBe('yerin')
  })

  it('fallback de imagen: sin variantesSexo directo, cae al imageUrls.banner plano de la entidad', () => {
    const npc = makeNpc({ slug: 'gesgurio', name: 'Gesgurio', imageUrls: { thumbnail: null, banner: '/plano.png' } })
    const index = buildEnciclopediaIndex(emptyResponse({ npcs: [npc] }))

    const match = pickMentionedEntityBanner('El Gesgurio ruge.', index, new Set())
    expect(match?.bannerUrl).toBe('/plano.png')
  })

  it('fallback de imagen: con variantesSexo, usa la primera variante de sexo antes que la imagen plana', () => {
    const sexoVariant: EnciclopediaSexoVariante = {
      sexo: 'macho',
      rasgoFisico: 'x',
      description: 'x',
      medidaCm: 10,
      edadMaxima: 5,
      imageUrls: { thumbnail: null, banner: '/macho.png' },
    } as never
    const npc = makeNpc({
      slug: 'gesgurio',
      name: 'Gesgurio',
      imageUrls: { thumbnail: null, banner: '/plano.png' },
      variantesSexo: [sexoVariant],
    } as never)
    const index = buildEnciclopediaIndex(emptyResponse({ npcs: [npc] }))

    const match = pickMentionedEntityBanner('El Gesgurio ruge.', index, new Set())
    expect(match?.bannerUrl).toBe('/macho.png')
  })
})

describe('mentionedEntityKey', () => {
  it('compone entityType:entitySlug', () => {
    expect(mentionedEntityKey({ entityType: 'npc', entitySlug: 'gruth' } as EnciclopediaLinkTarget)).toBe('npc:gruth')
  })

  it('sin entityType/entitySlug, cae a "info:" + name', () => {
    expect(mentionedEntityKey({ entityType: undefined, entitySlug: undefined, name: 'Algo suelto' } as EnciclopediaLinkTarget)).toBe('info:Algo suelto')
  })
})

describe('resolveEntityBannerFromRef', () => {
  it('reconstruye el banner a partir de entityType/entitySlug ya persistidos', () => {
    const npc = makeNpc({ slug: 'gruth', name: 'Gruth', imageUrls: { thumbnail: null, banner: '/gruth.png' } })
    const index = buildEnciclopediaIndex(emptyResponse({ npcs: [npc] }))

    const resolved = resolveEntityBannerFromRef('npc', 'gruth', index)
    expect(resolved).toEqual({ name: 'Gruth', icon: expect.any(String), imageUrl: '/gruth.png' })
  })

  it('sin match en bySlugKey (entidad ya no existe en el índice actual), devuelve null', () => {
    const index = buildEnciclopediaIndex(emptyResponse())
    expect(resolveEntityBannerFromRef('npc', 'inexistente', index)).toBeNull()
  })

  it('match sin imagen real disponible, devuelve null', () => {
    const npc = makeNpc({ slug: 'sin-imagen', name: 'Anónimo', imageUrls: { thumbnail: null, banner: null } })
    const index = buildEnciclopediaIndex(emptyResponse({ npcs: [npc] }))

    expect(resolveEntityBannerFromRef('npc', 'sin-imagen', index)).toBeNull()
  })
})
