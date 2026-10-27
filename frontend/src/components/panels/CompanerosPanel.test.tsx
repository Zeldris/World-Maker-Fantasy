import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

vi.mock('../../lib/api', () => ({
  getTameoPendientes: vi.fn(),
  asignarPlantillaCompanion: vi.fn(),
  preguntarTierraCompanero: vi.fn(),
  postIntentarTameo: vi.fn(),
  postConfirmarTameo: vi.fn(),
  postSoltarTameo: vi.fn(),
  postAlCorral: vi.fn(),
}))

import { getTameoPendientes, postAlCorral } from '../../lib/api'
import { CompanerosPanel } from './CompanerosPanel'

/// P349: al llevar un animal al corral la pantalla dice qué ha pasado (antes el animal desaparecía de la lista sin más).
describe('CompanerosPanel — al corral (P349)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('enseña el aviso del backend tras pulsar «Al corral»', async () => {
    const pendiente = { npcSlug: 'murgol', name: 'Múrgol', tipo: 'FAUNA' as const, felicidad: 80, umbral: 80, atributoResistencia: null, enJaula: true, alCorral: true, hayCorral: true }
    let llevado = false
    vi.mocked(getTameoPendientes).mockImplementation(async () => ({ pendientes: llevado ? [] : [pendiente] }))
    vi.mocked(postAlCorral).mockImplementation(async () => {
      llevado = true
      return { ganadoId: 'g1', buildingId: 'b1', sexo: 'F', aviso: 'El Múrgol entra en los Corrales del Ganadero.' }
    })
    const { findByText, getByRole, queryByText } = render(
      <CompanerosPanel saveId="s1" companions={[]} inventory={[]} plantillasEquipo={[]} onRefreshSave={vi.fn().mockResolvedValue(undefined)} />,
    )
    fireEvent.click(await findByText(/Múrgol/))
    expect(queryByText('El Múrgol entra en los Corrales del Ganadero.')).toBeNull()
    await act(async () => fireEvent.click(getByRole('button', { name: /Al corral/ })))
    expect(await findByText('El Múrgol entra en los Corrales del Ganadero.')).toBeTruthy()
  })
})
