import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { CampamentosBandidos } from './CampamentosBandidos'

/// CR-50 (50d): campamentos de bandidos que conoces y la partida para ir a por ellos.
describe('CampamentosBandidos (CR-50 50d)', () => {
  afterEach(cleanup)

  it('sin campamentos conocidos, cómo se descubren', () => {
    const { getByText } = render(<CampamentosBandidos campamentos={[]} grupos={[]} guerreros={[]} desactivado={false} onAtacar={async () => {}} />)
    expect(getByText(/se descubren estando allí/)).toBeTruthy()
  })

  it('elige quién va y ataca un campamento', async () => {
    const onAtacar = vi.fn().mockResolvedValue(undefined)
    const { getByRole, getByLabelText, getByText } = render(
      <CampamentosBandidos
        campamentos={[{ id: 'c1', lugar: 'Las Agujas Imán', slug: 'agujas', region: 'Llanuras', grupo: 'Renegados goirntes', cabecilla: 'Cabecilla', gente: 6 }]}
        grupos={[{ slotIndex: 1, nombre: 'Grupo 2', companeros: [{ id: 'k1', name: 'Ana' }] }]}
        guerreros={[{ id: 's1', name: 'Brog', rol: 'soldado' }]}
        desactivado={false}
        onAtacar={onAtacar}
      />,
    )
    expect(getByText(/Renegados goirntes/).parentElement?.textContent).toContain('unos 6 y su cabecilla')
    const boton = getByRole('button', { name: 'Atacar (0)' }) as HTMLButtonElement
    expect(boton.disabled).toBe(true)
    fireEvent.click(getByLabelText('Ana contra el campamento'))
    fireEvent.click(getByLabelText('Brog contra el campamento'))
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Atacar (2)' }))
    })
    expect(onAtacar).toHaveBeenCalledWith('c1', { companionIds: ['k1'], subjectIds: ['s1'] })
  })
})
