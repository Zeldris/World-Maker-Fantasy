import { useState } from 'react'
import { assignClase, assignEspecializacion, getSave } from '../lib/api'
import type { Clase, Especializacion } from '../types'
import type { SaveDetail } from '../lib/api'

/// Estado de Clase/Especialización (deuda técnica, auditoría 2026-09 — ver
/// [[tarkor_extraccion_hooks_gameview_2026-08-21]] para el criterio real de extracción usado en
/// este proyecto: "¿quién más escribe este mismo estado?"). A diferencia de `useKingdomState`/
/// `useActionModalsState`, aquí SOLO `syncFromSave` (GameView.tsx, al cargar/recargar la partida)
/// escribe estos mismos 5 `useState` — ningún otro hook los toca desde fuera — así que el hook
/// puede quedarse con `syncFromSave` pasado como parámetro y encapsular también los dos handlers
/// de asignación enteros (`handleAssignClase`/`handleAssignEspecializacion`), no solo agrupar la
/// declaración.
export function useClaseEspecializacionState(saveId: string | null, syncFromSave: (save: SaveDetail) => void) {
  // Elección obligatoria de clase al empezar a jugar (2026-09-01, fix de bug real: personaje
  // custom se quedaba sin clase para siempre) — mismo patrón que pendingDeathResolution.
  const [pendingClaseChoice, setPendingClaseChoice] = useState(false)
  const [clasesDisponibles, setClasesDisponibles] = useState<{ clase: Clase; resumenMecanico: string; iconoUrl: string | null }[]>([])
  // Elección obligatoria de especialización a nivel 10 (2026-09-01) — mismo patrón que
  // pendingDeathResolution: bloquea el composer hasta resolver.
  const [pendingEspecializacionChoice, setPendingEspecializacionChoice] = useState(false)
  const [especializacionesDisponibles, setEspecializacionesDisponibles] = useState<{ especializacion: Especializacion; resumenMecanico: string; iconoUrl: string | null }[]>([])
  const [clase, setClase] = useState<Clase | null>(null)

  // Elección obligatoria de clase al empezar a jugar (2026-09-01, fix de bug real) — mismo
  // criterio que handleAssignEspecializacion: recarga la partida entera para reflejar el tronco
  // común de habilidades concedido por el backend.
  async function handleAssignClase(claseElegida: Clase) {
    if (!saveId) return
    await assignClase(saveId, claseElegida)
    const save = await getSave(saveId)
    syncFromSave(save)
  }

  // Elección obligatoria de especialización a nivel 10 (2026-09-01) — mismo criterio que
  // handleResolveDeath: recarga la partida entera para reflejar las habilidades nuevas concedidas
  // por el backend, en vez de reconstruir el estado a mano.
  async function handleAssignEspecializacion(especializacionElegida: Especializacion) {
    if (!saveId) return
    await assignEspecializacion(saveId, especializacionElegida)
    const save = await getSave(saveId)
    syncFromSave(save)
  }

  return {
    pendingClaseChoice,
    setPendingClaseChoice,
    clasesDisponibles,
    setClasesDisponibles,
    pendingEspecializacionChoice,
    setPendingEspecializacionChoice,
    especializacionesDisponibles,
    setEspecializacionesDisponibles,
    clase,
    setClase,
    handleAssignClase,
    handleAssignEspecializacion,
  }
}
