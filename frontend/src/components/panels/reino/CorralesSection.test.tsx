import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

vi.mock('../../../lib/api', () => ({
  getCorrales: vi.fn(),
  postEntregarForraje: vi.fn(),
  postSacrificar: vi.fn(),
  postLlevarConsigo: vi.fn(),
  postDevolverAlCorral: vi.fn(),
}))

import { getCorrales, postDevolverAlCorral, postEntregarForraje, postLlevarConsigo, postSacrificar, type CorralesInfo } from '../../../lib/api'
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

describe('CorralesSection — guardias y Domadora (CR-56)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('marca el corral de guardia, deja llevarse un adulto y devolver al que va contigo', async () => {
    vi.mocked(getCorrales).mockResolvedValue({
      ...datos,
      fueraDelCorral: [{ id: 'c9', name: 'Aullador Rojo' }],
      corrales: [{ ...datos.corrales[0]!, especie: 'canizor', especieNombre: 'Canizor', guardia: true, produccionDia: [], animales: [{ id: 'g1', sexo: 'F', edadDias: 300, etapa: 'ADULTO', diasParaSiguiente: 600, puedeLlevar: true }] }],
    })
    vi.mocked(postLlevarConsigo).mockResolvedValue({ companionId: 'c1' })
    vi.mocked(postDevolverAlCorral).mockResolvedValue({ buildingId: 'b1', aviso: 'El Aullador Rojo entra en los Corrales del Ganadero.' })
    const { findByText, findByRole, getByRole } = render(<CorralesSection saveId="s1" inventory={[]} onRefreshSave={vi.fn().mockResolvedValue(undefined)} />)
    await findByText(/Guardia: defiende el Reino/)
    await act(async () => fireEvent.click(getByRole('button', { name: 'Llevar contigo' })))
    expect(postLlevarConsigo).toHaveBeenCalledWith('s1', 'g1')
    await act(async () => fireEvent.click(getByRole('button', { name: 'Devolver al corral' })))
    expect(postDevolverAlCorral).toHaveBeenCalledWith('s1', 'c9')
    // P352: lo que ha pasado se ve, no solo se guarda en el diario.
    expect((await findByRole('status')).textContent).toBe('El Aullador Rojo entra en los Corrales del Ganadero.')
  })
})

describe('CorralesSection — el atado de la Jaula (P346)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('enseña quién espera atado en cada Jaula y cuál está vacía', async () => {
    vi.mocked(getCorrales).mockResolvedValue({
      ...datos,
      jaulas: [
        { id: 'j1', name: 'Jaula grande', tamano: 'GRANDE', ocupante: { npcSlug: 'corretolvas', name: 'Corretolvas', tipo: 'FAUNA', felicidad: 15 } },
        { id: 'j2', name: 'Jaula pequeña', tamano: 'PEQUENA', ocupante: null },
      ],
    })
    const { findByText, getByText } = render(<CorralesSection saveId="s1" inventory={[]} onRefreshSave={vi.fn().mockResolvedValue(undefined)} />)
    await findByText('Jaula grande')
    expect(getByText('Corretolvas')).toBeTruthy()
    expect(getByText('Vacía')).toBeTruthy()
  })

  it('una Jaula dañada se marca como dañada y su atado sigue viéndose', async () => {
    vi.mocked(getCorrales).mockResolvedValue({
      ...datos,
      jaulas: [{ id: 'j3', name: 'Jaula mediana', tamano: 'MEDIANA', estado: 'DANADO', ocupante: { npcSlug: 'canizor', name: 'Cánizor atado', tipo: 'FAUNA', felicidad: 7 } }],
    })
    const { findByText, getByText } = render(<CorralesSection saveId="s1" inventory={[]} onRefreshSave={vi.fn().mockResolvedValue(undefined)} />)
    await findByText(/Jaula mediana/)
    expect(getByText(/dañada/)).toBeTruthy()
    expect(getByText('Cánizor atado')).toBeTruthy()
  })
})
