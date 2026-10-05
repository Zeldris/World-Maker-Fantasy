import { createContext, useContext } from 'react'

// ZON-36 (hito 0.2, decisión de la usuaria en la ronda de la Fase F) — velocidad de paso en el mapa
// de zona: cuánto dura cada paso (la animación y el ritmo de pedirlos son la misma cifra).
export type VelocidadPasoZona = 'normal' | 'rapida' | 'inmediata'

export const MS_POR_VELOCIDAD: Record<VelocidadPasoZona, number> = { normal: 600, rapida: 250, inmediata: 0 }

/// Duración del paso en curso, para que fichas y nombres se animen al mismo ritmo que se anda.
export const PasoZonaContext = createContext<number>(MS_POR_VELOCIDAD.normal)

export function useMsPaso(): number {
  return useContext(PasoZonaContext)
}

/// ZON-38: cuánto esperar antes de pedir el siguiente paso, para que su respuesta llegue justo
/// cuando termina la animación del actual (descontando lo que tardó la llamada anterior). Pedirlo
/// antes haría que «Parar» dejara al personaje una celda más allá.
export function esperaAntesDePedir(msPaso: number, ultimaLatencia: number): number {
  return Math.max(0, msPaso - ultimaLatencia)
}
