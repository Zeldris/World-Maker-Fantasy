import { useEffect, useState } from 'react'
import type { CombatExchangeInfo, CombatExchangeSideInfo } from '../types'
import { attributeLabels, attributeColorClasses } from '../lib/dice'
import { gradoOf, formatMultiplier, difficultyLabelFor, esCheckOpuesto } from './CombatExchangeBadge'
import { TooltipAnchor } from './TooltipAnchor'

/// Animación de dados en paralelo (petición explícita, 2026-08-15: "que veas los resultados
/// sacados por ambos... mientras la narración se genera") — el backend manda el intercambio de
/// combate ya resuelto del todo (dos tiradas + desenlace) ANTES de que empiece a llegar texto de
/// narración (ver `onExchangeResolved`, api.ts/turnResolution.ts), así que esta espera real del
/// modelo local (varios segundos en este hardware) deja de ser tiempo muerto: se ve la tirada de
/// cada lado como si cayera en vivo, mientras el texto sigue generándose debajo.
///
/// Mismos colores/animaciones de aterrizaje que ya usa `RollBadge.tsx` para cualquier tirada
/// resuelta (claro/con_coste → `animate-stamp-in`, sello con overshoot; fallo → `animate-shake-no`,
/// rebote en seco) — un dado que "cae mal" debe SENTIRSE distinto de uno que cae bien, mismo
/// lenguaje visual en todo el juego, no uno nuevo solo para esto.
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

/// Duración de la caída de UN dado (petición explícita, 2026-08-15: "que el primer dado tarde 5
/// segundos... y que el otro tarde 5 segs al acabar el otro de mostrarse, para que no sea tan
/// rápida la animación") — SECUENCIAL, no en paralelo con un pequeño desfase: el segundo dado ni
/// empieza a girar hasta que el primero ya aterrizó del todo, así que la espera total son ~10s.
/// Exportadas (2026-08-22) para que `GatheringDiceReveal.tsx` (tirada de Explorar/Desollar) use la
/// misma cadencia de caída sin duplicar la lista — un solo dado ahí, dos si hay ventaja por Suerte,
/// pero el mismo "impulso perdiéndose" que ya se siente en combate.
export const ROLL_DURATION_MS = 5000

/// Cadencia de la tirada (ms entre cada número al azar que se enseña) — arranca rápida y se va
/// frenando antes de aterrizar, la sensación clásica de "el dado pierde impulso", sin física real
/// ni librería de animación: generada para sumar justo `ROLL_DURATION_MS`, en vez de una lista
/// corta fija. Petición explícita, segunda vuelta (2026-08-15): "que en esos 5 segundos el roll
/// vaya mucho más rápido y muestre más números" — el primer ajuste frenaba demasiado pronto (tope
/// de 450ms alcanzado a los ~2,7s, dejando el resto del giro casi quieto). Arranque más rápido
/// (30ms), crecimiento más suave (×1.06) y tope más bajo (180ms) — el doble largo de números
/// visibles en los mismos 5 segundos, sin dejar de notarse el frenado final.
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

