import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { RecursoDetalleModal } from './RecursoDetalleModal'
import type { EnciclopediaFaunaFloraInfo } from '../lib/api'

// Sin `globals: true` no hay desmontado automático entre tests (ver LogPanel.test.tsx).
afterEach(() => {
  cleanup()
})

/// Modal de detalle de RECURSO (2026-09-29) — solo los campos que pinta; el resto de la ficha de
/// Enciclopedia no importa aquí.
function ficha(overrides: Partial<EnciclopediaFaunaFloraInfo> = {}): EnciclopediaFaunaFloraInfo {
  return {
    sourceSlug: 'lucre-blanco',
    sourceName: 'Lucre Blanco',
    aliases: [],
    region: 'Llanuras de Ceniza',
    description: 'Un árbol de corteza pálida y madera densa.',
    yields: [{ itemName: 'Tronco de lucre', cantidad: 2, condicion: null }],
    imageUrls: { thumbnail: null, banner: null },
    discovered: true,
    ...overrides,
  } as EnciclopediaFaunaFloraInfo
}

describe('RecursoDetalleModal', () => {
  it('muestra el detalle de la ficha: nombre, región, descripción y recursos', () => {
    const { container, getByRole } = render(<RecursoDetalleModal nombre="Lucre Blanco" metodo="TALA" entry={ficha()} onAccion={() => {}} onCerrar={() => {}} />)
    expect(getByRole('dialog').getAttribute('aria-label')).toBe('Lucre Blanco')
    expect(container.textContent).toContain('Llanuras de Ceniza')
    expect(container.textContent).toContain('Un árbol de corteza pálida y madera densa.')
    expect(container.textContent).toContain('hasta 2 Tronco de lucre')
  })

  it.each([
    ['TALA', 'Talar'],
    ['MINERIA', 'Minar'],
    ['EXTRACCION', 'Recolectar'],
    ['PESCA', 'Pescar'],
    ['PASIVO', 'Recoger'],
  ] as const)('el botón de acción para %s se llama "%s"', (metodo, etiqueta) => {
    const { getByRole } = render(<RecursoDetalleModal nombre="X" metodo={metodo} entry={ficha()} onAccion={() => {}} onCerrar={() => {}} />)
    expect(getByRole('button', { name: etiqueta })).toBeTruthy()
  })

  it('sin metodo (oferta antigua) el botón es "Recolectar"', () => {
    const { getByRole } = render(<RecursoDetalleModal nombre="X" entry={ficha()} onAccion={() => {}} onCerrar={() => {}} />)
    expect(getByRole('button', { name: 'Recolectar' })).toBeTruthy()
  })

  it('pulsar la acción llama a onAccion (y no a onCerrar); "Cerrar" llama a onCerrar', () => {
    const onAccion = vi.fn()
    const onCerrar = vi.fn()
    const { getByRole } = render(<RecursoDetalleModal nombre="Lucre Blanco" metodo="TALA" entry={ficha()} onAccion={onAccion} onCerrar={onCerrar} />)
    fireEvent.click(getByRole('button', { name: 'Talar' }))
    expect(onAccion).toHaveBeenCalledTimes(1)
    expect(onCerrar).not.toHaveBeenCalled()
    fireEvent.click(getByRole('button', { name: 'Cerrar' }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })

  it('sin ficha o sin descubrir muestra el nombre y una línea de relleno, sin filtrar la descripción', () => {
    const sinFicha = render(<RecursoDetalleModal nombre="Lucre Blanco" metodo="TALA" entry={undefined} onAccion={() => {}} onCerrar={() => {}} />)
    expect(sinFicha.getByRole('dialog').getAttribute('aria-label')).toBe('Lucre Blanco')
    expect(sinFicha.container.textContent).toContain('Todavía no sabes mucho sobre esto.')
    expect(sinFicha.getByRole('button', { name: 'Talar' })).toBeTruthy()
    cleanup()

    const oculta = render(<RecursoDetalleModal nombre="Lucre Blanco" metodo="TALA" entry={ficha({ discovered: false })} onAccion={() => {}} onCerrar={() => {}} />)
    expect(oculta.container.textContent).toContain('Todavía no sabes mucho sobre esto.')
    expect(oculta.container.textContent).not.toContain('corteza pálida')
  })
})
