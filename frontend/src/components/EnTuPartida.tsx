import { useEffect, useMemo, useState } from 'react'
import { getLeyendasFicha, type EntradaLeyenda } from '../lib/api'
import { EntradaLeyendaItem } from './panels/LeyendasPanel'
import type { FichaConLeyendas } from '../lib/leyendas'

// CR-20 (20b, hito 0.2 — roadmap-cronista.md § 14 «Fichas vivas») — sección «En tu partida» de una
// ficha de la Enciclopedia: lo que el personaje sabe de ese NPC, facción o lugar en esta partida,
// con el mismo aspecto que en Leyendas. Si no sabe nada, la sección no aparece (INT-4).

export function EnTuPartida({ saveId, ficha, slug }: { saveId: string; ficha: FichaConLeyendas; slug: string }) {
  const [entradas, setEntradas] = useState<EntradaLeyenda[]>([])

  useEffect(() => {
    let cancelado = false
    setEntradas([])
    getLeyendasFicha(saveId, ficha, slug)
      .then((r) => {
        if (!cancelado) setEntradas(r.entradas)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [saveId, ficha, slug])

  const porId = useMemo(() => new Map(entradas.map((e) => [e.sucesoId, e])), [entradas])
  if (entradas.length === 0) return null
  return (
    <section aria-label="En tu partida" className="flex flex-col gap-1.5">
      <p className="text-2xs font-semibold uppercase tracking-wide text-wood-500">En tu partida</p>
      <ul className="flex flex-col gap-1.5">
        {entradas.map((e) => (
          <EntradaLeyendaItem key={e.sucesoId} entrada={e} porId={porId} />
        ))}
      </ul>
    </section>
  )
}
