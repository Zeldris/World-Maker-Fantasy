import { useState } from 'react'
import { PanelSection } from '../../PanelSection'
import type { CampamentoInfo, OpcionesPartida } from '../../../lib/api'

/// CR-50 (50d, Q5/Q7): los campamentos de bandidos que conoces (estuviste allí, te llegó el rumor o
/// los ve una Torre) y la partida para ir a por ellos: tus grupos 2+ y tus soldados, vigías y
/// cazadores. Si cae su cabecilla, el campamento se deshace y el Reino se queda con lo que guardaban.
export function CampamentosBandidos({
  campamentos,
  grupos,
  guerreros,
  desactivado,
  title,
  onAtacar,
}: {
  campamentos: CampamentoInfo[]
  grupos: OpcionesPartida['grupos']
  guerreros: { id: string; name: string; rol: string }[]
  desactivado: boolean
  title?: string
  onAtacar: (campamentoId: string, p: { companionIds: string[]; subjectIds: string[] }) => Promise<void>
}) {
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
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

  return (
    <PanelSection title="Campamentos de bandidos">
      {campamentos.length === 0 ? (
        <p className="text-xs text-wood-500">No conoces ninguno: se descubren estando allí, por los rumores o desde una Torre de vigía.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <fieldset className="flex flex-col gap-1">
            <legend className="text-2xs uppercase tracking-[0.12em] text-wood-500">Quién va</legend>
            {[...grupos.map((g) => ({ titulo: g.nombre, gente: g.companeros })), ...(guerreros.length > 0 ? [{ titulo: 'Súbditos', gente: guerreros }] : [])].map((bloque) => (
              <div key={bloque.titulo} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-2xs text-wood-400">{bloque.titulo}:</span>
                {bloque.gente.map((g) => (
                  <label key={g.id} className="flex items-center gap-1 text-2xs text-wood-200">
                    <input type="checkbox" checked={elegidos.has(g.id)} onChange={() => alternar(g.id)} aria-label={`${g.name} contra el campamento`} />
                    {g.name}
                  </label>
                ))}
              </div>
            ))}
          </fieldset>
          <ul className="flex flex-col gap-1.5">
            {campamentos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-red-900/50 bg-wood-950/40 px-3 py-2 text-xs text-wood-200">
                <span>
                  ⛺ <span className="font-medium text-wood-100">{c.grupo}</span> en {c.lugar} · unos {c.gente} y su cabecilla
                </span>
                <button
                  type="button"
                  disabled={desactivado || companionIds.length + subjectIds.length === 0}
                  title={title}
                  onClick={() =>
                    void onAtacar(c.id, { companionIds, subjectIds }).then(() => setElegidos(new Set()))
                  }
                  className="tactile text-2xs font-semibold text-accent-300 hover:underline disabled:opacity-50"
                >
                  Atacar ({companionIds.length + subjectIds.length})
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PanelSection>
  )
}
