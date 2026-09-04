import type { CombatExchangeInfo } from '../types'
import { esCheckOpuesto } from './CombatExchangeBadge'
import { DiceRollVs, ROLL_DURATION_MS, ROLL_TICK_DELAYS_MS } from './DiceRoll'

/// Animación de dados en paralelo (petición explícita, 2026-08-15: "que veas los resultados
/// sacados por ambos... mientras la narración se genera") — el backend manda el intercambio de
/// combate ya resuelto del todo (dos tiradas + desenlace) ANTES de que empiece a llegar texto de
/// narración (ver `onExchangeResolved`, api.ts/turnResolution.ts), así que esta espera real del
/// modelo local (varios segundos en este hardware) deja de ser tiempo muerto: se ve la tirada de
/// cada lado como si cayera en vivo, mientras el texto sigue generándose debajo.
///
/// Reducido (2026-09-04, centralización de todas las tiradas del juego) a un wrapper fino sobre
/// `DiceRollVs` (`DiceRoll.tsx`) — la lógica de tick/desglose vive ahí, compartida ahora también
/// por iniciativa, turno normal, Huir y Tameo. Mantiene su nombre/firma pública para no tocar
/// `CombatPanel.tsx`.
export { ROLL_DURATION_MS, ROLL_TICK_DELAYS_MS }

export function DiceRollReveal({ exchange, playerName, enemyName }: { exchange: CombatExchangeInfo; playerName?: string; enemyName?: string }) {
  const jugador = exchange.atacanteEsJugador ? exchange.atacante : exchange.defensor
  const enemigo = exchange.atacanteEsJugador ? exchange.defensor : exchange.atacante
  const showDifficulty = !esCheckOpuesto(exchange)

  return (
    <DiceRollVs
      left={jugador}
      right={enemigo}
      leftLabel={playerName ?? 'Tú'}
      rightLabel={enemyName ?? 'el enemigo'}
      leftFirst={exchange.atacanteEsJugador}
      showDifficulty={showDifficulty}
    />
  )
}
