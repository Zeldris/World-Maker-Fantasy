import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

vi.mock('../../../lib/api', () => ({
  crearPlantilla: vi.fn(),
  borrarPlantilla: vi.fn(),
  asignarPlantillaCompanion: vi.fn(),
  asignarPlantillaSubject: vi.fn(),
  fijarRolReinoCompanion: vi.fn(),
  depositarEnAlmacen: vi.fn(),
  retirarDeAlmacen: vi.fn(),
  getAlmacenLimites: vi.fn(),
  setAlmacenLimite: vi.fn(),
}))

import { fijarRolReinoCompanion, getAlmacenLimites } from '../../../lib/api'
import { SubditosSection } from './SubditosSection'
import type { CompanionInfo } from '../../../types'

/// REI-113/REI-115 (hito 0.1) — el rol de cada compañero se elige con el selector del juego, y cada
/// opción explica qué hace ese rol hoy.
const ana = { id: 'c1', name: 'Ana', rolReino: null } as unknown as CompanionInfo

describe('SubditosSection — roles', () => {
  beforeEach(() => {
    vi.mocked(getAlmacenLimites).mockResolvedValue({ limites: [] })
    vi.mocked(fijarRolReinoCompanion).mockResolvedValue({} as never)
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('cada rol explica qué hace y elegirlo llama a la API', async () => {
    const { getByRole, getByText } = render(
      <SubditosSection saveId="s1" subjects={[]} companions={[ana]} inventory={[]} almacenItems={[]} plantillasEquipo={[]} onRefreshSave={async () => {}} />,
    )
    await act(async () => {})
    fireEvent.click(getByRole('button', { name: 'Rol en el Reino de Ana' }))
    expect(getByText('Necesario para negociar, sabotear o espiar a otras facciones.')).toBeTruthy()
    expect(getByText(/Fuera del Reino/)).toBeTruthy()
    await act(async () => {
      fireEvent.click(getByRole('option', { name: /Diplomático/ }))
    })
    expect(fijarRolReinoCompanion).toHaveBeenCalledWith('s1', 'c1', 'diplomatico')
  })
})
