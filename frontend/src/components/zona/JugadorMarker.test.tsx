import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { JugadorMarker } from './MarcadoresZona'

describe('JugadorMarker (P115, QA-27)', () => {
  it('deja pasar los clics a lo que hay debajo (una salida bajo Gorhorn se puede abrir)', () => {
    const { getByTestId } = render(
      <svg>
        <JugadorMarker x={400} y={575} escala={1} angulo={null} quieto />
      </svg>,
    )
    expect(getByTestId('jugador-zona').getAttribute('pointer-events')).toBe('none')
  })
})
