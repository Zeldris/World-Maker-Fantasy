import { useEffect, useState } from 'react'
import { getEtiquetas, type EtiquetaInfo } from '../../lib/api'

/// CR-14 (hito 0.3): los títulos que se ha ganado el personaje (Clemente, Verdugo de…), con el
/// suceso que los dio; los perdidos, apagados debajo.
export function EtiquetasSection({ saveId }: { saveId: string }) {
  const [etiquetas, setEtiquetas] = useState<EtiquetaInfo[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let vivo = true
    getEtiquetas(saveId)
      .then((r) => vivo && setEtiquetas(r.etiquetas))
      .catch(() => vivo && setError(true))
    return () => {
      vivo = false
    }
  }, [saveId])

  if (error) return <p className="text-xs text-danger-300">No se pudieron cargar los títulos.</p>
  if (!etiquetas) return <p className="text-xs italic text-wood-500">Cargando títulos…</p>
  if (etiquetas.length === 0) {
    return <p className="text-xs italic text-wood-500">Todavía no te has ganado ningún título. Lo que hagas dirá quién eres.</p>
  }
  const activas = etiquetas.filter((e) => e.activa)
  const perdidas = etiquetas.filter((e) => !e.activa)
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {activas.map((e) => (
          <li key={e.clave} className="rounded-lg border border-accent-700/40 bg-wood-950/50 px-3 py-2">
            <p className="font-serif text-sm text-accent-200">{e.texto}</p>
            {e.porque && <p className="mt-0.5 text-2xs text-wood-400">{e.porque}</p>}
          </li>
        ))}
      </ul>
      {perdidas.length > 0 && (
        <div>
          <p className="mb-1 text-2xs uppercase tracking-[0.15em] text-wood-500">Ya no</p>
          <ul className="flex flex-col gap-1">
            {perdidas.map((e) => (
              <li key={e.clave} className="px-3 text-xs text-wood-500 line-through">
                {e.texto}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