/// Un lado del intercambio, cayendo (petición explícita: solo el NÚMERO gira, el 🎲 se queda
/// fijo — más simple, y coincide con cómo ya se muestran las tiradas resueltas en todo el juego).
function DiceSide({
  label,
  side,
  startDelayMs,
  showDifficulty,
}: {
  label: string
  side: CombatExchangeSideInfo
  startDelayMs: number
  showDifficulty: boolean
}) {
  const [display, setDisplay] = useState<number | null>(null)
  const [landed, setLanded] = useState(false)
  const grado = gradoOf(side)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe arrancar una vez por intercambio, `side`/`startDelayMs` son estables durante la vida de este componente
  }, [])

  // Bono real que se SUMA al dado (petición explícita, 2026-08-15: "saqué un 4 y eso se le sumará
  // a tus 11 de destreza, que se vea para que se entienda que eso después se suma") — mismo cálculo
  // exacto que ya usa CombatExchangeBadge (`Math.floor(valorEfectivo / 2)`, NO el atributo crudo:
  // bug real ya cerrado una vez ahí, 2026-08-09, mostrar el crudo en vez del ya multiplicado nunca
  // cuadraba con el resultado final cuando la árbol de ventajas aplicaba). Es un número fijo,
  // conocido de antemano — no depende del dado — así que se muestra desde YA, no solo al aterrizar.
  //
  // "(valorCrudo×mult≈valorEfectivo/2)" en gris junto al bono (petición explícita, 2026-08-15;
  // revisado 2026-08-18 y de nuevo 2026-08-20, mismo criterio y mismo motivo que
  // CombatExchangeBadge.tsx: el ×mult vive DENTRO del numerador de la fracción, resuelto antes del
  // "/2" — sacarlo fuera de la fracción, como antes, se leía como una multiplicación todavía
  // pendiente sobre el total de arriba. `side.valorEfectivo` es el mismo número que ya calculó el
  // backend para `bono` — se reutiliza tal cual, nunca se recalcula aparte.
  const valorCrudo = Math.max(1, side.value - (side.malus || 0))
  const bono = Math.floor(side.valorEfectivo / 2)

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="max-w-[6rem] truncate text-2xs uppercase tracking-wide text-wood-500">{label}</span>
      {/* Dos filas separadas en vez de una sola apretada (petición explícita, 2026-08-15: "las
          separaciones de los números no están alineadas... que la tirada salga arriba y debajo
          el attr por el multiplicador"): arriba el dado + su bono (lo que de verdad se está
          tirando), abajo el atributo con su multiplicador de tipo si aplica (por qué el bono es
          ese). Sin el total "=resultado" (petición explícita previa) — CombatExchangeBadge ya lo
          muestra al terminar el turno. */}
      <span className="flex items-baseline justify-center gap-2">
        <span className="flex items-center gap-1">
          <span aria-hidden="true">🎲</span>
          <span
            className={`font-mono text-2xl font-bold tabular-nums ${landed ? `${GRADE_COLOR[grado]} ${GRADE_LAND_ANIM[grado]}` : 'text-wood-300'}`}
          >
            {display ?? '?'}
          </span>
        </span>
        {/* Dos colores deliberadamente distintos (petición explícita, 2026-08-20: "que los que
            suman estén en un color y lo del paréntesis en otro"), mismo criterio que
            CombatExchangeBadge.tsx — `wood-100` cálido para el bono que de verdad se suma al
            dado, `accent2` frío para la fracción que solo explica de dónde sale ese número. */}
        <span className="flex items-baseline gap-1.5 font-mono text-sm">
          <span className="font-bold text-wood-100">+{bono}</span>
          <span className="text-accent2-400">
            ({valorCrudo}
            {/* El ×mult se resuelve AQUÍ DENTRO, antes del "/2" — mismo criterio y mismo motivo
                que CombatExchangeBadge.tsx (bug real, 2026-08-20). */}
            {side.multiplicador != null && side.multiplicador !== 1 && (
              <>
                <span className={side.multiplicador > 1 ? 'text-moss-400' : 'text-danger-400'}>×{formatMultiplier(side.multiplicador)}</span>
                ≈{side.valorEfectivo}
              </>
            )}
            /2)
          </span>
        </span>
      </span>
      {/* Color por atributo (petición explícita, 2026-08-20) — mismo `attributeColorClasses` que
          ya usa CombatExchangeBadge.tsx en la cabecera "Atr vs Atr", así el nombre del atributo se
          reconoce de un vistazo también mientras el dado todavía está cayendo. */}
      <span className={`text-2xs font-semibold ${attributeColorClasses[side.attribute].text}`}>{attributeLabels[side.attribute]}</span>
      {/* Dificultad necesaria (petición explícita, 2026-08-15: "añadir en algún lado el mínimo
          necesario que necesitas sacar") — visible desde el principio, no solo al aterrizar: es
          un dato fijo que no depende de la tirada, mismo criterio y mismo texto/tooltip que ya usa
          CombatExchangeBadge ("necesitaba X") para no inventar una segunda forma de explicarlo.
          Rediseño a check opuesto (2026-08-21): en un turno NUEVO esta dificultad ya no decide
          nada — el desenlace sale de comparar los dos totales entre sí, no contra este umbral —
          así que mostrarla aquí sería directamente engañoso; se oculta (CombatExchangeBadge, ya
          aterrizado el turno, es quien explica el margen real). Solo se mantiene para turnos
          `resolveIndependentExchange` (`!showDifficulty` es falso solo cuando SÍ aplica). */}
      {showDifficulty && (
        <TooltipAnchor text={`Dificultad fija según tu nivel frente al del rival — no es la tirada del otro lado. Umbral real: ${side.difficulty}.`}>
          <span className="font-mono text-2xs text-wood-600 underline decoration-dotted decoration-wood-700 underline-offset-2">
            necesitas {difficultyLabelFor(side.difficulty)} ({side.difficulty})
          </span>
        </TooltipAnchor>
      )}
    </div>
  )
}

export function DiceRollReveal({ exchange, playerName, enemyName }: { exchange: CombatExchangeInfo; playerName?: string; enemyName?: string }) {
  const jugador = exchange.atacanteEsJugador ? exchange.atacante : exchange.defensor
  const enemigo = exchange.atacanteEsJugador ? exchange.defensor : exchange.atacante
  // Orden de iniciativa (petición explícita: "dependiendo de la iniciativa") — quien tiene la
  // iniciativa este intercambio (el atacante) cae primero; el otro no empieza a girar hasta que
  // el primero ya aterrizó del todo (secuencial, ver ROLL_DURATION_MS), no en paralelo.
  const jugadorDelayMs = exchange.atacanteEsJugador ? 0 : ROLL_DURATION_MS
  const enemigoDelayMs = exchange.atacanteEsJugador ? ROLL_DURATION_MS : 0
  const showDifficulty = !esCheckOpuesto(exchange)

  return (
    <div className="animate-entry-in mt-2 flex items-center justify-center gap-14 rounded-lg border border-dashed border-iron-700 bg-wood-950/30 px-3 py-3">
      <DiceSide label={playerName ?? 'Tú'} side={jugador} startDelayMs={jugadorDelayMs} showDifficulty={showDifficulty} />
      <span className="text-xs text-wood-600">vs</span>
      <DiceSide label={enemyName ?? 'el enemigo'} side={enemigo} startDelayMs={enemigoDelayMs} showDifficulty={showDifficulty} />
    </div>
  )
}
