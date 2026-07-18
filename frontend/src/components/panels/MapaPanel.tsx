import { beriRegions, llanurasPuntosDeInteres } from '../../data/map'
import { InteractiveMap } from './InteractiveMap'

export function MapaPanel() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-3 flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wood-400">Berig</p>
          <span className="h-px flex-1 bg-iron-700" />
        </div>
        <InteractiveMap regions={beriRegions} />
      </div>

      <div>
        <div className="mb-3 flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wood-400">
            Puntos de interés — Llanuras del Viento Rojo
          </p>
          <span className="h-px flex-1 bg-iron-700" />
        </div>
        <div className="flex flex-col gap-2">
          {llanurasPuntosDeInteres.map((poi) => (
            <div key={poi.name} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5 text-sm">
              <p className="font-medium text-wood-100">{poi.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-wood-400">{poi.description}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-wood-500 italic">
        Vaelira y el resto del mapa se irán añadiendo cuando la partida los necesite.
      </p>
    </div>
  )
}
