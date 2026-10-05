import { useEffect, useMemo, useRef, useState } from 'react'
import { getLeyendas, type EntradaLeyenda, type FamiliaSuceso } from '../../lib/api'
import { agruparCronica, colorDeEntrada, diaDeEntrada, FAMILIA_ESTILO, lineaTemporal, NIVEL_CLASES, porEntidad, type SeccionEntidad } from '../../lib/leyendas'
import { PanelEmptyState } from '../PanelEmptyState'
import { Esqueleto } from '../Esqueleto'

// CR-20 / PAN-9b (hito 0.2, decisiones Q5-Q6 de la Fase E) — Leyendas de tu partida: la crónica tal
// como la conoce el personaje (lo que no sabe no existe aquí, INT-4). Crónica por días o semanas,
// Personajes, Facciones, Lugares y Línea temporal, con filtro por familia. Cada familia con su
// icono y color (INT-1), la importancia como marca y nunca como número (INT-2), y «por qué pasó»
// como cadena de causas que se pueden pulsar (INT-3). Un rumor se ve como rumor, sin detalles.

type Seccion = 'cronica' | SeccionEntidad | 'linea'

const SECCIONES: { id: Seccion; label: string }[] = [
  { id: 'cronica', label: 'Crónica' },
  { id: 'personajes', label: 'Personajes' },
  { id: 'facciones', label: 'Facciones' },
  { id: 'lugares', label: 'Lugares' },
  { id: 'linea', label: 'Línea temporal' },
]

const VIA_LABEL: Record<EntradaLeyenda['via'], string> = {
  TESTIGO: 'Lo viviste',
  OIDAS: 'De oídas',
  NPC: 'Te lo contaron',
  BANDO: 'Bando del tablón',
  ALIADA: 'Aviso de un aliado',
}

function botonClases(activo: boolean): string {
  return `tactile rounded-lg px-2.5 py-1 text-xs transition-colors ${
    activo ? 'bg-wood-950/70 text-accent-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]' : 'text-wood-400 hover:bg-wood-950/40 hover:text-wood-200'
  }`
}

/// Una entrada de Leyendas. `porId` sirve para nombrar sus causas; `irA` lleva a una causa.
export function EntradaLeyendaItem({ entrada: e, porId, irA, resaltada = false }: {
  entrada: EntradaLeyenda
  porId?: Map<string, EntradaLeyenda>
  irA?: (sucesoId: string) => void
  resaltada?: boolean
}) {
  const estilo = FAMILIA_ESTILO[e.familia]
  return (
    <li
      id={`leyenda-${e.sucesoId}`}
      data-nivel={e.nivel}
      className={`relative rounded-lg border-l-2 bg-wood-950/40 px-3 py-2 ${NIVEL_CLASES[e.nivel]} ${e.rumor ? 'italic' : ''} ${resaltada ? 'ring-1 ring-accent-500/60' : ''}`}
    >
      {e.nivel === 'GRAVE' && (
        <span aria-label="Suceso grave" title="Suceso grave" className="animate-stamp-in absolute right-2 top-1.5 h-3 w-3 rounded-full bg-danger-600 shadow-[0_0_0_2px_rgba(0,0,0,0.35)]" />
      )}
      <p className={`text-xs leading-relaxed ${e.rumor ? 'text-wood-300' : 'text-wood-100'}`}>
        <span role="img" aria-label={estilo.label} title={estilo.label} className={`mr-1.5 not-italic ${colorDeEntrada(e)}`}>
          {estilo.icono}
        </span>
        {e.texto}
      </p>
      <p className="mt-0.5 flex flex-wrap gap-x-2 text-2xs not-italic text-wood-500">
        <span>{e.rumor ? `Rumor · lo supiste el día ${diaDeEntrada(e)}` : `Día ${diaDeEntrada(e)}`}</span>
        {(e.lugar?.nombre ?? e.region) && <span>{e.lugar?.nombre ?? e.region}</span>}
        <span>{VIA_LABEL[e.via]}</span>
      </p>
      {e.causas.length > 0 && (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-2xs not-italic text-wood-400">
          <span>Por qué pasó:</span>
          {e.causas.map((id) => {
            const causa = porId?.get(id)
            const contenido = (
              <>
                {causa ? `Día ${diaDeEntrada(causa)}` : 'Antes'}
                {causa && <span className="ml-1 text-wood-500">{causa.texto.length > 40 ? `${causa.texto.slice(0, 40)}…` : causa.texto}</span>}
              </>
            )
            // Sin `irA` (una ficha) la causa se nombra pero no lleva a ningún sitio.
            return irA ? (
              <button key={id} type="button" onClick={() => irA(id)} className="rounded border border-iron-700 px-1.5 py-0.5 text-wood-300 hover:bg-wood-900/60">
                {contenido}
              </button>
            ) : (
              <span key={id} className="rounded border border-iron-800 px-1.5 py-0.5 text-wood-400">
                {contenido}
              </span>
            )
          })}
        </p>
      )}
    </li>
  )
}

