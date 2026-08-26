import { useState } from 'react'

/// Deuda técnica (auditoría 2026-08-25): el patrón `try { await accion() } catch (err) {
/// setError(err instanceof Error ? err.message : fallback) }` vivía duplicado byte a byte en 6
/// componentes (CompanionEquipModal, KingdomFoundingModal, TameoModal ×2, AbilityForm,
/// CapturaModal). Mismo criterio que `useAsyncModalData.ts` (que ya unificó el trío loading/error
/// de la carga INICIAL de varios modales de selección) — aquí se unifica la mitad que faltaba, la
/// ACCIÓN DE ENVÍO. Deliberadamente NO incluye `busy`: los 6 sitios originales no comparten la
/// misma forma de "ocupado" (la mayoría es un booleano, pero `CapturaModal` necesita saber QUÉ
/// candidato concreto está en proceso, no solo si hay uno) — cada componente sigue gestionando su
/// propio estado de "ocupado" como antes, este hook solo centraliza capturar y formatear el error.
export function useSubmitError() {
  const [error, setError] = useState<string | null>(null)

  async function runCatchingError<T>(action: () => Promise<T>, fallbackMessage: string): Promise<T | undefined> {
    setError(null)
    try {
      return await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackMessage)
      return undefined
    }
  }

  return { error, setError, runCatchingError }
}
