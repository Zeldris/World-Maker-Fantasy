import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { GameFooter } from './GameFooter'

/// BAS-5 (hito 0.2) — pie sacado de GameView, mismo comportamiento por modo.
describe('BAS-5 — GameFooter', () => {
  afterEach(() => {
    cleanup()
  })

  const base = {
    characterName: 'Ilse', onResolverMuerte: vi.fn(), resolviendoMuerte: false, combatComposer: <p>composer de combate</p>,
    desollar: null, conHabilidades: true, skillHudView: { screen: 'composer' as const }, setSkillHudView: vi.fn(), skillBars: [], savedActions: [],
    onSelectBar: vi.fn(), onCreateBar: vi.fn(), onEditBar: vi.fn(), onDeleteBar: vi.fn(), onUseAbility: vi.fn(), onBackToComposer: vi.fn(),
    composerRef: null, onChange: vi.fn(), onSubmit: vi.fn(), composerDisabled: false, disabledReason: undefined,
  }

  it('fin: aviso de partida terminada', () => {
    const { getByText } = render(<GameFooter {...base} modo="fin" />)
    expect(getByText(/esta partida ha terminado/)).toBeTruthy()
  })

  it('muerte: «Aceptar» resuelve', () => {
    const { getByRole } = render(<GameFooter {...base} modo="muerte" />)
    fireEvent.click(getByRole('button', { name: 'Aceptar' }))
    expect(base.onResolverMuerte).toHaveBeenCalled()
  })

  it('combate: el composer de combate que le pasan', () => {
    const { getByText } = render(<GameFooter {...base} modo="combate" />)
    expect(getByText('composer de combate')).toBeTruthy()
  })

  it('normal: aviso de desollar y botón de habilidades, que abre el menú de barras', () => {
    const onDesollar = vi.fn()
    const { getByText, getByRole } = render(<GameFooter {...base} modo="normal" desollar={{ disabled: false, onClick: onDesollar }} />)
    fireEvent.click(getByText('Hay presas caídas sin desollar en esta zona.'))
    expect(onDesollar).toHaveBeenCalled()
    fireEvent.click(getByRole('button', { name: 'Habilidades' }))
    expect(base.setSkillHudView).toHaveBeenCalledWith({ screen: 'menu-barras' })
  })
})
