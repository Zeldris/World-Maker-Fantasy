import type { SkillBarCategory, SkillBarInfo } from '../types'

export type SkillHudView =
  | { screen: 'composer' }
  | { screen: 'menu-tipo' }
  | { screen: 'menu-barras'; category: SkillBarCategory }
  | { screen: 'barra-activa'; skillBarId: string }

const CATEGORY_LABEL: Record<SkillBarCategory, string> = {
  general: 'General',
  profesion: 'Profesión',
  reino: 'Reino',
}
const CATEGORY_ICON: Record<SkillBarCategory, string> = {
  general: '✨',
  profesion: '🛠️',
  reino: '🏰',
}
const SKILL_BAR_CATEGORIES: SkillBarCategory[] = ['general', 'profesion', 'reino']
export const SKILL_BARS_PER_CATEGORY_MAX = 3

/// Menú de barras de habilidades múltiples (2026-09-04, v2 de la SkillBar única de 2026-08-29) —
/// UNA superficie que sustituye su propio contenido al navegar (petición explícita: "un menu que
/// al pulsar una opcion se actualiza mostrando el submenu... en vez de poblar con varios menus"),
/// nunca popups anidados. Pantalla 1 (4 opciones: General/Profesión/Reino/Escribir) → pantalla 2
/// (barras de esa categoría, con botón Atrás en la cabecera).
export function SkillBarMenu({
  view,
  skillBars,
  onNavigate,
  onSelectBar,
  onCreateBar,
  onEditBar,
}: {
  view: Extract<SkillHudView, { screen: 'menu-tipo' | 'menu-barras' }>
  skillBars: SkillBarInfo[]
  onNavigate: (view: SkillHudView) => void
  onSelectBar: (bar: SkillBarInfo) => void
  onCreateBar: (category: SkillBarCategory) => void
  onEditBar: (bar: SkillBarInfo) => void
}) {
  if (view.screen === 'menu-tipo') {
    return (
      <div className="flex flex-1 flex-wrap items-center justify-center gap-2">
        {SKILL_BAR_CATEGORIES.map((category) => (
          <button
            type="button"
            key={category}
            onClick={() => onNavigate({ screen: 'menu-barras', category })}
            className="tactile flex items-center gap-1.5 rounded-lg border border-iron-700 bg-wood-950/50 px-3 py-2 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
          >
            <span aria-hidden="true">{CATEGORY_ICON[category]}</span>
            {CATEGORY_LABEL[category]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onNavigate({ screen: 'composer' })}
          className="tactile flex items-center gap-1.5 rounded-lg border border-iron-700 bg-wood-950/50 px-3 py-2 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
        >
          <span aria-hidden="true">⌨️</span>
          Escribir
        </button>
      </div>
    )
  }

  const barsOfCategory = skillBars.filter((b) => b.category === view.category).sort((a, b) => a.slotIndex - b.slotIndex)

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onNavigate({ screen: 'menu-tipo' })}
          aria-label="Atrás"
          className="tactile flex h-7 w-7 items-center justify-center rounded-md border border-iron-700 text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
        >
          ←
        </button>
        <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-wood-500">
          {CATEGORY_ICON[view.category]} {CATEGORY_LABEL[view.category]}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {barsOfCategory.map((bar) => (
          <div key={bar.id} className="flex items-center gap-1 rounded-lg border border-iron-700 bg-wood-950/50 px-2.5 py-1.5">
            <button type="button" onClick={() => onSelectBar(bar)} className="tactile text-xs text-wood-200 hover:text-accent-300">
              {bar.name} <span className="text-wood-500">({bar.abilityNames.length})</span>
            </button>
            <button
              type="button"
              onClick={() => onEditBar(bar)}
              aria-label={`Editar ${bar.name}`}
              className="tactile flex h-5 w-5 items-center justify-center rounded-full border border-iron-700 text-2xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
            >
              ✎
            </button>
          </div>
        ))}
        {barsOfCategory.length < SKILL_BARS_PER_CATEGORY_MAX && (
          <button
            type="button"
            onClick={() => onCreateBar(view.category)}
            className="tactile rounded-lg border border-dashed border-iron-700 px-2.5 py-1.5 text-xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
          >
            + Nueva barra
          </button>
        )}
      </div>
    </div>
  )
}
