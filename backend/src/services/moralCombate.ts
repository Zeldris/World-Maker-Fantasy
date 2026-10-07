// Moral y retirada de los NPC en combate (CR-44, hito 0.2 — decisiones de la Fase G, 2026-10-05,
// contrastadas con la regla opcional de moral de D&D 5e, DMG pág. 273). Puro, sin base de datos.
//
// - Todo NPC con mente tiene moral; la fauna sigue con su temperamento.
// - Se tira moral (Voluntad, CD 10) la primera vez que el NPC cae a GRAVE, la primera vez que su
//   bando queda a la mitad de efectivos y al caer o huir su capitán (CR-45). Con desventaja si la
//   jugadora va claramente ganando, o si el que tira acaba de perder a su capitán. En un grupo con
//   líder, tira el líder por todos.
// - Si la moral falla, intenta escapar con la misma tirada de Destreza que la huida del personaje
//   (mismos tramos de dificultad por nivel, con los papeles cambiados); si no escapa, pierde el turno.
// - La Inteligencia decide cómo se va: < 12 desbandada (cada uno por su lado), 12 o más en orden.
import { rollD20, type AttributeBlock, type RollMode } from './dice.js';
import { contraataqueDifficultyFor } from './npcScene.js';

export const MORAL_DIFICULTAD = 10;
/// Por debajo, la retirada es una desbandada; desde aquí, en orden (mismo umbral táctico que
/// `INTELIGENCIA_TACTICA_UMBRAL`, combateMultiple.ts).
export const INTELIGENCIA_RETIRADA_ORDENADA = 12;

export type DisparadorMoral = 'GRAVE' | 'MITAD_BANDO' | 'CAPITAN_CAIDO';
export type FormaRetirada = 'DESBANDADA' | 'ORDENADA';

type Condicion = 'ILESO' | 'HERIDO' | 'GRAVE' | 'CONVALECIENTE' | 'MUERTO';
/// En pie = sigue en el combate: un NPC GRAVE aún pelea; CONVALECIENTE ya no (combateMultiple.ts).
export const EN_PIE = (c: Condicion | null | undefined) => c !== 'CONVALECIENTE' && c !== 'MUERTO';
const MAL_HERIDO = (c: Condicion | null | undefined) => c === 'GRAVE' || c === 'CONVALECIENTE' || c === 'MUERTO';

/// Tiene moral: un NPC con raza (persona) que no es una invocación ni fauna. Un líder de facción
/// cuya muerte acabaría con ella no huye (`sinSucesor`), para no partir historias.
export function tieneMoral(npc: { raza: string | null; faunaCategoria?: string | null; esInvocacion?: boolean; sinSucesor?: boolean }): boolean {
  return !!npc.raza && !npc.faunaCategoria && !npc.esInvocacion && !npc.sinSucesor;
}

/// Disparadores nuevos al pasar de `antes` a `despues` (solo la primera vez que se cruza cada uno).
export function disparadoresDeMoral(
  antes: { condicion: Condicion | null; propiosEnPie: number; propiosTotal: number },
  despues: { condicion: Condicion | null; propiosEnPie: number },
): DisparadorMoral[] {
  const out: DisparadorMoral[] = [];
  // Solo GRAVE: quien cae directo a CONVALECIENTE ya está fuera del combate y no puede irse.
  if (!MAL_HERIDO(antes.condicion) && despues.condicion === 'GRAVE') out.push('GRAVE');
  const mitad = antes.propiosTotal / 2;
  if (antes.propiosTotal > 1 && antes.propiosEnPie > mitad && despues.propiosEnPie <= mitad) out.push('MITAD_BANDO');
  return out;
}

/// «La jugadora va claramente ganando»: el doble de combatientes en pie que este bando, o este bando
/// tiene a alguien grave y el contrario a nadie peor que herido.
export function vaClaramentePerdiendo(propios: (Condicion | null)[], contrarios: (Condicion | null)[]): boolean {
  const propiosEnPie = propios.filter(EN_PIE).length;
  const contrariosEnPie = contrarios.filter(EN_PIE).length;
  if (contrariosEnPie >= 2 * Math.max(1, propiosEnPie)) return true;
  const algunPropioGrave = propios.some(MAL_HERIDO);
  const algunContrarioGrave = contrarios.some(MAL_HERIDO);
  return algunPropioGrave && !algunContrarioGrave;
}

export interface TiradaMoral {
  rolls: number[];
  usedRoll: number;
  total: number;
  dificultad: number;
  modo: RollMode;
  aguanta: boolean;
}

/// Tirada de moral: d20 (o 2d20 con desventaja) + Voluntad / 2 contra CD 10.
/// `bono` (CR-65): +1/+2/+3 del Barracón a la guarnición que defiende su asentamiento.
export function tirarMoral(atributos: AttributeBlock, desventaja: boolean, random: () => number = Math.random, bono = 0): TiradaMoral {
  const modo: RollMode = desventaja ? 'desventaja' : 'normal';
  const { rolls, usedRoll } = rollD20(modo, random);
  const total = usedRoll + Math.floor((atributos.voluntad ?? 0) / 2) + bono;
  return { rolls, usedRoll, total, dificultad: MORAL_DIFICULTAD, modo, aguanta: total >= MORAL_DIFICULTAD };
}

export interface TiradaEscape {
  roll: number;
  total: number;
  dificultad: number;
  escapa: boolean;
}

/// Escapar del combate: la tirada de la huida del personaje con los papeles cambiados (huir de
/// alguien de más nivel cuesta más).
export function tirarEscape(atributos: AttributeBlock, nivelNpc: number, nivelPerseguidor: number, random: () => number = Math.random): TiradaEscape {
  const dificultad = contraataqueDifficultyFor(nivelPerseguidor, nivelNpc);
  const roll = Math.floor(random() * 20) + 1;
  const total = roll + Math.floor((atributos.destreza ?? 0) / 2);
  return { roll, total, dificultad, escapa: total >= dificultad };
}

export function formaDeRetirada(inteligencia: number): FormaRetirada {
  return inteligencia >= INTELIGENCIA_RETIRADA_ORDENADA ? 'ORDENADA' : 'DESBANDADA';
}

/// Quién tira la moral de un grupo: su líder si lo hay y sigue en pie (D&D: tira el líder por el
/// grupo); si no, el de más Voluntad. Con desbandada (líder de Inteligencia < 12) cada uno tira lo suyo.
export function quienTiraMoral<T extends { id: string; voluntad: number; enPie: boolean }>(grupo: T[], liderId: string | null): T | null {
  const lider = liderId ? grupo.find((m) => m.id === liderId && m.enPie) : undefined;
  if (lider) return lider;
  return [...grupo].filter((m) => m.enPie).sort((a, b) => b.voluntad - a.voluntad)[0] ?? null;
}
