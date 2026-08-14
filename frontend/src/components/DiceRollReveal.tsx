import { useEffect, useState } from 'react'
import type { CombatExchangeInfo, CombatExchangeSideInfo } from '../types'
import { attributeLabels } from '../lib/dice'
import { gradoOf } from './CombatExchangeBadge'

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
const ROLL_DURATION_MS = 5000

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
const ROLL_TICK_DELAYS_MS = buildRollTickDelays(ROLL_DURATION_MS)

/// Un lado del intercambio, cayendo (petición explícita: solo el NÚMERO gira, el 🎲 se queda
/// fijo — más simple, y coincide con cómo ya se muestran las tiradas resueltas en todo el juego).
function DiceSide({ label, side, startDelayMs }: { label: string; side: CombatExchangeSideInfo; startDelayMs: number }) {
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

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="max-w-[6rem] truncate text-2xs uppercase tracking-wide text-wood-500">{label}</span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true">🎲</span>
        <span
          className={`font-mono text-2xl font-bold tabular-nums ${landed ? `${GRADE_COLOR[grado]} ${GRADE_LAND_ANIM[grado]}` : 'text-wood-300'}`}
        >
          {display ?? '?'}
        </span>
      </span>
      <span className="text-2xs text-wood-500">{attributeLabels[side.attribute]}</span>
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

  return (
    <div className="animate-entry-in mt-2 flex items-center justify-center gap-14 rounded-lg border border-dashed border-iron-700 bg-wood-950/30 px-3 py-3">
      <DiceSide label={playerName ?? 'Tú'} side={jugador} startDelayMs={jugadorDelayMs} />
      <span className="text-xs text-wood-600">vs</span>
      <DiceSide label={enemyName ?? 'el enemigo'} side={enemigo} startDelayMs={enemigoDelayMs} />
    </div>
  )
}
