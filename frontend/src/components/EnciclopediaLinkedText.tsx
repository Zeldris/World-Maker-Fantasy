import type { ReactNode } from 'react'
import type { EnciclopediaIndex } from '../lib/enciclopediaIndex'
import type { EnciclopediaLinkTarget } from '../lib/enciclopediaIndex'

interface EnciclopediaLinkedTextProps {
  text: string
  index: EnciclopediaIndex
  onDetail: (target: EnciclopediaLinkTarget) => void
  /// Shift+clic izquierdo (petición explícita, 2026-07-22: "cualquier enlace a la enciclopedia
  /// que mostramos", no solo las tarjetas del panel) — inserta el chip de esa mención directo en
  /// el composer sin navegar a su ficha. Opcional para no romper ningún sitio que no lo necesite.
  onQuickInsert?: (target: EnciclopediaLinkTarget) => void
}

// Enlaza menciones de NPCs/objetos/fauna-flora/lugares/personajes dentro de texto libre —
// narración de turno, diario, o las propias descripciones de la Enciclopedia (2026-07-22,
// petición explícita). Mismo lenguaje visual que el chip de objeto de ChatComposer.tsx
// (`.chip-inline`/`.chip-tooltip`, ver index.css) para que se lea como "el mismo tipo de cosa",
// pero clicable en vez de solo informativo — abre el DetailModal de esa entrada.
export function EnciclopediaLinkedText({ text, index, onDetail, onQuickInsert }: EnciclopediaLinkedTextProps) {
  if (!index.regex) return <>{text}</>

  const matches = Array.from(text.matchAll(index.regex))
  if (matches.length === 0) return <>{text}</>

  const nodes: ReactNode[] = []
  let cursor = 0
  matches.forEach((match, i) => {
    const start = match.index ?? 0
    const matchedText = match[0]
    const target = index.entries.get(matchedText.toLowerCase())
    if (!target) return
    if (start > cursor) nodes.push(text.slice(cursor, start))
    nodes.push(
      <button
        key={`${start}-${i}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (e.shiftKey && onQuickInsert) {
            onQuickInsert(target)
          } else {
            onDetail(target)
          }
        }}
        style={{ cursor: 'pointer' }}
        className="chip-inline relative inline-flex items-center gap-1 rounded-full border border-accent-600/60 bg-accent-500/10 px-2 py-0.5 align-baseline text-xs text-accent-300 transition-colors hover:bg-accent-500/20"
      >
        <span>{target.icon}</span>
        <span className="font-medium">{target.name}</span>
        <span className="chip-tooltip">{target.description}</span>
      </button>,
    )
    cursor = start + matchedText.length
  })
  if (cursor < text.length) nodes.push(text.slice(cursor))

  return <>{nodes}</>
}
