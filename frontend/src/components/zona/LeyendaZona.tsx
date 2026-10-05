import { EstandarteSalida } from './FichaZona'
import { JugadorMarker, ParcelaMarker, ZonePointMarker } from './MarcadoresZona'
import { COLOR_HEX, TIPO_LABEL } from '../../lib/zonaFichas'
import type { ZonaPinTipo } from '../ZonePointDetailModal'

// ZON-80 (hito 0.2) — leyenda del mapa de zona, sacada de `ZonaPanel.tsx` tal cual.
export function LeyendaZona() {
  return (
    <>
    {/* ZON-20 (hito 0.1) — leyenda compacta fija en una esquina del mapa (BG3), plegada por
        defecto, con las mismas fichas reales que se pintan en el lienzo. */}
    <div className="absolute bottom-2 left-2 z-10">
    <details className="group max-h-[70%] max-w-[min(22rem,calc(100%-1rem))] overflow-y-auto rounded-lg border border-iron-700 bg-wood-950/90 text-2xs text-wood-400 shadow-lg backdrop-blur-sm">
      <summary className="tactile flex cursor-pointer select-none items-center gap-1.5 px-3 py-1.5 font-semibold uppercase tracking-[0.1em] text-wood-500 marker:content-none">
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">▸</span>
        Leyenda
      </summary>
      <div className="flex flex-col gap-2 border-t border-iron-800 px-3 py-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {(Object.keys(TIPO_LABEL) as (ZonaPinTipo)[]).map((tipo) => (
            <span key={tipo} className="flex items-center gap-1.5">
              <svg viewBox="-18 -18 36 36" width={20} height={20} aria-hidden="true">
                <ZonePointMarker tipo={tipo} x={0} y={0} color={COLOR_HEX.NEUTRO} escala={1} sombra={false} />
              </svg>
              {TIPO_LABEL[tipo]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <svg viewBox="-18 -18 36 36" width={20} height={20} aria-hidden="true">
              <JugadorMarker x={0} y={0} escala={1} angulo={null} quieto={false} sombra={false} />
            </svg>
            Tú
          </span>
          {/* Compañero de fauna con nombre propio (C10, 2026-09-13) — entrada propia en la
              leyenda para el anillo punteado, mismo criterio del comentario de arriba
              ("nunca puede desincronizarse de lo que de verdad se pinta"). */}
          <span className="flex items-center gap-1.5">
            <svg viewBox="-18 -18 36 36" width={20} height={20} aria-hidden="true">
              <ZonePointMarker tipo="NPC" x={0} y={0} color={COLOR_HEX.NEUTRO} escala={1} sombra={false} hasCompanion />
            </svg>
            NPC con compañero
          </span>
          <span className="flex items-center gap-1.5">
            <svg viewBox="-18 -18 36 36" width={20} height={20} aria-hidden="true">
              <EstandarteSalida escala={1} angulo={0} texto="" />
            </svg>
            Salida de la región
          </span>
          {/* Icono de parcela (§ 7.4, 2026-09-21) — cuadrado con cruz = hueco vacío donde
              construir, sólido = ya ocupado. Mismo criterio ("nunca desincronizarse de lo
              que de verdad se pinta") que el resto de esta leyenda. */}
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true">
              <ParcelaMarker x={12} y={12} ocupada={false} />
            </svg>
            Parcela vacía
          </span>
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true">
              <ParcelaMarker x={12} y={12} ocupada={true} />
            </svg>
            Parcela construida
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX.ALIADO }} />
            Aliado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX.NEUTRO }} />
            Neutro
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX.ENEMIGO }} />
            Enemigo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX.SIN_FACCION }} />
            Sin facción
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX.INERTE }} />
            Salvaje
          </span>
        </div>
      </div>
    </details>
    </div>
    </>
  )
}
