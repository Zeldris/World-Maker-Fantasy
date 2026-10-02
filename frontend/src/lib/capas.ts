// Gestor de capas con prioridad (UX-9, hito 0.2 — roadmap-front-ux.md § 4.3, H7).
//
// Antes, cuando coincidían dos overlays (clase obligatoria + fundar reino, ficha + modo dinámico…)
// ganaba el que iba más abajo en el JSX. Aquí cada capa abierta declara su nivel y solo se ve la
// de nivel más alto; el resto espera **oculta pero montada** (conserva lo que tuviera a medias) y
// reaparece al cerrarse la de arriba. Dentro de un nivel, una sola capa: la primera en el orden de
// registro; las demás esperan detrás.

export const NIVEL_CAPA = {
  consulta: 1,
  accion: 2,
  escena: 3,
  decision: 4,
  critico: 5,
  sistema: 6,
} as const

export type NivelCapa = keyof typeof NIVEL_CAPA

export interface CapaAbierta {
  id: string
  nivel: NivelCapa
  /// Capa hija: se abre desde otra (la ficha de detalle, que sale desde el registro, un panel o
  /// un modal). Siempre visible y por encima, y no hace esperar a nadie.
  hija?: boolean
}

export interface EstadoCapas {
  /// Ids que se pintan.
  visibles: Set<string>
  /// Ids abiertos que esperan, en el orden en que volverán.
  enEspera: string[]
  /// La capa principal visible (la de nivel más alto), o null si no hay ninguna.
  superior: string | null
}

/// `abiertas` en orden de registro (el de prioridad dentro de cada nivel).
export function resolverCapas(abiertas: CapaAbierta[]): EstadoCapas {
  const principales = abiertas.filter((c) => !c.hija)
  let superior: CapaAbierta | null = null
  for (const c of principales) {
    if (!superior || NIVEL_CAPA[c.nivel] > NIVEL_CAPA[superior.nivel]) superior = c
  }
  const visibles = new Set<string>(abiertas.filter((c) => c.hija).map((c) => c.id))
  if (superior) visibles.add(superior.id)
  const enEspera = principales
    .filter((c) => c.id !== superior?.id)
    .sort((a, b) => NIVEL_CAPA[b.nivel] - NIVEL_CAPA[a.nivel])
    .map((c) => c.id)
  return { visibles, enEspera, superior: superior?.id ?? null }
}
