// P92 (QA-27): las etiquetas del mapa de zona (destinos de las salidas y nombres de las fichas) se
// pisaban cuando caían cerca, p. ej. dos salidas en la misma esquina y una ficha al lado. Cada caja va en
// unidades del lienzo. P123: las fichas (y el jugador y los viajeros) son obstáculos fijos que se colocan
// primero; luego las etiquetas, en orden (las primeras mandan), se apartan en vertical lo justo.

/// `fija`: un obstáculo que no se mueve ni se devuelve (P123: la ficha misma, con su «×N»). Su clave es
/// `f:<clave de su etiqueta>`: en su sitio, la etiqueta de una ficha puede tocar su propia ficha (va pegada
/// debajo); apartada, no.
export type CajaEtiqueta = { clave: string; x: number; y: number; ancho: number; alto: number; fija?: boolean }

const HUECO = 2
/// P151: lo más que se aparta una etiqueta, en alturas de etiqueta. Más lejos ya no se sabe de quién es:
/// si no cabe más cerca, se queda en su sitio aunque pise algo.
const MAX_ALTURAS = 3

function sePisan(a: CajaEtiqueta, b: CajaEtiqueta): boolean {
  return a.x < b.x + b.ancho + HUECO && b.x < a.x + a.ancho + HUECO && a.y < b.y + b.alto + HUECO && b.y < a.y + a.alto + HUECO
}

/// Desplazamiento vertical (unidades del lienzo) de cada etiqueta para que no se pisen. Para cada una
/// prueba su sitio y, si pisa algo, justo debajo o justo encima de cada caja ya colocada, y se queda con
/// la más cercana que quepa en el lienzo sin pisar nada; si no hay ninguna a menos de `MAX_ALTURAS`,
/// no se mueve.
export function separarEtiquetas(cajas: CajaEtiqueta[], altoLienzo: number): Map<string, number> {
  const colocadas: CajaEtiqueta[] = cajas.filter((c) => c.fija)
  const dy = new Map<string, number>()
  for (const caja of cajas) {
    if (caja.fija) continue
    const propia = `f:${caja.clave}`
    const libre = (y: number) => !colocadas.some((c) => (y !== caja.y || c.clave !== propia) && sePisan(c, { ...caja, y }))
    const maximo = MAX_ALTURAS * (caja.alto + HUECO)
    const candidatas = [caja.y, ...colocadas.flatMap((c) => [c.y + c.alto + HUECO, c.y - caja.alto - HUECO])]
      .filter((y) => y >= 0 && y + caja.alto <= altoLienzo && Math.abs(y - caja.y) <= maximo)
      // La más cercana; a igual distancia, la de abajo (las etiquetas van debajo de su ficha).
      .sort((a, b) => Math.abs(a - caja.y) - Math.abs(b - caja.y) || b - a)
    const y = candidatas.find(libre) ?? caja.y
    colocadas.push({ ...caja, y })
    if (y !== caja.y) dy.set(caja.clave, y - caja.y)
  }
  return dy
}
