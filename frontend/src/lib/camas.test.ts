import { describe, it, expect } from 'vitest'
import { textoDeCamas } from './camas'

describe('P258 — texto de las camas', () => {
  it('dice ocupadas y libres con palabras, no «1/4»', () => {
    expect(textoDeCamas({ total: 4, companeros: 1, subditos: 0, libres: 3 })).toBe('Camas: 1 ocupada de 4 · 3 libres (0 súbditos, 1 compañero)')
  })
  it('suma las temporales del Ayuntamiento a la capacidad', () => {
    expect(textoDeCamas({ total: 0, companeros: 0, subditos: 0, libres: 0, temporales: 2 })).toBe('Camas: 0 ocupadas de 2 · 2 libres (0 súbditos, 0 compañeros, 2 temporales del Ayuntamiento solo para súbditos)')
  })
  it('sin camas libres dice 0 libres y singulariza una', () => {
    expect(textoDeCamas({ total: 3, companeros: 1, subditos: 2, libres: 0 })).toBe('Camas: 3 ocupadas de 3 · 0 libres (2 súbditos, 1 compañero)')
    expect(textoDeCamas({ total: 2, companeros: 0, subditos: 1, libres: 1 })).toBe('Camas: 1 ocupada de 2 · 1 libre (1 súbdito, 0 compañeros)')
  })
})
