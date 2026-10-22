import { useCallback, useEffect, useState } from 'react'
import { PanelSection } from '../../PanelSection'
import { ErrorBanner } from '../../ErrorBanner'
import { SelectorJuego } from '../../SelectorJuego'
import { GuerraSection } from './GuerraSection'
import { useErrorConReintento } from '../../../hooks/useErrorConReintento'
import { useModoConsulta } from '../../../context/useModoConsulta'
import { getDefensa, postEquiposMilicia, postGuarnicion, postLlamarMilicia, postRepararEdificio, type AsentamientoDefensa, type AvistamientoInfo, type ModuloDefensaInfo } from '../../../lib/api'

const NOMBRE: Record<ModuloDefensaInfo['modulo'], string> = { empalizada: 'Empalizada', 'torre-vigia': 'Torre de vigía', armeria: 'Armería', barracon: 'Barracón' }

/// La misma frase que `MILICIA_SOLO_CAPITAL` del backend (`defensaReino.ts`): la milicia sale de la Capital.
export const MILICIA_SOLO_CAPITAL = 'La milicia sale de la Capital: aquí no vive nadie que armar.'

/// Puro: lo que da un módulo, en una línea («cobertura +2 · aguanta 1 de 2 asaltos»). `armaLaCapital`:
/// si es una Armería, si sus equipos arman a la milicia de la Capital (es de su región); si no, no sirven.
export function efectoDeModulo(m: ModuloDefensaInfo, a: AsentamientoDefensa, armaLaCapital = a.capital): string {
  switch (m.modulo) {
    case 'empalizada':
      return m.danado ? 'dañada: no cubre hasta repararla' : m.caida ? 'caída: no cubre hasta repararla' : `cobertura +${a.efecto.cobertura} · ha encajado ${m.golpes} de ${a.efecto.aguante} asaltos`
    case 'torre-vigia':
      if (m.danado) return 'dañada: no ve venir nada hasta repararla'
      return `ve ${a.efecto.radioTramos} tramo${a.efecto.radioTramos === 1 ? '' : 's'} de camino · +${a.efecto.bonoAltura} al tirar desde lo alto`
    case 'armeria':
      if (m.danado) return 'dañada: sus equipos no cuentan hasta repararla'
      if (!armaLaCapital) return MILICIA_SOLO_CAPITAL
      return `${m.equiposMilicia} de ${a.efecto.equiposMilicia} equipos de milicia`
    case 'barracon':
      if (m.danado) return 'dañado: sin plazas de guarnición hasta repararlo'
      return `${a.efecto.plazasGuarnicion} plazas de guarnición · +${a.efecto.bonoMoral} a la moral`
  }
}

