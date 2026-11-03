import { describe, expect, it } from 'vitest'
import estado from './useGameViewState.tsx?raw'
import modales from './GameModals.tsx?raw'
import cajon from './GamePanelCajon.tsx?raw'

/// P128 (tanda 48): `<Capa id="fin-de-partida">` se pintaba sin registrar en `capasAbiertas`, y una capa que el gestor
/// no conoce sale oculta (`display:none`): el modal de fin de partida no se veía nunca. Toda capa que se pinta tiene
/// que estar en la lista del gestor.
describe('UX-9 — toda <Capa> pintada está registrada en el gestor (P128)', () => {
  const registradas = new Set([...estado.matchAll(/\{ id: '([^']+)', nivel:/g)].map((m) => m[1]))
  const pintadas = [modales, cajon].flatMap((f) => [...f.matchAll(/<Capa id="([^"]+)"/g)].map((m) => m[1]))

  it('cada id de <Capa> aparece en capasAbiertas', () => {
    expect(pintadas.length).toBeGreaterThan(10)
    expect(pintadas.filter((id) => !registradas.has(id))).toEqual([])
  })
})
