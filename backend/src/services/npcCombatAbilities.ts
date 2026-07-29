import type { Attribute, AttributeBlock } from './dice.js';
import type { AbilityEffect } from '@prisma/client';
import { baseAttackFor } from './baseAttack.js';
import { classAbilityUnlocksForClase, type Clase } from './classAbilities.js';
import { BERIG_RAZAS } from './berigLore.js';
import type { NpcHabilidadRacialInScene } from './npcScene.js';

export interface NpcCombatAbility {
  name: string;
  attribute: Attribute;
  /// null para Ataque base y habilidades raciales (siempre puramente descriptivas, nunca leídas
  /// como mecánica de combate — ver comentario de `Npc.habilidadesRaciales` en schema.prisma) —
  /// solo las de clase tienen un `AbilityEffect` real.
  effect: AbilityEffect | null;
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

  const ataqueBase = baseAttackFor({ attributes: npc.attributes, weaponNames, ataqueNatural: npc.ataqueNatural });
  abilities.push({ name: ataqueBase.name, attribute: ataqueBase.preferredAttribute, effect: null });

  if (npc.clase) {
    for (const unlock of classAbilityUnlocksForClase(npc.clase as Clase)) {
      if (unlock.level > npc.level) continue;
      abilities.push({ name: unlock.ability.name, attribute: unlock.ability.preferredAttribute ?? 'fuerza', effect: unlock.ability.effect ?? null });
    }
  }

  if (npc.raza) {
    const raza = BERIG_RAZAS.find((r) => r.slug === npc.raza);
    if (raza) abilities.push({ name: raza.habilidadRacial.name, attribute: raza.habilidadRacial.preferredAttribute, effect: null });
  }

  for (const racial of npc.habilidadesRaciales) {
    abilities.push({ name: racial.name, attribute: racial.preferredAttribute, effect: null });
  }

  return abilities;
}

/// Elige qué habilidad usa el NPC este intercambio (petición explícita: "por lo general usarán
/// habilidades defensivas pero siendo posible usar todas las del combate") — AGUANTE es la única
/// etiqueta mecánicamente defensiva (ver classAbilities.ts/death.ts); si el NPC tiene alguna Y le
/// toca defender, la prefiere 7 de cada 10 veces, nunca al 100% (deja hueco a que use cualquier
/// otra, igual que puede hacer el jugador). Atacando, o sin ninguna AGUANTE disponible, elige
/// uniformemente entre todo su roster (con Ataque base siempre presente, nunca se queda sin nada
/// que elegir).
export function chooseNpcAbility(abilities: NpcCombatAbility[], rol: 'ataque' | 'defensa', random: () => number = Math.random): NpcCombatAbility {
  if (rol === 'defensa') {
    const defensivas = abilities.filter((a) => a.effect === 'AGUANTE');
    if (defensivas.length > 0 && random() < 0.7) {
      return defensivas[Math.floor(random() * defensivas.length)];
    }
  }
  return abilities[Math.floor(random() * abilities.length)];
}
