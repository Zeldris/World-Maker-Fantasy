import { describe, it, expect } from 'vitest'
import { debeAvisar } from './noticias'
import { normalizarAjustes } from './ajustes'

/// CFG-35 (Fase E, Q7) — qué noticias del mundo salen como aviso emergente.
describe('debeAvisar', () => {
  it('por defecto, los importantes: destacado y grave; lo normal o sin nivel, no', () => {
    expect(normalizarAjustes({}).avisosSucesos).toBe('importantes')
    expect(debeAvisar({ nivel: 'DESTACADO' }, 'importantes')).toBe(true)
    expect(debeAvisar({ nivel: 'GRAVE' }, 'importantes')).toBe(true)
    expect(debeAvisar({ nivel: 'NORMAL' }, 'importantes')).toBe(false)
    expect(debeAvisar({ categoria: 'GENTE' }, 'importantes')).toBe(false)
    expect(debeAvisar(undefined, 'importantes')).toBe(false)
  })

  it('solo graves, todos y ninguno', () => {
    expect(debeAvisar({ nivel: 'DESTACADO' }, 'graves')).toBe(false)
    expect(debeAvisar({ nivel: 'GRAVE' }, 'graves')).toBe(true)
    expect(debeAvisar(undefined, 'todos')).toBe(true)
    expect(debeAvisar({ nivel: 'GRAVE' }, 'ninguno')).toBe(false)
  })

  it('una propuesta al Reino avisa siempre salvo con «ninguno»; un resumen, si alguna línea avisaría', () => {
    const propuesta = { propuesta: { id: 'p', faccion: 'Clan Goshg', tipo: 'TRATADO' as const, venceEn: 0 } }
    expect(debeAvisar(propuesta, 'graves')).toBe(true)
    expect(debeAvisar(propuesta, 'ninguno')).toBe(false)
    expect(debeAvisar({ resumen: true, lineas: [null, { nivel: 'GRAVE' }] }, 'graves')).toBe(true)
    expect(debeAvisar({ resumen: true, lineas: [null, { nivel: 'NORMAL' }] }, 'importantes')).toBe(false)
  })
})
