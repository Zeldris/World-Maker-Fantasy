import type { CombatExchangeInfo, CombatExchangeOutcome, CombatExchangeSideInfo } from '../types'
import { attributeLabels } from '../lib/dice'

// Mismos 3 colores que RollBadge.tsx (claro/con_coste/fallo) — coherencia visual entre los dos
// tipos de tirada (acción libre vs intercambio de combate), aunque aquí se pintan DOS a la vez.
const SIDE_STYLES: Record<'claro' | 'con_coste' | 'fallo', string> = {
  claro: 'border-moss-600/60 bg-moss-500/10 text-moss-400',
  con_coste: 'border-cost-600/60 bg-cost-500/10 text-cost-400',
  fallo: 'border-iron-700 bg-iron-800/80 text-wood-400',
}

const SIDE_LABEL: Record<'claro' | 'con_coste' | 'fallo', string> = {
  claro: 'Éxito',
  con_coste: 'Éxito con coste',
  fallo: 'Fallo',
}

// Traducción corta de `ExchangeOutcome` (combatExchange.ts, backend) — decisión ya tomada por el
// motor determinista, esto solo la explica en una frase (revisión de partida 2026-08-08, petición
// explícita: "por qué perdiste o ganaste la tirada").
const OUTCOME_LABEL: Record<CombatExchangeOutcome, string> = {
  defensor_contragolpea: 'El ataque falla del todo, y la defensa responde con un golpe propio.',
  ataque_falla: 'El ataque falla del todo.',
  parada_en_seco: 'Parada en seco — bloqueado sin daño.',
  golpes_mutuos: 'Golpes mutuos — los dos acusan algo.',
  golpe_normal: 'El ataque conecta.',
  golpe_pleno: 'Golpe pleno — conecta de lleno.',
}

function gradoOf(side: CombatExchangeSideInfo): 'claro' | 'con_coste' | 'fallo' {
  return side.gradoExito ?? (side.success ? 'claro' : 'fallo')
}

function SideRow({ label, side }: { label: string; side: CombatExchangeSideInfo }) {
  const grado = gradoOf(side)
  const bono = Math.floor(side.value / 2)
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border px-2 py-1 font-mono text-2xs ${SIDE_STYLES[grado]}`}>
      <span className="font-sans font-semibold uppercase tracking-[0.08em]">{label}</span>
      <span className="text-wood-600">·</span>
      <span>{attributeLabels[side.attribute]}</span>
      <span className="text-wood-600">·</span>
      <span>
        🎲{side.roll} + {bono} = {side.result} vs {side.difficulty}
      </span>
      <span className="text-wood-600">·</span>
      <span className="font-sans font-semibold">{SIDE_LABEL[grado]}</span>
    </div>
  )
}

/// Las dos tiradas reales de un intercambio de combate (revisión de partida 2026-08-08, petición
/// explícita: "que aparezca el resultado de las tiradas en las narraciones de combate, indicando
/// qué atributo y valor sacaste tú y el del enemigo, y por qué perdiste o ganaste la tirada, el
/// cálculo") — mismo criterio que RollBadge (nunca confiar solo en la prosa del narrador), pero
/// con las DOS tiradas a la vez, ya que un intercambio siempre las tiene (ver combatExchange.ts).
export function CombatExchangeBadge({ exchange }: { exchange: CombatExchangeInfo }) {
  const jugador = exchange.atacanteEsJugador ? exchange.atacante : exchange.defensor
  const enemigo = exchange.atacanteEsJugador ? exchange.defensor : exchange.atacante
  return (
    <div className="animate-stamp-in mt-2 flex flex-col gap-1">
      <SideRow label="Tú" side={jugador} />
      <SideRow label="Enemigo" side={enemigo} />
      <p className="text-2xs text-wood-500">{OUTCOME_LABEL[exchange.resultado]}</p>
    </div>
  )
}
