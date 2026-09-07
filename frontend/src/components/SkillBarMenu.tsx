import type { SkillBarInfo } from '../types'

export type SkillHudView = { screen: 'composer' } | { screen: 'menu-barras' } | { screen: 'barra-activa'; skillBarId: string }

export const SKILL_BARS_MAX = 3

/// Menú de barras de habilidades múltiples (2026-09-04, v2 de la SkillBar única de 2026-08-29;
/// rediseñado 2026-09-06, hallazgo 10 de la sesión de pruebas: 3 barras EN GENERAL sin distinguir
/// tipo — antes había un paso intermedio "qué tipo de barra quieres" antes de ver ninguna barra;
/// ahora este menú lista directamente las (hasta 3) barras que ya tienes). UNA superficie que
/// sustituye su propio contenido al navegar (petición explícita: "un menu que al pulsar una opcion
/// se actualiza mostrando el submenu... en vez de poblar con varios menus"), nunca popups anidados.
export function SkillBarMenu({
  skillBars,
  onNavigate,
  onSelectBar,
  onCreateBar,
  onEditBar,
  onDeleteBar,
}: {
  skillBars: SkillBarInfo[]
  onNavigate: (view: SkillHudView) => void
  onSelectBar: (bar: SkillBarInfo) => void
  onCreateBar: () => void
  onEditBar: (bar: SkillBarInfo) => void
  /// Borrar una barra 2ª/3ª (2026-09-06) — nunca la base (`slotIndex: 0`), mismo guard que ya
  /// aplica el backend; este menú no ofrece el botón en absoluto para esa barra.
  onDeleteBar: (bar: SkillBarInfo) => void
}) {
  const bars = [...skillBars].sort((a, b) => a.slotIndex - b.slotIndex)

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {bars.map((bar) => (
          <div key={bar.id} className="flex items-center gap-1.5 rounded-lg border border-iron-700 bg-wood-950/50 px-3 py-2">
            <button type="button" onClick={() => onSelectBar(bar)} className="tactile text-sm text-wood-200 hover:text-accent-300">
              {bar.name} <span className="text-wood-500">({bar.abilityNames.length})</span>
            </button>
            <button
              type="button"
              onClick={() => onEditBar(bar)}
              aria-label={`Editar ${bar.name}`}
              className="tactile flex h-6 w-6 items-center justify-center rounded-full border border-iron-700 text-xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
            >
              ✎
            </button>
            {bar.slotIndex !== 0 && (
              <button
                type="button"
                onClick={() => onDeleteBar(bar)}
                aria-label={`Borrar ${bar.name}`}
                className="tactile flex h-6 w-6 items-center justify-center rounded-full border border-iron-700 text-xs text-wood-500 transition-colors hover:border-danger-600/60 hover:text-danger-300"
              >
                🗑️
              </button>
            )}
          </div>
        ))}
        {bars.length < SKILL_BARS_MAX && (
          <button
            type="button"
            onClick={onCreateBar}
            className="tactile rounded-lg border border-dashed border-iron-700 px-3 py-2 text-sm text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
          >
            + Nueva barra
          </button>
        )}
        <button
          type="button"
          onClick={() => onNavigate({ screen: 'composer' })}
          className="tactile flex items-center gap-2 rounded-lg border border-iron-700 bg-wood-950/50 px-3 py-2 text-sm text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
        >
          <span aria-hidden="true" className="text-lg">
            ⌨️
          </span>
          Escribir
        </button>
      </div>
    </div>
  )
}
