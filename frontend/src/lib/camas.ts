import type { CamasReino } from './api'

/// P258: «Camas: 1 ocupada de 4 · 3 libres (…)». Antes decía «1/4» y a la vez «Cama libre ✓»: no se sabía si era
/// 1 ocupada o 1 libre. Ahora se dicen las dos cosas con palabras.
export function textoDeCamas(c: CamasReino): string {
  const capacidad = c.total + (c.temporales ?? 0)
  const ocupadas = c.companeros + c.subditos
  const libres = Math.max(0, capacidad - ocupadas)
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
  const detalle = `${plural(c.subditos, 'súbdito', 'súbditos')}, ${plural(c.companeros, 'compañero', 'compañeros')}${c.temporales ? `, ${c.temporales} temporales del Ayuntamiento solo para súbditos` : ''}`
  return `Camas: ${plural(ocupadas, 'ocupada', 'ocupadas')} de ${capacidad} · ${plural(libres, 'libre', 'libres')} (${detalle})`
}
