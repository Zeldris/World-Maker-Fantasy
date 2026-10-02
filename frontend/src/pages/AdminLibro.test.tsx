import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const getLibroDeSucesos = vi.fn()
vi.mock('../lib/api', () => ({ getLibroDeSucesos: (...args: unknown[]) => getLibroDeSucesos(...args) }))

import { AdminLibro } from './AdminLibro'

const suceso = (id: string, texto: string, extra: Record<string, unknown> = {}) => ({
  id, tipo: 'REGALO', familia: 'JUGADOR', fictionalMinutes: 500, fecha: 'Día 1', regionSlug: null, importancia: 4,
  origen: 'JUGADOR', texto, textoNarrado: null, actores: [], causaIds: [], efectoIds: [], ...extra,
})

/// CR-4 (hito 0.2) — vista de administración del Libro de Sucesos, solo lectura.
describe('CR-4 — AdminLibro', () => {
  afterEach(() => {
    cleanup()
    getLibroDeSucesos.mockReset()
  })

  const montar = () =>
    render(
      <MemoryRouter initialEntries={['/admin/partida/s1/libro']}>
        <Routes>
          <Route path="/admin/partida/:id/libro" element={<AdminLibro />} />
        </Routes>
      </MemoryRouter>,
    )

  it('lista los sucesos, resuelve causas por texto y filtra por familia', async () => {
    getLibroDeSucesos.mockResolvedValue({
      personaje: 'Ilse', total: 2, hayMas: false,
      sucesos: [suceso('b', 'Ilse regala una daga.', { causaIds: ['a'] }), suceso('a', 'Ilse llega a Vharn.')],
    })
    const { findByText, getByText, getByRole } = montar()
    expect(await findByText('Ilse regala una daga.')).toBeTruthy()
    expect(getByText('Por: Ilse llega a Vharn.')).toBeTruthy()
    expect(getLibroDeSucesos).toHaveBeenCalledWith('s1', { familia: null, importanciaMin: 1, antesDe: undefined })

    fireEvent.click(getByRole('button', { name: 'Clima' }))
    await waitFor(() => expect(getLibroDeSucesos).toHaveBeenLastCalledWith('s1', { familia: 'CLIMA', importanciaMin: 1, antesDe: undefined }))
  })

  it('«Cargar más» pide los anteriores al último y los añade', async () => {
    getLibroDeSucesos
      .mockResolvedValueOnce({ personaje: 'Ilse', total: 2, hayMas: true, sucesos: [suceso('b', 'Segundo.')] })
      .mockResolvedValueOnce({ personaje: 'Ilse', total: 2, hayMas: false, sucesos: [suceso('a', 'Primero.')] })
    const { findByText, getByRole, queryByRole } = montar()
    await findByText('Segundo.')
    fireEvent.click(getByRole('button', { name: 'Cargar más' }))
    expect(await findByText('Primero.')).toBeTruthy()
    expect(getLibroDeSucesos).toHaveBeenLastCalledWith('s1', { familia: null, importanciaMin: 1, antesDe: 'b' })
    expect(queryByRole('button', { name: 'Cargar más' })).toBeNull()
  })
})
