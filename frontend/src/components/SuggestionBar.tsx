import { useEffect, useState } from 'react'

/// Sugerencias de próxima acción (petición explícita, 2026-08-15: "no obligar siempre al usuario a
/// escribir... 3 posibles sugerencias que el usuario puede elegir y añadir a su prompt") — barra
/// colapsada por defecto entre el log y el composer (petición explícita, preocupación de espacio:
/// "puede ocupar bastante... una barra... que al pulsarlo despliega en cards... una vez la elijas
/// se colapsa"), nunca envía nada por su cuenta: elegir una sugerencia solo RELLENA el composer
/// (`ChatComposer.setText`), la jugadora sigue pudiendo editarla o borrarla antes de mandarla.
export function SuggestionBar({ suggestions, onPick }: { suggestions: string[]; onPick: (text: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  // Se colapsa sola en cuanto llegan sugerencias de un turno nuevo — sin esto, quedarían
  // desplegadas las de un turno ya viejo si la jugadora no las había cerrado a mano.
  useEffect(() => {
    setExpanded(false)
  }, [suggestions])

  if (suggestions.length === 0) return null

  return (
    <div className="border-t border-iron-800 bg-wood-950/70 px-4 pt-2.5">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="tactile flex w-full items-center justify-between rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-1.5 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
      >
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true">💡</span>
          <span className="font-semibold uppercase tracking-wide">Sugerencias</span>
        </span>
        <span aria-hidden="true" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {expanded && (
        <div className="animate-entry-in grid grid-cols-1 gap-2 py-2.5 sm:grid-cols-3">
          {suggestions.map((s, i) => (
            <button
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
