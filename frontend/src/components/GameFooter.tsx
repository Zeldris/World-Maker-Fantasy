import type { ComponentProps, ReactNode, Ref } from 'react'
import { ChatComposer, type ChatComposerHandle } from './ChatComposer'
import { SkillBarMenu, type SkillHudView } from './SkillBarMenu'
import { SkillBarHud } from './SkillBarHud'
import { TooltipAnchor } from './TooltipAnchor'
import type { SkillBarInfo, SavedActionInfo } from '../types'

type MenuProps = ComponentProps<typeof SkillBarMenu>
type HudProps = ComponentProps<typeof SkillBarHud>
type ComposerProps = ComponentProps<typeof ChatComposer>

export type ModoPie = 'fin' | 'muerte' | 'combate' | 'normal'

interface GameFooterProps {
  /// Qué ocupa el pie: aviso de fin, botón de aceptar la muerte, composer de combate o el normal.
  modo: ModoPie
  characterName: string | null
  onResolverMuerte: () => void
  resolviendoMuerte: boolean
  /// Composer de combate ya montado (lo arma GameView con el estado de useCombatFlow).
  combatComposer: ReactNode
  /// Aviso de presas sin desollar, o null si no toca.
  desollar: { disabled: boolean; onClick: () => void } | null
  /// Barra de habilidades disponible (fuera de combate).
  conHabilidades: boolean
  skillHudView: SkillHudView
  setSkillHudView: (v: SkillHudView) => void
  skillBars: SkillBarInfo[]
  savedActions: SavedActionInfo[]
  onSelectBar: MenuProps['onSelectBar']
  onCreateBar: MenuProps['onCreateBar']
  onEditBar: (bar: SkillBarInfo) => void
  onDeleteBar: MenuProps['onDeleteBar']
  onUseAbility: HudProps['onUse']
  onBackToComposer: HudProps['onBackToComposer']
  composerRef: Ref<ChatComposerHandle>
  onChange: ComposerProps['onChange']
  onSubmit: ComposerProps['onSubmit']
  composerDisabled: boolean
  disabledReason: string | undefined
}

/// Pie de la partida (BAS-5, hito 0.2 — sacado de GameView.tsx sin cambio visual): fin de partida,
/// muerte pendiente, composer de combate o composer normal con la barra de habilidades.
export function GameFooter({
  modo,
  characterName,
  onResolverMuerte,
  resolviendoMuerte,
  combatComposer,
  desollar,
  conHabilidades,
  skillHudView,
  setSkillHudView,
  skillBars,
  savedActions,
  onSelectBar,
  onCreateBar,
  onEditBar,
  onDeleteBar,
  onUseAbility,
  onBackToComposer,
  composerRef,
  onChange,
  onSubmit,
  composerDisabled,
  disabledReason,
}: GameFooterProps) {
  if (modo === 'fin') {
    return (
      <div className="animate-entry-in-slow border-t border-iron-800 bg-wood-950/90 px-4 py-5 text-center">
        <div className="animate-line-extend mx-auto mb-3 h-px w-24 origin-center bg-red-800" />
        <p className="text-sm text-danger-400">
          {characterName} ya no puede seguir — esta partida ha terminado. Volviendo a «Tus partidas»…
        </p>
      </div>
    )
  }
  if (modo === 'muerte') {
    // Muerte permanente, botón Aceptar/Reintentar (2026-08-31) — el susurro de la Entidad ya está en
    // el log (LogPanel); este bloque sustituye al composer normal hasta que el jugador confirma.
    return (
      <div className="animate-entry-in-slow border-t border-iron-800 bg-wood-950/90 px-4 py-5 text-center">
        <div className="animate-line-extend mx-auto mb-3 h-px w-24 origin-center bg-accent-700" />
        <button
          type="button"
          onClick={onResolverMuerte}
          disabled={resolviendoMuerte}
          className="tactile rounded-lg border border-accent-600 bg-accent-500/10 px-4 py-2 text-sm font-bold uppercase tracking-wide text-accent-300 transition-colors hover:bg-accent-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resolviendoMuerte ? 'Resolviendo...' : 'Aceptar'}
        </button>
      </div>
    )
  }
  if (modo === 'combate') return <>{combatComposer}</>

  // Toggle a la IZQUIERDA de la propia fila del composer/barra (2026-08-29) — solo en la vista
  // `composer`; las otras 2 vistas (menú-barras/barra-activa) ya tienen su propia forma de volver.
  const skillToggle = conHabilidades && skillHudView.screen === 'composer' && (
    <TooltipAnchor text="Elegir una habilidad por botón en vez de escribir">
      <button
        type="button"
        onClick={() => setSkillHudView({ screen: 'menu-barras' })}
        disabled={composerDisabled}
        aria-label="Habilidades"
        className="skill-slot tactile"
      >
        <span aria-hidden="true">✨</span>
      </button>
    </TooltipAnchor>
  )
  const activeBar = skillHudView.screen === 'barra-activa' ? skillBars.find((b) => b.id === skillHudView.skillBarId) : undefined
  return (
    <>
      {desollar && (
        <button
          type="button"
          onClick={desollar.onClick}
          disabled={desollar.disabled}
          className="tactile mx-4 mb-2 flex items-center gap-2 rounded-lg border border-accent-700/60 bg-accent-500/10 px-3 py-2 text-left text-sm text-accent-200 hover:bg-accent-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-lg leading-none">🔪</span>
          <span>Hay presas caídas sin desollar en esta zona.</span>
        </button>
      )}
      {conHabilidades && skillHudView.screen === 'menu-barras' ? (
        <div className="border-t border-iron-800 bg-wood-950/90 px-4 pb-3 pt-3.5">
          <SkillBarMenu
            skillBars={skillBars}
            onNavigate={setSkillHudView}
            onSelectBar={onSelectBar}
            onCreateBar={onCreateBar}
            onEditBar={onEditBar}
            onDeleteBar={onDeleteBar}
          />
        </div>
      ) : conHabilidades && skillHudView.screen === 'barra-activa' && activeBar ? (
        <div className="border-t border-iron-800 bg-wood-950/90 px-4 pb-3 pt-3.5">
          <SkillBarHud
            bar={activeBar}
            savedActions={savedActions}
            onUse={onUseAbility}
            onBackToComposer={onBackToComposer}
            onBackToBars={() => setSkillHudView({ screen: 'menu-barras' })}
            onEdit={() => onEditBar(activeBar)}
            disabled={composerDisabled}
          />
        </div>
      ) : (
        <ChatComposer
          ref={composerRef}
          onChange={onChange}
          onSubmit={onSubmit}
          disabled={composerDisabled}
          leftSlot={skillToggle}
          disabledReason={disabledReason}
        />
      )}
    </>
  )
}
