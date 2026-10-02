import { useEffect, useState } from 'react'
import { getDestinosViaje, type TravelDestinationInfo } from '../lib/api'
import { formatMinutos } from '../lib/gameViewHelpers'
import { SelectionModalShell } from './SelectionModalShell'
import { CargandoModal, ErrorCarga } from './EstadosModal'

interface TravelDestinationModalProps {
  saveId: string
  onSelect: (actionText: string) => void
  onCancel: () => void
  /// UX-3 (hito 0.1) — motivo por el que ahora no se puede lanzar un turno (narrador escribiendo,
  /// ocupado…); `null`/ausente = libre. Deshabilita los botones que mandan una acción al turno.
  bloqueoTurno?: string | null
}

/// Pop-up de "Viajar" (2026-08-17, comentario de startingAbilities.ts: "igual que volver al
/// campamento pero con las regiones que tienes descubiertas si no llevas mapa y si tienes mapa a
/// todas las regiones que muestra el mapa poseído") — mismo patrón que CampSelectionModal, el
/// backend decide `hasMap` según el inventario real.
///
/// Filas rediseñadas + tiempo de viaje (petición explícita, 2026-08-18: "bordes en cada elemento y
/// estilos mejores... que salga con el tiempo de juego que nos llevaría llegar") — `d.minutos` ya
/// viene del backend calculado con el mismo grafo/fórmula que `resolveTravel` de verdad
/// (buildAdjacency + shortestPath + minutosConDestreza), tiempo de FICCIÓN, nunca de reloj real;
/// `null` cuando el destino no tiene camino real por el grafo desde aquí (se lista igual, sin
/// badge de tiempo).
export function TravelDestinationModal({ saveId, onSelect, onCancel, bloqueoTurno }: TravelDestinationModalProps) {
  const [loading, setLoading] = useState(true)
  const [hasMap, setHasMap] = useState(false)
  const [destinations, setDestinations] = useState<TravelDestinationInfo[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDestinosViaje(saveId)
      .then((res) => {
        setHasMap(res.hasMap)
        setDestinations(res.destinations)
      })
      .catch(() => setError('No se pudo comprobar los destinos disponibles.'))
      .finally(() => setLoading(false))
  }, [saveId])

  return (
    <SelectionModalShell title="Viajar" onCancel={onCancel}>
      <p className="text-2xs text-wood-500">
        {hasMap ? 'Con tu mapa, puedes poner rumbo a cualquier lugar de la región.' : 'Solo lugares que ya has visitado — consigue un mapa para ver más.'}
      </p>

      {loading ? (
        <CargandoModal texto="Buscando destinos..." />
      ) : error ? (
        <ErrorCarga mensaje={error} />
      ) : destinations.length === 0 ? (
        <p className="text-xs text-wood-500">Todavía no has descubierto ningún otro lugar.</p>
      ) : (
        <div className="space-y-2">
          {bloqueoTurno && <p className="text-2xs text-wood-500">🔒 {bloqueoTurno}</p>}
          {destinations.map((d) => (
            <button type="button"
              data-opcion
              key={d.locationSlug}
              disabled={!!bloqueoTurno}
              title={bloqueoTurno ?? undefined}
              onClick={() => onSelect(`Viajo hacia ${d.locationName}.`)}
              className="tactile flex w-full items-center justify-between gap-3 rounded-lg border border-wood-600/40 bg-wood-950/40 p-3 text-left text-xs text-wood-300 shadow-sm transition-colors hover:border-accent-600/60 hover:bg-accent-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-wood-100">{d.locationName}</span>
                <span className="block truncate text-2xs text-wood-500">{d.region}</span>
              </span>
              {d.minutos != null && (
                <span className="flex shrink-0 items-center gap-1 rounded-full border border-wood-600/40 bg-wood-900/60 px-2.5 py-1 text-2xs font-mono text-wood-300">
                  <span aria-hidden="true">🕐</span>
                  {formatMinutos(d.minutos)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </SelectionModalShell>
  )
}
