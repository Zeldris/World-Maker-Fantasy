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
  cambiarTareaSubdito: vi.fn(),
  responderLlegada: vi.fn(),
}))

import { cambiarRolSubdito, cambiarTareaSubdito, fijarRolReinoCompanion, getAlmacenLimites, getSubditos, responderLlegada, type SubditoInfo } from '../../../lib/api'
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

  it('P220a: las camas temporales del Ayuntamiento se enseñan aparte, solo para súbditos', async () => {
    vi.mocked(getSubditos).mockResolvedValue({
      subditos: [], camas: { total: 0, companeros: 0, subditos: 0, libres: 0, temporales: 2, enAyuntamiento: 0, libresSubditos: 2 },
    })
    const { findByText } = render(
      <SubditosSection saveId="s1" subjects={[]} companions={[]} inventory={[]} almacenItems={[]} plantillasEquipo={[]} onRefreshSave={async () => {}} />,
    )
    expect(await findByText('Camas: 0/2 (0 súbditos, 0 compañeros, 2 temporales del Ayuntamiento solo para súbditos)')).toBeTruthy()
  })

  it('las camas compartidas, el rol de un adulto se cambia y una cría no tiene rol', async () => {
    vi.mocked(getSubditos).mockResolvedValue({
      subditos: [sub({ id: 'a', pareja: 'Grosh Ketg', crias: 1 }), sub({ id: 'b', name: 'Doru Ketg', edad: 1, adulto: false })],
      camas: { total: 4, companeros: 1, subditos: 2, libres: 1 },
      salidas: [{ id: 'm', name: 'Urga Koh', estado: 'MUERTO', motivo: 'Murió de viejo.', cuando: 0 }],
    })
    const { findByText, getByRole, getByText } = render(
      <SubditosSection saveId="s1" subjects={[]} companions={[]} inventory={[]} almacenItems={[]} plantillasEquipo={[]} onRefreshSave={async () => {}} />,
    )
    expect(await findByText('Camas: 3/4 (2 súbditos, 1 compañero)')).toBeTruthy()
    expect(getByText('cría')).toBeTruthy()
    expect(getByText('Pareja de Grosh Ketg · 1 cría')).toBeTruthy()
    expect(getByText('Urga Koh')).toBeTruthy()
    expect(getByText(/Murió de viejo\./)).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Rol de Brakka Ketg' }))
    await act(async () => {
      fireEvent.click(getByRole('option', { name: /Soldado/ }))
    })
    expect(cambiarRolSubdito).toHaveBeenCalledWith('s1', 'a', 'soldado')
  })

  it('un trabajador adulto elige su tarea (CR-61); una cría no tiene tarea', async () => {
    vi.mocked(cambiarTareaSubdito).mockResolvedValue({ ok: true })
    vi.mocked(getSubditos).mockResolvedValue({
      subditos: [sub({ id: 'a', tarea: 'recolector' }), sub({ id: 'b', name: 'Doru Ketg', edad: 1, adulto: false }), sub({ id: 'c', name: 'Grosh Ketg', role: 'soldado', rol: 'soldado' })],
      camas: { total: 4, companeros: 0, subditos: 3, libres: 1 },
    })
    const { findByRole, queryByRole, getByRole } = render(
      <SubditosSection saveId="s1" subjects={[]} companions={[]} inventory={[]} almacenItems={[]} plantillasEquipo={[]} onRefreshSave={async () => {}} />,
    )
    fireEvent.click(await findByRole('button', { name: 'Tarea de Brakka Ketg' }))
    expect(queryByRole('button', { name: 'Tarea de Doru Ketg' })).toBeNull()
    expect(queryByRole('button', { name: 'Tarea de Grosh Ketg' })).toBeNull()
    await act(async () => {
      fireEvent.click(getByRole('option', { name: /Cocinero/ }))
    })
    expect(cambiarTareaSubdito).toHaveBeenCalledWith('s1', 'a', 'cocinero')
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

  // P220b: el checklist de requisitos de llegada se ve siempre, con el estado y la cifra de cada uno.
  it('enseña todos los requisitos de llegada con su estado y cifra', async () => {
    vi.mocked(getSubditos).mockResolvedValue({
      ahora: 0, subditos: [], camas: { total: 0, companeros: 0, subditos: 0, libres: 0 },
      requisitosLlegada: [
        { clave: 'cama', nombre: 'Cama libre', cumple: true, cifra: '0/2', motivo: 'No hay cama libre.' },
        { clave: 'comida', nombre: 'Comida', cumple: false, cifra: '0', motivo: 'No hay comida.' },
        { clave: 'agua', nombre: 'Agua', cumple: true, cifra: '12', motivo: 'No hay agua.' },
        { clave: 'felicidad', nombre: 'Felicidad', cumple: true, cifra: '55, mínimo 40', motivo: 'Poca fama.' },
      ],
    })
    const { findByLabelText } = render(
      <SubditosSection saveId="s1" subjects={[]} companions={[]} inventory={[]} almacenItems={[]} plantillasEquipo={[]} onRefreshSave={async () => {}} />,
    )
    const lista = await findByLabelText('Requisitos para que llegue alguien')
    expect(lista.textContent).toBe('Para que llegue alguien: Cama libre ✓ (0/2) · Comida ✗ (0) · Agua ✓ (12) · Felicidad ✓ (55, mínimo 40)')
  })
})

