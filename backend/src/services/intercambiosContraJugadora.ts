import type { CombatExchangeDisplay } from './combatExchange.js';

export interface IntercambioContraJugadora {
  display: CombatExchangeDisplay;
  atacanteNombre: string;
}

/// P55 (QA-27): en un combate de grupo, qué intercambio va en la narración del turno y cuáles van
/// aparte en el diario. Si la jugadora tuvo su propio intercambio, ese manda y todos los ataques
/// que recibió van aparte; si no, el primero que recibió ocupa su hueco (hallazgo G11) y el resto
/// va aparte. Antes el resto se perdía: se podía caer tras ganar el único intercambio que se veía.
export function repartirIntercambios(
  propio: CombatExchangeDisplay | null,
  contraJugadora: IntercambioContraJugadora[],
): { principal: CombatExchangeDisplay | null; aparte: IntercambioContraJugadora[] } {
  if (propio) return { principal: propio, aparte: contraJugadora };
  const [primero, ...resto] = contraJugadora;
  if (!primero) return { principal: null, aparte: [] };
  return { principal: { ...primero.display, rivalNombre: primero.atacanteNombre }, aparte: resto };
}
