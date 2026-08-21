import { useState } from 'react'
import { getCampamentos, type CampInfo } from '../lib/api'
import { SelectionModalShell } from './SelectionModalShell'
import { useAsyncModalData } from '../hooks/useAsyncModalData'

interface CampSelectionModalProps {
  saveId: string
  onSelect: (actionText: string) => void
  onCancel: () => void
}

/// Pop-up de "Volver al campamento" (2026-08-17, comentario de startingAbilities.ts) — lista los
/// campamentos ACTIVOS ya construidos por región. Al elegir uno, completa el `promptText` real de
/// la habilidad con la región y lo manda por el turno normal — `resolveTravel` (backend) ya sabe
/// resolver un viaje real a CUALQUIER Location del mundo por nombre, no solo destinos adyacentes,
/// así que no hace falta ninguna lógica de viaje nueva aquí.
export function CampSelectionModal({ saveId, onSelect, onCancel }: CampSelectionModalProps) {
  const [camps, setCamps] = useState<CampInfo[]>([])
  const { loading, error } = useAsyncModalData(
    () => getCampamentos(saveId),
    (res) => setCamps(res.camps),
    'No se pudo comprobar qué campamentos tienes construidos.',
    [saveId],
  )

  return (
    <SelectionModalShell title="Volver al campamento" onCancel={onCancel}>
      {loading ? (
        <p className="text-xs text-wood-500">Buscando tus campamentos...</p>
      ) : error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : camps.length === 0 ? (
        <p className="text-xs text-wood-500">Todavía no has construido ningún campamento.</p>
      ) : (
        <div className="space-y-1.5">
          {camps.map((c) => (
            <button
              key={c.locationSlug}
              onClick={() => onSelect(`Viajo hacia el campamento en ${c.locationName}.`)}
              className="tactile w-full rounded-lg border border-iron-700 p-2.5 text-left text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:bg-accent-500/10"
            >
              <span className="font-semibold text-wood-100">{c.locationName}</span>
              <span className="ml-1.5 text-wood-500">— {c.region}</span>
            </button>
          ))}
        </div>
      )}
    </SelectionModalShell>
  )
}
