import { useEffect, useRef, useState } from 'react'
import type { RollInfo, CombatExchangeSideInfo } from '../types'
import { attributeLabels, attributeColorClasses } from '../lib/dice'
import { gradoOf, formatMultiplier, difficultyLabelFor } from './CombatExchangeBadge'
import { TooltipAnchor } from './TooltipAnchor'
import { RollBreakdown } from './RollBreakdown'
import { debeDesplazarseATirada, escucharScrollManual } from '../lib/scrollTirada'
import { buildRollTickDelays, cancelarTirada, duracionTirada, retardosTirada, ROLL_DURATION_MS, saltarTiradas, temporizadorTirada } from '../lib/duracionTirada'

const TITULO_SALTAR = 'Clic o Espacio: ver ya el resultado'

/// Núcleo genérico de "tirada en vivo" (2026-09-04, centralización de todas las tiradas del juego
/// — petición explícita: "como si jugaras una partida D&D... que el efecto de los dados suceda de
/// verdad", no solo un badge con el número ya puesto). Antes esta lógica vivía privada dentro de
/// `DiceRollReveal.tsx` (solo ataque/defensa de combate) — movida aquí para que iniciativa, turno
/// normal, Huir y Tameo la reutilicen sin reimplementar el tick/desglose. `DiceRollReveal.tsx`
/// sigue existiendo como wrapper fino sobre `DiceRollVs` (mismo nombre público, `CombatPanel.tsx`
/// no cambia). `GatheringDiceReveal.tsx` (recolección) mantiene su propio JSX — shape (`rolls[]`
/// con posible ventaja, sin "vs") demasiado distinto para forzarlo aquí — pero reimporta las
/// constantes de cadencia desde este archivo en vez de duplicarlas.
// DAD-6 (hito 0.1, H22) — el fallo tenía el gris del texto normal; ahora tiene color propio.
const GRADE_COLOR: Record<'claro' | 'fallo', string> = {
  claro: 'text-moss-400',
  fallo: 'text-danger-400',
}
const GRADE_LAND_ANIM: Record<'claro' | 'fallo', string> = {
  claro: 'animate-stamp-in',
  fallo: 'animate-shake-no',
}

