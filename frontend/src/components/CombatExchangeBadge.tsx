import type { CombatExchangeInfo, CombatExchangeOutcome, CombatExchangeSideInfo } from '../types'
import { attributeLabels, attributeColorClasses } from '../lib/dice'

// Mismos 3 colores que RollBadge.tsx (claro/con_coste/fallo) — coherencia visual entre los dos
// tipos de tirada (acción libre vs intercambio de combate).
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
// explícita: "por qué perdiste o ganaste la tirada"). 'independiente' añadido 2026-08-13 (bug real:
// faltaba, se veía en blanco para cualquier habilidad de utilidad/ANALISIS).
const OUTCOME_LABEL: Record<CombatExchangeOutcome, string> = {
  defensor_contragolpea: 'El ataque falla del todo, y la defensa responde con un golpe propio.',
  ataque_falla: 'El ataque falla del todo.',
  parada_en_seco: 'Parada en seco — bloqueado sin daño.',
  golpes_mutuos: 'Golpes mutuos — los dos acusan algo.',
  golpe_normal: 'El ataque conecta.',
  golpe_pleno: 'Golpe pleno — conecta de lleno.',
  independiente: 'Cada lado se juzga por su cuenta — no hay un bando que "gane" el intercambio.',
}

// Rediseño (2026-08-13, petición explícita: "que salga más claro, attr vs attr, tirada de un att,
// tirada del otro y luego los cálculos e indicar quién gana") — quién se lleva el intercambio según
// `ExchangeOutcome` (backend, OUTCOME_TABLE de combatExchange.ts): 'atacante'/'defensor' son
// posiciones (quién tenía la iniciativa este intercambio, ver `atacanteEsJugador`), no bandos fijos.
// null = sin ganador cruzado (independiente, cada lado se resuelve solo) o empate real.
const WINNER_SIDE: Record<CombatExchangeOutcome, 'atacante' | 'defensor' | 'empate' | null> = {
  defensor_contragolpea: 'defensor',
  ataque_falla: 'defensor',
  parada_en_seco: 'defensor',
  golpes_mutuos: 'empate',
  golpe_normal: 'atacante',
  golpe_pleno: 'atacante',
  independiente: null,
}

function gradoOf(side: CombatExchangeSideInfo): 'claro' | 'con_coste' | 'fallo' {
  return side.gradoExito ?? (side.success ? 'claro' : 'fallo')
}

function winnerLabel(exchange: CombatExchangeInfo): string | null {
  const side = WINNER_SIDE[exchange.resultado]
  if (side === null) return null
  if (side === 'empate') return 'Empate'
  const ganaJugador = (side === 'atacante') === exchange.atacanteEsJugador
  return ganaJugador ? 'Ganas tú' : 'Gana el enemigo'
}

// Fila de UN lado: atributo (con punto de color) + cálculo completo + grado — separado en dos
// líneas a propósito (etiqueta arriba, cálculo abajo) para que "tirada de un atributo, tirada del
// otro" se lea de un vistazo, sin tener que desenredar una sola línea larga.
function SideRow({ label, side, isWinner }: { label: string; side: CombatExchangeSideInfo; isWinner: boolean }) {
  const grado = gradoOf(side)
  // Bug real (revisión de rediseño de combate, 2026-08-09): el bono mostrado se calculaba sobre
  // el atributo crudo (`value`) en vez del ya multiplicado por el árbol de debilidades
  // (`valorEfectivo`) — el número en pantalla nunca cuadraba con `result` cuando el árbol aplicaba
  // un multiplicador de verdad.
  const bono = Math.floor(side.valorEfectivo / 2)
  const colors = attributeColorClasses[side.attribute]
  return (
    <div className={`rounded-md border px-2.5 py-1.5 font-mono text-2xs ${SIDE_STYLES[grado]} ${isWinner ? 'ring-1 ring-inset ring-current' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-sans font-semibold uppercase tracking-[0.08em]">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors.dot}`} aria-hidden="true" />
          {label}
          <span className="text-wood-600">·</span>
          {attributeLabels[side.attribute]}
        </span>
        <span className="font-sans font-semibold">
          {isWinner && '🏆 '}
          {SIDE_LABEL[grado]}
        </span>
      </div>
      <div className="mt-0.5 text-wood-400">
        🎲{side.roll} + {bono} = {side.result} vs {side.difficulty}
      </div>
    </div>
  )
}

/// Las dos tiradas reales de un intercambio de combate (revisión de partida 2026-08-08, ampliado
/// 2026-08-13 con cabecera "Atr vs Atr" + fila de ganador explícita, petición directa de la
/// usuaria: "que salga más claro, attr vs attr, tirada de un att, tirada del otro y luego los
/// cálculos e indicar quién gana").
export function CombatExchangeBadge({ exchange }: { exchange: CombatExchangeInfo }) {
  const jugador = exchange.atacanteEsJugador ? exchange.atacante : exchange.defensor
  const enemigo = exchange.atacanteEsJugador ? exchange.defensor : exchange.atacante
  const winner = winnerLabel(exchange)
  const winnerIsJugador = winner === 'Ganas tú'
  const winnerIsEnemigo = winner === 'Gana el enemigo'
  return (
    <div className="animate-stamp-in mt-2 flex flex-col gap-1">
      <div className="flex items-center justify-center gap-2 font-sans text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">
        <span className={attributeColorClasses[jugador.attribute].text}>{attributeLabels[jugador.attribute]}</span>
        <span className="text-wood-600">vs</span>
        <span className={attributeColorClasses[enemigo.attribute].text}>{attributeLabels[enemigo.attribute]}</span>
      </div>
      <SideRow label="Tú" side={jugador} isWinner={winnerIsJugador} />
      <SideRow label="Enemigo" side={enemigo} isWinner={winnerIsEnemigo} />
      <p className="text-center text-2xs text-wood-500">
        {winner && <span className="font-semibold text-wood-300">{winner} · </span>}
        {OUTCOME_LABEL[exchange.resultado]}
      </p>
    </div>
  )
}
