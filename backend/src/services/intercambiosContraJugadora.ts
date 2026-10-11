import type { CondicionFisica } from '@prisma/client';
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

/// Etiqueta de cada condición en una línea del diario (P55: golpe gratis contra la jugadora). Es
/// la de la barra de estado, sin género (P25: el personaje puede ser de cualquiera).
export const CONDICION_EN_TEXTO: Record<CondicionFisica, string> = {
  ILESO: 'Ileso',
  HERIDO: 'Herido',
  GRAVE: 'Grave',
  CONVALECIENTE: 'Convaleciente',
  MUERTO: 'Muerto',
};
