import { useEffect, useState } from 'react'
import { getHilos, type HiloInfo } from '../../lib/api'

/// CR-17 (hito 0.3, Q6): «Historias en marcha» de Leyendas — los hilos que conoce el personaje
/// (venganzas, deudas, rivalidades…), abiertos arriba y los ya cerrados debajo.
const PATRON: Record<HiloInfo['patron'], { icono: string; label: string }> = {
  VENGANZA: { icono: '🗡️', label: 'Venganza' },
  ASCENSO: { icono: '👑', label: 'Ascenso' },
  CAIDA: { icono: '🏚️', label: 'Caída' },
  DEUDA: { icono: '🤝', label: 'Deuda' },
  RIVALIDAD: { icono: '⚔️', label: 'Rivalidad' },
  REDENCION: { icono: '🕊️', label: 'Redención' },
}

export function HistoriasEnMarcha({ saveId }: { saveId: string }) {
  const [hilos, setHilos] = useState<HiloInfo[] | null>(null)
  const [fallo, setFallo] = useState(false)
  useEffect(() => {
    let vivo = true
    getHilos(saveId)
      .then((r) => vivo && setHilos(r.hilos))
      .catch(() => vivo && setFallo(true))
    return () => {
      vivo = false
    }
  }, [saveId])

  if (fallo) return <p className="text-xs text-danger-300">No se pudieron leer las historias.</p>
  if (!hilos) return <p className="text-xs italic text-wood-500">Leyendo…</p>
  if (hilos.length === 0) return <p className="text-xs text-wood-400">No sabes de ninguna historia en marcha.</p>
  return (
    <ul className="flex flex-col gap-1.5">
      {hilos.map((h) => (
        <li key={h.id} className={`rounded-lg border px-3 py-2 ${h.abierto ? 'border-iron-700 bg-wood-950/40' : 'border-iron-800/60 bg-wood-950/20 opacity-70'}`}>
          <p className="flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] text-wood-400">
            <span aria-hidden="true">{PATRON[h.patron].icono}</span>
            {PATRON[h.patron].label}
            {h.abierto ? (h.tension >= 7 ? <span className="text-danger-300">· tensa</span> : null) : <span>· cerrada</span>}
          </p>
          <p className="mt-0.5 text-xs text-wood-200">{h.resumen}</p>
        </li>
      ))}
    </ul>
  )
}
