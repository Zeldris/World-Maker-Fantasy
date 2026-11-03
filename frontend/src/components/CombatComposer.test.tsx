import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CombatComposer } from './CombatComposer'

const base = { freeText: '', onFreeTextChange: () => {}, onSubmit: () => {}, busy: false, ended: false, rematar: ['Orco enfurecido'] }

describe('CombatComposer · aviso de remate (P365)', () => {
  it('sin energía para ningún ataque de Daño, dice que se recupere con Defenderse', () => {
    render(<CombatComposer {...base} sinEnergiaParaDanio />)
    expect(screen.getByText(/no te queda energía para ningún ataque/)).toBeTruthy()
    expect(screen.getByText(/Usa «Defenderse» para recuperarla/)).toBeTruthy()
  })

  it('con energía, pide elegir un ataque de Daño', () => {
    render(<CombatComposer {...base} />)
    expect(screen.getByText(/elige un ataque de «⚔️ Daño»/)).toBeTruthy()
    expect(screen.queryByText(/Defenderse/)).toBeNull()
  })
})
