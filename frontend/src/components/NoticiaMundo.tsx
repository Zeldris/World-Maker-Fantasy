import type { ReactNode } from 'react'
import type { NoticiaMeta } from '../types'
import { diaDeFiccion, ICONO_CATEGORIA } from '../lib/noticias'

// UX-38 (hito 0.2, roadmap-front-ux.md § 4.7) — una noticia del canal «El mundo» con su categoría
// (icono), la oportunidad que abre (dónde y hasta qué día) y, si es el resumen de varios días
// («Mientras pasaban los días…», UX-31), plegada con una línea por noticia. Los nombres de
// facciones, lugares y NPC ya son enlaces a su ficha: los pinta `texto` (EnciclopediaLinkedText).

export function NoticiaMundo({ text, noticia, texto }: { text: string; noticia: NoticiaMeta; texto: (t: string) => ReactNode }) {
  if (noticia.resumen) {
    const [cabecera, ...lineas] = text.split('\n')
    return (
      <details className="texto-narracion">
        <summary className="cursor-pointer select-none font-semibold text-wood-200">
          {cabecera} <span className="text-2xs font-normal text-wood-500">({lineas.length} noticias)</span>
        </summary>
        <ul className="mt-1 flex flex-col gap-1 pl-1">
          {lineas.map((l, i) => (
            <li key={i}>{texto(l.replace(/^• /, ''))}</li>
          ))}
        </ul>
      </details>
    )
  }
  const categoria = noticia.categoria ? ICONO_CATEGORIA[noticia.categoria] : null
  return (
    <div>
      <p className="texto-narracion whitespace-pre-line">
        {categoria && (
          <span role="img" aria-label={categoria.label} title={categoria.label} className="mr-1.5 not-italic">
            {categoria.icono}
          </span>
        )}
        {texto(text)}
      </p>
      {noticia.oportunidad && (
        <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-accent-600/50 bg-accent-500/10 px-2 py-0.5 text-2xs text-accent-200">
          <span aria-hidden="true">📍</span>
          En {noticia.oportunidad.lugar} · hasta el día {diaDeFiccion(noticia.oportunidad.venceEn)}
        </p>
      )}
    </div>
  )
}
