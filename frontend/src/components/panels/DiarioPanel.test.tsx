import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'

vi.mock('../../lib/api', () => ({ getDiario: vi.fn() }))

import { getDiario, type DiarioResponse } from '../../lib/api'
import { DiarioPanel } from './DiarioPanel'

afterEach(cleanup)

// P380: el Diario abría en «Verano · Día 6» (día dentro de la estación) con la fecha del juego en el Día 36, y
// en la fecha del último capítulo de la lista, no en la actual.
describe('DiarioPanel (P380)', () => {
  it('abre en la fecha más reciente y numera el día como el juego (Día 36)', async () => {
    const respuesta = {
      entries: [
        { kind: 'entry', id: 'e1', channel: 'player', text: 'Entrada de hoy', timeLabel: '08:00', createdAt: '2026-01-01', day: 36, year: 1, estacion: 'VERANO', diaRelativo: 6 },
        { kind: 'chapter', chapterNumber: 1, summary: 'Capítulo viejo', createdAt: '2026-01-01', year: 1, estacion: 'PRIMAVERA', diaRelativo: 3 },
      ],
      unplacedChapters: [],
    } as unknown as DiarioResponse
    vi.mocked(getDiario).mockResolvedValue(respuesta)
    const { findByText, queryByText } = render(<DiarioPanel saveId="s1" />)
    expect(await findByText('Entrada de hoy')).toBeTruthy()
    await waitFor(() => expect(queryByText('Capítulo viejo')).toBeNull())
    expect(queryByText('Día 36')).toBeTruthy()
    expect(queryByText('Día 6')).toBeNull()
  })
})
