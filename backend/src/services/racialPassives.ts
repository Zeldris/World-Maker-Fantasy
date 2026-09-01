import type { Attribute, RollMode } from './dice.js';

/// Pasivas raciales (2026-08-28, pendiente 2026-08-27 punto 4, "de 2 raciales activas a 1 pasiva")
/// — puro: decide `rollMode`/`racialAdvantageReason` para un lado de un intercambio de combate,
/// dado el contexto real (raza propia, atributo del rival, si el rival dispara CONTROL/
/// INTIMIDACION, si es el primer intercambio del combate). El caller (turnResolution.ts/
/// combateMultipleOrquestacion.ts) pasa el resultado directo a `ExchangeParticipant.rollMode`/
/// `.racialAdvantageReason` — esta función nunca toca `tx`/Prisma ni tira dados.
///
/// Reemplaza las 2 habilidades raciales activas (ataque+defensa por raza, `berigLore.ts` §
/// habilidadesRaciales) — esas SIGUEN existiendo como SavedAction (no se retiran, serían un roster
/// vacío raro en Habilidades), pero ya no cuentan contra el cupo de 10 ni ofrecen nada mecánico
/// nuevo aparte de lo de siempre; la pasiva de aquí es la novedad real, siempre activa, nunca se
/// elige ni se pulsa.
export interface RacialAdvantageResult {
  rollMode: RollMode;
  racialAdvantageReason?: string;
}

const NONE: RacialAdvantageResult = { rollMode: 'normal' };

/// Goirntes — "leen la guardia con precisión matemática, sin margen de error" + su piel se
/// endurece bajo tensión (Piel Quitinosa, la habilidad activa de siempre). Ventaja al DEFENDERSE,
/// SOLO contra ataques físicos (cualquier atributo salvo `magia` — decisión explícita: "todos los
/// attr son fisicos menos la Magia"). Nunca en ataque, nunca contra magia.
function goirntesDefensiveMode(rivalAttribute: Attribute): RacialAdvantageResult {
  if (rivalAttribute === 'magia') return NONE;
  return { rollMode: 'ventaja', racialAdvantageReason: 'Piel Quitinosa (Goirnte): ventaja al defenderse contra ataques físicos.' };
}

/// Orcos — "con ira nos quemaron, con honor nos rebelamos, y aún así nadie domó nuestros caminos".
/// El motor no tiene una "tirada de resistencia" separada para CONTROL (se dispara solo con la
/// propia tirada del atacante, ver `utilityTriggered`, combatExchange.ts) — en vez de inventar un
/// mecanismo nuevo, el RIVAL que intenta CONTROL contra un Orco tira con DESVENTAJA (decisión
/// cerrada con la usuaria): mismo resultado narrativo ("les cuesta más enganchar ese efecto en
/// ellos") sin ampliar el motor a un chequeo de resistencia que hoy no existe para nada más.
function orcosControlDisadvantage(): RacialAdvantageResult {
  return { rollMode: 'desventaja', racialAdvantageReason: 'Contra un Orco: nadie los domó — desventaja al intentar CONTROL sobre él/ella.' };
}

/// Nabieus — "fríos, calculadores, observadores... la muerte como un regalo, la enfermedad como
/// oportunidad" — nada asusta ni desestabiliza a un Nabieu. Mismo mecanismo que Orcos/CONTROL:
/// desventaja para quien intenta INTIMIDACION contra ellos.
function nabieusIntimidacionDisadvantage(): RacialAdvantageResult {
  return { rollMode: 'desventaja', racialAdvantageReason: 'Contra un Nabieu: nada les asusta — desventaja al intentar INTIMIDACION sobre él/ella.' };
}

/// Faerus — "su olfato lee el miedo antes que la propia presa lo sienta". Ventaja en la PRIMERA
/// tirada de cada combate nuevo (no en cada intercambio de un combate ya en marcha) — el caller
/// decide "primer intercambio" comparando contra `Save.pendingCombatNpcSlugs` de ANTES de este
/// turno (si el NPC no estaba ya en esa lista, es un combate recién abierto).
function faerusFirstStrikeMode(): RacialAdvantageResult {
  return { rollMode: 'ventaja', racialAdvantageReason: 'Olfato de la Manada (Faerus): ventaja en el primer intercambio de este combate.' };
}

/// Combina las pasivas propias (Goirntes/Faerus, dependen solo de mi raza+contexto) — llamar una
/// vez por lado de cada intercambio, para el participante que ES esta raza. `isFirstExchange` solo
/// importa para Faerus (el resto la ignoran).
export function ownRacialAdvantageFor(raza: string | null, rol: 'ataque' | 'defensa' | 'utilidad', rivalAttribute: Attribute, isFirstExchange: boolean): RacialAdvantageResult {
  if (!raza) return NONE;
  if (raza === 'goirntes' && rol === 'defensa') return goirntesDefensiveMode(rivalAttribute);
  if (raza === 'faerus' && isFirstExchange) return faerusFirstStrikeMode();
  return NONE;
}

/// Penalización al RIVAL cuando intenta CONTROL/INTIMIDACION contra un Orco/Nabieu — llamar una
/// vez por lado de cada intercambio, para el participante que ataca/usa la utilidad CONTRA una de
/// estas 2 razas. `targetRaza` = la raza del OTRO lado (a quien afecta el efecto si dispara).
export function rivalRacialDisadvantageAgainst(targetRaza: string | null, ownEffects: string[]): RacialAdvantageResult {
  if (!targetRaza) return NONE;
  if (targetRaza === 'orcos' && ownEffects.includes('CONTROL')) return orcosControlDisadvantage();
  if (targetRaza === 'nabieus' && ownEffects.includes('INTIMIDACION')) return nabieusIntimidacionDisadvantage();
  return NONE;
}
