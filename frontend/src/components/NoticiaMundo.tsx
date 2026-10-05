import { useState, type ReactNode } from 'react'
import type { NoticiaMeta, RespuestaPropuesta } from '../types'
import { diaDeFiccion, ICONO_CATEGORIA } from '../lib/noticias'

// UX-38 (hito 0.2, roadmap-front-ux.md § 4.7) — una noticia del canal «El mundo» con su categoría
// (icono), la oportunidad que abre (dónde y hasta qué día) y, si es el resumen de varios días
// («Mientras pasaban los días…», UX-31), plegada con una línea por noticia. Los nombres de
// facciones, lugares y NPC ya son enlaces a su ficha: los pinta `texto` (EnciclopediaLinkedText).
//
// CR-34 (34e, Q15): una propuesta de tratado o alianza de una facción al Reino lleva Aceptar y
// Rechazar mientras está pendiente; después, la respuesta.
//
// NAR-9 (Fase E, Q8): un rumor sin confirmar va en estilo pergamino, con la región de donde viene y
// el día en que pasó en una etiqueta aparte, y un enlace a su entrada de Leyendas.

export type ResponderPropuesta = (propuestaId: string, acepta: boolean) => Promise<RespuestaPropuesta>

const ETIQUETA_RESPUESTA: Record<RespuestaPropuesta, string> = { ACEPTADA: 'Aceptada', RECHAZADA: 'Rechazada', CADUCADA: 'Sin respuesta: rechazada' }

function Propuesta({ propuesta, onResponder }: { propuesta: NonNullable<NoticiaMeta['propuesta']>; onResponder?: ResponderPropuesta }) {
  const [respuesta, setRespuesta] = useState<RespuestaPropuesta | undefined>(propuesta.respuesta)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (respuesta) {
    return <span className="mt-1 block text-2xs text-wood-400">{ETIQUETA_RESPUESTA[respuesta]}</span>
  }
  const responder = async (acepta: boolean) => {
    if (!onResponder) return
    setEnviando(true)
    setError(null)
    try {
      setRespuesta(await onResponder(propuesta.id, acepta))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo responder')
    } finally {
      setEnviando(false)
    }
  }
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-2 not-italic">
      <span className="text-2xs text-wood-400">Hasta el día {diaDeFiccion(propuesta.venceEn)}</span>
      <button type="button" disabled={enviando || !onResponder} onClick={() => responder(true)} className="rounded border border-accent-600/60 bg-accent-500/15 px-2 py-0.5 text-xs text-accent-100 hover:bg-accent-500/25 disabled:opacity-50">
        Aceptar
      </button>
      <button type="button" disabled={enviando || !onResponder} onClick={() => responder(false)} className="rounded border border-wood-600/60 px-2 py-0.5 text-xs text-wood-200 hover:bg-wood-700/40 disabled:opacity-50">
        Rechazar
      </button>
      {error && <span className="text-2xs text-red-300">{error}</span>}
    </span>
  )
}

function Linea({ text, noticia, texto }: { text: string; noticia: NoticiaMeta | null; texto: (t: string) => ReactNode }) {
  const categoria = noticia?.categoria ? ICONO_CATEGORIA[noticia.categoria] : null
  return (
    <>
      {categoria && (
        <span role="img" aria-label={categoria.label} title={categoria.label} className="mr-1.5 not-italic">
          {categoria.icono}
        </span>
      )}
      {texto(text)}
      {noticia?.rumor && (
        <span className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-wood-600/50 bg-wood-800/40 px-2 py-0.5 text-2xs not-italic text-wood-300">
          <span aria-hidden="true">📜</span>
          {noticia.rumor.region ? `Desde ${noticia.rumor.region} · ` : ''}pasó el día {diaDeFiccion(noticia.rumor.pasoEn)}
        </span>
      )}
      {noticia?.oportunidad && (
        <span className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-accent-600/50 bg-accent-500/10 px-2 py-0.5 text-2xs text-accent-200">
          <span aria-hidden="true">📍</span>
          En {noticia.oportunidad.lugar} · hasta el día {diaDeFiccion(noticia.oportunidad.venceEn)}
        </span>
      )}
    </>
  )
}

export function NoticiaMundo({ text, noticia, texto, onResponderPropuesta, onVerLeyendas }: {
  text: string
  noticia: NoticiaMeta
  texto: (t: string) => ReactNode
  onResponderPropuesta?: ResponderPropuesta
  /// NAR-9: abre el panel de Leyendas.
  onVerLeyendas?: () => void
}) {
  if (noticia.resumen) {
    const [cabecera, ...lineas] = text.split('\n')
    return (
      <details className="texto-narracion">
        <summary className="cursor-pointer select-none font-semibold text-wood-200">
          {cabecera} <span className="text-2xs font-normal text-wood-500">({lineas.length} noticias)</span>
        </summary>
        <ul className="mt-1 flex flex-col gap-1 pl-1">
          {lineas.map((l, i) => (
            <li key={i}>
              <Linea text={l.replace(/^• /, '')} noticia={noticia.lineas?.[i] ?? null} texto={texto} />
            </li>
          ))}
        </ul>
      </details>
    )
  }
  return (
    <p className={`texto-narracion whitespace-pre-line ${noticia.rumor ? 'rounded border-l-2 border-wood-600/60 bg-wood-900/30 px-2 py-1 italic' : ''}`}>
      <Linea text={text} noticia={noticia} texto={texto} />
      {noticia.propuesta && <Propuesta propuesta={noticia.propuesta} onResponder={onResponderPropuesta} />}
      {noticia.sucesoId && onVerLeyendas && (
        <button type="button" onClick={onVerLeyendas} className="ml-1.5 text-2xs not-italic text-accent2-300 underline-offset-2 hover:underline">
          Ver en Leyendas
        </button>
      )}
    </p>
  )
}
