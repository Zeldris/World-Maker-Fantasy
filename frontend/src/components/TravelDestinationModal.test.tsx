import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'

vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/api')>()), getDestinosViaje: vi.fn() }))
import { getDestinosViaje } from '../lib/api'
import { TravelDestinationModal } from './TravelDestinationModal'

const destino = { locationSlug: 'el-pozo', locationName: 'El Pozo', region: 'Llanuras', minutos: 90, banda: 'corta' as const }

/// P164 (QA-27, usuaria 2026-10-17): ir directo a otra zona desde la lista de «Viajar» es cosa de una montura.
describe('TravelDestinationModal', () => {
  afterEach(cleanup)

  it('sin montura, los destinos se ven pero no se puede ir y dice por qué', async () => {
    vi.mocked(getDestinosViaje).mockResolvedValue({ hasMap: false, montura: false, motivoSinMontura: 'Necesitas una montura para ir directo', destinations: [destino] })
    render(<TravelDestinationModal saveId="s" onSelect={() => {}} onCancel={() => {}} />)
    await waitFor(() => expect(screen.getByText('El Pozo')).toBeTruthy())
    expect(screen.getByText(/Necesitas una montura para ir directo/)).toBeTruthy()
    expect((screen.getByText('El Pozo').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('con montura, se puede ir', async () => {
    vi.mocked(getDestinosViaje).mockResolvedValue({ hasMap: false, montura: true, destinations: [destino] })
    render(<TravelDestinationModal saveId="s" onSelect={() => {}} onCancel={() => {}} />)
    await waitFor(() => expect(screen.getByText('El Pozo')).toBeTruthy())
    expect((screen.getByText('El Pozo').closest('button') as HTMLButtonElement).disabled).toBe(false)
  })
})
