import { describe, expect, it } from 'vitest'
import { textoTrasCaer } from './muertes'

describe('textoTrasCaer (P119, QA-27)', () => {
  it('dice cuántas muertes lleva y qué viene', () => {
    expect(textoTrasCaer('Gorhorn', 3, 'MEDIO')).toBe('Gorhorn ha caído (muerte 3 de 4). Al aceptar, despierta donde descansó por última vez o, si nunca descansó, en su punto de partida. Si además nunca superó su primera prueba, todo habrá sido una pesadilla y empezará de nuevo.')
  })

  it('en Novato no hay cuenta de muertes', () => {
    expect(textoTrasCaer('Gorhorn', 7, 'NOVATO')).toBe('Gorhorn ha caído. Al aceptar, despierta donde descansó por última vez o, si nunca descansó, en su punto de partida. Si además nunca superó su primera prueba, todo habrá sido una pesadilla y empezará de nuevo.')
  })
})
