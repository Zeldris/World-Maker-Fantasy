import { useEffect, useState } from 'react'

/// Sugerencias de próxima acción (petición explícita, 2026-08-15: "no obligar siempre al usuario a
/// escribir... 3 posibles sugerencias que el usuario puede elegir y añadir a su prompt") — barra
/// colapsada por defecto entre el log y el composer, nunca envía nada por su cuenta: elegir una
/// sugerencia solo RELLENA el composer (`ChatComposer.setText`), la jugadora sigue pudiendo
/// editarla o borrarla antes de mandarla.
///
/// Movido a llamada aparte bajo demanda (petición explícita, 2026-08-15, ver comentario de
/// cabecera de `generateSuggestions` en el backend): antes las sugerencias llegaban solas tras
/// CADA turno (de ahí el auto-colapso al cambiar `suggestions`, para no sorprender con una barra ya
/// desplegada de un turno viejo); ahora solo llegan cuando la jugadora pulsa el botón "Sugerir" —
/// el pedido es explícito, así que la barra se auto-EXPANDE en cuanto llega la respuesta en vez de
/// colapsarse.
export function SuggestionBar({
  suggestions,
  onPick,
  loading = false,
}: {
  suggestions: string[]
  onPick: (text: string) => void
  loading?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (suggestions.length > 0) setExpanded(true)
  }, [suggestions])

  if (suggestions.length === 0 && !loading) return null

  return (
    <div className="border-t border-iron-800 bg-wood-950/70 px-4 pt-2.5">
      <button type="button"
        onClick={() => setExpanded((e) => !e)}
        disabled={loading}
        className="tactile flex w-full items-center justify-between rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-1.5 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true">💡</span>
          <span className="font-semibold uppercase tracking-wide">{loading ? 'Pensando sugerencias...' : 'Sugerencias'}</span>
        </span>
        {!loading && (
          <span aria-hidden="true" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▾
          </span>
        )}
      </button>
      {expanded && !loading && (
        <div className="animate-entry-in grid grid-cols-1 gap-2 py-2.5 sm:grid-cols-3">
          {suggestions.map((s, i) => (
            <button type="button"
              key={i}
              onClick={() => {
                onPick(s)
                setExpanded(false)
              }}
              className="tactile rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2 text-left text-xs leading-relaxed text-wood-200 transition-colors hover:border-accent-600/60 hover:bg-accent-500/5"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
