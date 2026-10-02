import { describe, it, expect } from 'vitest'
import { AJUSTES_POR_DEFECTO, CLAVE_AJUSTES, cargarAjustes, guardarAjustes, normalizarAjustes } from './ajustes'

function almacen(inicial: Record<string, string> = {}) {
  const datos = { ...inicial }
  return {
    datos,
    getItem: (k: string) => datos[k] ?? null,
    setItem: (k: string, v: string) => {
      datos[k] = v
    },
    removeItem: (k: string) => {
      delete datos[k]
    },
  }
}

/// CFG-5 (hito 0.2) — persistencia versionada de los ajustes.
describe('CFG-5 — ajustes', () => {
  it('sin nada guardado o con JSON roto: los de por defecto', () => {
    expect(cargarAjustes(almacen())).toEqual(AJUSTES_POR_DEFECTO)
    expect(cargarAjustes(almacen({ [CLAVE_AJUSTES]: '{roto' }))).toEqual(AJUSTES_POR_DEFECTO)
    expect(cargarAjustes(null)).toEqual(AJUSTES_POR_DEFECTO)
  })

  it('guardar y cargar ida y vuelta', () => {
    const a = almacen()
    const ajustes = { ...AJUSTES_POR_DEFECTO, escalaInterfaz: 125, altoContraste: true, velocidadDados: 'rapida' as const }
    guardarAjustes(ajustes, a)
    expect(cargarAjustes(a)).toEqual(ajustes)
  })

  it('normaliza: campos inválidos vuelven a su valor por defecto sin tirar el resto; escala acotada', () => {
    const n = normalizarAjustes({ escalaInterfaz: 400, animaciones: 'a-tope', altoContraste: true, tamanoNarracion: 'grande' })
    expect(n.escalaInterfaz).toBe(150)
    expect(n.animaciones).toBe('sistema')
    expect(n.altoContraste).toBe(true)
    expect(n.tamanoNarracion).toBe('grande')
    expect(normalizarAjustes({ escalaInterfaz: 92 }).escalaInterfaz).toBe(90)
    expect(normalizarAjustes('basura')).toEqual(AJUSTES_POR_DEFECTO)
  })
})

/// CFG-6 (hito 0.2) — los ajustes se aplican a <html> como atributos y variables CSS.
describe('CFG-6 — aplicarAjustes', () => {
  it('escala, animaciones (sistema resuelto), contraste, narración y dados', async () => {
    const { aplicarAjustes } = await import('./ajustes')
    const { duracionTirada, ROLL_DURATION_MS } = await import('./duracionTirada')
    const raiz = document.createElement('div')
    aplicarAjustes(
      { ...AJUSTES_POR_DEFECTO, escalaInterfaz: 125, altoContraste: true, tamanoNarracion: 'grande', fuenteNarracion: 'legible', interlineadoAmplio: true, velocidadDados: 'rapida' },
      raiz,
      true,
    )
    expect(raiz.style.fontSize).toBe('125%')
    expect(raiz.dataset.motion).toBe('reducidas')
    expect(raiz.dataset.contrast).toBe('alto')
    expect(raiz.dataset.narrationFont).toBe('legible')
    expect(raiz.style.getPropertyValue('--narration-size')).toBe('1rem')
    expect(raiz.style.getPropertyValue('--narration-leading')).toBe('1.9')
    expect(duracionTirada()).toBe(Math.round(ROLL_DURATION_MS * 0.3))

    aplicarAjustes({ ...AJUSTES_POR_DEFECTO, animaciones: 'ninguna' }, raiz, false)
    expect(raiz.style.fontSize).toBe('')
    expect(raiz.dataset.motion).toBe('ninguna')
    expect(raiz.dataset.contrast).toBeUndefined()
    expect(duracionTirada()).toBe(ROLL_DURATION_MS)
    aplicarAjustes(AJUSTES_POR_DEFECTO, raiz, false)
    expect(raiz.dataset.motion).toBe('completas')
  })
})
