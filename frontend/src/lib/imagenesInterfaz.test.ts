import { describe, expect, it } from 'vitest'
import { imagenCategoria, imagenEstado, imagenFase, imagenInterfaz, imagenPestana } from './imagenesInterfaz'

describe('imagenesInterfaz (UX-41)', () => {
  it('resuelve las piezas preparadas a una URL de webp', () => {
    expect(imagenPestana('inventario')).toMatch(/pestana-inventario.*\.webp/)
    expect(imagenFase('combate')).toMatch(/fase-combate.*\.webp/)
    expect(imagenCategoria('arma')).toMatch(/categoria-arma.*\.webp/)
    expect(imagenEstado('hecho')).toMatch(/estado-hecho.*\.webp/)
    expect(imagenInterfaz('cielo')).toMatch(/cielo.*\.webp/)
  })

  it('sin pieza devuelve undefined para que quien pinta use su emoji', () => {
    expect(imagenPestana('reputacion')).toBeUndefined()
    expect(imagenFase('fin')).toBeUndefined()
    expect(imagenCategoria('piedra')).toBeUndefined()
  })
})
