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

/// Una línea del diario tras la narración principal del turno.
export type LineaTrasElGolpe =
  | { tipo: 'aviso'; texto: string }
  | { tipo: 'intercambio'; texto: string; combatExchange: CombatExchangeDisplay }
  | { tipo: 'golpeGratis'; texto: string };

/// P117 (QA-27, QA-70): en qué orden van al diario las líneas que siguen a la narración del turno.
/// La subida de nivel y sus desbloqueos los gana el golpe de la jugadora, así que van antes que los
/// ataques que recibe después (con o sin tirada): antes la subida salía tras «Estado: Muerto».
export function lineasTrasElGolpe(p: {
  brujula: string | null;
  subidaDeNivel: string | null;
  desbloqueos: string[];
  intercambiosAparte: IntercambioContraJugadora[];
  golpesGratis: { atacanteNombre: string; nuevaCondicion: CondicionFisica }[];
}): LineaTrasElGolpe[] {
  return [
    ...(p.brujula ? [{ tipo: 'aviso' as const, texto: p.brujula }] : []),
    ...(p.subidaDeNivel ? [{ tipo: 'aviso' as const, texto: p.subidaDeNivel }] : []),
    ...p.desbloqueos.map((texto) => ({ tipo: 'aviso' as const, texto })),
    ...p.intercambiosAparte.map((extra) => ({
      tipo: 'intercambio' as const,
      texto: `${extra.atacanteNombre} te ataca.`,
      combatExchange: { ...extra.display, rivalNombre: extra.atacanteNombre },
    })),
    ...p.golpesGratis.map((golpe) => ({
      tipo: 'golpeGratis' as const,
      texto: `${golpe.atacanteNombre} te golpea sin que puedas defenderte (estás ocupado con otro rival). Estado: ${CONDICION_EN_TEXTO[golpe.nuevaCondicion]}.`,
    })),
  ];
}
