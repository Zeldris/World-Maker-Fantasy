import { useEffect } from 'react'
import { OfferCard } from '../OfferCard'
import type { PresentacionOferta } from '../../lib/ofertaModoDinamico'

// ZON-40/ZON-41 (hito 0.2, decisión de la usuaria en la ronda de la Fase F) — tarjeta flotante al
// pasar el ratón por una ficha del mapa de zona y menú pegado a la ficha al pulsarla, en lugar del
// modal grande (que queda como «Ver ficha completa»). En táctil no hay ratón: el menú hace también
// de tarjeta. Van dentro del SVG (`foreignObject`) y se dibujan a tamaño de pantalla fijo (`escala`,
// ZON-11), así caen siempre pegados a la ficha sea cual sea el tamaño del mapa.

export interface InfoFicha {
  nombre: string
  /// «Fauna · Enemigo · ×3 · a 4 celdas».
  detalles: string[]
}

export interface AccionFicha {
  label: string
  onClick: () => void
}

const ANCHO_PX = 210

/// Coloca la caja junto a la ficha (a su derecha, o a su izquierda si no cabe) dentro del lienzo.
function posicion(x: number, y: number, altoPx: number, escala: number): { x: number; y: number } {
  const ancho = ANCHO_PX * escala
  const alto = altoPx * escala
  const derecha = x + 18 * escala
  const px = derecha + ancho <= 800 ? derecha : Math.max(0, x - 18 * escala - ancho)
  const py = Math.min(600 - alto, Math.max(0, y - alto / 2))
  return { x: px, y: py }
}

function Cabecera({ info }: { info: InfoFicha }) {
  return (
    <>
      <p className="truncate text-xs font-semibold text-wood-100">{info.nombre}</p>
      <p className="text-2xs text-wood-400">{info.detalles.join(' · ')}</p>
    </>
  )
}

/// ZON-40: tarjeta al pasar el ratón (sin acciones, no captura el ratón).
export function TarjetaFicha({ x, y, escala, info }: { x: number; y: number; escala: number; info: InfoFicha }) {
  const alto = 44
  const p = posicion(x, y, alto, escala)
  return (
    <foreignObject x={p.x} y={p.y} width={ANCHO_PX * escala} height={alto * escala} pointerEvents="none" data-testid="tarjeta-ficha">
      <div style={{ width: ANCHO_PX, transform: `scale(${escala})`, transformOrigin: '0 0' }} className="rounded-md border border-iron-700 bg-wood-950/95 px-2.5 py-1.5 shadow-lg">
        <Cabecera info={info} />
      </div>
    </foreignObject>
  )
}

/// ZON-41: menú pegado a la ficha, con su información arriba y las acciones que tiene ahora.
export function MenuFicha({ x, y, escala, info, acciones, onClose }: { x: number; y: number; escala: number; info: InfoFicha; acciones: AccionFicha[]; onClose: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', tecla, true)
    return () => window.removeEventListener('keydown', tecla, true)
  }, [onClose])
  const alto = 48 + acciones.length * 28
  const p = posicion(x, y, alto, escala)
  return (
    <foreignObject x={p.x} y={p.y} width={ANCHO_PX * escala} height={alto * escala} onClick={(e) => e.stopPropagation()}>
      <div
        role="menu"
        aria-label={info.nombre}
        style={{ width: ANCHO_PX, transform: `scale(${escala})`, transformOrigin: '0 0' }}
        className="rounded-md border border-iron-700 bg-wood-950/95 px-2.5 py-1.5 shadow-lg"
      >
        <Cabecera info={info} />
        <div className="mt-1 flex flex-col gap-0.5">
          {acciones.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              onClick={() => {
                onClose()
                a.onClick()
              }}
              className="tactile rounded px-2 py-1 text-left text-xs text-wood-200 hover:bg-wood-800/70 hover:text-wood-100"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </foreignObject>
  )
}

const ANCHO_ENCUENTRO_PX = 270
const ALTO_ENCUENTRO_PX = 190

/// ZON-5 (hito 0.2): la tarjeta de un encuentro, pegada a su ficha en el mapa (la misma que sale en
/// el registro, con sus mismas acciones). El mapa ya no se cierra al chocar con algo.
export function TarjetaEncuentro({ x, y, escala, presentacion, bloqueo }: { x: number; y: number; escala: number; presentacion: PresentacionOferta; bloqueo?: string | null }) {
  const ancho = ANCHO_ENCUENTRO_PX * escala
  const alto = ALTO_ENCUENTRO_PX * escala
  const derecha = x + 18 * escala
  const px = derecha + ancho <= 800 ? derecha : Math.max(0, x - 18 * escala - ancho)
  const py = Math.min(600 - alto, Math.max(0, y - 40 * escala))
  return (
    <foreignObject x={px} y={py} width={ancho} height={alto} onClick={(e) => e.stopPropagation()} data-testid="encuentro-en-mapa">
      <div style={{ width: ANCHO_ENCUENTRO_PX, transform: `scale(${escala})`, transformOrigin: '0 0' }} className="rounded-lg bg-wood-950/95 shadow-xl [&>div]:mt-0">
        <OfferCard bloqueo={bloqueo} {...presentacion} />
      </div>
    </foreignObject>
  )
}
