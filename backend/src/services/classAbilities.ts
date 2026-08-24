import type { StartingAbility } from './startingAbilities.js';
import { 
  ENERGY_COST_BASICA, ENERGY_COST_MEDIA,ENERGY_COST_AVANZADA, ENERGY_COST_EXPERTA,
  ENERGY_RECOVER_BASICA, ENERGY_RECOVER_MEDIA, ENERGY_RECOVER_AVANZADA, ENERGY_RECOVER_EXPERTA
 } from './energy.js';

/// Habilidades de COMBATE por CLASE (rediseño 2026-07-29, tope de 10 habilidades de combate
/// activas — "en vez de tener muchas habilidades usables a la vez... podamos variar sencillamente
/// cambiando de arma"): se recorta de 12 a solo 4 (2 Guerrero + 2 Cazador), y ya NO son de
/// ataque/aguante genéricos "pegar más fuerte" — eso ahora lo cubren las habilidades de arma
/// (weaponAbilities.ts). Estas son de apoyo/contraataque con un efecto propio y descrito,
/// repartidas a propósito en los 4 atributos que NI el arma equipada NI la racial de fuerza/
/// destreza/constitución llegan a cubrir (Voluntad/Carisma/Inteligencia/Arcano) — así ningún
/// atributo jugable se queda sin ninguna habilidad real de combate detrás.
///
/// Todas se aprenden desde nivel 1 (mismo criterio que las de arma) — ya no hay un roster que
/// desbloquear progresivamente, el tope de 10 ya limita de sobra la profundidad.
///
/// Rediseño de combate (2026-08-09, petición explícita: "una habilidad defensiva o de utilidad
/// nunca hará daño directo"): las 4 pasan a `rol: 'utilidad'`, reactivas — su efecto solo se
/// evalúa si el RIVAL atacó con una habilidad `rol:'ataque'` ese mismo intercambio Y la tirada
/// PROPIA tiene éxito (resuelto en `combatExchange.ts` § resolveIndependentExchange, aplicado en
/// turnResolution.ts § applyUtilityEffects). Nunca hacen daño incondicional por su cuenta — la
/// única que sí "devuelve" daño (Contraataque) solo lo hace como reacción a un ataque real, nunca
/// desde su propia tirada en solitario. Dos renombradas in-place (mismo hueco de atributo/clase,
/// descripción y `effect` reescritos): Puño de Hierro → Contraataque (su descripción ya sonaba a
/// esto: "aguanta... listo para responder"), Lectura de Presa → Analizar rival (deja de dañar,
/// pasa a revelar el atributo recomendado contra el rival).
export type Clase = 'Guerrero' | 'Cazador';

export interface ClassAbilityUnlock {
  level: number;
  clase: Clase;
  ability: StartingAbility;
}

