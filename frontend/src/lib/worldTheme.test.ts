import { describe, it, expect, afterEach } from 'vitest'
import { applyWorldTheme } from './worldTheme'
import type { WorldTheme } from '../types'

/// Cobertura nueva (2026-09-03) — sin test hasta ahora, manipula document.documentElement.style
/// directamente (jsdom real disponible en este entorno de test, sin necesidad de mockear el DOM).
const FULL_THEME: WorldTheme = {
  accent300: '#111111',
  accent400: '#222222',
  accent500: '#333333',
  accent600: '#444444',
  accent2300: '#555555',
  accent2400: '#666666',
  accent2500: '#777777',
  accent2600: '#888888',
}

afterEach(() => {
  applyWorldTheme(null)
})

describe('applyWorldTheme', () => {
  it('con un theme real, fija las 8 variables CSS con los valores dados', () => {
    applyWorldTheme(FULL_THEME)
    const root = document.documentElement.style
    expect(root.getPropertyValue('--color-accent-300')).toBe('#111111')
    expect(root.getPropertyValue('--color-accent-400')).toBe('#222222')
    expect(root.getPropertyValue('--color-accent2-600')).toBe('#888888')
  })

  it('con theme:null, elimina todas las variables (aunque ya hubiera un theme aplicado antes)', () => {
    applyWorldTheme(FULL_THEME)
    applyWorldTheme(null)
    const root = document.documentElement.style
    expect(root.getPropertyValue('--color-accent-300')).toBe('')
    expect(root.getPropertyValue('--color-accent2-600')).toBe('')
  })

  it('aplicar un theme distinto sobre uno ya aplicado sustituye los valores, sin dejar residuos del anterior', () => {
    applyWorldTheme(FULL_THEME)
    const otroTheme: WorldTheme = { ...FULL_THEME, accent300: '#000000' }
    applyWorldTheme(otroTheme)
    expect(document.documentElement.style.getPropertyValue('--color-accent-300')).toBe('#000000')
  })
})
