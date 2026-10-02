import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { MenuPausa } from './MenuPausa'

/// CFG-3 (hito 0.2) — menú de pausa.
describe('CFG-3 — MenuPausa', () => {
  afterEach(() => {
    cleanup()
  })

  const handlers = () => ({ onReanudar: vi.fn(), onConfiguracion: vi.fn(), onSalirPartidas: vi.fn(), onSalirInicio: vi.fn() })

  it('cada opción llama a lo suyo; Escape reanuda; el número elige (MOD-3)', () => {
    const h = handlers()
    const { getByRole } = render(<MenuPausa aviso={null} {...h} />)
    fireEvent.click(getByRole('button', { name: /Configuración/ }))
    expect(h.onConfiguracion).toHaveBeenCalled()
    fireEvent.keyDown(getByRole('dialog'), { key: '3' })
    expect(h.onSalirPartidas).toHaveBeenCalled()
    fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' })
    expect(h.onReanudar).toHaveBeenCalled()
  })

  it('con algo en curso, enseña el aviso de salida', () => {
    const { getByText } = render(<MenuPausa aviso="El narrador está escribiendo: lo que cuente se guardará igualmente." {...handlers()} />)
    expect(getByText(/El narrador está escribiendo/)).toBeTruthy()
  })
})
