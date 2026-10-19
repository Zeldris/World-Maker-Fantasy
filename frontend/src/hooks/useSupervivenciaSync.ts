import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { getSave } from '../lib/api'
import type { CondicionFisica } from '../types'

const SUPERVIVENCIA_INTERVAL_MS = 60_000

/// P219 (c): el worker de fondo baja la condición por Hambre/Sed directamente en BD, así que el HUD
/// enseñaba la que traía el último turno («Grave 50») y tras recargar la real («Convaleciente 25»).
/// Este sondeo vuelve a leer solo condición, Hambre y Sed cuando no hay turno ni combate en curso.
export function useSupervivenciaSync(params: {
  saveId: string | null
  characterThinking: boolean
  combatActive: boolean
  setCondicionFisica: Dispatch<SetStateAction<CondicionFisica>>
  setHambre: Dispatch<SetStateAction<number>>
  setSed: Dispatch<SetStateAction<number>>
}): void {
  const { saveId } = params
  const ref = useRef(params)
  useEffect(() => {
    ref.current = params
  })
  useEffect(() => {
    if (!saveId) return
    let cancelled = false
    const tick = async () => {
      if (ref.current.characterThinking || ref.current.combatActive) return
      try {
        const save = await getSave(saveId)
        // Un turno pudo empezar mientras llegaba la respuesta: no pisar su resultado.
        if (cancelled || ref.current.characterThinking || ref.current.combatActive) return
        ref.current.setCondicionFisica(save.condicionFisica)
        ref.current.setHambre(save.hambre)
        ref.current.setSed(save.sed)
      } catch {
        // Sin red: se reintenta en el siguiente tick.
      }
    }
    const interval = setInterval(() => void tick(), SUPERVIVENCIA_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [saveId])
}
