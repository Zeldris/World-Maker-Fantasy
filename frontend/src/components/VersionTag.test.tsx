import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'

// Función simple (no `vi.fn`) para poder simular un rechazo sin que vitest lo cuente como no gestionado.
let respuesta: () => Promise<string> = async () => ''
let llamadas = 0
vi.mock('../lib/api', () => ({
  getServerVersion: () => {
    llamadas++
    return respuesta()
  },
}))

vi.stubGlobal('__APP_VERSION__', '0.0.2-alpha+67014de')

const { VersionTag } = await import('./VersionTag')

describe('VersionTag', () => {
  beforeEach(() => {
    llamadas = 0
  })
  afterEach(cleanup)

  it('con la misma versión en el servidor, muestra solo la del frontend', async () => {
    respuesta = async () => '0.0.2-alpha+67014de'
    render(<VersionTag />)
    await waitFor(() => expect(llamadas).toBe(1))
    expect(screen.getByTestId('version-tag').textContent).toBe('v0.0.2-alpha+67014de')
  })

  it('con otra versión en el servidor, muestra ambas', async () => {
    respuesta = async () => '0.0.1-alpha+abc1234'
    render(<VersionTag />)
    await waitFor(() =>
      expect(screen.getByTestId('version-tag').textContent).toBe('v0.0.2-alpha+67014de · servidor v0.0.1-alpha+abc1234'),
    )
  })

  it('si el backend no responde, solo la del frontend', async () => {
    respuesta = async () => {
      throw new Error('caído')
    }
    render(<VersionTag />)
    await waitFor(() => expect(llamadas).toBe(1))
    expect(screen.getByTestId('version-tag').textContent).toBe('v0.0.2-alpha+67014de')
  })
})
