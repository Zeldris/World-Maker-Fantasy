// P92 (QA-27): las etiquetas del mapa de zona (destinos de las salidas y nombres de las fichas) se
// pisaban cuando caían cerca, p. ej. dos salidas en la misma esquina y una ficha al lado. Cada caja va en
// unidades del lienzo; las fijas (salidas) se colocan primero y el resto se aparta en vertical.

export type CajaEtiqueta = { clave: string; x: number; y: number; ancho: number; alto: number }

const HUECO = 2

function sePisan(a: CajaEtiqueta, b: CajaEtiqueta): boolean {
  return a.x < b.x + b.ancho + HUECO && b.x < a.x + a.ancho + HUECO && a.y < b.y + b.alto + HUECO && b.y < a.y + a.alto + HUECO
}

/// Desplazamiento vertical (unidades del lienzo) de cada etiqueta para que no se pisen: en orden (las
/// primeras mandan), cada una baja lo justo bajo la que pisa; si se saldría por abajo, sube por encima.
export function separarEtiquetas(cajas: CajaEtiqueta[], altoLienzo: number): Map<string, number> {
  const colocadas: CajaEtiqueta[] = []
  const dy = new Map<string, number>()
  for (const caja of cajas) {
    const actual = { ...caja }
    // Tope de vueltas: con muchas etiquetas juntas, mejor alguna pisada que un bucle sin fin.
    for (let vuelta = 0; vuelta < 12; vuelta++) {
      const pisada = colocadas.find((c) => sePisan(c, actual))
      if (!pisada) break
      const abajo = pisada.y + pisada.alto + HUECO
      actual.y = abajo + actual.alto <= altoLienzo ? abajo : pisada.y - actual.alto - HUECO
    }
    colocadas.push(actual)
    if (actual.y !== caja.y) dy.set(caja.clave, actual.y - caja.y)
  }
  return dy
}
