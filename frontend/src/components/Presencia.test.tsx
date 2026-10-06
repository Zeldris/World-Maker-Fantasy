import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { Presencia, useSaliendo, MS_SALIDA_CAPA } from './Presencia'

function Contenido({ texto }: { texto: string }) {
  const saliendo = useSaliendo()
  return <p data-testid="c">{texto}{saliendo ? ' (saliendo)' : ''}</p>
}

const Caso = ({ abierto, texto = 'hola' }: { abierto: boolean; texto?: string }) => <Presencia>{abierto && <Contenido texto={texto} />}</Presencia>

describe('Presencia (BAS-7)', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    delete document.documentElement.dataset.motion
  })

  it('con animaciones completas, al cerrarse sigue pintando lo último mientras sale y luego lo desmonta', () => {
    vi.useFakeTimers()
    document.documentElement.dataset.motion = 'completas'
    const { rerender, queryByTestId } = render(<Caso abierto texto="último" />)
    rerender(<Caso abierto={false} />)
    expect(queryByTestId('c')?.textContent).toBe('último (saliendo)')
    act(() => {
      vi.advanceTimersByTime(MS_SALIDA_CAPA + 10)
    })
    expect(queryByTestId('c')).toBeNull()
  })

  it('si se reabre mientras sale, vuelve en el acto sin marca de salida', () => {
    document.documentElement.dataset.motion = 'completas'
    const { rerender, queryByTestId } = render(<Caso abierto />)
    rerender(<Caso abierto={false} />)
    rerender(<Caso abierto texto="otra vez" />)
    expect(queryByTestId('c')?.textContent).toBe('otra vez')
  })

  it('sin animaciones completas cierra en seco', () => {
    document.documentElement.dataset.motion = 'reducidas'
    const { rerender, queryByTestId } = render(<Caso abierto />)
    rerender(<Caso abierto={false} />)
    expect(queryByTestId('c')).toBeNull()
  })
})
