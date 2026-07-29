import type { StartingAbility } from './startingAbilities.js';
import { ENERGY_COST_BASICA } from './energy.js';

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
export type Clase = 'Guerrero' | 'Cazador';

export interface ClassAbilityUnlock {
  level: number;
  clase: Clase;
  ability: StartingAbility;
}

const CLASS_ABILITIES: ClassAbilityUnlock[] = [
  {
    level: 1,
    clase: 'Guerrero',
    ability: {
      name: 'Puño de Hierro',
      icon: '✊',
      description: 'Aguanta cualquier golpe entrante sin retroceder ni un paso, listo para responder de inmediato en cuanto el enemigo se descubre.',
      promptText: 'Aprieto los dientes, aguanto el golpe entrante sin ceder terreno y me preparo para responder en cuanto se descubra.',
      category: 'combate',
      effect: 'AGUANTE',
      preferredAttribute: 'voluntad',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    clase: 'Guerrero',
    ability: {
      name: 'Grito de Guerra',
      icon: '📢',
      description: 'Un grito que quiebra el nervio del enemigo un instante antes del choque — no todos los golpes se dan con el arma.',
      promptText: 'Suelto un grito de guerra que retumba antes del choque, buscando quebrar el nervio de mi enemigo un instante antes de que reaccione.',
      category: 'combate',
      effect: 'INTIMIDACION',
      preferredAttribute: 'carisma',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    clase: 'Cazador',
    ability: {
      name: 'Lectura de Presa',
      icon: '🔍',
      description: 'Lee el punto débil exacto del enemigo antes de moverse — un cazador nunca desperdicia el primer golpe.',
      promptText: 'Estudio a mi enemigo un instante, leyendo su punto débil antes de moverme, y golpeo justo ahí sin desperdiciar el movimiento.',
      category: 'combate',
      effect: 'ATAQUE',
      preferredAttribute: 'inteligencia',
      energyCost: ENERGY_COST_BASICA,
    },
  },
  {
    level: 1,
    clase: 'Cazador',
    ability: {
      name: 'Instinto Salvaje',
      icon: '🌀',
      description: 'Un arrebato de instinto puro y salvaje, imposible de anticipar — ni el propio cazador sabe de dónde sale hasta que ya ha golpeado.',
      promptText: 'Dejo que un arrebato de instinto puro y salvaje tome el control por un instante, golpeando de una forma que ni yo mismo podría anticipar.',
      category: 'combate',
      effect: 'ATURDIMIENTO',
      preferredAttribute: 'arcano',
      energyCost: ENERGY_COST_BASICA,
    },
  },
];

/// Qué habilidades de clase tiene un personaje — hoy solo Gorhorn es jugable, y es la "variante
/// especial" que aprende de AMBAS clases (Guerrero y Cazador), de ahí que no filtre por `clase`.
/// Un futuro personaje de una sola clase necesitaría filtrar también por `clase` aquí. Sin
/// parámetro de nivel: las 4 se conceden de golpe a nivel 1 (ver comentario de cabecera).
export function classAbilityUnlocksFor(characterName: string, level: number): StartingAbility[] {
  if (characterName !== 'Gorhorn') return [];
  return CLASS_ABILITIES.filter((u) => u.level === level).map((u) => u.ability);
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
