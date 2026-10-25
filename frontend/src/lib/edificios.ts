/// P212/P213: el nombre de un edificio para mostrarlo. Las recetas guardan el nombre como va en la
/// narración («un pequeño ayuntamiento», «unos corrales del Ganadero») y `Building.name` lo copia tal cual;
/// para la interfaz se le quita el artículo y se pone en mayúscula («Pequeño ayuntamiento»). Sirve igual para
/// las partidas viejas (el dato guardado no cambia) y para un edificio que la narración haya nombrado con artículo.
export function nombreDeEdificio(name: string): string {
  const limpio = name.trim().replace(/^(un|una|unos|unas|el|la|los|las)\s+/i, '')
  return limpio.charAt(0).toUpperCase() + limpio.slice(1)
}

/// P213: último recurso si ni la habilidad ni la receta traen nombre: «totem-clan-maktor» -> «Totem clan maktor».
export function nombreDeSlug(slug: string): string {
  const texto = slug.replace(/[-_]+/g, ' ').trim()
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
