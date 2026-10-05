import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MisionesPanel } from './MisionesPanel'
import type { QuestInfo } from '../../types'

/// CR-40 (40g) — misiones secundarias del motor en el panel: quién encarga, progreso, plazo,
/// Entregar (solo las de entregar) y Abandonar con confirmación. Las del narrador no cambian.
describe('MisionesPanel — misiones del motor', () => {
  afterEach(() => cleanup())
  const base: QuestInfo = { id: 'q1', title: '6 × carne para Clan Serhu', description: 'x', status: 'ACTIVA', objetivo: null, rewardXp: 80, rewardItems: [], targetLocationSlug: null }
  const entregar: QuestInfo = { ...base, tipoMision: 'ENTREGAR', progreso: 2, cantidad: 6, venceEn: 11 * 1440, encarga: 'Clan Serhu', recompensa: { xp: 80, goirnos: 35, reputacion: 70 } }

  it('enseña quién encarga, el progreso, el día límite y la recompensa con Goirnos', () => {
    const { getByText } = render(<MisionesPanel quests={[entregar]} onEntregar={async () => {}} onAbandonar={async () => {}} />)
    expect(getByText('Clan Serhu')).toBeTruthy()
    expect(getByText('2/6')).toBeTruthy()
    expect(getByText('12')).toBeTruthy()
    expect(getByText(/\+80 XP, 35 Goirnos/)).toBeTruthy()
  })

  it('Entregar llama al backend; Abandonar pide confirmación antes', async () => {
    const onEntregar = vi.fn(async () => {})
    const onAbandonar = vi.fn(async () => {})
    const { getByRole, getByText } = render(<MisionesPanel quests={[entregar]} onEntregar={onEntregar} onAbandonar={onAbandonar} />)
    fireEvent.click(getByRole('button', { name: 'Entregar' }))
    await waitFor(() => expect(onEntregar).toHaveBeenCalledWith('q1'))
    fireEvent.click(getByRole('button', { name: 'Abandonar' }))
    expect(onAbandonar).not.toHaveBeenCalled()
    expect(getByText(/Perderás reputación/)).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Abandonar' }))
    await waitFor(() => expect(onAbandonar).toHaveBeenCalledWith('q1'))
  })

  it('una misión del narrador (sin tipo) no lleva botones; una de cazar no lleva Entregar', () => {
    const { queryByRole, rerender } = render(<MisionesPanel quests={[base]} onEntregar={async () => {}} onAbandonar={async () => {}} />)
    expect(queryByRole('button', { name: 'Abandonar' })).toBeNull()
    rerender(<MisionesPanel quests={[{ ...entregar, tipoMision: 'CAZAR' }]} onEntregar={async () => {}} onAbandonar={async () => {}} />)
    expect(queryByRole('button', { name: 'Entregar' })).toBeNull()
    expect(queryByRole('button', { name: 'Abandonar' })).toBeTruthy()
  })
})
