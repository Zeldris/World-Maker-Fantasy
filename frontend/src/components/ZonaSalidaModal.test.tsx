import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ZonaSalidaModal } from './ZonaSalidaModal'
import { etiquetaSalida } from '../lib/rumboSalida'
import type { ZonaSalidaInfo } from '../lib/api'

const salida = {
  locationId: 'loc2', slug: 'pilares-rotos', nombre: 'Paso de los Pilares Rotos', x: 650, y: 560,
  visitada: false, teaser: 'Tres columnas erosionadas', description: null, imageUrl: null, alcanzable: true, minutos: 90, conocida: true,
} as ZonaSalidaInfo

describe('Salida de zona (P115, QA-27)', () => {
  it('con el mapa de la región, dice adónde lleva y cuánto se tarda', () => {
    render(<ZonaSalidaModal salida={salida} onViajar={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Lleva a Paso de los Pilares Rotos · unas 1.5 h de camino')).toBeTruthy()
  })

  it('sin conocer el destino, el camino solo dice su rumbo, pero sí cuánto se tarda', () => {
    const desconocida = { ...salida, conocida: false }
    expect(etiquetaSalida(desconocida)).toBe('Camino hacia el sureste')
    render(<ZonaSalidaModal salida={desconocida} onViajar={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('unas 1.5 h de camino')).toBeTruthy()
  })

  it('con el destino conocido, la etiqueta del mapa es su nombre', () => {
    expect(etiquetaSalida(salida)).toBe('Paso de los Pilares Rotos')
  })
})
