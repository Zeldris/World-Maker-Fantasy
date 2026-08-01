import type { Attribute, AttributeBlock } from './dice.js';
import type { AbilityEffect } from '@prisma/client';
import { baseAttackFor } from './baseAttack.js';
import { classAbilityUnlocksForClase, type Clase } from './classAbilities.js';
import { BERIG_RAZAS } from './berigLore.js';
import type { NpcHabilidadRacialInScene } from './npcScene.js';
import { ENERGY_COST_BASICA, ENERGY_COST_ATAQUE_BASICO } from './energy.js';

export interface NpcCombatAbility {
  name: string;
  attribute: Attribute;
  /// null para Ataque base y habilidades raciales (siempre puramente descriptivas, nunca leídas
  /// como mecánica de combate — ver comentario de `Npc.habilidadesRaciales` en schema.prisma) —
  /// solo las de clase tienen un `AbilityEffect` real.
  effect: AbilityEffect | null;
  /// Sistema de fatiga simétrico (2026-07-30, deuda técnica: "los NPC siguen eligiendo habilidad
  /// sin restricción de energía") — mismo coste fijo por tramo que el jugador (energy.ts):
  /// ENERGY_COST_ATAQUE_BASICO para el Ataque base (2026-07-31, antes 0/gratis — ver comentario
  /// de más abajo), ENERGY_COST_BASICA para el resto (de clase, racial dual, o la propia de
  /// fauna) — ningún NPC tiene hoy una habilidad "avanzada" equivalente a la de arma nivel 20 del
  /// jugador, así que no hace falta ese tramo.
  energyCost: number;
  /// Rediseño 2026-07-31 (mismo sistema simétrico que el coste, ver energy.ts § nextEnergia) —
  /// energía que RECUPERA usar esta habilidad en un intercambio real. Esquivar/Defenderse
  /// genéricos regeneran (5/10); el resto, incluido Ataque base, se queda en 0.
  energyRegen: number;
}

export interface NpcForCombatAbilities {
  level: number;
  attributes: AttributeBlock;
  raza: string | null;
  clase: string | null;
  ataqueNatural: string | null;
  habilidadesRaciales: NpcHabilidadRacialInScene[];
}

/// Rediseño del turno de combate (2026-07-28) — reúne TODO lo que un NPC puede usar en un
/// intercambio (Ataque base + su clase, si tiene, hasta su nivel + su racial, humanoide o
/// fauna) en una sola lista plana. Mismo criterio que `resolveCombatAbilities` del frontend
/// (lib/npcAbilities.ts) para la ficha de la Enciclopedia, pero aquí en el backend y sobre los
/// catálogos reales (classAbilities.ts/berigLore.ts) en vez de la respuesta HTTP de la
/// Enciclopedia — los dos deben mostrar lo mismo, pero este es el que de verdad decide la
/// mecánica.
export function npcCombatAbilitiesFor(npc: NpcForCombatAbilities, weaponNames: string[]): NpcCombatAbility[] {
  const abilities: NpcCombatAbility[] = [];

  // Rediseño 2026-07-31 ("ataque básico... son acciones que tienen todos los personajes... cuesta
  // solo 5 de energía") — mismo cambio que el lado del jugador (weaponAbilities.ts): el Ataque
  // base deja de ser gratis y pasa a costar ENERGY_COST_ATAQUE_BASICO, simétrico entre jugador y
  // NPC.
  const ataqueBase = baseAttackFor({ attributes: npc.attributes, weaponNames, ataqueNatural: npc.ataqueNatural });
  abilities.push({ name: ataqueBase.name, attribute: ataqueBase.preferredAttribute, effect: null, energyCost: ENERGY_COST_ATAQUE_BASICO, energyRegen: 0 });

  if (npc.clase) {
    for (const unlock of classAbilityUnlocksForClase(npc.clase as Clase)) {
      if (unlock.level > npc.level) continue;
      abilities.push({
        name: unlock.ability.name,
        attribute: unlock.ability.preferredAttribute ?? 'fuerza',
        effect: unlock.ability.effect ?? null,
        energyCost: ENERGY_COST_BASICA,
        energyRegen: 0,
      });
    }
  }

  if (npc.raza) {
    const raza = BERIG_RAZAS.find((r) => r.slug === npc.raza);
    if (raza) {
      abilities.push({
        name: raza.habilidadesRaciales.ataque.name,
        attribute: raza.habilidadesRaciales.ataque.preferredAttribute,
        effect: null,
        energyCost: ENERGY_COST_BASICA,
        energyRegen: 0,
      });
      abilities.push({
        name: raza.habilidadesRaciales.defensa.name,
        attribute: raza.habilidadesRaciales.defensa.preferredAttribute,
        effect: null,
        energyCost: ENERGY_COST_BASICA,
        energyRegen: 0,
      });
    }
  }

  for (const racial of npc.habilidadesRaciales) {
    abilities.push({ name: racial.name, attribute: racial.preferredAttribute, effect: null, energyCost: ENERGY_COST_BASICA, energyRegen: 0 });
  }

  // Esquivar/Defenderse genéricos (2026-07-30, petición explícita: "a los npc les falta la
  // habilidad de esquivar y defenderse") — mismo fallback SIEMPRE disponible que ya tiene
  // cualquier personaje jugable (GENERIC_COMBAT_ABILITIES, genericCombatAbilities.ts). Sin esto,
  // un NPC sin clase/raza con habilidad AGUANTE (fauna, sociales, PLANTILLA genéricas) no tenía
  // NINGUNA opción defensiva real — `chooseNpcAbility('defensa', ...)` caía siempre en el roster
  // entero (en la práctica, reusar Ataque base como si fuera una defensa). Gratis (energyCost 0)
  // y, desde 2026-07-31, RECUPERAN energía (10/5) — mismos números que el lado del jugador.
  abilities.push({ name: 'Esquivar', attribute: 'destreza', effect: 'AGUANTE', energyCost: 0, energyRegen: 5 });
  abilities.push({ name: 'Defenderse', attribute: 'constitucion', effect: 'AGUANTE', energyCost: 0, energyRegen: 10 });

  return abilities;
}

