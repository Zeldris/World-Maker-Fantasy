import { useEffect, useState } from 'react'
import { deleteObra, getObras, putOrdenObras, type CasaDeObrasInfo } from '../../../lib/api'
import { PanelSection } from '../../PanelSection'

/// Casa de obras (P277/P284, diseño 2026-10-21): la cola de obras y reparaciones que trabajan los
/// súbditos constructores, día a día. Se reordena (la primera que su nivel alcanza es la que toman)
/// y se quitan obras; el aviso «🔒N» dice por qué una obra no avanza.
export function CasaDeObrasCola({ saveId, version = 0 }: { saveId: string; version?: number }) {
  const [datos, setDatos] = useState<CasaDeObrasInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    getObras(saveId)
      .then((d) => { if (vivo) setDatos(d) })
      .catch((e) => { if (vivo) setError(e instanceof Error ? e.message : 'No se pudo leer la Casa de obras.') })
    return () => { vivo = false }
  }, [saveId, version, recarga])

  /// `deshacer`: si la petición falla, vuelve atrás lo que se pintó por adelantado; además se relee
  /// la cola del servidor y se enseña el error.
  const hacer = async (accion: () => Promise<unknown>, deshacer?: () => void) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await accion()
      setRecarga((n) => n + 1)
    } catch (e) {
      deshacer?.()
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la cola.')
      setRecarga((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }
  const mover = (i: number, delta: -1 | 1) => {
    if (!datos) return
    const ids = datos.cola.map((o) => o.id)
    const j = i + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    const antes = datos
    setDatos({ ...datos, cola: ids.map((id) => datos.cola.find((o) => o.id === id)!) })
    void hacer(() => putOrdenObras(saveId, ids), () => setDatos(antes))
  }

  if (!datos) return error ? <p role="alert" className="text-2xs text-cost-400">{error}</p> : null
  const { casa, constructores, cola } = datos
  return (
    <PanelSection title="Casa de obras">
      {casa ? (
        <p className="mb-1.5 text-2xs text-wood-400">
          Nivel {casa.nivel}: obras hasta tier {casa.tierMaximo} · constructores {constructores.length}/{casa.plazas}
          {constructores.length > 0 && ` (${constructores.map((c) => `${c.name}, nivel ${c.nivel}`).join('; ')})`}
        </p>
      ) : (
        <p className="mb-1.5 text-2xs text-wood-500">Sin Casa de obras: constrúyela para encargar obras de más de tier 3 y reparaciones.</p>
      )}
      {error && <p role="alert" className="mb-1.5 text-2xs text-cost-400">{error}</p>}
      {cola.length === 0 ? (
        <p className="text-2xs text-wood-500">La cola está vacía.</p>
      ) : (
        <ol className="flex flex-col gap-1.5" aria-label="Cola de obras">
          {cola.map((o, i) => (
            <li key={o.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-sm text-wood-100">
                <span>
                  {i + 1}. {o.nombre} <span className="text-2xs text-wood-400">T{o.tier} · día {o.diasHechos}/{o.dias}</span>
                </span>
                <span className="flex gap-1 text-2xs">
                  <button type="button" aria-label={`Subir ${o.nombre}`} disabled={busy || i === 0} onClick={() => mover(i, -1)} className="tactile rounded border border-iron-700 px-1.5 disabled:opacity-40">▲</button>
                  <button type="button" aria-label={`Bajar ${o.nombre}`} disabled={busy || i === cola.length - 1} onClick={() => mover(i, 1)} className="tactile rounded border border-iron-700 px-1.5 disabled:opacity-40">▼</button>
                  <button type="button" aria-label={`Quitar ${o.nombre}`} disabled={busy} onClick={() => void hacer(() => deleteObra(saveId, o.id))} className="tactile rounded border border-iron-700 px-1.5 text-cost-400 disabled:opacity-40">✕</button>
                </span>
              </div>
              {o.aviso && <p className="mt-0.5 text-2xs text-cost-400" role="status">{o.aviso}</p>}
            </li>
          ))}
        </ol>
      )}
    </PanelSection>
  )
}
