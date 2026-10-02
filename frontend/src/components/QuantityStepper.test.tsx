import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { useState } from 'react'
import { QuantityStepper } from './QuantityStepper'

function Probador({ max = 5, tope }: { max?: number; tope?: number }) {
  const [n, setN] = useState(0)
  return <QuantityStepper value={n} max={max} tope={tope} onChange={setN} etiqueta="Raciones" motivoTope="Ya estarías saciado" />
}

/// MOD-5 (hito 0.2) — selector de cantidad compartido.
describe('MOD-5 — QuantityStepper', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('−/+ por clics, Máx. hasta el tope y el número se puede escribir', () => {
    const { getByRole, getByLabelText } = render(<Probador max={5} tope={3} />)
    const campo = getByLabelText('Raciones') as HTMLInputElement
    fireEvent.click(getByRole('button', { name: 'Más: Raciones' }))
    expect(campo.value).toBe('1')
    fireEvent.click(getByRole('button', { name: 'Máx.' }))
    expect(campo.value).toBe('3')
    const mas = getByRole('button', { name: 'Más: Raciones' }) as HTMLButtonElement
    expect(mas.disabled).toBe(true)
    expect(mas.title).toBe('Ya estarías saciado')
    fireEvent.change(campo, { target: { value: '9' } })
    fireEvent.blur(campo)
    expect(campo.value).toBe('3')
    fireEvent.change(campo, { target: { value: '2' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(campo.value).toBe('2')
  })

  it('mantener pulsado «+» repite y al soltar no suma uno de más', () => {
    vi.useFakeTimers()
    const { getByRole, getByLabelText } = render(<Probador max={10} />)
    const mas = getByRole('button', { name: 'Más: Raciones' })
    fireEvent.pointerDown(mas)
    act(() => {
      vi.advanceTimersByTime(400)
    })
    for (let i = 0; i < 3; i++) {
      act(() => {
        vi.advanceTimersByTime(110)
      })
    }
    fireEvent.pointerUp(mas)
    fireEvent.click(mas)
    expect((getByLabelText('Raciones') as HTMLInputElement).value).toBe('3')
  })
})
