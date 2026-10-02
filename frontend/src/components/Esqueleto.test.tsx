import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Esqueleto } from './Esqueleto'

/// REI-114 (hito 0.1) — esqueleto de carga anunciado a lectores de pantalla.
describe('Esqueleto', () => {
  afterEach(() => cleanup())

  it('pinta las filas pedidas y anuncia qué se está cargando', () => {
    const { getByRole, container } = render(<Esqueleto filas={4} que="el mercado" />)
    expect(getByRole('status').textContent).toBe('Cargando el mercado…')
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4)
    expect(container.innerHTML).toContain('motion-safe:animate-pulse')
  })
})
