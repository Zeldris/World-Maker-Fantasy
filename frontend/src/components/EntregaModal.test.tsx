import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'

vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/api')>()), getEntregables: vi.fn(), postEntregar: vi.fn() }))
import { getEntregables } from '../lib/api'
import { EntregaModal } from './EntregaModal'

/// P242: «No hay nadie aquí» salía con gente delante porque solo se entrega a compañeros y a quien pide materiales.
describe('EntregaModal', () => {
  afterEach(cleanup)

  it('P242: sin destinatarios explica a quién se puede entregar, no solo que no hay nadie', async () => {
    vi.mocked(getEntregables).mockResolvedValue({ items: [{ id: 'i1', name: 'Pan', description: '' }], npcs: [] })
    render(<EntregaModal saveId="s" onEntregado={() => {}} onCancel={() => {}} />)
    await waitFor(() => expect(screen.getByText(/compañeros de equipo/)).toBeTruthy())
    expect(screen.getByText(/te pide materiales/)).toBeTruthy()
  })
})
