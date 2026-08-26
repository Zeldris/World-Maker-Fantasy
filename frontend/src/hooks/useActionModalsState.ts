import { useState } from 'react'
import type { PostCombatInteractionInfo } from '../types'

/// Estado de los pop-ups de acción (deuda técnica, auditoría 2026-08-25 — ver
/// [[tarkor_extraccion_hooks_gameview_2026-08-21]] para el criterio real de extracción: "¿quién más
/// escribe este mismo estado?"). `carcassPending` es la excepción del grupo — `useCombatFlow`
/// (tras resolver un turno con intercambio de combate) y `handleSubmit` (GameView.tsx, al terminar
/// un `CombatEncounter` con caídos) también lo escriben desde fuera de la apertura/cierre normal
/// del pop-up, así que su setter se sigue exponiendo igual que el resto — este hook agrupa las
/// declaraciones `useState`, no encapsula del todo la apertura/cierre (eso se queda en
/// `GameView.tsx`, donde ya vivía).
export function useActionModalsState() {
  const [harvestModal, setHarvestModal] = useState<{ oficio: string; label: string } | null>(null)
  const [carcassPending, setCarcassPending] = useState<boolean | null>(null)
  const [huntModalOpen, setHuntModalOpen] = useState(false)
  const [simpleModal, setSimpleModal] = useState<'camp' | 'travel' | null>(null)
  const [saquearZonaModalOpen, setSaquearZonaModalOpen] = useState(false)
  const [healModalOpen, setHealModalOpen] = useState(false)
  const [postCombatTarget, setPostCombatTarget] = useState<PostCombatInteractionInfo | null>(null)

  return {
    harvestModal,
    setHarvestModal,
    carcassPending,
    setCarcassPending,
    huntModalOpen,
    setHuntModalOpen,
    simpleModal,
    setSimpleModal,
    saquearZonaModalOpen,
    setSaquearZonaModalOpen,
    healModalOpen,
    setHealModalOpen,
    postCombatTarget,
    setPostCombatTarget,
  }
}
