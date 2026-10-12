import { describe, expect, it } from 'vitest'
import { descripcionSinNombre, nombreCortoOficio } from './oficioTexto'

describe('oficioTexto (P99, QA-27)', () => {
  it('el nombre corto deja solo el oficio', () => {
    expect(nombreCortoOficio('Herrería de los Orcos de las Llanuras del Viento Rojo')).toBe('Herrería')
    expect(nombreCortoOficio('Primeros auxilios de los Orcos de las Llanuras del Viento Rojo')).toBe('Primeros auxilios')
    expect(nombreCortoOficio('Desollador')).toBe('Desollador')
  })

  it('la descripción no repite el nombre en su primera frase', () => {
    const nombre = 'Herrería de los Orcos de las Llanuras del Viento Rojo'
    expect(descripcionSinNombre('Herrería de Orcos de las Llanuras del Viento Rojo. Esta profesión se centra en los recursos de la zona.', nombre)).toBe(
      'Esta profesión se centra en los recursos de la zona.',
    )
    expect(descripcionSinNombre('Cura y trabaja las pieles de la caza.', 'Curtidor de los Orcos de las Llanuras del Viento Rojo')).toBe(
      'Cura y trabaja las pieles de la caza.',
    )
  })
})
