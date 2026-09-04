import { useEffect, useRef, useState } from 'react'
import type { RollInfo, CombatExchangeSideInfo } from '../types'
import { attributeLabels, attributeColorClasses } from '../lib/dice'
import { gradoOf, formatMultiplier, difficultyLabelFor } from './CombatExchangeBadge'
import { TooltipAnchor } from './TooltipAnchor'

/// Núcleo genérico de "tirada en vivo" (2026-09-04, centralización de todas las tiradas del juego
/// — petición explícita: "como si jugaras una partida D&D... que el efecto de los dados suceda de
/// verdad", no solo un badge con el número ya puesto). Antes esta lógica vivía privada dentro de
/// `DiceRollReveal.tsx` (solo ataque/defensa de combate) — movida aquí para que iniciativa, turno
/// normal, Huir y Tameo la reutilicen sin reimplementar el tick/desglose. `DiceRollReveal.tsx`
/// sigue existiendo como wrapper fino sobre `DiceRollVs` (mismo nombre público, `CombatPanel.tsx`
/// no cambia). `GatheringDiceReveal.tsx` (recolección) mantiene su propio JSX — shape (`rolls[]`
/// con posible ventaja, sin "vs") demasiado distinto para forzarlo aquí — pero reimporta las
/// constantes de cadencia desde este archivo en vez de duplicarlas.
const GRADE_COLOR: Record<'claro' | 'con_coste' | 'fallo', string> = {
  claro: 'text-moss-400',
  con_coste: 'text-cost-400',
  fallo: 'text-wood-400',
}
const GRADE_LAND_ANIM: Record<'claro' | 'con_coste' | 'fallo', string> = {
  claro: 'animate-stamp-in',
  con_coste: 'animate-stamp-in',
  fallo: 'animate-shake-no',
}

/// Duración de la caída de UN dado — SECUENCIAL en `DiceRollVs` (el segundo no empieza a girar
/// hasta que el primero ya aterrizó), ~10s en total para un "vs" completo. Ver histórico de la
/// cadencia en el comentario original de `buildRollTickDelays` más abajo.
export const ROLL_DURATION_MS = 5000

/// Cadencia de la tirada (ms entre cada número al azar que se enseña) — arranca rápida (30ms) y se
/// va frenando (×1.06 por paso, tope 180ms) antes de aterrizar, sin física real ni librería de
/// animación: generada para sumar justo `ROLL_DURATION_MS`.
function buildRollTickDelays(totalMs: number): number[] {
  const delays: number[] = []
  let elapsed = 0
  let delay = 30
  while (elapsed + delay < totalMs) {
    delays.push(delay)
    elapsed += delay
    delay = Math.min(180, Math.round(delay * 1.06))
  }
  return delays
}
export const ROLL_TICK_DELAYS_MS = buildRollTickDelays(ROLL_DURATION_MS)

