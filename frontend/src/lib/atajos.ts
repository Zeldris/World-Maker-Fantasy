// CFG-26 (hito 0.2, roadmap-front.md § 2.6) — atajos de teclado reasignables. Una tecla por acción;
// solo fuera de campos de texto y sin Ctrl/Alt/Meta (no pisan los del navegador). Enter (enviar) y
// Esc (menú) son fijos y no viven aquí.

export type AccionAtajo = 'inventario' | 'mapa' | 'personaje' | 'habilidades' | 'diario' | 'reino' | 'enciclopedia' | 'zona'

export const ACCIONES_ATAJO: { accion: AccionAtajo; label: string }[] = [
  { accion: 'inventario', label: 'Inventario' },
  { accion: 'mapa', label: 'Mapa' },
  { accion: 'personaje', label: 'Personaje' },
  { accion: 'habilidades', label: 'Habilidades' },
  { accion: 'diario', label: 'Diario' },
  { accion: 'reino', label: 'Reino' },
  { accion: 'enciclopedia', label: 'Enciclopedia' },
  { accion: 'zona', label: 'Moverte por la zona' },
]

export type MapaAtajos = Record<AccionAtajo, string>

export const ATAJOS_POR_DEFECTO: MapaAtajos = {
  inventario: 'i',
  mapa: 'm',
  personaje: 'p',
  habilidades: 'h',
  diario: 'j',
  reino: 'k',
  enciclopedia: 'l',
  zona: 'z',
}

/// Teclas que no se pueden asignar (las usan otras cosas: números de la barra y de los modales).
const RESERVADAS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', ' ', 'enter', 'escape', 'tab'])

export const teclaValida = (tecla: string): boolean => tecla.length === 1 && !RESERVADAS.has(tecla.toLowerCase())

/// Completa con los de por defecto lo que falte o sea inválido.
export function normalizarAtajos(crudo: unknown): MapaAtajos {
  const o = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>
  const mapa = { ...ATAJOS_POR_DEFECTO }
  for (const { accion } of ACCIONES_ATAJO) {
    const t = o[accion]
    if (typeof t === 'string' && teclaValida(t)) mapa[accion] = t.toLowerCase()
  }
  return mapa
}

/// Asigna `tecla` a `accion`; si otra acción la tenía, intercambian (nunca dos con la misma).
export function asignarAtajo(mapa: MapaAtajos, accion: AccionAtajo, tecla: string): MapaAtajos {
  const t = tecla.toLowerCase()
  if (!teclaValida(t)) return mapa
  const otra = (Object.keys(mapa) as AccionAtajo[]).find((a) => a !== accion && mapa[a] === t)
  return { ...mapa, [accion]: t, ...(otra ? { [otra]: mapa[accion] } : {}) }
}

/// Qué acción dispara esta pulsación, o null (escribiendo en un campo, con modificadores, o sin
/// atajo asignado).
export function accionDeTecla(
  e: { key: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean; target: EventTarget | null },
  mapa: MapaAtajos,
): AccionAtajo | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null
  const destino = e.target instanceof Element ? e.target : null
  if (destino?.closest('input, textarea, select, [contenteditable="true"]')) return null
  const t = e.key.toLowerCase()
  return (Object.keys(mapa) as AccionAtajo[]).find((a) => mapa[a] === t) ?? null
}
