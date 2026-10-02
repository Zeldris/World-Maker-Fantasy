import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { BotonMantener, MS_MANTENER } from './BotonMantener'

/// MOD-4 (hito 0.2) — mantener pulsado 1 s confirma; soltar antes, no.
describe('MOD-4 — BotonMantener', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('mantenido el tiempo entero confirma; soltado antes no', () => {
    const onConfirmar = vi.fn()
    const { getByRole } = render(<BotonMantener onConfirmar={onConfirmar}>Mantén para elegir</BotonMantener>)
    const boton = getByRole('button', { name: 'Mantén para elegir' })
    fireEvent.pointerDown(boton)
    act(() => {
      vi.advanceTimersByTime(MS_MANTENER - 100)
    })
    fireEvent.pointerUp(boton)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onConfirmar).not.toHaveBeenCalled()
    fireEvent.pointerDown(boton)
    act(() => {
      vi.advanceTimersByTime(MS_MANTENER)
    })
    expect(onConfirmar).toHaveBeenCalledTimes(1)
  })

  it('con teclado: Espacio mantenido confirma; un clic suelto no', () => {
    const onConfirmar = vi.fn()
    const { getByRole } = render(<BotonMantener onConfirmar={onConfirmar}>Mantén</BotonMantener>)
    const boton = getByRole('button')
    fireEvent.click(boton)
    expect(onConfirmar).not.toHaveBeenCalled()
    fireEvent.keyDown(boton, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(MS_MANTENER)
    })
    expect(onConfirmar).toHaveBeenCalledTimes(1)
  })
})
