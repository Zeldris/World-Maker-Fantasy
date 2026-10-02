import { useMemo } from 'react'
import { calcularFase, canDo, type AccionJuego, type EstadoParaFase, type FaseJuego, type Permiso } from '../lib/gamePhase'

/// UX-1 (hito 0.2) — fase actual de la partida y sus permisos (matriz de UX-2, `lib/gamePhase.ts`).
export function useGamePhase(estado: EstadoParaFase): { fase: FaseJuego; puede: (accion: AccionJuego) => Permiso } {
  const fase = calcularFase(estado)
  return useMemo(() => ({ fase, puede: (accion: AccionJuego) => canDo(fase, accion) }), [fase])
}
