import type { StartingAbility } from './startingAbilities.js';

/// Habilidades de COMBATE por CLASE (roadmap de Fable, 2026-07-21 — ver memoria
/// project_tarkor_roadmap_habilidades_clase), genéricas de la combinación Guerrero/Cazador: no
/// mencionan a Gorhorn, su hacha rota ni el Clan Maktor — cualquier personaje futuro de esta clase
/// las aprende igual, sin importar su arma concreta u origen (petición explícita de la usuaria,
/// 2026-07-21: "imagínate que me creo un guerrero o cazador de otra clase, pues no debería
/// aparecer Maktor... debería ser algo más genérico").
///
/// Distinto de la HABILIDAD ÚNICA DE PERSONAJE (aprendida a nivel medio, un movimiento de firma
/// solo de ESE personaje — para Gorhorn sería "Grito de Maktor", grounded en que es el último
/// superviviente de su clan): esa es personal y no vive aquí, sino en un mecanismo aparte keyed
/// por `characterName`, no por clase — todavía no implementada (deferida, ver roadmap).
///
/// A diferencia de startingAbilities.ts (kit de partida, fijo desde el turno 1), estas se
/// conceden dinámicamente cuando el nivel alcanza el umbral. `isStarting: true` aunque no sean
/// literalmente "de partida": es el mismo campo que ya usa el resto del proyecto para decir
/// "diseño, no la jugadora" (no editable, no borrable, ver DetailModal.tsx/HabilidadesPanel.tsx).
///
/// Arranque deliberadamente pequeño (decisión explícita de la usuaria: "empezamos con 2, una
/// ofensiva y 1 defensiva"): del roster completo que propuso Fable, se implementaron primero solo
/// estas 2 (2026-07-21). La ofensiva NO es un remate (petición explícita: "la primera ofensiva no
/// puede ser un REMATE, debe ser un ataque normal o básico") — Tajo Cruzado es un ataque directo
/// genérico, sin condición previa.
///
/// Resto del roster añadido 2026-07-22 (checklist punto 2, con luz verde para la mecánica real de
/// puntos 1-2): 6 habilidades más, en los niveles que dejó libres el roster original de Fable (el
/// 4 se deja reservado a propósito para la futura habilidad única de personaje — "Grito de
/// Maktor" para Gorhorn, primer ASI_LEVELS de progression.ts, ver roadmap). "Sentencia del Hacha
/// Rota" e "Ira de los Últimos Maktor" del roster original de Fable se renombran aquí a nombres
/// genéricos (mismo criterio ya aplicado a Tajo Cruzado/Guardia de Hierro): ninguna habilidad de
/// CLASE puede nombrar a Gorhorn, su hacha rota o el Clan Maktor — eso es privilegio exclusivo de
/// la futura habilidad única de personaje.
///
/// Guerrero y Cazador (2026-07-22, petición explícita: "Guerrero es una clase y Cazador es otra
/// con sus propias habilidades! Gorhorn es una variante especial que le permite aprender las
/// habilidades de ambas clases") — hasta ahora vivían como un único roster fusionado sin distinguir
/// cuál era de cada una; se separan aquí vía `clase`, sin cambiar el motor de turnos (Gorhorn sigue
/// aprendiendo TODAS, de ambas clases, filtrando solo por nivel — `classAbilityUnlocksFor` no
/// cambia su contrato). El reparto por atributo definitorio de cada clase (fuerza/voluntad =
/// Guerrero, destreza = Cazador) dejaba a Cazador con solo 2 de las 8 originales (Ojo del Cazador,
/// Zarpazo del Viento Rojo) — se amplió el mismo día con 4 habilidades nuevas para que tenga cuerpo
/// propio, en niveles libres que no pisan los ya usados por Guerrero ni el 4 (reservado para la
/// futura habilidad única de personaje).
export type Clase = 'Guerrero' | 'Cazador';

export interface ClassAbilityUnlock {
  level: number;
  clase: Clase;
  ability: StartingAbility;
}

