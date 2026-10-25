import { useCallback, useEffect, useState } from 'react'
import { PanelSection } from '../../PanelSection'
import { ErrorBanner } from '../../ErrorBanner'
import { SelectorJuego } from '../../SelectorJuego'
import { useErrorConReintento } from '../../../hooks/useErrorConReintento'
import { useModoConsulta } from '../../../context/useModoConsulta'
import { getPartidas, postAtacarCampamento, postLanzarPartida, postOrdenPartida, type CampamentoInfo, type OpcionesPartida, type PartidaInfo } from '../../../lib/api'
import { CampamentosBandidos } from './CampamentosBandidos'

const ESTADO: Record<PartidaInfo['estado'], string> = {
  IDA: 'de camino',
  TRABAJANDO: 'en el coto',
  VUELTA: 'de vuelta',
  TERMINADO: 'en casa',
}

/// Puro: «Caza de Múrgol · de camino, en Los Pilares → La Hondonada».
export function lineaDePartida(p: PartidaInfo): string {
  const que = p.tipo === 'ATAQUE' ? 'Ataque al campamento' : p.tipo === 'ATAQUE_ASENTAMIENTO' ? 'Ataque a su casa' : `${p.tipo === 'CAPTURA' ? 'Captura' : 'Caza'} de ${p.especieNombre ?? 'presas'}`
  // P283: la que ya volvió dice desde qué día está en casa.
  const donde = p.estado === 'TERMINADO' ? (p.vueltaDia != null ? `${ESTADO.TERMINADO} desde el día ${p.vueltaDia}` : ESTADO.TERMINADO) : `${ESTADO[p.estado]}, en ${p.ubicacion} → ${p.destino}`
  return `${que} · ${donde}`
}

/// Puro: lo que trae una partida.
export function cargaDePartida(p: PartidaInfo): string | null {
  const partes = [p.carga?.piezas ? `${p.carga.piezas} pieza${p.carga.piezas === 1 ? '' : 's'}` : null, p.carga?.capturados ? `${p.carga.capturados} atado${p.carga.capturados === 1 ? '' : 's'}` : null].filter(Boolean)
  return partes.length > 0 ? `Trae ${partes.join(' y ')}` : null
}

