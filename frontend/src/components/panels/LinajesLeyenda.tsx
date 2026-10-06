import { useEffect, useState } from 'react'
import { getLinajes, type LinajeInfo, type MiembroLinaje } from '../../lib/api'
import { arbolDeLinaje } from '../../lib/linajes'

/// CR-52 (hito 0.3, Q8-Q14): «Linajes» de Leyendas — las familias (por apellido) y los rastros faerus
/// de los que el personaje sabe algo, y el suyo arriba. Cada uno con su árbol (de padres a crías) y
/// lo que se sabe de su historia.
const PUEBLO: Record<string, string> = { orcos: 'Orcos', goirntes: 'Goirntes', nabieus: 'Nabieus', faerus: 'Faerus' }

function Rama({ m, hijos, nivel }: { m: MiembroLinaje; hijos: (id: string) => MiembroLinaje[]; nivel: number }) {
  const suyos = nivel < 8 ? hijos(m.id) : []
  return (
    <li>
      <span className={m.vivo ? 'text-wood-200' : 'text-wood-500 line-through decoration-wood-600'}>
        {m.nombre}
        {m.tipo === 'PERSONAJE' && <span className="ml-1 text-2xs text-accent-300">(tú)</span>}
        {!m.vivo && <span className="sr-only"> (muerto)</span>}
      </span>
      {suyos.length > 0 && (
        <ul className="ml-3 border-l border-iron-800 pl-2">
          {suyos.map((h) => (
            <Rama key={h.id} m={h} hijos={hijos} nivel={nivel + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function LinajesLeyenda({ saveId }: { saveId: string }) {
  const [linajes, setLinajes] = useState<LinajeInfo[] | null>(null)
  const [fallo, setFallo] = useState(false)
  useEffect(() => {
    let vivo = true
    getLinajes(saveId)
      .then((r) => vivo && setLinajes(r.linajes))
      .catch(() => vivo && setFallo(true))
    return () => {
      vivo = false
    }
  }, [saveId])

  if (fallo) return <p className="text-xs text-danger-300">No se pudieron leer los linajes.</p>
  if (!linajes) return <p className="text-xs italic text-wood-500">Leyendo…</p>
  if (linajes.length === 0) return <p className="text-xs text-wood-400">No sabes de ninguna familia.</p>
  return (
    <ul className="flex flex-col gap-2">
      {linajes.map((l) => {
        const { raices, hijos } = arbolDeLinaje(l.miembros)
        return (
          <li key={l.id} className={`rounded-lg border px-3 py-2 ${l.propio ? 'border-accent-700/60 bg-wood-950/50' : 'border-iron-700 bg-wood-950/30'}`}>
            <p className="flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] text-wood-400">
              {l.tipo === 'RASTRO' ? `Rastro ${l.nombre}` : `Los ${l.nombre}`}
              <span>· {PUEBLO[l.pueblo] ?? l.pueblo}</span>
              {l.propio && <span className="text-accent-300">· tu linaje</span>}
            </p>
            <ul className="mt-1 text-xs">
              {raices.map((m) => (
                <Rama key={m.id} m={m} hijos={hijos} nivel={0} />
              ))}
            </ul>
            {l.historia.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-0.5 border-t border-iron-800/60 pt-1.5">
                {l.historia.map((h) => (
                  <li key={h.sucesoId} className="text-2xs text-wood-300">
                    {h.fecha && <span className="mr-1 text-wood-500">{h.fecha}</span>}
                    {h.texto}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
