import { useCallback, useEffect, useRef, useState } from 'react'
import { agregarNotificacion, type NuevaNotificacion, type Notificacion } from '../lib/notificaciones'

export const DURACION_NOTIFICACION_MS = 7000

/// HUD-6 (hito 0.2) — pila de notificaciones; cada una se va sola a los 7 s (una repetida vuelve a
/// contar desde cero).
export function useNotificaciones() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const siguienteId = useRef(1)
  const temporizadores = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const descartar = useCallback((id: number) => {
    setNotificaciones((prev) => prev.filter((n) => n.id !== id))
    const t = temporizadores.current.get(id)
    if (t) clearTimeout(t)
    temporizadores.current.delete(id)
  }, [])

  const notificar = useCallback(
    (nueva: NuevaNotificacion) => {
      const id = siguienteId.current++
      setNotificaciones((prev) => {
        const igual = prev.find((n) => n.tipo === nueva.tipo && n.texto === nueva.texto)
        if (igual) {
          const t = temporizadores.current.get(igual.id)
          if (t) clearTimeout(t)
          temporizadores.current.delete(igual.id)
        }
        return agregarNotificacion(prev, nueva, id)
      })
      temporizadores.current.set(
        id,
        setTimeout(() => descartar(id), DURACION_NOTIFICACION_MS),
      )
    },
    [descartar],
  )

  useEffect(() => {
    const mapa = temporizadores.current
    return () => mapa.forEach((t) => clearTimeout(t))
  }, [])

  return { notificaciones, notificar, descartar }
}
