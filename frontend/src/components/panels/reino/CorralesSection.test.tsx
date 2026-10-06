import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

vi.mock('../../../lib/api', () => ({
  getCorrales: vi.fn(),
  postEntregarForraje: vi.fn(),
  postSacrificar: vi.fn(),
}))

import { getCorrales, postEntregarForraje, postSacrificar, type CorralesInfo } from '../../../lib/api'
import { CorralesSection } from './CorralesSection'
import { avisoDeCarencia, lineaDeAnimal, resumenDeCorral } from '../../../lib/corrales'
import type { InventoryItemInfo } from '../../../types'

/// CR-55 (Q10): Reino › Corrales.
const datos: CorralesInfo = {
  forraje: 12,
  huecoForraje: 30,
  forrajeDia: 10,
  diasSinComer: 0,
  diasSinBeber: 0,
  corrales: [
    {
      id: 'b1',
      name: 'Corrales del Ganadero',
      escalon: 1,
      plazas: 6,
      especie: 'murgol',
      especieNombre: 'Múrgol',
      animales: [
        { id: 'g1', sexo: 'M', edadDias: 200, etapa: 'ADULTO', diasParaSiguiente: 1240 },
        { id: 'g2', sexo: 'F', edadDias: 10, etapa: 'CRIA', diasParaSiguiente: 20 },
      ],
      ganaderos: [{ id: 'c1', name: 'Brenka' }],
      produccionDia: [{ slug: 'leche-murgol', nombre: 'Leche de Múrgol', porDia: 3 }],
    },
  ],
}

describe('CorralesSection (CR-55)', () => {
  beforeEach(() => {
    vi.mocked(getCorrales).mockResolvedValue(datos)
    vi.mocked(postSacrificar).mockResolvedValue({ comida: 3, almacen: {}, perdido: 0 })
    vi.mocked(postEntregarForraje).mockResolvedValue({ entregados: 2, forraje: 16 })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('muestra el corral con su especie, plazas, ganadero y producción; las crías no se sacrifican', async () => {
    const onRefreshSave = vi.fn().mockResolvedValue(undefined)
    const { findByText, getAllByRole, getByText } = render(<CorralesSection saveId="s1" inventory={[]} onRefreshSave={onRefreshSave} />)
    await findByText('2/6')
    expect(getByText(/— Taller/)).toBeTruthy()
    expect(getByText(/Ganaderos: Brenka/)).toBeTruthy()
    expect(getByText(/3 Leche de Múrgol/)).toBeTruthy()
    const sacrificar = getAllByRole('button', { name: 'Sacrificar' })
    expect(sacrificar).toHaveLength(1)
    await act(async () => fireEvent.click(sacrificar[0]!))
    expect(postSacrificar).toHaveBeenCalledWith('s1', 'g1')
    expect(onRefreshSave).toHaveBeenCalled()
  })

  it('con pastos en la mochila ofrece entregarlos como forraje', async () => {
    const pastos = [{ id: 'i1', catalogSlug: 'pasto-solar', slot: null }, { id: 'i2', catalogSlug: 'pasto-solar', slot: null }] as unknown as InventoryItemInfo[]
    const { findByRole } = render(<CorralesSection saveId="s1" inventory={pastos} onRefreshSave={vi.fn().mockResolvedValue(undefined)} />)
    const boton = await findByRole('button', { name: /Entregar 2 Pasto Solar \(\+4\)/ })
    await act(async () => fireEvent.click(boton))
    expect(postEntregarForraje).toHaveBeenCalledWith('s1', 'pasto-solar')
  })
})

describe('textos de los corrales', () => {
  it('línea de un animal y resumen del corral', () => {
    expect(lineaDeAnimal({ id: 'a', sexo: 'F', edadDias: 10, etapa: 'CRIA', diasParaSiguiente: 20 })).toBe('♀ cría · joven en 20 días')
    expect(lineaDeAnimal({ id: 'a', sexo: 'M', edadDias: 2000, etapa: 'VEJEZ', diasParaSiguiente: null })).toBe('♂ viejo')
    expect(resumenDeCorral(datos.corrales[0]!.animales)).toBe('1 ♂ · 0 ♀ · 1 cría')
  })
  it('aviso de hambre y sed', () => {
    expect(avisoDeCarencia(0, 0)).toBeNull()
    expect(avisoDeCarencia(3, 0)).toBe('El ganado lleva 3 días sin forraje: no produce ni cría, y ya mueren animales.')
  })
})