/// CR-65 (65f, Q9): Reino › Defensa — cada asentamiento (la Capital y cada Cuartel Avanzado) con sus
/// módulos de defensa, su guarnición y su milicia, y la alerta de la Torre cuando se ve venir un
/// asalto (X4: alerta de sector), con «Llamar a la milicia».
export function DefensaSection({ saveId, onRefreshSave }: { saveId: string; onRefreshSave: () => Promise<void> }) {
  const [asentamientos, setAsentamientos] = useState<AsentamientoDefensa[] | null>(null)
  const [avistados, setAvistados] = useState<AvistamientoInfo[]>([])
  const [danados, setDanados] = useState<{ id: string; nombre: string }[]>([])
  const [aMover, setAMover] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const { fallo, informar, limpiar } = useErrorConReintento()
  const consulta = useModoConsulta()

  const cargar = useCallback(async () => {
    try {
      const r = await getDefensa(saveId)
      setAsentamientos(r.asentamientos)
      setAvistados(r.avistados)
      setDanados(r.danados ?? [])
    } catch (e) {
      informar('No se pudo cargar la defensa del Reino.', e, () => void cargar())
    }
  }, [saveId, informar])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function accion(fn: () => Promise<unknown>, mensaje: string) {
    setBusy(true)
    try {
      await fn()
      await Promise.all([cargar(), onRefreshSave()])
    } catch (e) {
      informar(mensaje, e)
    } finally {
      setBusy(false)
    }
  }

  if (!asentamientos) return <ErrorBanner fallo={fallo} onCerrar={limpiar} />
  const desactivado = busy || !!consulta
  // Las Armerías que arman a la milicia de la Capital (las de su región, como `planMilicia`): solo en ellas se compran equipos.
  const armeriasDeLaCapital = new Set(asentamientos.filter((a) => a.capital).flatMap((a) => a.modulos.filter((m) => m.modulo === 'armeria').map((m) => m.id)))
  return (
    <div className="flex flex-col gap-5">
      <ErrorBanner fallo={fallo} onCerrar={limpiar} />
      {avistados.length > 0 && (
        <section role="alert" aria-label="Asaltos a la vista" className="rounded-lg border border-red-700/60 bg-red-950/40 px-3 py-2">
          {avistados.map((v) => (
            <div key={`${v.asentamientoId}-${v.viajeroId}`} className="flex flex-wrap items-center gap-3 text-xs text-red-200">
              <span>
                ⚑ {v.quien}: {v.gente} a {v.tramos} tramo{v.tramos === 1 ? '' : 's'} de {v.asentamiento}
              </span>
              {v.sinMilicia && <span className="text-2xs text-red-300/80">{v.sinMilicia}</span>}
              <button type="button" disabled={desactivado || !!v.sinMilicia} title={consulta ?? v.sinMilicia ?? undefined} onClick={() => void accion(() => postLlamarMilicia(saveId, v.asentamientoId), 'No se pudo llamar a la milicia.')} className="tactile text-2xs font-semibold text-accent-300 hover:underline disabled:opacity-50">
                Llamar a la milicia
              </button>
            </div>
          ))}
        </section>
      )}
      {asentamientos.length === 0 && danados.length === 0 && <p className="text-xs text-wood-500">Tu Reino necesita un Ayuntamiento para defenderse.</p>}
      {danados.map((d) => (
        <p key={d.id} className="text-xs text-cost-400">
          {d.nombre} está dañado y no defiende: repáralo en la pestaña Edificios.
        </p>
      ))}
      {asentamientos.map((a) => {
        const otros = asentamientos.filter((x) => x.id !== a.id).flatMap((x) => x.guarnicion)
        const armeria = a.modulos.find((m) => m.modulo === 'armeria')
        return (
          <PanelSection key={a.id} title={`${a.nombre}${a.capital ? ' · Capital' : ''}`}>
            {a.modulos.length === 0 && <p className="text-xs text-wood-500">Sin módulos de defensa: construye una Empalizada, una Torre de vigía, una Armería o un Barracón en {a.region}.</p>}
            <ul className="flex flex-col gap-1.5" aria-label={`Módulos de ${a.nombre}`}>
              {a.modulos.map((m) => (
                <li key={m.id} className="text-xs text-wood-200">
                  <span className="font-medium text-wood-100">{NOMBRE[m.modulo]}</span> <span className="text-wood-500">(escalón {m.escalon})</span> · {efectoDeModulo(m, a, armeriasDeLaCapital.has(m.id))}
                  {(m.caida || m.danado) && (
                    <button type="button" disabled={desactivado} title={consulta ?? undefined} onClick={() => void accion(() => postRepararEdificio(saveId, m.id), 'No se pudo reparar el módulo.')} className="tactile ml-2 text-2xs text-accent-300 hover:underline disabled:opacity-50">
                      Reparar
                    </button>
                  )}
                  {m.modulo === 'armeria' && armeriasDeLaCapital.has(m.id) && m.equiposMilicia < a.efecto.equiposMilicia && (
                    <button type="button" disabled={desactivado} title={consulta ?? undefined} onClick={() => void accion(() => postEquiposMilicia(saveId, m.id, 1), 'No se pudo comprar el equipo.')} className="tactile ml-2 text-2xs text-accent-300 hover:underline disabled:opacity-50">
                      Comprar un equipo
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-2xs text-wood-400">
              Guarnición {a.guarnicion.length}/{a.efecto.plazasGuarnicion}
              {a.guarnicion.length > 0 && `: ${a.guarnicion.map((g) => `${g.nombre}${g.rol === 'vigia' ? ' (vigía)' : ''}`).join(', ')}`}
              {armeria && a.capital && ` · milicia: hasta ${armeria.equiposMilicia}`}
            </p>
            {otros.length > 0 && a.guarnicion.length < a.efecto.plazasGuarnicion && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <SelectorJuego
                  ariaLabel={`Traer a ${a.nombre}`}
                  value={aMover[a.id] ?? ''}
                  opciones={[{ value: '', label: 'Traer soldado…' }, ...otros.map((g) => ({ value: g.id, label: `${g.nombre}${g.rol === 'vigia' ? ' (vigía)' : ''}` }))]}
                  onChange={(v) => setAMover((p) => ({ ...p, [a.id]: v }))}
                  disabled={desactivado}
                />
                <button type="button" disabled={desactivado || !aMover[a.id]} title={consulta ?? undefined} onClick={() => void accion(() => postGuarnicion(saveId, aMover[a.id]!, a.id), 'No se pudo mover al soldado.')} className="tactile text-2xs text-accent-300 hover:underline disabled:opacity-50">
                  Asignar aquí
                </button>
              </div>
            )}
          </PanelSection>
        )
      })}
      <GuerraSection saveId={saveId} onRefreshSave={onRefreshSave} />
    </div>
  )
}
