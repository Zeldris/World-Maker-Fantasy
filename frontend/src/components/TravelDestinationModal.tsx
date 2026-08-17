import { useEffect, useState } from 'react'
import { getDestinosViaje, type TravelDestinationInfo } from '../lib/api'
import { SelectionModalShell } from './SelectionModalShell'

interface TravelDestinationModalProps {
  saveId: string
  onSelect: (actionText: string) => void
  onCancel: () => void
}

/// Pop-up de "Viajar" (2026-08-17, comentario de startingAbilities.ts: "igual que volver al
/// campamento pero con las regiones que tienes descubiertas si no llevas mapa y si tienes mapa a
/// todas las regiones que muestra el mapa poseído") — mismo patrón que CampSelectionModal, el
/// backend decide `hasMap` según el inventario real.
export function TravelDestinationModal({ saveId, onSelect, onCancel }: TravelDestinationModalProps) {
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
        <p className="text-xs text-wood-500">Buscando destinos...</p>
      ) : error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : destinations.length === 0 ? (
        <p className="text-xs text-wood-500">Todavía no has descubierto ningún otro lugar.</p>
      ) : (
        <div className="space-y-1.5">
          {destinations.map((d) => (
            <button
              key={d.locationSlug}
              onClick={() => onSelect(`Viajo hacia ${d.locationName}.`)}
              className="tactile w-full rounded-lg border border-iron-700 p-2.5 text-left text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:bg-accent-500/10"
            >
              <span className="font-semibold text-wood-100">{d.locationName}</span>
              <span className="ml-1.5 text-wood-500">— {d.region}</span>
            </button>
          ))}
        </div>
      )}
    </SelectionModalShell>
  )
}