// `effects` es una lista (2026-08-15) — una habilidad puede combinar varios AbilityEffect a la
// vez (turnResolution.ts comprueba cada uno de forma independiente). Ninguna de las 7 de abajo
// usa más de uno todavía, pero ya se puede.
const CLASS_ABILITIES: ClassAbilityUnlock[] = [
  {
    level: 1,
    clase: 'Guerrero',
    ability: {
      name: 'Grito de Guerra',
      icon: '📢',
      description: 'Un grito que quiebra el nervio del enemigo justo antes del choque — si llega a atacar de verdad, el golpe se le queda a medias y pierde la iniciativa.',
      promptText: 'Suelto un grito de guerra que retumba antes del choque, buscando quebrar la concentración de mi enemigo justo cuando ataque.',
      category: 'combate',
      effects: ['INTIMIDACION'],
      rol: 'utilidad',
      preferredAttribute: 'carisma',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 4,
    clase: 'Guerrero',
    ability: {
      name: 'Detectar Puntos Débiles',
      icon: '🔍',
      description: 'Estudia al rival un instante, leyendo su punto débil — revela qué atributo conviene usar contra él, nunca inflige daño por sí sola.',
      promptText: 'Estudio a mi enemigo un instante, leyendo su punto débil antes de moverme.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 6,
    clase: 'Guerrero',
    ability: {
      name: 'Grito tenebroso',
      icon: '✊',
      description: 'Un grito tenebroso que quiebra el nervio del enemigo reduciendo su fuerza y su destreza',
      // `promptText` vacío corregido (auditoría de documentación/lore 2026-08-18): a diferencia de
      // "Compañero cazador" (rol:'pasiva', nunca se invoca con texto), esta es rol:'utilidad' —
      // igual que "Grito de Guerra"/"Contraataque"/"Detectar Puntos Débiles" arriba, necesita algo
      // real que mandar al Narrador en primera persona al usarla.
      promptText: 'Suelto un grito tenebroso, cargado de rabia contenida, buscando minar la fuerza y la destreza de mi enemigo antes de que pueda reaccionar.',
      category: 'combate',
      effects: ['DEBILIDAD'],
      rol: 'utilidad',
      preferredAttribute: 'carisma',
      energyCost: ENERGY_COST_MEDIA,
    },
  },
  {
    level: 8,
    clase: 'Guerrero',
    ability: {
      name: 'Contraataque',
      icon: '✊',
      description: 'Aguanta cualquier golpe entrante sin retroceder ni un paso — si el rival ataca de verdad, responde de inmediato con un golpe propio.',
      promptText: 'Aprieto los dientes, aguanto el golpe entrante sin ceder terreno, listo para responder en el instante en que ataque de verdad.',
      category: 'combate',
      effects: ['ATAQUE'],
      rol: 'utilidad',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_AVANZADA,
    },
  },
  {
    level: 1,
    clase: 'Cazador',
    ability: {
      name: 'Analisis Salvaje',
      icon: '🔍',
      description: 'Estudia al rival un instante, leyendo su punto débil — revela qué atributo conviene usar contra él, nunca inflige daño por sí sola.',
      promptText: 'Estudio a mi enemigo un instante, leyendo su punto débil antes de moverme.',
      category: 'combate',
      effects: ['ANALISIS'],
      rol: 'utilidad',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 4,
    clase: 'Cazador',
    ability: {
      name: 'Barrido Salvaje',
      icon: '🌀',
      description: 'Evade el golpe y desestabiliza a su openente con una patada baja a las piernas — si el rival ataca de verdad, lo desorienta permitiendole ganar la iniciativa en los dos siguientes turnos, sin llegar a herirlo.',
      promptText: 'Dejo que un arrebato de instinto puro y salvaje tome el control por un instante, listo para desorientar a mi rival en cuanto ataque.',
      category: 'combate',
      effects: ['ATURDIMIENTO'],
      rol: 'defensa',
      preferredAttribute: 'destreza',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 8,
    clase: 'Cazador',
    ability: {
      name: 'Compañero cazador',
      icon: '🐺',
      description: 'Te permite llevar como compañero a una bestia de la fauna que tengas bajo tu control.',
      // Pasiva (2026-08-15) — nunca se invoca con texto libre ni entra al roster de combate
      // (npcCombatAbilitiesFor la filtra), siempre está activa por su cuenta en cuanto se
      // desbloquea. promptText vacío a propósito, mismo criterio que el resto de pasivas.
      promptText: '',
      category: 'combate',
      effects: ['COMPANERO'],
      rol: 'pasiva',
      preferredAttribute: 'inteligencia',
      energyCost: 0,
    },
  },
];

/// Qué habilidades de clase tiene un personaje — hoy solo Gorhorn es jugable. Hasta 2026-08-24 era
/// una "variante especial" que aprendía de AMBAS clases (Guerrero y Cazador) sin filtrar por
/// `clase`; petición explícita de la usuaria ese día ("Gorhorn deja de tener doble clase y pasa a
/// ser Cazador solo, voy a probarlo por la rama de domador" — ver `docs/rpgtarkor/clases.md`, la
/// rama Domador en sí sigue siendo solo diseño, no aplicada al motor) — ahora filtra por
/// `clase: 'Cazador'` como cualquier personaje de una sola clase futuro.
export function classAbilityUnlocksFor(characterName: string, level: number): StartingAbility[] {
  if (characterName !== 'Gorhorn') return [];
  return CLASS_ABILITIES.filter((u) => u.level === level && u.clase === 'Cazador').map((u) => u.ability);
}

/// Roster completo (todos los niveles) — para la Enciclopedia, no para el motor de turnos.
export function allClassAbilityUnlocks(): ClassAbilityUnlock[] {
  return CLASS_ABILITIES;
}

/// Roster de UNA clase, para el árbol colapsable propio de cada una en la Enciclopedia
/// (2026-07-22, "que cada clase sea un colapsable que al pulsarlo veas el árbol de habilidades").
export function classAbilityUnlocksForClase(clase: Clase): ClassAbilityUnlock[] {
  return CLASS_ABILITIES.filter((u) => u.clase === clase);
}
