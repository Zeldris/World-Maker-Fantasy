import type { SubditoInfo } from './api'

// REI-118 (hito 0.3): reglas puras de la lista de súbditos del Reino.

const PUEBLO_LABEL: Record<string, string> = { orcos: 'orco', goirntes: 'goirnte', nabieus: 'nabieu', faerus: 'faerus' }

/// Puro: cómo se presenta un súbdito («orca, 24 años · de los Ketg»).
export function lineaDeSubdito(s: Pick<SubditoInfo, 'pueblo' | 'genero' | 'edad' | 'adulto' | 'linaje'>): string {
  const pueblo = s.pueblo ? PUEBLO_LABEL[s.pueblo] ?? s.pueblo : null
  const quien = pueblo ? (s.genero === 'F' && pueblo.endsWith('o') ? `${pueblo.slice(0, -1)}a` : pueblo) : null
  const edad = s.edad == null ? null : s.adulto ? `${s.edad} años` : s.edad === 0 ? 'recién nacido' : `cría de ${s.edad} año${s.edad === 1 ? '' : 's'}`
  const linaje = s.linaje ? (s.linaje.tipo === 'RASTRO' ? `del rastro ${s.linaje.nombre}` : `de los ${s.linaje.nombre}`) : null
  return [[quien, edad].filter(Boolean).join(', '), linaje].filter(Boolean).join(' · ')
}