describe('SubditosSection — P230 fallo de carga', () => {
  beforeEach(() => {
    vi.mocked(getAlmacenLimites).mockResolvedValue({ limites: [] })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('si falla la carga avisa con Reintentar y al reintentar muestra los súbditos', async () => {
    vi.mocked(getSubditos)
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValue({ subditos: [], camas: { total: 3, companeros: 0, subditos: 0, libres: 3 } })
    const { findByRole, findByText } = render(
      <SubditosSection saveId="s1" subjects={[]} companions={[]} inventory={[]} almacenItems={[]} plantillasEquipo={[]} onRefreshSave={async () => {}} />,
    )
    const aviso = await findByRole('alert')
    expect(aviso.textContent).toContain('No se pudieron cargar los súbditos.')
    await act(async () => {
      fireEvent.click(await findByRole('button', { name: /Reintentar/ }))
    })
    expect(getSubditos).toHaveBeenCalledTimes(2)
    expect(await findByText(/Camas: 0\/3/)).toBeTruthy()
  })

  it('P236 — con la carga fallida no sale «Aún no vive nadie»; con la carga ok y vacía, sí', async () => {
    vi.mocked(getSubditos).mockRejectedValueOnce(new Error('500'))
    const props = { saveId: 's1', subjects: [], companions: [], inventory: [], almacenItems: [], plantillasEquipo: [], onRefreshSave: async () => {} }
    const fallida = render(<SubditosSection {...props} />)
    await fallida.findByRole('alert')
    expect(fallida.queryByText(/Aún no vive nadie/)).toBeNull()
    cleanup()
    vi.mocked(getSubditos).mockResolvedValue({ subditos: [], camas: { total: 3, companeros: 0, subditos: 0, libres: 3 } })
    const ok = render(<SubditosSection {...props} />)
    expect(await ok.findByText(/Aún no vive nadie/)).toBeTruthy()
  })

  it('si la recarga automática (nuevo subjects) va bien tras un fallo, el aviso desaparece', async () => {
    vi.mocked(getSubditos)
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValue({ subditos: [], camas: { total: 3, companeros: 0, subditos: 0, libres: 3 } })
    const props = { saveId: 's1', companions: [], inventory: [], almacenItems: [], plantillasEquipo: [], onRefreshSave: async () => {} }
    const { findByRole, queryByRole, findByText, rerender } = render(<SubditosSection {...props} subjects={[]} />)
    await findByRole('alert')
    rerender(<SubditosSection {...props} subjects={[{ id: 'nuevo' } as never]} />)
    expect(await findByText(/Camas: 0\/3/)).toBeTruthy()
    expect(queryByRole('alert')).toBeNull()
  })
})
