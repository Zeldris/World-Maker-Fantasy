import { afterEach, describe, expect, it } from 'vitest'
import { esEmpaquetado } from './empaquetado'

/// INS-33 — «empaquetado» es que `window.__TARKOR__` sea un objeto.
describe('esEmpaquetado', () => {
  afterEach(() => {
    delete window.__TARKOR__
  })

  it('con el objeto inyectado por Tauri', () => {
    window.__TARKOR__ = { apiUrl: 'http://127.0.0.1:1' }
    expect(esEmpaquetado()).toBe(true)
    window.__TARKOR__ = {}
    expect(esEmpaquetado()).toBe(true)
  })

  it('ausente: desarrollo y web', () => {
    expect(esEmpaquetado()).toBe(false)
  })

  it('un valor que no es un objeto no cuenta', () => {
    for (const valor of [null, 'x', 1, true]) {
      ;(window as unknown as { __TARKOR__: unknown }).__TARKOR__ = valor
      expect(esEmpaquetado()).toBe(false)
    }
  })
})
