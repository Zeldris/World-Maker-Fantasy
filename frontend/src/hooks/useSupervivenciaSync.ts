import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { getSupervivencia } from '../lib/api'
import type { CondicionFisica } from '../types'

const SUPERVIVENCIA_INTERVAL_MS = 60_000
const ORDEN_CONDICION: CondicionFisica[] = ['ILESO', 'HERIDO', 'GRAVE', 'CONVALECIENTE', 'MUERTO']

/// P219 (c): el worker de fondo baja la condición por Hambre/Sed directamente en BD, así que el HUD
/// enseñaba la que traía el último turno («Grave 50») y tras recargar la real («Convaleciente 25»).
/// Este sondeo vuelve a leer solo condición, Hambre y Sed cuando no hay turno ni combate en curso.
export function useSupervivenciaSync(params: {
  saveId: string | null
  characterThinking: boolean
  combatActive: boolean
  /// Condición que ve ahora el HUD: con ella se sabe si el sondeo la ha empeorado.
  condicionFisica: CondicionFisica
  /// P323: el sondeo ha visto que la condición empeoró por hambre o sed; `aviso` es el texto del motor.
  alEmpeorar?: (aviso: string) => void
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
        const save = await getSupervivencia(saveId)
        // Un turno pudo empezar mientras llegaba la respuesta: no pisar su resultado.
        if (cancelled || ref.current.characterThinking || ref.current.combatActive) return
        // P323: el diario de la BD lleva el aviso, pero el de la pantalla no lo recarga: sin esto la condición bajaba sin avisar.
        if (save.aviso && ORDEN_CONDICION.indexOf(save.condicionFisica) > ORDEN_CONDICION.indexOf(ref.current.condicionFisica)) {
          ref.current.alEmpeorar?.(save.aviso)
        }
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
