import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { HistoriasEnMarcha } from './HistoriasEnMarcha'
import * as api from '../../lib/api'

describe('HistoriasEnMarcha (CR-17)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('pinta cada historia con su tipo, marca las tensas y las cerradas', async () => {
    vi.spyOn(api, 'getHilos').mockResolvedValue({
      hilos: [
        { id: '1', patron: 'VENGANZA', abierto: true, tension: 8, resumen: 'Torgash quiere vengar a su hermano.', abiertoEn: 10, cerradoEn: null },
        { id: '2', patron: 'DEUDA', abierto: false, tension: 4, resumen: 'Dessa le debe algo a Gorhorn. La deuda queda saldada.', abiertoEn: 5, cerradoEn: 9 },
      ],
    })
    render(<HistoriasEnMarcha saveId="s" />)
    expect(await screen.findByText('Torgash quiere vengar a su hermano.')).toBeTruthy()
    expect(screen.getByText('· tensa')).toBeTruthy()
    expect(screen.getByText('· cerrada')).toBeTruthy()
  })
})
