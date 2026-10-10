import type { CombatExchangeSideInfo } from '../types'
import { formatMultiplier } from './CombatExchangeBadge'

/// Desglose inline de una tirada — `(15 −3sal +4hab = 16 ×1.5 ≈24/2)` — extraído (hallazgo 20,
/// revisar-partida-hallazgos.md 2026-09-07) de `DiceRoll.tsx`/`CombatExchangeBadge.tsx`, donde
/// vivía duplicado letra por letra en los dos sitios. Motivo del hallazgo: con los 3 modificadores
/// a la vez (malus + bono de habilidad + multiplicador racial) el texto era un único `<span>`
/// inline sin puntos de quiebre internos — en pantallas estrechas o con varias badges de combate
/// múltiple en fila, se desbordaba o forzaba un salto de línea a mitad de un término.
///
/// Fix de layout (petición explícita de la usuaria: "adaptativo y responsive pero que todo
/// coincida siempre en la misma posición... para no complicarse al leer la ecuación" — NO un
/// flex-wrap suelto término a término, que dejaría cada número en una posición distinta según el
/// ancho disponible): cada GRUPO (`−Xsal`, `+Xhab`, `×X≈Y`) es un átomo con `whitespace-nowrap`
/// propio dentro de un `inline-flex flex-wrap` — el orden es siempre el mismo (valor base → malus →
/// bono → "=cruda" → multiplicador → "/2"), y si no cabe todo en una línea, el punto de corte cae
/// SIEMPRE entre grupos completos, nunca a mitad de un número. En la práctica caben todos con
/// margen sobrado salvo en las badges más estrechas de combate múltiple con los 3 modificadores a
/// la vez — ahí el multiplicador (el grupo más largo y el que menos aporta a la lectura rápida del
/// resultado ya mostrado fuera del paréntesis) es el primero en caer a una segunda línea.
export function RollBreakdown({ side, valorCrudo, valorEfectivo }: { side: Partial<CombatExchangeSideInfo>; valorCrudo: number; valorEfectivo: number }) {
  const hasMultiplicador = side.multiplicador != null && side.multiplicador !== 1
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-0.5">
      <span className="whitespace-nowrap">
        (
        {side.value}
        {!!side.malus && <span className="text-danger-400" title="Penalización por heridas"> −{side.malus} heridas</span>}
        {!!side.attributeBonus && <span className="text-moss-400"> +{side.attributeBonus}hab</span>}
        {side.malus || side.attributeBonus ? ` = ${valorCrudo}` : ''}
        {!hasMultiplicador && '/2)'}
      </span>
      {hasMultiplicador && (
        <span className="whitespace-nowrap">
          <span className={side.multiplicador! > 1 ? 'text-moss-400' : 'text-danger-400'}>×{formatMultiplier(side.multiplicador!)}</span>
          ≈{valorEfectivo}/2)
        </span>
      )}
    </span>
  )
}
