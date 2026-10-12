import { describe, it, expect } from 'vitest'
import { claseLabel } from './dice'

/// P54 (QA-27): «Chaman» salía sin tilde en la elección de clase.
describe('P54 — nombre visible de cada clase', () => {
  it('lleva tilde donde la tiene', () => {
    expect(claseLabel('CHAMAN')).toBe('Chamán')
    expect(claseLabel('GUERRERO')).toBe('Guerrero')
    expect(claseLabel('DRUIDA')).toBe('Druida')
  })
})