/// CR-63 (63d, Q3/Q7): Reino › Partidas — las partidas de caza y captura del Reino (por dónde van y
/// qué traen, con sus órdenes) y el formulario para lanzar una nueva: tipo, lugar que conoces,
/// especie que has visto allí, quién va (tus grupos 2+ y súbditos cazadores) y si repite.
export function PartidasSection({ saveId, onRefreshSave }: { saveId: string; onRefreshSave: () => Promise<void> }) {
  const [partidas, setPartidas] = useState<PartidaInfo[]>([])
  const [opciones, setOpciones] = useState<OpcionesPartida | null>(null)
  const [campamentos, setCampamentos] = useState<CampamentoInfo[]>([])
  const [guerreros, setGuerreros] = useState<{ id: string; name: string; rol: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [tipo, setTipo] = useState<'CAZA' | 'CAPTURA'>('CAZA')
  const [destinoId, setDestinoId] = useState('')
  const [especie, setEspecie] = useState('')
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [permanente, setPermanente] = useState(false)
  const { fallo, informar, limpiar } = useErrorConReintento()
  const consulta = useModoConsulta()

  const cargar = useCallback(async () => {
    try {
      const r = await getPartidas(saveId)
      setPartidas(r.partidas)
      setOpciones(r.opciones)
      setCampamentos(r.campamentos ?? [])
      setGuerreros(r.guerreros ?? [])
    } catch (e) {
      informar('No se pudieron cargar las partidas.', e, () => void cargar())
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

  if (!opciones) return <ErrorBanner fallo={fallo} onCerrar={limpiar} />
  const destino = opciones.destinos.find((d) => d.id === destinoId) ?? opciones.destinos[0]
  const especies = (destino?.especies ?? []).filter((e) => tipo === 'CAZA' || e.capturable)
  const especieElegida = especies.find((e) => e.slug === especie) ?? especies[0]
  const companerosIds = new Set(opciones.grupos.flatMap((g) => g.companeros.map((c) => c.id)))
  const companionIds = [...elegidos].filter((id) => companerosIds.has(id))
  const subjectIds = [...elegidos].filter((id) => opciones.cazadores.some((c) => c.id === id && !c.sinArma))
  const alternar = (id: string) =>
    setElegidos((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  const enMarcha = partidas.filter((p) => p.estado !== 'TERMINADO')
  const vueltas = partidas.filter((p) => p.estado === 'TERMINADO')
  const nadieDisponible = opciones.cazadores.length === 0 && opciones.grupos.length === 0
  // P283: «fuera» no es «no tienes»: sus cazadores vuelven y se les puede mandar otra vez.
  const fuera = opciones.cazadoresFuera ?? []
  // P281 (Q3): sin arma no salen; se ven en la lista, marcados, para saber por qué.
  const sinArma = opciones.cazadores.filter((c) => c.sinArma)

  return (
    <div className="flex flex-col gap-5">
      <ErrorBanner fallo={fallo} onCerrar={limpiar} />
      <PanelSection title="En marcha">
        {enMarcha.length === 0 && <p className="text-xs text-wood-500">Ninguna partida fuera ahora mismo.</p>}
        <ul className="flex flex-col gap-2">
          {enMarcha.map((p) => (
            <li key={p.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2" aria-label={lineaDePartida(p)}>
              <p className="text-xs font-medium text-wood-100">{lineaDePartida(p)}</p>
              <p className="text-2xs text-wood-400">
                {p.miembros.join(', ')}
                {p.permanente && ' · 🔁 repite'}
              </p>
              {cargaDePartida(p) && <p className="text-2xs text-emerald-300">{cargaDePartida(p)}</p>}
              <div className="mt-1.5 flex gap-3">
                {p.permanente && (
                  <button type="button" disabled={busy || !!consulta} title={consulta ?? undefined} onClick={() => void accion(() => postOrdenPartida(saveId, p.id, 'parar'), 'No se pudo parar la orden.')} className="tactile text-2xs text-accent-300 hover:underline disabled:opacity-50">
                    No repetir
                  </button>
                )}
                {p.estado !== 'VUELTA' && (
                  <button type="button" disabled={busy || !!consulta} title={consulta ?? undefined} onClick={() => void accion(() => postOrdenPartida(saveId, p.id, 'volver'), 'No se pudo hacer volver a la partida.')} className="tactile text-2xs text-wood-400 hover:text-wood-200 disabled:opacity-50">
                    Volver a casa
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {vueltas.length > 0 && (
          <ul className="mt-3 flex flex-col gap-0.5" aria-label="Partidas que volvieron">
            {vueltas.map((p) => (
              <li key={p.id} className="text-2xs text-wood-500">
                {lineaDePartida(p)}
                {cargaDePartida(p) ? ` · ${cargaDePartida(p)}` : ' · sin presas'}
                {!cargaDePartida(p) && p.carga?.resumen && <span className="block text-wood-400">{p.carga.resumen}</span>}
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      <PanelSection title="Nueva partida">
        {!opciones.origen && <p className="text-xs text-wood-500">Tu Reino necesita un edificio desde el que salir.</p>}
        {opciones.origen && opciones.destinos.length === 0 && <p className="text-xs text-wood-500">Ahora mismo no hay ningún lugar que conozcas con presas a la vista: o aún no has explorado donde las hay, o ya cazaste las de los que conoces, o ninguno tiene camino desde tu Reino. Explora otros lugares antes de mandar a nadie.</p>}
        {opciones.origen && nadieDisponible && (
          <p className="text-xs text-wood-500">
            {fuera.length > 0
              ? `Tus cazadores (${fuera.join(', ')}) están fuera con una partida: cuando vuelvan podrás mandarlos otra vez.`
              : 'No hay nadie libre: da a algún súbdito el rol de cazador (Súbditos) o forma un grupo de combate 2 o más.'}
          </p>
        )}
        {opciones.origen && destino && !nadieDisponible && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <SelectorJuego
                ariaLabel="Tipo de partida"
                value={tipo}
                opciones={[
                  { value: 'CAZA', label: 'Caza', descripcion: 'Vuelve con piezas que se estropean en 3 días: el Desolladero las aprovecha.' },
                  { value: 'CAPTURA', label: 'Captura', descripcion: 'Lleva cuerdas y necesita una Jaula libre: trae los animales atados.' },
                ]}
                onChange={(v) => setTipo(v)}
                className="min-w-[7rem]"
              />
              <SelectorJuego ariaLabel="Destino" value={destino.id} opciones={opciones.destinos.map((d) => ({ value: d.id, label: d.name, descripcion: d.region }))} onChange={(v) => setDestinoId(v)} className="min-w-[10rem]" />
              {especieElegida ? (
                <SelectorJuego ariaLabel="Especie" value={especieElegida.slug} opciones={especies.map((e) => ({ value: e.slug, label: e.name, descripcion: `${e.cantidad} a la vista` }))} onChange={(v) => setEspecie(v)} className="min-w-[8rem]" />
              ) : (
                <span className="text-2xs text-wood-500">Nada que se pueda capturar allí.</span>
              )}
            </div>
            <fieldset className="flex flex-col gap-1">
              <legend className="text-2xs uppercase tracking-[0.12em] text-wood-500">Quién va</legend>
              {[...opciones.grupos.map((g) => ({ titulo: g.nombre, gente: g.companeros })), ...(opciones.cazadores.length > 0 ? [{ titulo: 'Cazadores', gente: opciones.cazadores }] : [])].map((bloque) => (
                <div key={bloque.titulo} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-2xs text-wood-400">{bloque.titulo}:</span>
                  {bloque.gente.map((g) => (
                    <label key={g.id} className="flex items-center gap-1 text-2xs text-wood-200">
                      <input type="checkbox" checked={elegidos.has(g.id)} disabled={'sinArma' in g && !!g.sinArma} onChange={() => alternar(g.id)} />
                      {g.name}
                      {'sinArma' in g && !!g.sinArma && <span className="text-amber-300"> (sin arma)</span>}
                    </label>
                  ))}
                </div>
              ))}
            </fieldset>
            {sinArma.length > 0 && (
              <p className="text-2xs text-amber-300" role="status">
                {sinArma.map((c) => c.name).join(', ')} no {sinArma.length === 1 ? 'tiene' : 'tienen'} arma: un cazador sale armado como un soldado, así que no puede ir hasta que el Reino le dé una.
              </p>
            )}
            <label className="flex items-center gap-1.5 text-2xs text-wood-300">
              <input type="checkbox" checked={permanente} onChange={(e) => setPermanente(e.target.checked)} />
              Orden permanente: al volver y descargar, sale otra vez (se para si cae alguien).
            </label>
            <button
              type="button"
              disabled={busy || !!consulta || !especieElegida || companionIds.length + subjectIds.length === 0}
              title={consulta ?? undefined}
              onClick={() =>
                void accion(async () => {
                  await postLanzarPartida(saveId, { tipo, especie: especieElegida!.slug, destinoLocationId: destino.id, companionIds, subjectIds, permanente })
                  setElegidos(new Set())
                }, 'No se pudo lanzar la partida.')
              }
              className="tactile self-start rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-wood-950 disabled:opacity-50"
            >
              Lanzar partida ({companionIds.length + subjectIds.length})
            </button>
          </div>
        )}
      </PanelSection>
      <CampamentosBandidos
        campamentos={campamentos}
        grupos={opciones.grupos}
        guerreros={guerreros}
        desactivado={busy || !!consulta}
        title={consulta ?? undefined}
        onAtacar={async (id, p) => {
          let ok = false
          await accion(async () => {
            await postAtacarCampamento(saveId, id, p)
            ok = true
          }, 'No se pudo mandar la partida.')
          return ok
        }}
      />
    </div>
  )
}
