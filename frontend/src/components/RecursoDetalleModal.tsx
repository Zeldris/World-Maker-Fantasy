import type { EnciclopediaFaunaFloraInfo } from '../lib/api'
import { resolveImageUrl } from '../lib/api'
import { etiquetaAccionRecurso } from '../lib/recursoAccion'
import type { MetodoObtencion } from '../types'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'

/// Modal de detalle de un RECURSO encontrado en la Zona (2026-09-29, petición de Álvaro: "con los
/// elementos de flora sale el Interactuar y eso debería abrir un modal que muestra el detalle del
/// elemento y un botón con texto según la profesión"). Antes "Interactuar" recolectaba directo.
///
/// `entry` es la ficha de Enciclopedia (`faunaFlora`, resuelta por `sourceSlug` en GameView); sin
/// ficha o todavía sin descubrir en la partida se muestra solo el nombre + una línea de relleno,
/// nunca información de algo que la partida aún no ha descubierto (mismo criterio que
/// `ZonePointDetailModal`). La acción recolectora en sí NO vive aquí: `onAccion` llama al mismo
/// handler de siempre (`handleInteractuarModoDinamicoRecurso`).
export function RecursoDetalleModal({
  nombre,
  metodo,
  entry,
  onAccion,
  onCerrar,
}: {
  nombre: string
  metodo?: MetodoObtencion | null
  entry?: EnciclopediaFaunaFloraInfo | null
  onAccion: () => void
  onCerrar: () => void
}) {
  const detalle = entry && entry.discovered ? entry : null
  const imagen = detalle ? resolveImageUrl(detalle.imageUrls.banner ?? detalle.imageUrls.thumbnail) : null

  return (
    <SelectionModalShell
      title={nombre}
      onCancel={onCerrar}
      cancelLabel="Cerrar"
      footer={
        <button type="button" onClick={onAccion} className={confirmButtonClasses('accent')}>
          {etiquetaAccionRecurso(metodo)}
        </button>
      }
    >
      {!detalle ? (
        <p className="text-xs italic text-wood-500">Todavía no sabes mucho sobre esto.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {imagen && <img src={imagen} alt="" className="h-40 w-full rounded-lg border border-iron-700 object-cover object-top" />}
          {detalle.region && (
            <div className="flex flex-wrap gap-1.5 text-2xs">
              <span className="rounded-full border border-iron-700 bg-wood-950/50 px-2.5 py-1 uppercase tracking-wide text-wood-400">{detalle.region}</span>
            </div>
          )}
          <p className="text-sm text-wood-200">{detalle.description ?? 'Sin descripción todavía.'}</p>
          <div className="flex flex-col gap-1">
            <span className="text-2xs uppercase tracking-wide text-wood-400">Recursos</span>
            {detalle.yields.length === 0 ? (
              <p className="text-xs italic text-wood-500">Sin recursos catalogados todavía.</p>
            ) : (
              <ul className="flex flex-col gap-0.5 text-xs text-wood-300">
                {detalle.yields.map((y) => (
                  <li key={`${y.itemName}-${y.condicion ?? ''}`}>
                    {y.cantidad} {y.itemName}
                    {y.condicion ? <span className="text-wood-500"> ({y.condicion})</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </SelectionModalShell>
  )
}
