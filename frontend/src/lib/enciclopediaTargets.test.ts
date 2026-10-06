import { describe, it, expect } from 'vitest'
import { faunaFloraToDetailTarget } from './enciclopediaTargets'
import type { EnciclopediaFaunaFloraInfo } from './api'

const baseEntry: EnciclopediaFaunaFloraInfo = {
  sourceSlug: 'ruptidar',
  sourceName: 'Ruptidar',
  aliases: ['ruptidar'],
  cazable: true,
  esFauna: true,
  region: null,
  description: 'Reptil serpentiforme.',
  yields: [],
  imagePrompts: { thumbnail: null, banner: null },
  imageUrls: { thumbnail: null, banner: null },
  discovered: true,
  fase: 'DESCUBIERTO',
  ataqueBase: null,
  faunaCategoria: 'ESCAMADOS',
  floraCategoria: null,
  faunaCategoriaUnlocks: [],
  companionOfNpc: null,
}

// Cierre de deuda técnica (2026-09-15): `faunaCategoria` ya llegaba desde 2026-09-04, pero el
// roster de habilidades que desbloquea (faunaCategoriaUnlocks) nunca se mostraba en ningún sitio
// — ni el backend lo exponía (backend/src/routes/world.ts, faunaCategoriaAbilityUnlocksFor sin
// consumidor real) ni, aun exponiéndolo, el frontend lo consumía. Cubre solo la pieza nueva:
// `faunaFloraToDetailTarget` incluye el roster en `extra`, ordenado por nivel.
describe('faunaFloraToDetailTarget — roster de habilidades de categoría (faunaCategoriaUnlocks)', () => {
  it('con faunaCategoriaUnlocks vacío (flora, o fauna sin categoría asignada): no añade ninguna línea de roster', () => {
    const target = faunaFloraToDetailTarget(baseEntry)
    expect(target.extra).not.toContain('Habilidades de su categoría')
  })

  it('con faunaCategoriaUnlocks real: las lista ordenadas por nivel, con la categoría en el encabezado', () => {
    const entry: EnciclopediaFaunaFloraInfo = {
      ...baseEntry,
      faunaCategoriaUnlocks: [
        {
          level: 8,
          ability: {
            icon: '🦷',
            name: 'Mordisco Certero',
            description: 'x',
            promptText: 'x',
            category: 'combate',
            imagePrompts: { thumbnail: null, banner: null },
            imageUrls: { thumbnail: null, banner: null },
            preferredAttribute: 'fuerza',
          },
        },
        {
          level: 1,
          ability: {
            icon: '🐍',
            name: 'Reptación Sigilosa',
            description: 'x',
            promptText: 'x',
            category: 'combate',
            imagePrompts: { thumbnail: null, banner: null },
            imageUrls: { thumbnail: null, banner: null },
            preferredAttribute: 'destreza',
          },
        },
      ],
    }
    const target = faunaFloraToDetailTarget(entry)
    expect(target.extra).toContain('Habilidades de su categoría (ESCAMADOS)')
    // Orden por nivel, no por el orden de llegada del array.
    const idxNv1 = target.extra!.indexOf('Nv.1')
    const idxNv8 = target.extra!.indexOf('Nv.8')
    expect(idxNv1).toBeGreaterThanOrEqual(0)
    expect(idxNv8).toBeGreaterThan(idxNv1)
  })
})

// Vínculo Companion↔dueño (auditoría de contenido de Enciclopedia, 2026-09-15): `Npc.
// companionOfNpcSlug` ya vinculaba a Gisoki/Gogorath con su dueño, pero nunca llegaba al frontend.
describe('faunaFloraToDetailTarget — vínculo Companion↔dueño (companionOfNpc)', () => {
  it('con companionOfNpc null (la inmensa mayoría de fauna): no añade ninguna línea de vínculo', () => {
    const target = faunaFloraToDetailTarget(baseEntry)
    expect(target.extra).not.toContain('Compañero vinculado de')
  })

  it('con companionOfNpc real: añade la línea con el nombre del dueño', () => {
    const entry: EnciclopediaFaunaFloraInfo = {
      ...baseEntry,
      companionOfNpc: { slug: 'ulkha-ketg', name: 'Ulkha Ketg' },
    }
    const target = faunaFloraToDetailTarget(entry)
    expect(target.extra).toContain('Compañero vinculado de Ulkha Ketg.')
  })
})

// CR-56 (Q1): la ficha de una especie domesticable dice para qué sirve.
describe('faunaFloraToDetailTarget — usos de la especie (CR-56)', () => {
  it('con usos, añade una línea; sin ellos, nada', () => {
    expect(faunaFloraToDetailTarget({ ...baseEntry, usos: ['guardia del Reino', 'compañero de combate'] }).extra).toContain('Domesticada sirve para: guardia del Reino · compañero de combate.')
    expect(faunaFloraToDetailTarget(baseEntry).extra).not.toContain('Domesticada')
  })
})