// CFG-20 (hito 0.2) — la duración vive en lib/duracionTirada.ts (ajustable); se reexportan las
// constantes de siempre para quien solo necesite el valor de referencia (tests).
export { ROLL_DURATION_MS } from '../lib/duracionTirada'
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
  forcedGrado,
}: {
  label: string
  side: RollInfo | CombatExchangeSideInfo
  startDelayMs: number
  difficultyTooltip?: string
  showDifficulty: boolean
  /// Bug real jugando en vivo (2026-09-07, "las dos tiradas de combate deberían ser mi tirada vs
  /// la suya, no contra una dificultad"): en un check OPUESTO (iniciativa, y cualquier intercambio
  /// de combate que ya compara directo — `esCheckOpuesto`, CombatExchangeBadge.tsx), cada lado se
  /// calcula igualmente con `difficulty: 0` de relleno (ver `rollInitiative`/`resolveExchange`,
  /// backend), así que `gradoOf(side)` (== `side.success`) da SIEMPRE "claro" para los dos lados —
  /// el número aterrizaba siempre en verde/éxito, ganara o no la comparación real. `forcedGrado`
  /// (calculado por el padre, `DiceRollVs`, comparando ambos `result` directamente) sustituye a
  /// `gradoOf` cuando se pasa — mismo criterio que ya usa `winnerSide` (CombatExchangeBadge.tsx)
  /// para el resumen posterior, ahora también en la animación en vivo.
  forcedGrado?: 'claro' | 'fallo'
}) {
  const [display, setDisplay] = useState<number | null>(null)
  const [landed, setLanded] = useState(false)
  const grado = forcedGrado ?? gradoOf(side)
  const enriched = side as Partial<CombatExchangeSideInfo>

  useEffect(() => {
    let cancelled = false
    let aterrizado = false
    const timers: ReturnType<typeof setTimeout>[] = []
    let elapsed = startDelayMs
    for (const delay of retardosTirada()) {
      elapsed += delay
      timers.push(
        setTimeout(() => {
          if (cancelled || aterrizado) return
          setDisplay(1 + Math.floor(Math.random() * 20))
        }, elapsed),
      )
    }
    // CFG-20: el aterrizaje se puede adelantar con un clic o `Espacio` (`saltarTiradas`).
    const aterrizaje = temporizadorTirada(() => {
      if (cancelled) return
      aterrizado = true
      setDisplay(side.roll)
      setLanded(true)
    }, startDelayMs + duracionTirada(), { visible: true })
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      cancelarTirada(aterrizaje)
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
  const otros = side.result - side.roll - bono

  return (
    <div className="flex min-w-0 max-w-full flex-col items-center gap-1">
      {/* DAD-4 (hito 0.1, H23) — sin truncar: el nombre real del personaje o del rival cabe entero. */}
      <span className="max-w-[11rem] text-center text-2xs uppercase leading-tight tracking-wide text-wood-400 break-words">{label}</span>
      <span className="flex flex-wrap items-baseline justify-center gap-x-2">
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
              <RollBreakdown side={enriched} valorCrudo={valorCrudo} valorEfectivo={valorEfectivo} />
            </span>
          </TooltipAnchor>
        </span>
      </span>
      <span className={`text-2xs font-semibold ${attributeColorClasses[side.attribute].text}`}>{attributeLabels[side.attribute]}</span>
      {/* DAD-3 (hito 0.1, H20) — al aterrizar, la cuenta completa sin sumar de cabeza:
          dado + bono = total, y contra la dificultad con su veredicto si la hay. */}
      {landed && (
        <span data-testid="tirada-total" className="animate-entry-in font-mono text-xs text-wood-200">
          {side.roll} + {bono}
          {/* Lo que el backend suma aparte del dado y la mitad del atributo (bono de tirada de una
              habilidad, dado con ventaja…) — siempre explícito para que la cuenta cuadre. */}
          {otros !== 0 && ` ${otros > 0 ? '+' : '−'} ${Math.abs(otros)}`} = <span className="font-bold">{side.result}</span>
          {showDifficulty && (
            <>
              {' '}vs {side.difficulty} →{' '}
              <span className={`font-semibold ${GRADE_COLOR[grado]}`}>{grado === 'claro' ? 'Éxito' : 'Fallo'}</span>
            </>
          )}
        </span>
      )}
      {showDifficulty && (
        <TooltipAnchor
          text={
            difficultyTooltip ??
            `Dificultad fija según tu nivel frente al del rival — no es la tirada del otro lado. Umbral real: ${side.difficulty}.`
          }
        >
          <span className="font-mono text-2xs text-wood-400 underline decoration-dotted decoration-wood-600 underline-offset-2">
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
///
/// DAD-5 (hito 0.1, H24) — ya no es incondicional: solo si la tirada no se ve y el jugador no ha
/// movido el scroll a mano hace poco (lib/scrollTirada.ts), para no arrastrarle mientras lee.
function useScrollIntoViewOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    escucharScrollManual()
    const timer = setTimeout(() => {
      const el = ref.current
      if (!el || !debeDesplazarseATirada(el)) return
      // `scrollIntoView` no existe en jsdom (entorno de test) — comprobación explícita en vez de
      // solo `?.` en el elemento, que no protege contra un método ausente del todo.
      el.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
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
    <div ref={ref} onClick={saltarTiradas} title={TITULO_SALTAR} className="animate-entry-in mt-2 flex items-center justify-center rounded-lg border border-dashed border-iron-700 bg-wood-950/30 px-3 py-3">
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

/// Bug real jugando en vivo (2026-09-07, ver comentario largo de `DiceFace.forcedGrado`) — en un
/// check OPUESTO (`!showDifficulty`), quién "gana" cada lado es una comparación directa entre
/// ambos resultados, nunca contra la `difficulty: 0` de relleno que trae cada lado por separado.
/// Empate exacto → gana el DEFENSOR (mismo criterio ya documentado en combatExchange.ts §
/// resolveExchange: "el golpe no logra superar la defensa") — aquí no hay atacante/defensor
/// explícito, solo left/right, así que el empate se resuelve a favor de `right` (el lado que la
/// convención de este componente ya trata como "el otro", ver `rightLabel ?? 'el enemigo'`).
/// Extraída como función pura (testeable sin montar el componente).
export type LadoGanador = 'izquierda' | 'derecha'

export function forcedGradosFor(
  leftResult: number,
  rightResult: number,
  showDifficulty: boolean,
  ganador?: LadoGanador,
): { leftGrado: 'claro' | 'fallo' | undefined; rightGrado: 'claro' | 'fallo' | undefined } {
  if (showDifficulty) return { leftGrado: undefined, rightGrado: undefined }
  // P69 (QA-27): cuando quien gana ya lo decidió el backend (iniciativa: el empate es de la
  // jugadora), manda ese dato, no la regla del intercambio.
  if (ganador) return { leftGrado: ganador === 'izquierda' ? 'claro' : 'fallo', rightGrado: ganador === 'derecha' ? 'claro' : 'fallo' }
  return {
    leftGrado: leftResult > rightResult ? 'claro' : 'fallo',
    rightGrado: rightResult >= leftResult ? 'claro' : 'fallo',
  }
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
  onAllLanded,
  ganador,
}: {
  left: RollInfo | CombatExchangeSideInfo
  right: RollInfo | CombatExchangeSideInfo
  leftLabel?: string
  rightLabel?: string
  leftFirst: boolean
  showDifficulty: boolean
  /// Bug real jugando en vivo (2026-09-06): "Actúas primero." (CombatPanel.tsx) se mostraba en
  /// cuanto `lastInitiativeRoll` llegaba del backend, con el dato YA resuelto — pero el dado del
  /// lado que tira en segundo lugar seguía enseñando "?" varios segundos más, porque su animación
  /// es secuencial (no arranca hasta que el primero aterriza). El texto de conclusión "ganaba la
  /// carrera" siempre, sin excepción, porque nunca esperaba a nada. Callback opcional, disparado
  /// una sola vez cuando el SEGUNDO dado (el que tarda más: `leftDelayMs`/`rightDelayMs` +
  /// `ROLL_DURATION_MS`) termina de aterrizar — el padre lo usa para diferir cualquier conclusión
  /// textual hasta que ambos números sean visibles de verdad.
  onAllLanded?: () => void
  /// Quién gana según el backend, si no se decide comparando resultados (P69: empates de iniciativa).
  ganador?: LadoGanador
}) {
  const leftDelayMs = leftFirst ? 0 : duracionTirada()
  const rightDelayMs = leftFirst ? duracionTirada() : 0
  const ref = useScrollIntoViewOnMount<HTMLDivElement>()
  const [ambosAterrizados, setAmbosAterrizados] = useState(false)

  useEffect(() => {
    const totalMs = Math.max(leftDelayMs, rightDelayMs) + duracionTirada()
    const timer = temporizadorTirada(() => {
      setAmbosAterrizados(true)
      onAllLanded?.()
    }, totalMs)
    return () => cancelarTirada(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- misma disciplina que DiceFace: arranca una sola vez por tirada, `leftDelayMs`/`rightDelayMs`/`onAllLanded` son estables durante su vida
  }, [])

  const { leftGrado, rightGrado } = forcedGradosFor(left.result, right.result, showDifficulty, ganador)

  const nombreIzq = leftLabel ?? 'Tú'
  const nombreDer = rightLabel ?? 'el enemigo'

  return (
    <div ref={ref} onClick={saltarTiradas} title={TITULO_SALTAR} className="animate-entry-in mt-2 flex flex-col items-center gap-2 rounded-lg border border-dashed border-iron-700 bg-wood-950/30 px-3 py-3">
      {/* Fase G del 0.1 (hallazgo G4): en el panel de combate, estrecho, los dos lados no cabían en
          fila con `gap-14` y la fórmula del rival se cortaba con barra horizontal — ahora se
          acercan y, si aun así no caben, el rival baja debajo. */}
      <div className="flex max-w-full flex-wrap items-start justify-center gap-x-8 gap-y-2">
        <DiceFace label={nombreIzq} side={left} startDelayMs={leftDelayMs} showDifficulty={showDifficulty} forcedGrado={leftGrado} />
        <span className="self-center text-xs text-wood-500">vs</span>
        <DiceFace label={nombreDer} side={right} startDelayMs={rightDelayMs} showDifficulty={showDifficulty} forcedGrado={rightGrado} />
      </div>
      {/* DAD-3 (hito 0.1, H20) — en una tirada opuesta, la comparación final cuando ya se ven los dos dados. */}
      {!showDifficulty && ambosAterrizados && (
        <p data-testid="tirada-comparacion" className="animate-entry-in font-mono text-xs text-wood-200">
          {left.result} vs {right.result} → <span className="font-semibold text-moss-400">{leftGrado === 'claro' ? nombreIzq : nombreDer}</span>
        </p>
      )}
    </div>
  )
}
