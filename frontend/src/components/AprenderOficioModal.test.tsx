import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'

vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/api')>()), getAprenderOficioMaestros: vi.fn(), postAprenderOficio: vi.fn() }))
import { getAprenderOficioMaestros } from '../lib/api'
import { AprenderOficioModal } from './AprenderOficioModal'

const maestro = (npcSlug: string, extra: object) => ({ npcSlug, name: npcSlug, professionId: 'x', costeGoirnos: 10, yaAprendido: false, puedeAprender: false, motivoBloqueo: null, ...extra })

/// P181 (QA-27): once maestros con el botón apagado y nada que dijera que no se podía aprender nada.
describe('AprenderOficioModal', () => {
  afterEach(cleanup)

  it('sin nada que aprender lo dice de entrada, y lo ya conocido va sin botón', async () => {
    vi.mocked(getAprenderOficioMaestros).mockResolvedValue({
      maestros: [maestro('herrero', { yaAprendido: true }), maestro('cocinero', { motivoBloqueo: 'Todavía no confía lo bastante en ti.' })],
    })
    render(<AprenderOficioModal saveId="s" onAprendido={() => {}} onCancel={() => {}} />)
    await waitFor(() => expect(screen.getByText('Nadie aquí puede enseñarte nada todavía.')).toBeTruthy())
    expect(screen.getAllByRole('button', { name: 'Aprender' })).toHaveLength(1)
  })

  it('lo que se puede aprender va primero', async () => {
    vi.mocked(getAprenderOficioMaestros).mockResolvedValue({
      maestros: [maestro('herrero', { yaAprendido: true }), maestro('cocinero', { motivoBloqueo: 'No' }), maestro('curtidor', { puedeAprender: true })],
    })
    render(<AprenderOficioModal saveId="s" onAprendido={() => {}} onCancel={() => {}} />)
    await waitFor(() => expect(screen.getByText('curtidor')).toBeTruthy())
    const nombres = screen.getAllByText(/^(herrero|cocinero|curtidor)$/).map((n) => n.textContent)
    expect(nombres).toEqual(['curtidor', 'cocinero', 'herrero'])
    expect(screen.queryByText('Nadie aquí puede enseñarte nada todavía.')).toBeNull()
  })
})
