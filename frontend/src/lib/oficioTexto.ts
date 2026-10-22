/// P99 (QA-27): los oficios se llaman «Herrería de los Orcos de las Llanuras del Viento Rojo» y su
/// descripción empieza repitiéndolo («Herrería de Orcos de las Llanuras del Viento Rojo. Esta
/// profesión…»). En el panel se ve el nombre corto y la descripción sin esa primera frase; el nombre
/// completo queda en el aviso.

/// «Herrería de los Orcos de las Llanuras…» (o «… de faerus …») → «Herrería».
export function nombreCortoOficio(nombre: string): string {
  return nombre.replace(/\s+del?\s+\S[^]*$/, '').trim() || nombre
}

/// Nombre que se ve de cada oficio de una lista: el corto, salvo que dos de la lista compartan el
/// corto (dos herrerías distintas), que entonces van con el nombre completo para distinguirlas.
export function nombresVisiblesDeOficios(nombres: string[]): Map<string, string> {
  const cuantos = new Map<string, number>()
  for (const n of nombres) cuantos.set(nombreCortoOficio(n), (cuantos.get(nombreCortoOficio(n)) ?? 0) + 1)
  return new Map(nombres.map((n) => [n, (cuantos.get(nombreCortoOficio(n)) ?? 0) > 1 ? n : nombreCortoOficio(n)]))
}

/// Quita la primera frase de la descripción si solo repite el nombre del oficio, y la región donde
/// aún se repite («…cura pieles de los Orcos de las Llanuras…», «…la zona de las Llanuras…»).
export function descripcionSinNombre(descripcion: string, nombre: string): string {
  const corto = nombreCortoOficio(nombre)
  const [primera, ...resto] = descripcion.split(/(?<=\.)\s+/)
  const base = resto.length > 0 && nombreCortoOficio(primera.replace(/\.$/, '')) === corto ? resto.join(' ') : descripcion
  const cola = nombre.slice(corto.length).trim()
  const sinCola = cola ? base.split(` ${cola}`).join('') : base
  return sinCola.replace(/\b(la zona|el territorio) del?\s(?:la |las |los |el )?[^.]*\./g, '$1.')
}
