import { useEffect, useState } from 'react'
import type { GatheringRollInfo } from '../types'
import { attributeLabels, attributeColorClasses } from '../lib/dice'
import { ROLL_DURATION_MS, ROLL_TICK_DELAYS_MS } from './DiceRoll'

/// Tirada visible de Explorar/Desollar (rediseño de recolección, 2026-08-22, petición explícita:
/// "hay que añadirle una tirada visual con dado... como el combate"). Mismo lenguaje de caída que
/// `DiceRollReveal.tsx` (mismo `ROLL_DURATION_MS`/cadencia), pero deliberadamente MÁS simple: aquí
/// no hay una única dificultad fija que mostrar como "necesitas X" — el resultado se compara contra
/// la dificultad de cada recurso candidato por separado, y ese desenlace ya se ve en el propio
/// listado (aparece o no, con cuánta cantidad), no en este componente.
///
/// Uno o dos dados: Suerte por encima del umbral (backend, `SUERTE_VENTAJA_UMBRAL`) da VENTAJA —
/// se tiran dos d20 y se usa el mayor, nunca un modificador numérico sumado (así es como D&D trata
/// la suerte de verdad: rasgo Lucky/dote Lucky = repetir o tirar con ventaja). El dado descartado
/// se queda tachado en vez de desaparecer, para que se note que sí hubo ventaja.
function SingleDie({ value, landed, discarded }: { value: number | null; landed: boolean; discarded: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span aria-hidden="true">🎲</span>
      <span
        className={`font-mono text-2xl font-bold tabular-nums ${
          !landed ? 'text-wood-300' : discarded ? 'text-wood-700 line-through' : 'text-moss-400 animate-stamp-in'
        }`}
      >
        {value ?? '?'}
      </span>
    </span>
  )
}

export function GatheringDiceReveal({ roll, oficioLabel, onLanded }: { roll: GatheringRollInfo; oficioLabel: string; onLanded?: () => void }) {
  const [displays, setDisplays] = useState<(number | null)[]>(() => roll.rolls.map(() => null))
  const [landed, setLanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    let elapsed = 0
    for (const delay of ROLL_TICK_DELAYS_MS) {
      elapsed += delay
      timers.push(
        setTimeout(() => {
          if (cancelled) return
          setDisplays(roll.rolls.map(() => 1 + Math.floor(Math.random() * 20)))
        }, elapsed),
      )
    }
    timers.push(
      setTimeout(() => {
        if (cancelled) return
        setDisplays(roll.rolls)
        setLanded(true)
        // Avisa al pop-up para que revele el listado DESPUÉS de que el dado aterrice de verdad
        // (bug real jugando en vivo, 2026-08-22: "antes de incluso acabar el roll ya me está
        // mostrando todo" — `sources`/`roll` llegan juntos de la misma respuesta, así que sin este
        // aviso el listado se pintaba entero desde el primer render, spoileando el resultado
        // mientras el dado todavía giraba).
        onLanded?.()
      }, ROLL_DURATION_MS),
    )
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe arrancar una vez por tirada, `roll`/`onLanded` son estables durante la vida de este componente
  }, [])

  const bono = Math.floor(roll.value / 2) + roll.bonusOficio

  return (
    <div className="animate-entry-in mt-2 flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-iron-700 bg-wood-950/30 px-3 py-3">
      {roll.advantage && (
        <span className="text-2xs font-semibold text-cost-400">🍀 Ventaja por Suerte — se queda con el mejor de los dos dados</span>
      )}
      <div className="flex items-center gap-3">
        {displays.map((value, i) => (
          <SingleDie key={i} value={value} landed={landed} discarded={landed && roll.rolls.length > 1 && roll.rolls[i] !== roll.usedRoll} />
        ))}
      </div>
      {landed && (
        <span className="flex items-baseline gap-1.5 font-mono text-sm">
          <span className="font-bold text-wood-100">+{bono}</span>
          <span className="text-accent2-400">= {roll.result}</span>
        </span>
      )}
      <span className={`text-2xs font-semibold ${attributeColorClasses[roll.attribute].text}`}>
        {oficioLabel} · {attributeLabels[roll.attribute]}
      </span>
    </div>
  )
}