export function LeyendasPanel({ saveId, irAlSuceso }: {
  saveId: string
  /// NAR-9: al abrir desde una noticia, la entrada de su suceso (se señala y se lleva a la vista).
  irAlSuceso?: string | null
}) {
  const [entradas, setEntradas] = useState<EntradaLeyenda[] | null>(null)
  const [fallo, setFallo] = useState(false)
  const [seccion, setSeccion] = useState<Seccion>('cronica')
  const [porSemana, setPorSemana] = useState(false)
  const [familia, setFamilia] = useState<FamiliaSuceso | null>(null)
  const [resaltada, setResaltada] = useState<string | null>(null)
  const [siguiente, setSiguiente] = useState<string | null>(null)
  const [cargandoMas, setCargandoMas] = useState(false)

  useEffect(() => {
    let cancelado = false
    setEntradas(null)
    setFallo(false)
    setSiguiente(null)
    getLeyendas(saveId)
      .then((r) => {
        if (cancelado) return
        setEntradas(r.entradas)
        setSiguiente(r.siguiente)
      })
      .catch(() => {
        if (!cancelado) setFallo(true)
      })
    return () => {
      cancelado = true
    }
  }, [saveId])

  const porId = useMemo(() => new Map((entradas ?? []).map((e) => [e.sucesoId, e])), [entradas])
  const visibles = useMemo(() => (entradas ?? []).filter((e) => !familia || e.familia === familia), [entradas, familia])
  const familias = useMemo(() => [...new Set((entradas ?? []).map((e) => e.familia))], [entradas])

  // INT-3: ir a una causa es volver a la Crónica, sin filtro, y señalarla.
  const irA = (id: string) => {
    setSeccion('cronica')
    setFamilia(null)
    setResaltada(id)
    requestAnimationFrame(() => document.getElementById(`leyenda-${id}`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }))
  }
  const irARef = useRef(irA)
  irARef.current = irA
  // NAR-9: abierto desde «Ver en Leyendas», a la entrada de ese suceso en cuanto esté cargada.
  useEffect(() => {
    if (entradas && irAlSuceso && entradas.some((e) => e.sucesoId === irAlSuceso)) irARef.current(irAlSuceso)
  }, [entradas, irAlSuceso])

  // Más de una página: las más antiguas se piden con el cursor de la anterior.
  const verMas = () => {
    if (!siguiente) return
    setCargandoMas(true)
    getLeyendas(saveId, { cursor: siguiente })
      .then((r) => {
        setEntradas((prev) => [...(prev ?? []), ...r.entradas])
        setSiguiente(r.siguiente)
      })
      .catch(() => {})
      .finally(() => setCargandoMas(false))
  }
  const item = (e: EntradaLeyenda) => <EntradaLeyendaItem key={e.sucesoId} entrada={e} porId={porId} irA={irA} resaltada={resaltada === e.sucesoId} />

  if (fallo) return <PanelEmptyState icon="📕" title="No se pudieron leer las Leyendas" hint="Vuelve a abrir el panel en un momento." />
  if (!entradas) return <Esqueleto filas={4} que="las Leyendas" />
  if (entradas.length === 0) {
    return <PanelEmptyState icon="📕" title="Aún no hay leyendas" hint="Lo que vivas, te cuenten o leas en los tablones irá quedando escrito aquí." />
  }

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Secciones de Leyendas" className="flex flex-wrap gap-1">
        {SECCIONES.map((s) => (
          <button key={s.id} type="button" aria-pressed={seccion === s.id} onClick={() => setSeccion(s.id)} className={botonClases(seccion === s.id)}>
            {s.label}
          </button>
        ))}
      </nav>
      <div role="group" aria-label="Filtrar por familia" className="flex flex-wrap gap-1">
        <button type="button" aria-pressed={familia === null} onClick={() => setFamilia(null)} className={botonClases(familia === null)}>
          Todo
        </button>
        {familias.map((f) => (
          <button key={f} type="button" aria-pressed={familia === f} onClick={() => setFamilia(f)} className={botonClases(familia === f)}>
            <span className="mr-1">{FAMILIA_ESTILO[f].icono}</span>
            {FAMILIA_ESTILO[f].label}
          </button>
        ))}
      </div>

      {seccion === 'cronica' && (
        <>
          <label className="flex items-center gap-1.5 self-end text-2xs text-wood-400">
            <input type="checkbox" checked={porSemana} onChange={(ev) => setPorSemana(ev.target.checked)} />
            Por semanas
          </label>
          {agruparCronica(visibles, porSemana ? 'semana' : 'dia').map((g) => (
            <section key={g.clave} aria-label={g.etiqueta}>
              <h3 className="mb-1 font-serif text-xs tracking-wide text-wood-400">{g.etiqueta}</h3>
              <ul className="flex flex-col gap-1.5">{g.entradas.map(item)}</ul>
            </section>
          ))}
        </>
      )}

      {(seccion === 'personajes' || seccion === 'facciones' || seccion === 'lugares') &&
        (() => {
          const grupos = porEntidad(visibles, seccion)
          if (grupos.length === 0) return <p className="text-xs text-wood-400">Nada que contar todavía.</p>
          return grupos.map((g) => (
            <details key={g.clave} className="rounded-lg border border-iron-800 bg-wood-950/30 px-3 py-2">
              <summary className="cursor-pointer text-sm text-wood-200">
                {g.nombre} <span className="text-2xs text-wood-500">· {g.entradas.length}</span>
              </summary>
              <ul className="mt-2 flex flex-col gap-1.5">{g.entradas.map(item)}</ul>
            </details>
          ))
        })()}

      {seccion === 'linea' &&
        (() => {
          const linea = lineaTemporal(visibles)
          if (linea.length === 0) return <p className="text-xs text-wood-400">Aún no ha pasado nada que marque la historia.</p>
          return (
            <ol aria-label="Línea temporal" className="relative flex flex-col gap-2 border-l border-iron-700 pl-3">
              {linea.map(item)}
            </ol>
          )
        })()}

      {siguiente && (
        <button type="button" disabled={cargandoMas} onClick={verMas} className="self-center rounded border border-iron-700 px-3 py-1 text-xs text-wood-300 hover:bg-wood-900/60 disabled:opacity-50">
          {cargandoMas ? 'Leyendo…' : 'Ver más antiguas'}
        </button>
      )}
    </div>
  )
}