const CLASS_ABILITIES: ClassAbilityUnlock[] = [
  {
    level: 2,
    clase: 'Guerrero',
    ability: {
      name: 'Tajo Cruzado',
      icon: '🗡️',
      description: 'Dos tajos cruzados y veloces con el arma en mano — abre dos heridas donde el enemigo solo esperaba una.',
      promptText:
        'Giro el cuerpo entero y lanzo dos tajos cruzados y seguidos con mi arma, buscando abrir a mi enemigo antes de que pueda reaccionar al primero.',
      category: 'combate',
      effect: 'ATAQUE',
      preferredAttribute: 'fuerza',
    },
  },
  {
    level: 3,
    clase: 'Guerrero',
    ability: {
      name: 'Guardia de Hierro',
      icon: '🛡️',
      description: 'Planta los pies, cierra la guardia y no cede terreno — aguanta el envite sin retroceder.',
      promptText:
        'Planto los pies, cierro la guardia con firmeza y no cedo terreno pase lo que pase, aguantando el envite sin retroceder ni un paso.',
      category: 'combate',
      effect: 'AGUANTE',
      preferredAttribute: 'voluntad',
    },
  },
  {
    level: 5,
    clase: 'Guerrero',
    ability: {
      name: 'Embestida',
      icon: '🐗',
      description: 'Carga con todo el peso del cuerpo contra un enemigo, buscando derribarlo antes de que pueda reaccionar.',
      promptText: 'Bajo el hombro y cargo con todo mi peso contra mi enemigo, buscando derribarlo de un solo golpe.',
      category: 'combate',
      effect: 'ATURDIMIENTO',
      preferredAttribute: 'fuerza',
    },
  },
  {
    level: 6,
    clase: 'Guerrero',
    ability: {
      name: 'Golpe Quebrantador',
      icon: '💥',
      description: 'Un golpe brutal dirigido a romper la guardia del enemigo, sin importar lo que interponga.',
      promptText: 'Descargo un golpe brutal y directo, buscando romper cualquier guardia que mi enemigo interponga.',
      category: 'combate',
      effect: 'ATAQUE',
      preferredAttribute: 'fuerza',
    },
  },
  {
    level: 7,
    clase: 'Cazador',
    ability: {
      name: 'Ojo del Cazador',
      icon: '🎯',
      description: 'Un disparo o lanzamiento certero a distancia, calculado con la paciencia de un cazador experimentado.',
      promptText:
        'Me tomo un instante para apuntar con calma y lanzo un golpe certero a distancia, como un cazador que ya conoce a su presa.',
      category: 'combate',
      effect: 'ATAQUE',
      preferredAttribute: 'destreza',
    },
  },
  {
    level: 8,
    clase: 'Cazador',
    ability: {
      name: 'Zarpazo del Viento Rojo',
      icon: '🌪️',
      description: 'Una serie de golpes veloces y erráticos que dejan al enemigo desorientado, incapaz de anticipar el siguiente.',
      promptText:
        'Me muevo veloz y errático, encadenando golpes rápidos desde ángulos distintos hasta dejar a mi enemigo desorientado.',
      category: 'combate',
      effect: 'ATURDIMIENTO',
      preferredAttribute: 'destreza',
    },
  },
  {
    // Cazador nueva (2026-07-22): equivalente de Cazador a la Guardia de Hierro del Guerrero —
    // esquiva en vez de bloquear.
    level: 9,
    clase: 'Cazador',
    ability: {
      name: 'Paso de Sombra',
      icon: '🌬️',
      description: 'Un movimiento lateral rápido y silencioso que esquiva el golpe antes de que llegue, sin perder de vista al enemigo.',
      promptText:
        'Me desplazo lateral y rápido, casi sin hacer ruido, esquivando el golpe antes de que llegue sin perder de vista a mi enemigo.',
      category: 'combate',
      effect: 'AGUANTE',
      preferredAttribute: 'destreza',
    },
  },
  {
    // Genérica de "Sentencia del Hacha Rota" (roster original de Fable) — sin mención al hacha
    // rota de Gorhorn, ver nota de cabecera.
    level: 10,
    clase: 'Guerrero',
    ability: {
      name: 'Golpe de Sentencia',
      icon: '⚰️',
      description: 'El golpe final sobre un enemigo ya vencido — sin piedad, sin dudarlo.',
      promptText: 'Alzo mi arma sobre el enemigo ya vencido y descargo el golpe final, sin piedad ni titubeo.',
      category: 'combate',
      effect: 'REMATE',
      preferredAttribute: 'fuerza',
    },
  },
  {
    // Cazador nueva (2026-07-22): equivalente de Cazador al Golpe de Sentencia del Guerrero.
    level: 11,
    clase: 'Cazador',
    ability: {
      name: 'Disparo de Gracia',
      icon: '🏹',
      description: 'Un disparo certero y frío sobre un enemigo ya vencido, que no deja lugar a un segundo intento.',
      promptText: 'Apunto con calma sobre mi enemigo ya vencido y disparo el golpe de gracia, sin darle opción a un segundo intento.',
      category: 'combate',
      effect: 'REMATE',
      preferredAttribute: 'destreza',
    },
  },
  {
    // Genérica de "Ira de los Últimos Maktor" (roster original de Fable) — sin mención al Clan
    // Maktor, ver nota de cabecera.
    level: 12,
    clase: 'Guerrero',
    ability: {
      name: 'Ira sin Freno',
      icon: '🔥',
      description: 'Deja que la ira más antigua tome el control por un instante, descargando toda su fuerza en un solo ataque desatado.',
      promptText: 'Dejo que la ira más antigua que llevo dentro tome el control por un instante y descargo toda mi fuerza en un ataque desatado.',
      category: 'combate',
      effect: 'ATAQUE',
      preferredAttribute: 'fuerza',
    },
  },
  {
    // Cazador nueva (2026-07-22): Guerrero no tiene INTIMIDACION en su roster — se le da a Cazador
    // en vez de duplicar un efecto que Guerrero ya cubre, para que el roster completo (Guerrero +
    // Cazador) toque los 5 AbilityEffect al menos una vez cada uno.
    level: 13,
    clase: 'Cazador',
    ability: {
      name: 'Marca del Cazador',
      icon: '👁️',
      description: 'Deja claro, con una sola mirada o gesto calculado, que la presa ya ha sido elegida — quiebra el nervio antes del primer golpe.',
      promptText:
        'Clavo la mirada en mi objetivo y dejo claro, sin una palabra, que ya lo he elegido como presa — quiero que sienta el peso de saberse cazado.',
      category: 'combate',
      effect: 'INTIMIDACION',
      preferredAttribute: 'destreza',
    },
  },
  {
    // Cazador nueva (2026-07-22): segundo ATAQUE de Cazador, para igualar el peso de ataques
    // directos que ya tiene el roster de Guerrero.
    level: 15,
    clase: 'Cazador',
    ability: {
      name: 'Lluvia Certera',
      icon: '🪃',
      description: 'Una sucesión rápida de disparos o lanzamientos que caen sobre el enemigo casi a la vez, sin darle tiempo a cubrirse de todos.',
      promptText: 'Encadeno una sucesión rápida de disparos o lanzamientos, casi a la vez, sin darle tiempo a mi enemigo a cubrirse de todos.',
      category: 'combate',
      effect: 'ATAQUE',
      preferredAttribute: 'destreza',
    },
  },
];

/// Qué habilidades de clase desbloquea un personaje al alcanzar `level` (no acumulado — el
/// llamador itera por cada nivel cruzado en el turno, ver turnResolution.ts). Hoy solo Gorhorn es
/// jugable, y es la "variante especial" que aprende de AMBAS clases (Guerrero y Cazador) — de ahí
/// que este filtro no distinga `clase`, solo nivel. Un futuro personaje de una sola clase
/// necesitaría filtrar también por `clase` aquí.
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
