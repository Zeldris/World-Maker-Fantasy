import { useCallback, useEffect, useState } from 'react'
import { PanelSection } from '../../PanelSection'
import { ErrorBanner } from '../../ErrorBanner'
import { useErrorConReintento } from '../../../hooks/useErrorConReintento'
import { useModoConsulta } from '../../../context/useModoConsulta'
import { getGuerra, getPartidas, postAtacarAsentamiento, postTributo, type EnemigaInfo, type OpcionesPartida } from '../../../lib/api'

/// CR-37 (37c, Q4-Q5): con quién está en guerra o en tensión el Reino (y cuánta presión hay), el
/// tributo para calmarla (cada 100 Goirnos la baja; referencia: Bannerlord) y el contraataque a la casa
/// de quien está en guerra (X4: ir a por sus estaciones). Los ejércitos que vienen se ven en la alerta
/// de la Torre (Reino › Defensa) y en el mapa.
export function GuerraSection({ saveId, onRefreshSave }: { saveId: string; onRefreshSave: () => Promise<void> }) {
  const [enemigas, setEnemigas] = useState<EnemigaInfo[]>([])
  const [grupos, setGrupos] = useState<OpcionesPartida['grupos']>([])
  const [guerreros, setGuerreros] = useState<{ id: string; name: string }[]>([])
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const { fallo, informar, limpiar } = useErrorConReintento()
  const consulta = useModoConsulta()

  const cargar = useCallback(async () => {
    try {
      const [g, p] = await Promise.all([getGuerra(saveId), getPartidas(saveId)])
      setEnemigas(g.enemigas)
      setGrupos(p.opciones.grupos)
      setGuerreros(p.guerreros ?? [])
    } catch (e) {
      informar('No se pudo cargar la guerra.', e, () => void cargar())
    }
  }, [saveId, informar])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function accion(fn: () => Promise<unknown>, mensaje: string): Promise<boolean> {
    setBusy(true)
    try {
      await fn()
      await Promise.all([cargar(), onRefreshSave()])
      return true
    } catch (e) {
      informar(mensaje, e)
      return false
    } finally {
      setBusy(false)
    }
  }

  const companeros = new Set(grupos.flatMap((g) => g.companeros.map((c) => c.id)))
  const companionIds = [...elegidos].filter((id) => companeros.has(id))
  const subjectIds = [...elegidos].filter((id) => guerreros.some((g) => g.id === id))
  const alternar = (id: string) =>
    setElegidos((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  const desactivado = busy || !!consulta
  const enGuerra = enemigas.filter((e) => e.relacion === 'GUERRA')

  return (
    <PanelSection title="Guerra">
      <ErrorBanner fallo={fallo} onCerrar={limpiar} />
      {enemigas.length === 0 ? (
        <p className="text-xs text-wood-500">Nadie está en guerra ni en tensión con tu Reino.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-1.5" aria-label="Facciones en guerra o tensión">
            {enemigas.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 text-xs text-wood-200">
                <span>
                  <span className="font-medium text-wood-100">{e.nombre}</span> · <span className={e.relacion === 'GUERRA' ? 'text-red-300' : 'text-amber-300'}>{e.relacion === 'GUERRA' ? 'en guerra' : 'en tensión'}</span>
                </span>
                {[100, 300].map((g) => (
                  <button key={g} type="button" disabled={desactivado} title={consulta ?? undefined} onClick={() => void accion(() => postTributo(saveId, e.id, g), 'No se pudo pagar el tributo.')} className="tactile text-2xs text-accent-300 hover:underline disabled:opacity-50">
                    Tributo de {g}
                  </button>
                ))}
                {e.relacion === 'GUERRA' && (
                  <button
                    type="button"
                    disabled={desactivado || companionIds.length + subjectIds.length === 0}
                    title={consulta ?? undefined}
                    onClick={() =>
                      void accion(() => postAtacarAsentamiento(saveId, e.id, { companionIds, subjectIds }), 'No se pudo mandar la partida.').then((ok) => {
                        if (ok) setElegidos(new Set())
                      })
                    }
                    className="tactile text-2xs font-semibold text-red-300 hover:underline disabled:opacity-50"
                  >
                    Atacar su casa ({companionIds.length + subjectIds.length})
                  </button>
                )}
              </li>
            ))}
          </ul>
          {enGuerra.length > 0 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="text-2xs uppercase tracking-[0.12em] text-wood-500">Quién va al contraataque</legend>
              {[...grupos.map((g) => ({ titulo: g.nombre, gente: g.companeros })), ...(guerreros.length > 0 ? [{ titulo: 'Súbditos', gente: guerreros }] : [])].map((bloque) => (
                <div key={bloque.titulo} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-2xs text-wood-400">{bloque.titulo}:</span>
                  {bloque.gente.map((g) => (
                    <label key={g.id} className="flex items-center gap-1 text-2xs text-wood-200">
                      <input type="checkbox" checked={elegidos.has(g.id)} onChange={() => alternar(g.id)} aria-label={`${g.name} al contraataque`} />
                      {g.name}
                    </label>
                  ))}
                </div>
              ))}
            </fieldset>
          )}
        </div>
      )}
    </PanelSection>
  )
}
