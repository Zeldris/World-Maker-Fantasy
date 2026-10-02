import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminUI } from './AdminUI'

/// BAS-9 (hito 0.2) — el catálogo visual monta todos los componentes sin romperse.
describe('BAS-9 — AdminUI', () => {
  afterEach(() => {
    cleanup()
  })

  it('pinta las secciones y abre un modal de cada tamaño', () => {
    const { getByText, getByRole, queryByRole } = render(
      <MemoryRouter>
        <AdminUI />
      </MemoryRouter>,
    )
    expect(getByText('Catálogo de interfaz (admin)')).toBeTruthy()
    expect(getByRole('progressbar', { name: 'Ejemplo' })).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'ceremonia' }))
    expect(getByRole('dialog', { name: 'Modal ceremonia' })).toBeTruthy()
    fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' })
    expect(queryByRole('dialog')).toBeNull()
  })
})
