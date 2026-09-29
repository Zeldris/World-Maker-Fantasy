/// Aviso de riesgo de la tarjeta "Cazar" (F9-1, decisión de Álvaro, 2026-09-29) — cazar un grupo a
/// nivel bajo puede matar al jugador en un solo turno (p. ej. tres Gesgurio, más rápidos que el
/// jugador, atacan ~6 veces antes de que este actúe). La decisión es SOLO avisar: no cambia ninguna
/// regla de caza ni de combate. Puro, sin Prisma ni azar; `zona.ts` lo calcula con datos que el
/// backend ya tiene (nivel/destreza del jugador, nivel/destreza/cantidad del grupo) y lo envía con
/// la oferta de encuentro para que el frontend lo pinte.

export type RiesgoCaza = 'bajo' | 'alto' | 'mortal';

export interface RiesgoCazaInfo {
  riesgo: RiesgoCaza;
  /// Frase corta en español para mostrar en la tarjeta (vacía si el riesgo es 'bajo').
  motivo: string;
}

export interface EntradaRiesgoCaza {
  nivelJugador: number;
  destrezaJugador: number;
  nombreGrupo: string;
  nivelNpc: number;
  destrezaNpc: number;
  cantidad: number;
}

/// Poder del grupo / nivel del jugador a partir del cual la caza es 'alto' y 'mortal'. Con un
/// único enemigo de tu nivel la razón es 1 (bajo); con uno del doble de nivel, 2.
const RATIO_ALTO = 1.5;
const RATIO_MORTAL = 3;
/// Si además hay enemigos más rápidos (actúan antes que tú), 'mortal' baja a este umbral.
const RATIO_MORTAL_CON_RAPIDOS = 2;
/// Dos o más enemigos más rápidos ya son al menos 'alto' aunque no te superen en nivel.
const RAPIDOS_PARA_ALTO = 2;

export function riesgoDeCaza(entrada: EntradaRiesgoCaza): RiesgoCazaInfo {
  const cantidad = Math.max(1, Math.floor(entrada.cantidad));
  const nivelJugador = Math.max(1, entrada.nivelJugador);
  const poderGrupo = cantidad * Math.max(1, entrada.nivelNpc);
  const ratio = poderGrupo / nivelJugador;
  const rapidos = entrada.destrezaNpc > entrada.destrezaJugador ? cantidad : 0;

  const mortal = ratio >= RATIO_MORTAL || (rapidos > 0 && ratio >= RATIO_MORTAL_CON_RAPIDOS);
  const alto = ratio >= RATIO_ALTO || rapidos >= RAPIDOS_PARA_ALTO;
  if (!mortal && !alto) return { riesgo: 'bajo', motivo: '' };

  const grupo = cantidad > 1 ? `Un grupo de ${cantidad} ${entrada.nombreGrupo} (nivel ${entrada.nivelNpc})` : `${entrada.nombreGrupo} (nivel ${entrada.nivelNpc})`;
  const partes = [`${grupo} frente a tu nivel ${nivelJugador}`];
  if (rapidos > 0) {
    partes.push(rapidos > 1 ? `${rapidos} son más rápidos que tú y actuarán varias veces antes que tú` : 'es más rápido que tú y actuará antes');
  }
  const riesgo: RiesgoCaza = mortal ? 'mortal' : 'alto';
  return { riesgo, motivo: `${partes.join('; ')}.` };
}
