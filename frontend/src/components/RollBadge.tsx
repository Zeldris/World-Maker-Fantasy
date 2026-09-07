import type { RollInfo } from '../types'
import { attributeLabels } from '../lib/dice'

// Grados de éxito (2026-07-19, binario desde el 2026-09-07 — hallazgo 15/19b,
// revisar-partida-hallazgos.md: "con coste" retirado por ser puramente cosmético, nunca decidía
// nada mecánico real y a veces contradecía el resultado real del intercambio).
//
// Modo histórico/estático (2026-09-04, centralización de todas las tiradas del juego) — este
// badge dejó de ser el único modo para un turno normal/Huir: la primera vez que se ve una tirada
// EN VIVO (esta sesión, turno recién resuelto), `LogPanel.tsx` monta `DiceRollSingle` (DiceRoll.tsx)
// en su lugar, con el dado rodando de verdad. `RollBadge` se sigue usando siempre para el Diario
// (histórico por diseño, nunca "en vivo") y para cualquier turno de esta misma sesión que ya se
// vio animado una vez (ver `liveRevealedIdsRef`, GameView.tsx) — no tiene sentido volver a animar
// un dado que ya cayó, así que aquí simplemente se pinta el resultado ya puesto.
const gradoExitoOf = (roll: RollInfo): 'claro' | 'fallo' => roll.gradoExito ?? (roll.success ? 'claro' : 'fallo')

const BADGE_STYLES: Record<'claro' | 'fallo', string> = {
  claro: 'border-moss-600/60 bg-moss-500/10 text-moss-400 shadow-[0_0_10px_-4px_var(--color-moss-500)]',
  fallo: 'border-iron-700 bg-iron-800/80 text-wood-400',
}

// Un éxito se sella (stamp-in, con overshoot), un fallo rebota en seco (shake-no).
const BADGE_ANIMATION: Record<'claro' | 'fallo', string> = {
  claro: 'animate-stamp-in',
  fallo: 'animate-shake-no',
}

const LABEL: Record<'claro' | 'fallo', string> = {
  claro: 'Éxito',
  fallo: 'Fallo',
}

export function RollBadge({ roll }: { roll: RollInfo }) {
  const grado = gradoExitoOf(roll)
  // Desglose dado+bono (petición explícita de la usuaria, 2026-07-24: "25 Destreza Éxito" no
  // dice si fue un buen dado o una buena estadística) — antes solo se mostraba `result vs
  // difficulty`, un número ya opaco (dado + mitad del atributo, sumados y ocultos). El bono
  // (mitad del atributo, ver dice.ts) es una regla constante que no cambia turno a turno, así que
  // no hace falta explicarla aquí cada vez — solo lo que sí cambia: el dado y el total.
  const bono = Math.floor(roll.value / 2)
  return (
    <div className={`mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2.5 py-1 font-mono text-2xs ${BADGE_STYLES[grado]} ${BADGE_ANIMATION[grado]}`}>
      <span>{attributeLabels[roll.attribute]}</span>
      <span className="text-wood-600">·</span>
      <span>
        🎲{roll.roll} + {bono} = {roll.result} vs {roll.difficulty}
      </span>
      <span className="text-wood-600">·</span>
      <span className="font-semibold">{LABEL[grado]}</span>
    </div>
  )
}
