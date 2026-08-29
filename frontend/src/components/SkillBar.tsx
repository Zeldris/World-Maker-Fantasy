import type { SavedActionInfo } from '../types'
import { TooltipAnchor } from './TooltipAnchor'

/// Barra de habilidades fuera de combate (idea anotada 2026-08-29, implementada la misma sesión,
/// restilizada tras feedback en vivo: "tipo World of Warcraft pero ambientada en nuestro lore") —
/// mismo espíritu que el selector de habilidades de `CombatPanel.tsx`, pero para el composer
/// normal: en vez de escribir siempre la acción a mano, un toggle deja elegir por botón entre las
/// habilidades GENERALES de la partida (`savedActions` con `category === 'general'` — las 7 que
/// siembra `startingAbilities.ts` en toda partida nueva: Volver al campamento, Viajar, Descansar,
/// Saquear, Cazar, Curar, Recoger). v1 explícitamente sin rotar entre varias barras (profesión/
/// reino quedan en su pestaña de Habilidades de siempre) — decisión de alcance de la usuaria.
///
/// Estilo "hotbar" (2026-08-29, dos vueltas de feedback en vivo — la primera quedó "más plano de
/// lo pedido"): slots con bisel real (`.skill-slot`, index.css — gema hundida con luz arriba-
/// izquierda/sombra abajo-derecha, marco que se ilumina en azul de acento al pasar el ratón) en vez
/// de tarjetas rectangulares con nombre siempre visible — el nombre pasa a tooltip (`TooltipAnchor`,
/// mismo componente que el resto de iconos de la app), el icono es el protagonista.
///
/// Reutiliza `onUse` tal cual (la misma función `handleAttachAbility` de GameView.tsx que ya usa
/// el tab "Habilidades") — cada slot dispara exactamente el mismo comportamiento que ya existía
/// (abre el modal real si la habilidad lo tiene — Cazar/Curar/Saquear/Viajar/etc. — o inserta el
/// chip en el composer de texto libre si no), sin duplicar ninguna lógica de despacho.
export function SkillBar({
  actions,
  onUse,
  disabled = false,
}: {
  actions: SavedActionInfo[]
  onUse: (ability: SavedActionInfo) => void
  disabled?: boolean
}) {
  const general = actions.filter((a) => a.category === 'general')
  if (general.length === 0) return null

  return (
    // Centrado en el ancho disponible (2026-08-29, feedback en vivo: "que partan del centro y se
    // expandan desde ahí") — antes crecía pegado a la izquierda tras el toggle, dejando hueco vacío
    // a la derecha; `justify-center` en el espacio que le da `flex-1` del padre centra el bloque
    // entero, sea cual sea el número de habilidades.
    <div className="flex flex-1 flex-wrap items-center justify-center gap-1">
      {general.map((a) => (
        <TooltipAnchor key={a.id} text={a.name} subtext={a.description}>
          <button type="button"
            onClick={() => onUse(a)}
            disabled={disabled}
            aria-label={a.name}
            className="skill-slot tactile"
          >
            <span aria-hidden="true">{a.icon}</span>
          </button>
        </TooltipAnchor>
      ))}
    </div>
  )
}
