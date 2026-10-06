import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

vi.mock('../../../lib/api', () => ({
  crearPlantilla: vi.fn(),
  borrarPlantilla: vi.fn(),
  asignarPlantillaCompanion: vi.fn(),
  asignarPlantillaSubject: vi.fn(),
  fijarRolReinoCompanion: vi.fn(),
  depositarEnAlmacen: vi.fn(),
  retirarDeAlmacen: vi.fn(),
  getAlmacenLimites: vi.fn(),
  setAlmacenLimite: vi.fn(),
  getSubditos: vi.fn(),
  cambiarRolSubdito: vi.fn(),
  responderLlegada: vi.fn(),
}))

import { cambiarRolSubdito, fijarRolReinoCompanion, getAlmacenLimites, getSubditos, responderLlegada, type SubditoInfo } from '../../../lib/api'
import { SubditosSection } from './SubditosSection'
import { lineaDeSubdito, plazoDeLlegada } from '../../../lib/subditos'
import type { CompanionInfo } from '../../../types'

/// REI-113/REI-115 (hito 0.1) — el rol de cada compañero se elige con el selector del juego, y cada
/// opción explica qué hace ese rol hoy.
const ana = { id: 'c1', name: 'Ana', rolReino: null } as unknown as CompanionInfo

describe('SubditosSection — roles', () => {
  beforeEach(() => {
    vi.mocked(getAlmacenLimites).mockResolvedValue({ limites: [] })
    vi.mocked(fijarRolReinoCompanion).mockResolvedValue({} as never)
    vi.mocked(getSubditos).mockResolvedValue({ subditos: [], camas: { total: 0, companeros: 0, subditos: 0, libres: 0 } })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('cada rol explica qué hace y elegirlo llama a la API', async () => {
    const { getByRole, getByText } = render(
      <SubditosSection saveId="s1" subjects={[]} companions={[ana]} inventory={[]} almacenItems={[]} plantillasEquipo={[]} onRefreshSave={async () => {}} />,
    )
    await act(async () => {})
    fireEvent.click(getByRole('button', { name: 'Rol en el Reino de Ana' }))
    expect(getByText('Necesario para negociar, sabotear o espiar a otras facciones.')).toBeTruthy()
    expect(getByText(/Fuera del Reino/)).toBeTruthy()
    await act(async () => {
      fireEvent.click(getByRole('option', { name: /Diplomático/ }))
    })
    expect(fijarRolReinoCompanion).toHaveBeenCalledWith('s1', 'c1', 'diplomatico')
  })
})

/// REI-118 (hito 0.3): los súbditos como personas, con su rol editable y las camas compartidas.
const sub = (extra: Partial<SubditoInfo>): SubditoInfo => ({
  id: 'x', name: 'Brakka Ketg', role: 'trabajador', rol: 'trabajador', pueblo: 'orcos', genero: 'F', edad: 24, adulto: true,
  felicidad: 72, origen: 'LLEGADA', territoryId: 't', linaje: { nombre: 'Ketg', tipo: 'APELLIDO' }, ...extra,
})

describe('SubditosSection — súbditos (REI-118)', () => {
  beforeEach(() => {
    vi.mocked(getAlmacenLimites).mockResolvedValue({ limites: [] })
    vi.mocked(cambiarRolSubdito).mockResolvedValue({ ok: true })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('cada súbdito con su pueblo, edad y linaje', () => {
    expect(lineaDeSubdito(sub({}))).toBe('orca, 24 años · de los Ketg')
    expect(lineaDeSubdito(sub({ pueblo: 'faerus', genero: 'M', edad: 0, adulto: false, linaje: { nombre: 'Veyra', tipo: 'RASTRO' } }))).toBe('faerus, recién nacido · del rastro Veyra')
    expect(lineaDeSubdito(sub({ pueblo: null, edad: null, linaje: null }))).toBe('')
  })

  it('las camas compartidas, el rol de un adulto se cambia y una cría no tiene rol', async () => {
    vi.mocked(getSubditos).mockResolvedValue({
      subditos: [sub({ id: 'a' }), sub({ id: 'b', name: 'Doru Ketg', edad: 1, adulto: false })],
      camas: { total: 4, companeros: 1, subditos: 2, libres: 1 },
    })
    const { findByText, getByRole, getByText } = render(
      <SubditosSection saveId="s1" subjects={[]} companions={[]} inventory={[]} almacenItems={[]} plantillasEquipo={[]} onRefreshSave={async () => {}} />,
    )
    expect(await findByText('Camas: 3/4 (2 súbditos, 1 compañero)')).toBeTruthy()
    expect(getByText('cría')).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Rol de Brakka Ketg' }))
    await act(async () => {
      fireEvent.click(getByRole('option', { name: /Soldado/ }))
    })
    expect(cambiarRolSubdito).toHaveBeenCalledWith('s1', 'a', 'soldado')
  })
})

describe('SubditosSection — llegadas (REI-119)', () => {
  beforeEach(() => {
    vi.mocked(getAlmacenLimites).mockResolvedValue({ limites: [] })
    vi.mocked(responderLlegada).mockResolvedValue({ ok: true })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('el plazo de quien espera', () => {
    expect(plazoDeLlegada(3000, 120)).toBe('Esperará 2 días tu respuesta.')
    expect(plazoDeLlegada(600, 120)).toBe('Se irá en 8 horas si no le respondes.')
    expect(plazoDeLlegada(null, 0)).toBe('')
  })

  it('la tarjeta de quien llega: de dónde viene, y acogerlo llama a la API', async () => {
    vi.mocked(getSubditos).mockResolvedValue({
      ahora: 0, subditos: [], camas: { total: 2, companeros: 0, subditos: 0, libres: 2 },
      candidatos: [{ ...sub({ id: 'c', name: 'Grosh Koh', genero: 'M', linaje: { nombre: 'Koh', tipo: 'APELLIDO' } }), deDonde: 'Orcos del Clan Serhu', hastaMinutes: 2880 }],
    })
    const { findByText, getByRole, getByText } = render(
      <SubditosSection saveId="s1" subjects={[]} companions={[]} inventory={[]} almacenItems={[]} plantillasEquipo={[]} onRefreshSave={async () => {}} />,
    )
    expect(await findByText('Grosh Koh')).toBeTruthy()
    expect(getByText('orco, 24 años · de los Koh · de Orcos del Clan Serhu')).toBeTruthy()
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Acoger' }))
    })
    expect(responderLlegada).toHaveBeenCalledWith('s1', 'c', true)
  })
})
