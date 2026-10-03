import type { ReactNode } from 'react'
import { Miniatura } from '../Miniatura'

// BAS-8 (hito 0.2) — fila de entidad: miniatura de la enciclopedia (MOD-6), nombre, subtítulo y
// acción a la derecha. La forma común de las filas de los modales de selección.

interface EntityRowProps {
  nombre: string
  subtitulo?: ReactNode
  icono: string
  entityType?: string
  slug?: string
  accion?: ReactNode
  seleccionada?: boolean
}

export function EntityRow({ nombre, subtitulo, icono, entityType, slug, accion, seleccionada = false }: EntityRowProps) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-xs transition-colors ${
        seleccionada ? 'border-accent-600/60 bg-accent-500/10' : 'border-iron-700'
      }`}
    >
      <Miniatura nombre={nombre} entityType={entityType} slug={slug} icono={icono} />
      <div className="mr-auto min-w-0">
        <p className="truncate font-semibold text-wood-100">{nombre}</p>
        {subtitulo && <p className="mt-0.5 text-2xs text-wood-500">{subtitulo}</p>}
      </div>
      {accion}
    </div>
  )
}