/// Elige qué habilidad usa el NPC este intercambio (petición explícita: "por lo general usarán
/// habilidades defensivas pero siendo posible usar todas las del combate") — AGUANTE es la única
/// etiqueta mecánicamente defensiva (ver classAbilities.ts/death.ts); si el NPC tiene alguna Y le
/// toca defender, la prefiere 7 de cada 10 veces, nunca al 100% (deja hueco a que use cualquier
/// otra, igual que puede hacer el jugador — incluida una de ataque, tiene sentido "defenderse"
/// contraatacando). Atacando, en cambio, una habilidad puramente defensiva (AGUANTE) NUNCA tiene
/// sentido — "el orco ataca con Esquivar" es una frase sin sentido (bug real confirmado jugando
/// en vivo, 2026-07-31: `npcAbilityUsed` devolvió exactamente eso) — así que se excluye del todo
/// del pool de ataque, nunca solo se le resta preferencia. Sin ninguna AGUANTE en el roster (no
/// pasa en la práctica: Esquivar/Defenderse genéricas siempre están), atacar cae al roster
/// entero igual que antes.
///
/// Sistema de fatiga simétrico (2026-07-30) — `energiaDisponible` descarta antes de elegir
/// cualquier habilidad que el NPC no pueda pagar ahora mismo, mismo criterio que HabilidadesPanel
/// bloquea un botón sin energía suficiente para el jugador. Desde 2026-07-31 el Ataque base ya NO
/// es gratis (cuesta ENERGY_COST_ATAQUE_BASICO) — Esquivar/Defenderse (energyCost 0) siguen
/// sobreviviendo el filtro, así que `affordable` nunca sale vacío, pero un NPC muy exhausto (menos
/// de 5 de energía, tras una racha larga de ataques sin defender nunca) puede quedarse SIN ningún
/// `atacantes` afrontable — ver el segundo fallback de abajo.
export function chooseNpcAbility(
  abilities: NpcCombatAbility[],
  rol: 'ataque' | 'defensa',
  energiaDisponible: number,
  random: () => number = Math.random,
): NpcCombatAbility {
  const affordable = abilities.filter((a) => a.energyCost <= energiaDisponible);
  if (rol === 'defensa') {
    const defensivas = affordable.filter((a) => a.effect === 'AGUANTE');
    if (defensivas.length > 0 && random() < 0.7) {
      return defensivas[Math.floor(random() * defensivas.length)];
    }
    return affordable[Math.floor(random() * affordable.length)];
  }
  const atacantes = affordable.filter((a) => a.effect !== 'AGUANTE');
  if (atacantes.length > 0) return atacantes[Math.floor(random() * atacantes.length)];
  // Sin ninguna de ataque AFRONTABLE (2026-07-31, consecuencia real de que Ataque base ya no sea
  // gratis) — antes de caer en el roster entero (que podría ser puramente AGUANTE y reintroducir
  // "el orco ataca con Esquivar", el bug ya arreglado el 2026-07-31), se prueba con CUALQUIER
  // habilidad de ataque del roster completo, ignorando el coste — un NPC exhausto sigue golpeando
  // igual, nunca "ataca defendiéndose". `nextEnergia` ya topa el resultado a 0, nunca a negativo.
  const cualquierAtacante = abilities.filter((a) => a.effect !== 'AGUANTE');
  const pool = cualquierAtacante.length > 0 ? cualquierAtacante : affordable;
  return pool[Math.floor(random() * pool.length)];
}
