import type { SavedActionInfo, SkillBarInfo } from '../types'
import { TooltipAnchor } from './TooltipAnchor'
import { ABILITIES_REQUIEREN_MONTURA, MONTURA_TOOLTIP_SUFFIX } from '../lib/abilitiesRequierenMontura'
import { useNavegacionRejilla } from '../hooks/useNavegacionRejilla'

/// Vista "barra activa" del HUD (2026-09-04, v2 de la SkillBar única de 2026-08-29; rediseñado
/// 2026-09-06, hallazgo 10: la barra ya no pertenece a ninguna categoría, puede mezclar
/// habilidades de General/Profesión/Reino) — sustituye a SkillBar.tsx en el composer: en vez de
/// una única lista fija de habilidades `general`, muestra el contenido de LA barra que el jugador
/// eligió en SkillBarMenu.tsx. `onUse` se reutiliza tal cual (handleAttachAbility de GameView.tsx)
/// — mismo despacho que ya existía (abre modal o inserta chip en el composer), sin reimplementar
/// nada.
///
/// Dos formas distintas de "volver" (feedback en vivo, 2026-09-04): ⌨️ vuelve directo al composer
/// de texto libre; ↩ vuelve al menú de barras (para cambiar de barra sin pasar primero por el
/// composer) — antes solo existía la primera, así que cambiar de barra exigía reabrir el menú
/// desde cero cada vez.
export function SkillBarHud({
  bar,
  savedActions,
  onUse,
  onBackToComposer,
  onBackToBars,
  onEdit,
  disabled = false,
}: {
  bar: SkillBarInfo
  savedActions: SavedActionInfo[]
  onUse: (ability: SavedActionInfo) => void
  onBackToComposer: () => void
  onBackToBars: () => void
  onEdit: () => void
  disabled?: boolean
}) {
  const byName = new Map(savedActions.map((a) => [a.name, a]))
  const abilities = bar.abilityNames.map((name) => byName.get(name)).filter((a): a is SavedActionInfo => !!a)

  // BAS-3 (hito 0.2) — flechas/cruceta entre las habilidades de la barra.
  const navegar = useNavegacionRejilla()
  return (
    <div className="flex flex-1 items-center gap-2" onKeyDown={navegar}>
      <TooltipAnchor text="Volver a escribir tu acción libremente">
        <button type="button" onClick={onBackToComposer} disabled={disabled} aria-label="Texto libre" className="skill-slot tactile">
          <span aria-hidden="true">⌨️</span>
        </button>
      </TooltipAnchor>

      <TooltipAnchor text="Volver a elegir otra barra">
        <button type="button" onClick={onBackToBars} disabled={disabled} aria-label="Cambiar de barra" className="skill-slot tactile">
          <span aria-hidden="true">↩</span>
        </button>
      </TooltipAnchor>

      <div className="flex flex-1 flex-wrap items-center justify-center gap-1">
        {abilities.length === 0 ? (
          <span className="text-xs text-wood-500">«{bar.name}» está vacía — pulsa ✎ para asignarle habilidades.</span>
        ) : (
          abilities.map((a) => {
            const requiereMontura = ABILITIES_REQUIEREN_MONTURA.has(a.name)
            return (
              <TooltipAnchor key={a.id} text={a.name} subtext={requiereMontura ? `${a.description}${MONTURA_TOOLTIP_SUFFIX}` : a.description}>
                <button type="button" data-celda onClick={() => onUse(a)} disabled={disabled || requiereMontura} aria-label={a.name} className="skill-slot tactile">
                  <span aria-hidden="true">{a.icon}</span>
                </button>
              </TooltipAnchor>
            )
          })
        )}
      </div>

      <TooltipAnchor text={`Editar "${bar.name}"`}>
        <button type="button" onClick={onEdit} disabled={disabled} aria-label="Editar barra" className="skill-slot tactile">
          <span aria-hidden="true">✎</span>
        </button>
      </TooltipAnchor>
    </div>
  )
}
