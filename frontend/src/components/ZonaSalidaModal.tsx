import type { ZonaSalidaInfo } from '../lib/api'
import { etiquetaSalida } from '../lib/rumboSalida'
import { resolveImageUrl } from '../lib/api'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'
import { conPuntoFinal } from '../lib/conPuntoFinal'

interface ZonaSalidaModalProps {
  salida: ZonaSalidaInfo
  onViajar: (actionText: string) => void
  onCancel: () => void
  /// UX-3 (hito 0.1) — motivo por el que ahora no se puede lanzar un turno (narrador escribiendo,
  /// ocupado…); `null`/ausente = libre. Deshabilita los botones que mandan una acción al turno.
  bloqueoTurno?: string | null
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
export function ZonaSalidaModal({ salida, onViajar, onCancel, bloqueoTurno }: ZonaSalidaModalProps) {
  const imageUrl = salida.visitada ? resolveImageUrl(salida.imageUrl) : null

  return (
    <SelectionModalShell
      // B5 (pruebas 2026-09-28): un destino sin visitar titulaba "???" — ahora dice hacia dónde va.
      title={etiquetaSalida(salida)}
      onCancel={onCancel}
      footer={
        <button
          type="button"
          disabled={!!bloqueoTurno}
          title={bloqueoTurno ?? undefined}
          onClick={() => onViajar(`Viajo hacia ${salida.nombre}.`)}
          className={`${confirmButtonClasses('accent')} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {bloqueoTurno ? '🔒 ' : ''}Viajar
        </button>
      }
    >
      {imageUrl && (
        <img src={imageUrl} alt={salida.nombre} className="max-h-48 w-full rounded-lg border border-iron-700 object-cover" />
      )}
      <p className="text-xs text-wood-300">
        {salida.visitada ? (salida.description ?? 'Ya has estado aquí.') : (salida.teaser ? conPuntoFinal(salida.teaser) : 'Todavía no has explorado este lugar.')}
      </p>
    </SelectionModalShell>
  )
}