/// Un lado de una tirada, cayendo — solo el NÚMERO gira, el 🎲 se queda fijo. Acepta cualquier
/// `RollInfo` (turno normal/Huir/Tameo, sin malus/bonus/multiplicador) o `CombatExchangeSideInfo`
/// (combate/iniciativa, con el desglose completo) — todos los campos enriquecidos son opcionales
/// y degradan limpio con `?? 0`/`?.` cuando faltan.
export function DiceFace({
  label,
  side,
  startDelayMs,
  showDifficulty,
  difficultyTooltip,
}: {
  label: string
  side: RollInfo | CombatExchangeSideInfo
  startDelayMs: number
  difficultyTooltip?: string
  showDifficulty: boolean
}) {
  const [display, setDisplay] = useState<number | null>(null)
  const [landed, setLanded] = useState(false)
  const grado = gradoOf(side)
  const enriched = side as Partial<CombatExchangeSideInfo>

  useEffect(() => {
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    let elapsed = startDelayMs
    for (const delay of ROLL_TICK_DELAYS_MS) {
      elapsed += delay
      timers.push(
        setTimeout(() => {
          if (cancelled) return
          setDisplay(1 + Math.floor(Math.random() * 20))
        }, elapsed),
      )
    }
    timers.push(
      setTimeout(() => {
        if (cancelled) return
        setDisplay(side.roll)
        setLanded(true)
      }, startDelayMs + ROLL_DURATION_MS),
    )
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe arrancar una vez por tirada, `side`/`startDelayMs` son estables durante la vida de este componente
  }, [])

  // Bono real que se SUMA al dado — mismo cálculo que `CombatExchangeBadge` (`Math.floor(valorEfectivo/2)`,
  // nunca el atributo crudo). Es un número fijo, conocido de antemano (no depende del dado), así
  // que se muestra desde YA, no solo al aterrizar. `valorEfectivo` cae a `side.value` cuando falta
  // (turno normal/Huir/Tameo, sin árbol de tipos ni malus).
  const valorCrudo = Math.max(1, side.value - (enriched.malus || 0) + (enriched.attributeBonus || 0))
  const valorEfectivo = enriched.valorEfectivo ?? side.value
  const bono = Math.floor(valorEfectivo / 2)

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="max-w-[6rem] truncate text-2xs uppercase tracking-wide text-wood-500">{label}</span>
      <span className="flex items-baseline justify-center gap-2">
        <span className="flex items-center gap-1">
          <span aria-hidden="true">🎲</span>
          <span
            className={`font-mono text-2xl font-bold tabular-nums ${landed ? `${GRADE_COLOR[grado]} ${GRADE_LAND_ANIM[grado]}` : 'text-wood-300'}`}
          >
            {display ?? '?'}
          </span>
        </span>
        <span className="flex items-baseline gap-1.5 font-mono text-sm">
          <span className="font-bold text-wood-100">+{bono}</span>
          <TooltipAnchor
            text={`${attributeLabels[side.attribute]} ${side.value}${enriched.malus ? ` − ${enriched.malus} por tu condición física` : ''}${enriched.attributeBonus ? ` + ${enriched.attributeBonus} de la habilidad` : ''} = ${valorCrudo}.${
              enriched.multiplicador != null && enriched.multiplicador !== 1
                ? ` Con ×${formatMultiplier(enriched.multiplicador)} de ventaja de tipo: ${valorCrudo}×${formatMultiplier(enriched.multiplicador)} ≈ ${valorEfectivo} (redondeado). Mitad = tu bono real: +${bono}.`
                : ` Mitad = tu bono real: +${bono}.`
            }`}
          >
            <span className="text-accent2-400 underline decoration-dotted decoration-wood-700 underline-offset-2">
              (
              {side.value}
              {!!enriched.malus && <span className="text-danger-400"> −{enriched.malus}sal</span>}
              {!!enriched.attributeBonus && <span className="text-moss-400"> +{enriched.attributeBonus}hab</span>}
              {enriched.malus || enriched.attributeBonus ? ` = ${valorCrudo}` : ''}
              {enriched.multiplicador != null && enriched.multiplicador !== 1 && (
                <>
                  <span className={enriched.multiplicador > 1 ? 'text-moss-400' : 'text-danger-400'}>×{formatMultiplier(enriched.multiplicador)}</span>
                  ≈{valorEfectivo}
                </>
              )}
              /2)
            </span>
          </TooltipAnchor>
        </span>
      </span>
      <span className={`text-2xs font-semibold ${attributeColorClasses[side.attribute].text}`}>{attributeLabels[side.attribute]}</span>
      {showDifficulty && (
        <TooltipAnchor
          text={
            difficultyTooltip ??
            `Dificultad fija según tu nivel frente al del rival — no es la tirada del otro lado. Umbral real: ${side.difficulty}.`
          }
        >
          <span className="font-mono text-2xs text-wood-600 underline decoration-dotted decoration-wood-700 underline-offset-2">
            necesitas {difficultyLabelFor(side.difficulty)} ({side.difficulty})
          </span>
        </TooltipAnchor>
      )}
    </div>
  )
}

