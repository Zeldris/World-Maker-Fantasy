import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { EtiquetasSection } from './EtiquetasSection'
import * as api from '../../lib/api'

describe('EtiquetasSection (CR-14)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('pinta los títulos activos con su porqué y los perdidos tachados', async () => {
    vi.spyOn(api, 'getEtiquetas').mockResolvedValue({
      etiquetas: [
        { clave: 'CLEMENTE', texto: 'Clemente', activa: true, desdeMinutes: 10, porque: 'Gorhorn perdona la vida a Torgash.' },
        { clave: 'AMIGO_DE:clan-helsig', texto: 'Amigo de Clan Helsig', activa: false, desdeMinutes: 5, porque: null },
      ],
    })
    render(<EtiquetasSection saveId="s1" />)
    expect(await screen.findByText('Clemente')).toBeTruthy()
    expect(screen.getByText('Gorhorn perdona la vida a Torgash.')).toBeTruthy()
    expect(screen.getByText('Amigo de Clan Helsig').className).toContain('line-through')
  })

  it('sin títulos lo dice', async () => {
    vi.spyOn(api, 'getEtiquetas').mockResolvedValue({ etiquetas: [] })
    render(<EtiquetasSection saveId="s1" />)
    expect(await screen.findByText(/Todavía no te has ganado ningún título/)).toBeTruthy()
  })
})
