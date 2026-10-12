/// P33 (QA-27): centra `el` en su contenedor con scroll más cercano, sin mover nada más. Con
/// `scrollIntoView` se desplazaban también la página y los paneles de alrededor (el diario).
export function centrarEnSuContenedor(el: Element | null | undefined): void {
  if (!el) return
  let contenedor = el.parentElement
  while (contenedor) {
    const { overflowY, overflowX } = getComputedStyle(contenedor)
    const desplazable = /auto|scroll/.test(overflowY) || /auto|scroll/.test(overflowX)
    if (desplazable && (contenedor.scrollHeight > contenedor.clientHeight || contenedor.scrollWidth > contenedor.clientWidth)) break
    contenedor = contenedor.parentElement
  }
  if (!contenedor) return
  const r = el.getBoundingClientRect()
  const c = contenedor.getBoundingClientRect()
  contenedor.scrollTop += r.top + r.height / 2 - (c.top + c.height / 2)
  contenedor.scrollLeft += r.left + r.width / 2 - (c.left + c.width / 2)
}