/// Scroll automático al aparecer una tirada (2026-09-04, petición explícita jugando en vivo: "donde
/// se este ejecutando la tirada de dados el foco y el scroll deben apuntar a ese elemento que noto
/// que a veces me lo pierdo... por ejemplo en el de iniciativa en combate"). Centralizado aquí (no
/// en cada consumidor) porque `DiceRollSingle`/`DiceRollVs` se MONTAN de cero en cada tirada nueva
/// (nunca premontados cambiando de contenido, ver los `{roll && <.../>}` de LogPanel/CombatPanel/
/// TameoModal) — un `useEffect` sin dependencias en el propio componente se dispara exactamente una
/// vez por tirada real, sin tocar los sitios de llamada.
///
/// `block: 'center'` (bug real, 2026-09-04: con `'nearest'` el bloque quedaba parcialmente tapado
/// por el header del panel, "se queda a medias de colocarse donde se realiza la tirada" — porque
/// `CombatPanel.tsx` también hace `contentScrollRef.current?.scrollTo({top:0})` en su propio efecto
/// de montaje, en el MISMO ciclo en que se abre el panel/llega la primera tirada; sin retraso, ese
/// scroll a 0 puede ejecutarse después y pisar el `scrollIntoView` de aquí). El `setTimeout(0)`
/// empuja este scroll al siguiente tick de React, después de cualquier `scrollTo({top:0})` de
/// montaje que se dispare en el mismo render — así el de la tirada siempre gana, sea cual sea el
/// orden de los `useEffect` de padre/hijo.
///
/// Deliberadamente SIN `.focus()` — `CombatPanel.tsx` ya documentó (2026-08-31) que robar el foco
/// al abrir combate es más intrusivo que útil; mismo criterio aquí, el scroll basta para "no
/// perdérsela" sin secuestrar el teclado de en medio de lo que el jugador esté haciendo.
function useScrollIntoViewOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      // `scrollIntoView` no existe en jsdom (entorno de test) — comprobación explícita en vez de
      // solo `?.` en el elemento, que no protege contra un método ausente del todo.
      ref.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    }, 0)
    return () => clearTimeout(timer)
  }, [])
  return ref
}

/// Tirada de un solo lado (turno normal, Huir, o cualquier check simple sin oposición) — sustituye
/// a `RollBadge.tsx` cuando se quiere el momento de "tirada en vivo" (primera vez que se ve);
/// `RollBadge` se mantiene como modo histórico/estático para tiradas ya pasadas (Diario, recarga).
export function DiceRollSingle({ roll, label, showDifficulty = true }: { roll: RollInfo | CombatExchangeSideInfo; label?: string; showDifficulty?: boolean }) {
  const ref = useScrollIntoViewOnMount<HTMLDivElement>()
  return (
    <div ref={ref} className="animate-entry-in mt-2 flex items-center justify-center rounded-lg border border-dashed border-iron-700 bg-wood-950/30 px-3 py-3">
      <DiceFace
        label={label ?? 'Tú'}
        side={roll}
        startDelayMs={0}
        showDifficulty={showDifficulty}
        difficultyTooltip={`Umbral fijo de la acción, no depende de ningún rival. Umbral real: ${roll.difficulty}.`}
      />
    </div>
  )
}

/// Tirada opuesta ("vs") — dos lados, uno cae primero y el otro no empieza a girar hasta que el
/// primero aterriza del todo (secuencial, no en paralelo). Usada por combate (vía `DiceRollReveal`),
/// iniciativa, y Tameo/captura.
export function DiceRollVs({
  left,
  right,
  leftLabel,
  rightLabel,
  leftFirst,
  showDifficulty,
}: {
  left: RollInfo | CombatExchangeSideInfo
  right: RollInfo | CombatExchangeSideInfo
  leftLabel?: string
  rightLabel?: string
  leftFirst: boolean
  showDifficulty: boolean
}) {
  const leftDelayMs = leftFirst ? 0 : ROLL_DURATION_MS
  const rightDelayMs = leftFirst ? ROLL_DURATION_MS : 0
  const ref = useScrollIntoViewOnMount<HTMLDivElement>()

  return (
    <div ref={ref} className="animate-entry-in mt-2 flex items-center justify-center gap-14 rounded-lg border border-dashed border-iron-700 bg-wood-950/30 px-3 py-3">
      <DiceFace label={leftLabel ?? 'Tú'} side={left} startDelayMs={leftDelayMs} showDifficulty={showDifficulty} />
      <span className="text-xs text-wood-600">vs</span>
      <DiceFace label={rightLabel ?? 'el enemigo'} side={right} startDelayMs={rightDelayMs} showDifficulty={showDifficulty} />
    </div>
  )
}
