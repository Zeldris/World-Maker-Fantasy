import { useCallback, useEffect, useState } from 'react'
import { ErrorBanner } from '../ErrorBanner'
import { useErrorConReintento } from '../../hooks/useErrorConReintento'
import { getViajerosAqui, postComprarAViajero, postOrdenPartida, postPreguntarViajero, postVenderAViajero, type ViajeroAqui } from '../../lib/api'
import { SelectorJuego } from '../SelectorJuego'

const ESTADO: Record<ViajeroAqui['estado'], string> = { IDA: 'de camino', TRABAJANDO: 'cazando aquí', VUELTA: 'de vuelta' }

/// CR-63 (63e, Q9 y ADR 0003): los viajeros que están ahora donde estás tú — partidas tuyas o de
/// otras facciones. «Preguntar» (qué han visto por el camino), «Comprar carne» (a las de otras
/// facciones que traen piezas) y, a las tuyas, «Volver a casa».
/// `deZona`: los ids que pinta el mapa de la zona; si cambian (llega o se va alguien), se recarga.
export function ViajerosAqui({ saveId, lugar, deZona, soloConsulta, onRefreshSave }: { saveId: string; lugar: string; deZona?: string; soloConsulta?: boolean; onRefreshSave?: () => Promise<void> }) {
  const [viajeros, setViajeros] = useState<ViajeroAqui[]>([])
  const [vendibles, setVendibles] = useState<{ id: string; name: string; precio: number }[]>([])
  const [aVender, setAVender] = useState('')
  const [relato, setRelato] = useState<{ id: string; lineas: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const { fallo, informar, limpiar } = useErrorConReintento()

  const cargar = useCallback(async () => {
    try {
      const r = await getViajerosAqui(saveId)
      setViajeros(r.viajeros)
      setVendibles(r.vendibles ?? [])
    } catch (e) {
      informar('No se pudo ver quién pasa por aquí.', e, () => void cargar())
    }
  }, [saveId, informar])

  useEffect(() => {
    void cargar()
  }, [cargar, lugar, deZona])

  async function accion(fn: () => Promise<unknown>, mensaje: string) {
    setBusy(true)
    try {
      await fn()
      await Promise.all([cargar(), onRefreshSave?.()])
    } catch (e) {
      informar(mensaje, e)
    } finally {
      setBusy(false)
    }
  }

  if (viajeros.length === 0) return fallo ? <ErrorBanner fallo={fallo} onCerrar={limpiar} /> : null
  const desactivado = busy || soloConsulta
  return (
    <section aria-label="De paso por aquí" className="rounded-lg border border-quest-600/40 bg-wood-950/40 px-3 py-2">
      <ErrorBanner fallo={fallo} onCerrar={limpiar} />
      <p className="text-2xs uppercase tracking-[0.12em] text-quest-300">De paso por aquí</p>
      <ul className="mt-1 flex flex-col gap-2">
        {viajeros.map((v) => (
          <li key={v.id} className="text-xs text-wood-200">
            <p>
              ⚑ {v.propia ? 'Tu' : `La de ${v.quien}:`} {v.que} · {v.gente} · {ESTADO[v.estado]}
              {v.piezas > 0 && <span className="text-emerald-300"> · lleva {v.piezas} pieza{v.piezas === 1 ? '' : 's'}</span>}
            </p>
            <div className="mt-1 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={desactivado}
                onClick={() =>
                  void accion(async () => {
                    const r = await postPreguntarViajero(saveId, v.id)
                    setRelato({ id: v.id, lineas: r.lineas })
                  }, 'No quisieron contarte nada.')
                }
                className="tactile text-2xs text-accent-300 hover:underline disabled:opacity-50"
              >
                Preguntar
              </button>
              {!v.propia && v.piezas > 0 && (
                <button type="button" disabled={desactivado} onClick={() => void accion(() => postComprarAViajero(saveId, v.id), 'No se pudo comprar.')} className="tactile text-2xs text-accent-300 hover:underline disabled:opacity-50">
                  Comprar carne
                </button>
              )}
              {!v.propia && vendibles.length > 0 && (
                <span className="flex items-center gap-2">
                  <SelectorJuego
                    ariaLabel="Qué les vendes"
                    value={vendibles.find((x) => x.id === aVender)?.id ?? vendibles[0]!.id}
                    opciones={vendibles.map((x) => ({ value: x.id, label: `${x.name} (${x.precio} G)` }))}
                    onChange={(id) => setAVender(id)}
                    disabled={desactivado}
                    className="min-w-[8rem] text-2xs"
                  />
                  <button
                    type="button"
                    disabled={desactivado}
                    onClick={() => void accion(() => postVenderAViajero(saveId, v.id, vendibles.find((x) => x.id === aVender)?.id ?? vendibles[0]!.id), 'No te lo compraron.')}
                    className="tactile text-2xs text-accent-300 hover:underline disabled:opacity-50"
                  >
                    Vender
                  </button>
                </span>
              )}
              {v.propia && v.estado !== 'VUELTA' && (
                <button type="button" disabled={desactivado} onClick={() => void accion(() => postOrdenPartida(saveId, v.id, 'volver'), 'No se pudo hacer volver a la partida.')} className="tactile text-2xs text-wood-400 hover:text-wood-200 disabled:opacity-50">
                  Volver a casa
                </button>
              )}
            </div>
            {relato?.id === v.id && (
              <ul aria-label="Lo que cuentan" className="mt-1 flex flex-col gap-0.5 border-l border-quest-600/40 pl-2">
                {relato.lineas.map((l) => (
                  <li key={l} className="text-2xs text-wood-400">
                    {l}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
