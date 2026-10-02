import { describe, it, expect } from 'vitest'
import { resolverCapas } from './capas'

/// UX-9 (hito 0.2) — gana la capa más importante, no la que va más abajo en el JSX.
describe('UX-9 — resolverCapas', () => {
  it('sin capas abiertas no hay nada visible', () => {
    expect(resolverCapas([])).toEqual({ visibles: new Set(), enEspera: [], superior: null })
  })

  it('una decisión (clase) tapa al modo dinámico y al cajón, que esperan', () => {
    const r = resolverCapas([
      { id: 'panel', nivel: 'consulta' },
      { id: 'dinamico', nivel: 'escena' },
      { id: 'clase', nivel: 'decision' },
    ])
    expect([...r.visibles]).toEqual(['clase'])
    expect(r.superior).toBe('clase')
    expect(r.enEspera).toEqual(['dinamico', 'panel'])
  })

  it('dentro de un nivel gana la primera registrada; el orden del JSX no importa', () => {
    const r = resolverCapas([
      { id: 'clase', nivel: 'decision' },
      { id: 'reino', nivel: 'decision' },
    ])
    expect([...r.visibles]).toEqual(['clase'])
    expect(r.enEspera).toEqual(['reino'])
  })

  it('confirmar salida (sistema) va por encima de todo', () => {
    expect(resolverCapas([{ id: 'reino', nivel: 'decision' }, { id: 'salir', nivel: 'sistema' }]).superior).toBe('salir')
  })

  it('una capa hija (ficha) se ve siempre y no hace esperar a nadie', () => {
    const r = resolverCapas([
      { id: 'curar', nivel: 'accion' },
      { id: 'ficha', nivel: 'consulta', hija: true },
    ])
    expect(r.visibles).toEqual(new Set(['ficha', 'curar']))
    expect(r.superior).toBe('curar')
    expect(r.enEspera).toEqual([])
  })
})
