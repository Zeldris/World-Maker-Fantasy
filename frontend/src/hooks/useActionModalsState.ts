import { useState } from 'react'
import type { PostCombatInteractionInfo } from '../types'
import type { DynamicModeTurno } from '../lib/api'

/// Estado de los pop-ups de acción (deuda técnica, auditoría 2026-08-25 — ver
/// [[tarkor_extraccion_hooks_gameview_2026-08-21]] para el criterio real de extracción: "¿quién más
/// escribe este mismo estado?"). `carcassPending` es la excepción del grupo — `useTurnFlow`/
/// `useCombatFlow` (tras resolver un turno con intercambio de combate) y `GameView.tsx` (al
/// entrar en una escena nueva) también lo escriben desde fuera de la apertura/cierre normal del
/// pop-up, así que este hook agrupa las declaraciones `useState`, no encapsula del todo la
/// apertura/cierre (eso se queda en `GameView.tsx`, donde ya vivía).
export function useActionModalsState() {
  // `highlightSourceSlug` (Pieza 6d, 2026-09-03) — botón de "recolección redirigida" del log
  // (`entry.harvestSuggestion`), abre el modal con la fuente ya citada por texto libre priorizada.
  const [harvestModal, setHarvestModal] = useState<{ oficio: string; label: string; highlightSourceSlug?: string } | null>(null)
  const [carcassPending, setCarcassPending] = useState<boolean | null>(null)
  /// C.2 (checklist frontend 2026-08-27) — `carcassPending` se escribía con el setter crudo desde
  /// 3+ sitios distintos, cada uno reconstruyendo su propia condición. Dos formas reales de uso:
  /// "sí hay, de verdad" (tras un combate con caídos) y "sincroniza con lo que hay ahora mismo en
  /// la escena" (tras cambiar de zona/recargar) — dos funciones con nombre, no un booleano crudo.
  function markCarcassPending() {
    setCarcassPending(true)
  }
  function checkCarcassPending(hasSourcesNow: boolean) {
    setCarcassPending(hasSourcesNow)
  }
  const [huntModalOpen, setHuntModalOpen] = useState(false)
  const [simpleModal, setSimpleModal] = useState<'camp' | 'travel' | null>(null)
  const [saquearZonaModalOpen, setSaquearZonaModalOpen] = useState(false)
  const [healModalOpen, setHealModalOpen] = useState(false)
  /// Entregar un objeto a un NPC (2026-08-31) — mismo patrón que healModalOpen/saquearZonaModalOpen.
  const [entregaModalOpen, setEntregaModalOpen] = useState(false)
  /// Aprender oficio de un Maestro (2026-08-31, "Trabajador de Reino") — mismo patrón.
  const [aprenderOficioModalOpen, setAprenderOficioModalOpen] = useState(false)
  const [postCombatTarget, setPostCombatTarget] = useState<PostCombatInteractionInfo | null>(null)
  /// "Modo dinámico" (2026-08-27) — mini-flujo abierto tras pulsar "Interactuar" en la tarjeta de
  /// oferta del log; `turno` es la vuelta actual (narración + opciones), `busy` bloquea los botones
  /// mientras se espera la respuesta del backend. `error` (A.7, checklist frontend 2026-08-27): si
  /// `responderModoDinamico` falla, antes los botones se reactivaban sin ninguna explicación.
  /// `imageUrl` (B.6, mismo checklist) — retrato del NPC/fauna resuelto UNA VEZ al abrir (no cambia
  /// durante la conversación, el `targetSlug` es fijo), `null` si no hay imagen real subida.
  const [activeDynamicMode, setActiveDynamicMode] = useState<{ turno: DynamicModeTurno; busy: boolean; error?: string; imageUrl?: string | null } | null>(
    null,
  )

  /// Guard de exclusión mutua (checklist frontend 2026-08-27, A.2 — "ningún handler comprueba si
  /// otro modal ya está abierto antes de fijar el suyo... todos comparten z-50, cuál gana depende
  /// del orden de declaración en el JSX"). Cubre solo los 6 modales de ESTE hook —
  /// `detailTarget`/`kingdomFoundedInfo` (GameView.tsx) y `combat.combatOpen` (useCombatFlow.ts)
  /// viven fuera de aquí, el caller los combina antes de decidir si abre uno nuevo.
  const anyActionModalOpen = Boolean(
    harvestModal ||
      huntModalOpen ||
      simpleModal ||
      saquearZonaModalOpen ||
      healModalOpen ||
      entregaModalOpen ||
      aprenderOficioModalOpen ||
      postCombatTarget ||
      activeDynamicMode,
  )

  return {
    harvestModal,
    setHarvestModal,
    carcassPending,
    markCarcassPending,
    checkCarcassPending,
    huntModalOpen,
    setHuntModalOpen,
    simpleModal,
    setSimpleModal,
    saquearZonaModalOpen,
    setSaquearZonaModalOpen,
    healModalOpen,
    setHealModalOpen,
    entregaModalOpen,
    setEntregaModalOpen,
    aprenderOficioModalOpen,
    setAprenderOficioModalOpen,
    postCombatTarget,
    setPostCombatTarget,
    activeDynamicMode,
    setActiveDynamicMode,
    anyActionModalOpen,
  }
}
