import type { ZonaSalidaInfo } from '../lib/api'
import { resolveImageUrl } from '../lib/api'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'

interface ZonaSalidaModalProps {
  salida: ZonaSalidaInfo
  onViajar: (actionText: string) => void
  onCancel: () => void
}

/// Modal del icono de salida de región (2026-09-17, petición explícita de Álvaro: "al pulsarlo saca
/// un modal con la imagen de la zona (si ya la habías descubierto) y una descripción (una breve si
/// no lo conoces y la larga si ya lo descubriste)... y en ese modal un botón Viajar que invoca
/// directamente el viaje a esa zona"). Locations no usan la Enciclopedia de 3 fases — `visitada`
/// (binario, `LocationVisit`) decide qué mostrar: imagen real + `description` completa si ya se
/// visitó, solo `teaser` (o un texto genérico de reserva si el catálogo todavía no tiene uno curado)
/// si no. El botón "Viajar" arma el mismo texto libre que `TravelDestinationModal`
/// (`onSelect(`Viajo hacia ${nombre}.`)`) — reutiliza el motor de viaje determinista existente
/// (`resolveTravel`) sin duplicar ninguna lógica de viaje nueva, decisión explícita de Álvaro.
export function ZonaSalidaModal({ salida, onViajar, onCancel }: ZonaSalidaModalProps) {
  const imageUrl = salida.visitada ? resolveImageUrl(salida.imageUrl) : null

  return (
    <SelectionModalShell
      title={salida.visitada ? salida.nombre : '???'}
      onCancel={onCancel}
      footer={
        <button type="button" onClick={() => onViajar(`Viajo hacia ${salida.nombre}.`)} className={confirmButtonClasses('accent')}>
          Viajar
        </button>
      }
    >
      {imageUrl && (
        <img src={imageUrl} alt={salida.nombre} className="max-h-48 w-full rounded-lg border border-iron-700 object-cover" />
      )}
      <p className="text-xs text-wood-300">
        {salida.visitada ? (salida.description ?? 'Ya has estado aquí.') : (salida.teaser ?? 'Todavía no has explorado este lugar.')}
      </p>
    </SelectionModalShell>
  )
}
