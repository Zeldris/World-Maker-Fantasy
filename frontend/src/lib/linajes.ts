import type { MiembroLinaje } from './api'

// CR-52 (hito 0.3): reglas puras de la sección «Linajes» de Leyendas.

/// Puro: el árbol del linaje. Raíces = quien no tiene a ningún progenitor dentro del linaje.
export function arbolDeLinaje(miembros: MiembroLinaje[]): { raices: MiembroLinaje[]; hijos: (id: string) => MiembroLinaje[] } {
  const ids = new Set(miembros.map((m) => m.id))
  const dentro = (id: string | null) => !!id && ids.has(id)
  return {
    raices: miembros.filter((m) => !dentro(m.padreId) && !dentro(m.madreId)),
    // Una cría cuelga de su madre si está en el linaje; si no, de su padre (sin repetirse).
    hijos: (id) => miembros.filter((m) => (dentro(m.madreId) ? m.madreId === id : m.padreId === id)),
  }
}
