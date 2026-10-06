import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { Presencia, useSaliendo, MS_SALIDA_CAPA } from './Presencia'
import { Capa } from './Capa'
import { CapasContext } from '../context/capasContext'
import type { EstadoCapas } from '../lib/capas'

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

  it('una capa que esperaba oculta detrás de otra sale oculta, y mientras sale es inerte', () => {
    document.documentElement.dataset.motion = 'completas'
    const estado = (visibles: string[]) => ({ visibles: new Set(visibles) }) as unknown as EstadoCapas
    const Arbol = ({ abierta, visibles }: { abierta: boolean; visibles: string[] }) => (
      <CapasContext.Provider value={estado(visibles)}>
        <Presencia>{abierta && <Capa id="curar"><p>curar</p></Capa>}</Presencia>
      </CapasContext.Provider>
    )
    const { rerender, container } = render(<Arbol abierta visibles={[]} />)
    rerender(<Arbol abierta={false} visibles={[]} />)
    const capa = container.querySelector('[data-capa="curar"]') as HTMLElement
    expect(capa.hidden).toBe(true)
    expect(capa.hasAttribute('inert')).toBe(true)
  })
})
