import { describe, it, expect } from 'vitest'
import { accionDeTecla, asignarAtajo, ATAJOS_POR_DEFECTO, normalizarAtajos } from './atajos'

const tecla = (key: string, extra: Partial<{ ctrlKey: boolean; target: EventTarget | null }> = {}) => ({
  key, ctrlKey: false, altKey: false, metaKey: false, target: document.body, ...extra,
})

/// CFG-26 (hito 0.2) — atajos de teclado reasignables.
describe('CFG-26 — atajos', () => {
  it('la tecla dispara su acción; no al escribir ni con Ctrl', () => {
    expect(accionDeTecla(tecla('I'), ATAJOS_POR_DEFECTO)).toBe('inventario')
    expect(accionDeTecla(tecla('z'), ATAJOS_POR_DEFECTO)).toBe('zona')
    // UX-36: Leyendas con Y; L sigue siendo la Enciclopedia.
    expect(accionDeTecla(tecla('Y'), ATAJOS_POR_DEFECTO)).toBe('leyendas')
    expect(accionDeTecla(tecla('l'), ATAJOS_POR_DEFECTO)).toBe('enciclopedia')
    expect(accionDeTecla(tecla('q'), ATAJOS_POR_DEFECTO)).toBeNull()
    expect(accionDeTecla(tecla('i', { ctrlKey: true }), ATAJOS_POR_DEFECTO)).toBeNull()
    expect(accionDeTecla(tecla('i', { target: document.createElement('textarea') }), ATAJOS_POR_DEFECTO)).toBeNull()
  })

  it('reasignar intercambia si la tecla ya era de otra acción; no deja reservadas', () => {
    const m = asignarAtajo(ATAJOS_POR_DEFECTO, 'inventario', 'M')
    expect(m.inventario).toBe('m')
    expect(m.mapa).toBe('i')
    expect(asignarAtajo(ATAJOS_POR_DEFECTO, 'inventario', '1')).toEqual(ATAJOS_POR_DEFECTO)
  })

  it('normaliza: completa lo que falte y descarta lo inválido', () => {
    expect(normalizarAtajos({ inventario: 'B', mapa: 'Enter' })).toEqual({ ...ATAJOS_POR_DEFECTO, inventario: 'b' })
    expect(normalizarAtajos(null)).toEqual(ATAJOS_POR_DEFECTO)
  })
})
