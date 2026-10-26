import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiBaseUrl } from './api'

function conTauri(valor: unknown) {
  vi.stubGlobal('window', { __TARKOR__: { apiUrl: valor } })
}

describe('apiBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('usa window.__TARKOR__.apiUrl primero', () => {
    vi.stubEnv('VITE_API_URL', 'http://staging:9')
    conTauri('http://127.0.0.1:54321')
    expect(apiBaseUrl()).toBe('http://127.0.0.1:54321')
  })

  it('sin Tauri usa VITE_API_URL', () => {
    vi.stubGlobal('window', {})
    vi.stubEnv('VITE_API_URL', 'http://staging:9')
    expect(apiBaseUrl()).toBe('http://staging:9')
  })

  it('sin nada cae a localhost:3001', () => {
    vi.stubGlobal('window', {})
    vi.stubEnv('VITE_API_URL', undefined as unknown as string)
    expect(apiBaseUrl()).toBe('http://localhost:3001')
  })

  it.each<[unknown, string]>([['', 'cadena vacía'], [42, 'número'], [null, 'null'], [undefined, 'undefined']])(
    'apiUrl %j (%s) cae al siguiente',
    (valor) => {
      vi.stubEnv('VITE_API_URL', 'http://staging:9')
      conTauri(valor)
      expect(apiBaseUrl()).toBe('http://staging:9')
    },
  )

  it('quita la barra final', () => {
    conTauri('http://127.0.0.1:54321/')
    expect(apiBaseUrl()).toBe('http://127.0.0.1:54321')
    vi.stubGlobal('window', {})
    vi.stubEnv('VITE_API_URL', 'http://staging:9//')
    expect(apiBaseUrl()).toBe('http://staging:9')
  })
})
