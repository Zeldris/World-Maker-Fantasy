/// P99 (QA-27): los oficios se llaman «Herrería de los Orcos de las Llanuras del Viento Rojo» y su
/// descripción empieza repitiéndolo («Herrería de Orcos de las Llanuras del Viento Rojo. Esta
/// profesión…»). En el panel se ve el nombre corto y la descripción sin esa primera frase; el nombre
/// completo queda en el aviso.

/// «Herrería de los Orcos de las Llanuras…» → «Herrería».
export function nombreCortoOficio(nombre: string): string {
  return nombre.replace(/\s+de\s+(?:los\s+|las\s+)?[A-ZÁÉÍÓÚÑ][^]*$/, '').trim() || nombre
}

/// Quita la primera frase de la descripción si solo repite el nombre del oficio.
export function descripcionSinNombre(descripcion: string, nombre: string): string {
  const corto = nombreCortoOficio(nombre)
  const [primera, ...resto] = descripcion.split(/(?<=\.)\s+/)
  return resto.length > 0 && nombreCortoOficio(primera.replace(/\.$/, '')) === corto ? resto.join(' ') : descripcion
}
