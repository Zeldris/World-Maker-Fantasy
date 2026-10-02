import { useEffect, useRef, useState } from 'react'
import { HealthBar } from './HealthBar'
import { BotonAjustes } from './BotonAjustes'
import { EnergyBar } from './EnergyBar'
import { HungerBar } from './HungerBar'
import { ThirstBar } from './ThirstBar'
import { ESTACION_ICON, CLIMA_ICON } from '../lib/entorno'
import { formatCountdown } from '../lib/gameViewHelpers'
import type { CondicionFisica, Dificultad, EntornoTemporalInfo } from '../types'

const LIMITE_MUERTES: Record<Exclude<Dificultad, 'NOVATO'>, number> = { MEDIO: 4, AVANZADO: 2 }

interface GameHeaderProps {
  characterName: string | null
  worldName: string | null
  level: number
  pendingAttributePoints: number
  condicionFisica: CondicionFisica
  energia: number
  energiaMax: number
  hambre: number
  sed: number
  dificultad: Dificultad
  deathCount: number
  /// UX-10 — hay una decisión esperando en cola, con su aviso.
  decisionEnEspera: boolean
  avisoDecision: string
  onAbrirDecision: () => void
  /// UX-8 — indicador de fase (null en `libre`) y su motivo para el tooltip.
  etiquetaFase: { icono: string; texto: string } | null
  motivoFase: string | null
  /// Fin de la actividad en curso si la fase es `ocupado` (cuenta atrás en el indicador).
  ocupadoHasta: string | null
  nowTick: number
  fictionalDate: string
  entorno: EntornoTemporalInfo | null
  /// HUD-12 — el mundo trabaja en segundo plano (ambientación, avance diario, Cronista).
  mundoAvanza: boolean
  onSalir: () => void
  onAbrirNivel: () => void
}

