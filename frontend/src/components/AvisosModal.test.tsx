import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { AvisosModal } from './AvisosModal'

/// CR-40 (40g) — avisos de un tablón o de un NPC: recompensa por tabla, Aceptar y el motivo del
/// backend si no se puede (límite de activas, una por facción…).
describe('AvisosModal', () => {
  afterEach(() => cleanup())
  const aviso = { id: 'a1', titulo: 'Cazar canizores en las Llanuras', descripcion: 'Hay demasiados.', faccion: 'Clan Serhu', recompensa: { xp: 80, goirnos: 35, reputacion: 70, reputacionAlFallar: -35, reputacionConEnemiga: 0 }, retiraEn: 9 * 1440 }

  it('pinta el aviso con su recompensa y, al aceptarlo, lo confirma', async () => {
    const onAceptar = vi.fn(async () => {})
    const { getByText, getByRole } = render(<AvisosModal titulo="Tablón de avisos" avisos={[aviso]} vacio="Nada" onAceptar={onAceptar} onClose={() => {}} />)
    expect(getByText(/\+80 XP · 35 Goirnos · reputación \+70/)).toBeTruthy()
    expect(getByText(/Se retira el día 10/)).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(getByText(/Aceptada/)).toBeTruthy())
    expect(onAceptar).toHaveBeenCalledWith('a1')
  })

  it('si el backend no deja aceptarlo, muestra su motivo y mantiene el botón', async () => {
    const onAceptar = vi.fn(async () => { throw new Error('Ya llevas 3 misiones secundarias') })
    const { getByText, getByRole } = render(<AvisosModal titulo="T" avisos={[aviso]} vacio="Nada" onAceptar={onAceptar} onClose={() => {}} />)
    fireEvent.click(getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(getByText('Ya llevas 3 misiones secundarias')).toBeTruthy())
    expect(getByRole('button', { name: 'Aceptar' })).toBeTruthy()
  })

  it('sin avisos enseña el texto de vacío', () => {
    const { getByText } = render(<AvisosModal titulo="Trabajo de Ulkha" avisos={[]} vacio="Ulkha no tiene ningún encargo para ti ahora mismo." onAceptar={async () => {}} onClose={() => {}} />)
    expect(getByText('Ulkha no tiene ningún encargo para ti ahora mismo.')).toBeTruthy()
  })

  // CR-18 (18d): en un tablón, los bandos arriba, con el día en que pasó cada cosa.
  it('pinta los bandos del tablón encima de los avisos', () => {
    const bandos = [{ sucesoId: 's1', texto: 'Clan Serhu y Clan Goshg pactan una tregua.', pasoEn: 12 * 1440 + 600 }]
    const { getByRole, getByText } = render(<AvisosModal titulo="Tablón" avisos={[aviso]} bandos={bandos} vacio="Nada" onAceptar={async () => {}} onClose={() => {}} />)
    const seccion = getByRole('region', { name: 'Bandos' })
    expect(seccion.textContent).toContain('Día 13')
    expect(seccion.textContent).toContain('pactan una tregua')
    expect(getByText('Avisos')).toBeTruthy()
  })
})

