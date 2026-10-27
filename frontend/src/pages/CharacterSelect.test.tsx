import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CharacterSelect } from './CharacterSelect'
import { SessionProvider } from '../context/SessionContext'
import { worlds } from '../data/mock'

/// INS-33 — «Crear desde cero» queda visible pero deshabilitada, en construcción.
describe('CharacterSelect — INS-33', () => {
  afterEach(cleanup)

  it('la pestaña está deshabilitada y pulsarla no cambia de pestaña', () => {
    const { getByRole, getByText, queryByText } = render(
      <MemoryRouter initialEntries={[`/solitario/mundo/${worlds[0].id}`]}>
        <SessionProvider>
          <Routes>
            <Route path="/solitario/mundo/:worldId" element={<CharacterSelect />} />
          </Routes>
        </SessionProvider>
      </MemoryRouter>,
    )
    const pestana = getByRole('button', { name: /Crear desde cero/ }) as HTMLButtonElement
    expect(pestana.disabled).toBe(true)
    expect(pestana.getAttribute('aria-disabled')).toBe('true')
    expect(getByText('En construcción')).toBeTruthy()
    fireEvent.click(pestana)
    expect(queryByText('Confirmar personaje')).toBeNull()
    expect(getByText('Gorhorn')).toBeTruthy()
  })
})
