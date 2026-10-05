import { useCallback, useMemo, useState } from 'react'
import type { LogEntry } from '../types'
import { rumoresConLugar, type RumorConLugar } from '../lib/leyendas'

// INT-9 (hito 0.2) — rumores con lugar para el mapa de Berig: la región se marca con un pergamino
// hasta que se leen (al seleccionarla en el mapa). Lo leído es una comodidad de este navegador
// (`localStorage`, por partida); si no se puede guardar, simplemente vuelve a marcarse.

const clave = (saveId: string) => `tarkor.rumoresLeidos.${saveId}`

function leer(saveId: string | null): Set<string> {
  if (!saveId) return new Set()
  try {
    const crudo = localStorage.getItem(clave(saveId))
    return new Set(crudo ? (JSON.parse(crudo) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function useRumoresDelMapa(saveId: string | null, worldLog: LogEntry[]) {
  const [leidos, setLeidos] = useState<Set<string>>(() => leer(saveId))
  const [saveIdLeido, setSaveIdLeido] = useState(saveId)
  if (saveId !== saveIdLeido) {
    setSaveIdLeido(saveId)
    setLeidos(leer(saveId))
  }

  const rumores = useMemo(() => rumoresConLugar(worldLog), [worldLog])
  const sinLeer = useMemo(() => new Set(rumores.filter((r) => !leidos.has(r.sucesoId)).map((r) => r.region)), [rumores, leidos])

  const marcarLeidos = useCallback(
    (region: string) => {
      const nuevos = rumores.filter((r) => r.region === region && !leidos.has(r.sucesoId))
      if (nuevos.length === 0 || !saveId) return
      const todos = new Set([...leidos, ...nuevos.map((r) => r.sucesoId)])
      setLeidos(todos)
      try {
        localStorage.setItem(clave(saveId), JSON.stringify([...todos].slice(-500)))
      } catch {
        // Sin almacenamiento: solo se pierde que estaban leídos.
      }
    },
    [rumores, leidos, saveId],
  )

  return { rumores, sinLeer, marcarLeidos } as { rumores: RumorConLugar[]; sinLeer: Set<string>; marcarLeidos: (region: string) => void }
}
