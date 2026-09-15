import { describe, it, expect } from 'vitest'
import { resolveCombatAbilities } from './npcAbilities'
import type { EnciclopediaResponse } from './api'

// Cobertura nueva (deuda técnica 2026-08-21) — `resolveCombatAbilities` es la lógica real que
// decide qué habilidades muestra la ficha de un rival en combate (CombatPanel.tsx § EnemyFicha),
// pero según su propio comentario de cabecera "nunca se llamó desde ningún sitio real" hasta que se
// enganchó ahí — sin test, un cambio en el orden (Ataque base → clase → raza → habilidades propias
// de fauna) podría romperse sin que nada lo notara.
const ATAQUE_BASE = { icon: '⚔️', name: 'Golpe', description: 'Un golpe cualquiera.', preferredAttribute: 'fuerza' as const }

const EMPTY_ENCICLOPEDIA: EnciclopediaResponse = {
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
}

describe('resolveCombatAbilities', () => {
  it('sin ataqueBase/clase/raza/habilidadesRaciales: lista vacía', () => {
    expect(resolveCombatAbilities({ ataqueBase: null }, EMPTY_ENCICLOPEDIA)).toEqual([])
  })

  it('siempre antepone el ataque base cuando existe', () => {
    const result = resolveCombatAbilities({ ataqueBase: ATAQUE_BASE }, EMPTY_ENCICLOPEDIA)
    expect(result).toEqual([{ icon: '⚔️', name: 'Golpe', description: 'Un golpe cualquiera.', preferredAttribute: 'fuerza' }])
  })

  it('humanoide con clase: suma solo las habilidades desbloqueadas hasta su nivel, en orden', () => {
    const enciclopedia: EnciclopediaResponse = {
      ...EMPTY_ENCICLOPEDIA,
      classes: [
        {
          name: 'Guerrero',
          description: '',
          unlocks: [
            { level: 1, especializacion: null, ability: { name: 'Tajo', icon: '🗡️', description: 'Nivel 1.', promptText: '', category: 'combate', imagePrompts: { thumbnail: null, banner: null }, imageUrls: { thumbnail: null, banner: null }, preferredAttribute: 'fuerza' } },
            { level: 5, especializacion: null, ability: { name: 'Embestida', icon: '🛡️', description: 'Nivel 5.', promptText: '', category: 'combate', imagePrompts: { thumbnail: null, banner: null }, imageUrls: { thumbnail: null, banner: null }, preferredAttribute: 'constitucion' } },
          ],
        },
      ],
    }
    const result = resolveCombatAbilities({ ataqueBase: null, clase: 'Guerrero', level: 3 }, enciclopedia)
    expect(result.map((a) => a.name)).toEqual(['Tajo'])
  })

  it('humanoide con clase sin level (Infinity implícito): desbloquea TODAS las habilidades de la clase', () => {
    const enciclopedia: EnciclopediaResponse = {
      ...EMPTY_ENCICLOPEDIA,
      classes: [
        {
          name: 'Guerrero',
          description: '',
          unlocks: [
            { level: 1, especializacion: null, ability: { name: 'Tajo', icon: '🗡️', description: '', promptText: '', category: 'combate', imagePrompts: { thumbnail: null, banner: null }, imageUrls: { thumbnail: null, banner: null }, preferredAttribute: 'fuerza' } },
            { level: 5, especializacion: null, ability: { name: 'Embestida', icon: '🛡️', description: '', promptText: '', category: 'combate', imagePrompts: { thumbnail: null, banner: null }, imageUrls: { thumbnail: null, banner: null }, preferredAttribute: 'constitucion' } },
          ],
        },
      ],
    }
    const result = resolveCombatAbilities({ ataqueBase: null, clase: 'Guerrero' }, enciclopedia)
    expect(result.map((a) => a.name)).toEqual(['Tajo', 'Embestida'])
  })

  it('humanoide con raza: suma las 2 habilidades raciales (ataque + defensa), compartidas por toda la raza', () => {
    const enciclopedia: EnciclopediaResponse = {
      ...EMPTY_ENCICLOPEDIA,
      razas: [
        {
          slug: 'orcos',
          name: 'Orcos',
          icon: '🪓',
          rasgoFisico: '',
          rasgoCaracter: '',
          description: '',
          imagePrompts: { thumbnail: null, banner: null },
          imageUrls: { thumbnail: null, banner: null },
          habilidadesRaciales: {
            ataque: { icon: '🪓', name: 'Furia orca', description: '', preferredAttribute: 'fuerza' },
            defensa: { icon: '🛡️', name: 'Piel curtida', description: '', preferredAttribute: 'constitucion' },
          },
        },
      ],
    }
    const result = resolveCombatAbilities({ ataqueBase: null, raza: 'orcos' }, enciclopedia)
    expect(result.map((a) => a.name)).toEqual(['Furia orca', 'Piel curtida'])
  })

  it('clase/raza inexistentes en el catálogo: no rompe, simplemente no añade nada de esa fuente', () => {
    const result = resolveCombatAbilities({ ataqueBase: null, clase: 'Clase inventada', raza: 'raza-inventada' }, EMPTY_ENCICLOPEDIA)
    expect(result).toEqual([])
  })

  it('fauna: usa habilidadesRaciales propias tal cual, con selfTarget en cada una', () => {
    const selfTarget = { kind: 'info' as const, icon: '🐺', name: 'Lobo de las Dunas', description: '' }
    const result = resolveCombatAbilities(
      {
        ataqueBase: null,
        habilidadesRaciales: [{ icon: '🐺', name: 'Mordisco', description: 'Ataque de fauna.', categoria: 'ataque', preferredAttribute: 'destreza' }],
        selfTarget,
      },
      EMPTY_ENCICLOPEDIA,
    )
    expect(result).toEqual([{ icon: '🐺', name: 'Mordisco', description: 'Ataque de fauna.', preferredAttribute: 'destreza', detailTarget: selfTarget }])
  })

  it('combina las 4 fuentes en orden: ataque base, clase, raza, habilidades propias', () => {
    const enciclopedia: EnciclopediaResponse = {
      ...EMPTY_ENCICLOPEDIA,
      classes: [
        {
          name: 'Guerrero',
          description: '',
          unlocks: [
            { level: 1, especializacion: null, ability: { name: 'Tajo', icon: '🗡️', description: '', promptText: '', category: 'combate', imagePrompts: { thumbnail: null, banner: null }, imageUrls: { thumbnail: null, banner: null }, preferredAttribute: 'fuerza' } },
          ],
        },
      ],
      razas: [
        {
          slug: 'orcos',
          name: 'Orcos',
          icon: '🪓',
          rasgoFisico: '',
          rasgoCaracter: '',
          description: '',
          imagePrompts: { thumbnail: null, banner: null },
          imageUrls: { thumbnail: null, banner: null },
          habilidadesRaciales: {
            ataque: { icon: '🪓', name: 'Furia orca', description: '', preferredAttribute: 'fuerza' },
            defensa: { icon: '🛡️', name: 'Piel curtida', description: '', preferredAttribute: 'constitucion' },
          },
        },
      ],
    }
    const result = resolveCombatAbilities({ ataqueBase: ATAQUE_BASE, clase: 'Guerrero', raza: 'orcos', level: 10 }, enciclopedia)
    expect(result.map((a) => a.name)).toEqual(['Golpe', 'Tajo', 'Furia orca', 'Piel curtida'])
  })
})