/// Cabecera de la partida (BAS-5, hito 0.2 — sacada de GameView.tsx sin cambio visual): salir,
/// personaje y mundo, nivel, barras de estado, muertes, decisión en cola, fase y fecha.
export function GameHeader({
  characterName,
  worldName,
  level,
  pendingAttributePoints,
  condicionFisica,
  energia,
  energiaMax,
  hambre,
  sed,
  dificultad,
  deathCount,
  decisionEnEspera,
  avisoDecision,
  onAbrirDecision,
  etiquetaFase,
  motivoFase,
  ocupadoHasta,
  nowTick,
  fictionalDate,
  entorno,
  mundoAvanza,
  onSalir,
  onAbrirNivel,
}: GameHeaderProps) {
  // Pop del botón "Nivel X" solo en una subida real, nunca al cargar la partida (roadmap de
  // animaciones 2026-07-20, item 7) — mismo patrón que HealthBar: comparar contra un ref, no
  // animar en el primer render.
  const [levelPop, setLevelPop] = useState(0)
  const prevLevelRef = useRef(level)
  useEffect(() => {
    if (prevLevelRef.current !== level) {
      setLevelPop((p) => p + 1)
      prevLevelRef.current = level
    }
  }, [level])

  // Mismo patrón que el pop de nivel — el chip de muertes solo destella cuando sube de verdad.
  const [deathPop, setDeathPop] = useState(0)
  const prevDeathCountRef = useRef(deathCount)
  useEffect(() => {
    if (prevDeathCountRef.current !== deathCount) {
      setDeathPop((p) => p + 1)
      prevDeathCountRef.current = deathCount
    }
  }, [deathCount])

  return (
      <header className="iron-band relative flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-2.5">
        <div className="min-w-0">
          <button type="button"
            onClick={onSalir}
            className="text-xs text-wood-500 transition-colors hover:text-accent-300"
          >
            ← Salir a tus partidas
          </button>
          <p className="mt-0.5 truncate font-serif text-base tracking-wide text-wood-200">
            <span className="text-accent-400">{characterName}</span>
            <span className="mx-2 text-wood-600">·</span>
            <span className="text-wood-300">{worldName}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button"
            onClick={onAbrirNivel}
            title={pendingAttributePoints > 0 ? `${pendingAttributePoints} puntos de atributo por repartir` : 'Nivel'}
            className="relative flex items-center gap-1.5 rounded-md border border-iron-700 bg-wood-950/60 px-2.5 py-1 font-serif text-xs tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
          >
            <span key={levelPop} className={`inline-flex items-center gap-1.5 ${levelPop > 0 ? 'animate-pop-once' : ''}`}>
              <span className="gem" />
              Nivel {level}
            </span>
            {pendingAttributePoints > 0 && (
              <span className="ml-1 rounded-full bg-accent-500 px-1.5 text-2xs font-bold text-wood-950">
                +{pendingAttributePoints}
              </span>
            )}
          </button>
          <HealthBar condicionFisica={condicionFisica} />
          <EnergyBar energia={energia} energiaMax={energiaMax} />
          <HungerBar hambre={hambre} />
          <ThirstBar sed={sed} />
          {dificultad !== 'NOVATO' && (
            // Indicador de muerte permanente (2026-07-19, auditoría de frontend): docs/14 § 4.2
            // ya tiene un límite real de muertes por dificultad, pero el jugador no tenía ninguna
            // señal en pantalla de cuántas le quedan hasta el fin de partida definitivo.
            <span
              key={deathPop}
              title={`Muerte permanente a la ${LIMITE_MUERTES[dificultad]}ª muerte (dificultad ${dificultad.toLowerCase()})`}
              className={`relative rounded-md border border-iron-700 bg-wood-950/60 px-2.5 py-1 font-serif text-xs tracking-wide text-wood-300 ${
                deathPop > 0 ? 'animate-pop-once' : ''
              }`}
            >
              {deathPop > 0 && (
                <span aria-hidden="true" className="animate-edge-flash-red pointer-events-none absolute inset-0 rounded-md border border-danger-500" />
              )}
              💀 {deathCount}/{LIMITE_MUERTES[dificultad]}
            </span>
          )}
          {/* UX-10 (hito 0.2) — decisión en cola: aviso con botón para abrirla ya. */}
          {decisionEnEspera && (
            <button
              type="button"
              onClick={onAbrirDecision}
              title="Se abrirá sola al terminar; pulsa para abrirla ahora"
              className="tactile rounded-full border border-accent-600/70 bg-accent-500/10 px-2.5 py-1 font-serif text-2xs tracking-wide text-accent-300 hover:bg-accent-500/20"
            >
              <span aria-hidden="true">⚠️</span> {avisoDecision}
            </button>
          )}
          {/* UX-8 (hito 0.2) — indicador de la fase cuando algo está bloqueado, con el motivo al
              pasar el ratón; en `libre` no aparece. */}
          {etiquetaFase && (
            <span
              role="status"
              title={motivoFase ?? undefined}
              className="rounded-full border border-iron-700 bg-wood-950/60 px-2.5 py-1 font-serif text-2xs tracking-wide text-wood-300"
            >
              <span aria-hidden="true">{etiquetaFase.icono}</span> {etiquetaFase.texto}
              {ocupadoHasta ? ` · ${formatCountdown(ocupadoHasta, nowTick)}` : ''}
            </span>
          )}
          <span
            // C.11 (checklist frontend 2026-08-27) — mismo `rounded-full`/`text-2xs` que el badge
            // expandido de MapaPanel (misma info, tratamiento compacto vs. expandido a propósito,
            // ver comentario de abajo — solo se unifica la FORMA del contenedor, no el contenido).
            className="rounded-full border border-iron-700 bg-wood-950/60 px-2.5 py-1 font-serif text-2xs tracking-wide text-wood-300"
            // Estación/clima (2026-08-27, diseño/UX § 4.1: "candidato natural para absorber
            // estación/clima sin que la jugadora tenga que ir a buscarlos a ningún panel... cero
            // clics adicionales") — solo iconos aquí (el detalle completo en texto ya vive en el
            // badge de Mapa > Berig), el `title` da el nombre completo al pasar el ratón.
            title={entorno ? `${entorno.estacion.nombre}${entorno.clima ? ` · ${entorno.clima.nombre}` : ''}` : undefined}
          >
            {/* HUD-12 (hito 0.2) — «El mundo avanza»: gema que respira junto a la fecha; nunca bloquea. */}
          {mundoAvanza && <span role="status" aria-label="El mundo avanza" title="El mundo avanza" className="gem animate-pulse-soft mr-1.5 inline-block align-middle" />}
          {fictionalDate}
            {entorno && (
              <>
                {' '}
                {ESTACION_ICON[entorno.estacion.key]}
                {entorno.clima && CLIMA_ICON[entorno.clima.key]}
              </>
            )}
          </span>
          {/* CFG-1 (hito 0.2) — configuración siempre a mano. */}
          <BotonAjustes />
        </div>
        <div className="accent-hairline absolute inset-x-0 bottom-0" />
      </header>
  )
}
