import type { Attribute, AttributeBlock } from './dice.js';
import type { AbilityEffect, AbilityRol } from '@prisma/client';
import { baseAttackFor } from './baseAttack.js';
import { classAbilityUnlocksForClase, type Clase } from './classAbilities.js';
import { BERIG_RAZAS } from './berigLore.js';
import type { NpcHabilidadRacialInScene } from './npcScene.js';
import { ENERGY_COST_BASICA, ENERGY_COST_ATAQUE_BASICO } from './energy.js';

export interface NpcCombatAbility {
  name: string;
  /// Revisión de partida 2026-08-08, bug real jugando en vivo: un Múrgol (fauna sin arma, cuyo
  /// `ataqueNatural` es "Topetazo torpe con su cornamenta ramificada...") se narró repetidamente
  /// como "el orco lanudo" dando "zarpazos" — porque el único dato que llegaba al Narrador era el
  /// NOMBRE de la habilidad ("Ataque base", siempre igual, sin ninguna pista de CÓMO ataca de
  /// verdad esta especie) — `ataqueBase.description` (baseAttack.ts, ya calculada) se descartaba
  /// aquí mismo antes de este fix. Sin arma/ataqueNatural, el resto de habilidades (de clase,
  /// raciales) sí tenían nombres propios descriptivos, pero fauna desarmada dependía SOLO de
  /// "Ataque base" — el caso más grave y más frecuente.
  description: string;
  attribute: Attribute;
  /// null para Ataque base y habilidades raciales (siempre puramente descriptivas, nunca leídas
  /// como mecánica de combate — ver comentario de `Npc.habilidadesRaciales` en schema.prisma) —
  /// solo las de clase tienen un `AbilityEffect` real.
  effect: AbilityEffect | null;
  /// Rediseño de combate (2026-08-09) — ver `enum AbilityRol` (schema.prisma). Ataque base
  /// siempre 'ataque'; de clase toma el `rol` ya asignado en classAbilities.ts (hoy las 4 son
  /// 'utilidad'); racial humanoide ataque/defensa trivial según el slot; racial de fauna toma
  /// `categoria` tal cual (ya existía en worldCatalog.ts, antes descartado aquí); Esquivar/
  /// Defenderse genéricos 'defensa'.
  rol: AbilityRol;
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
  abilities.push({
    name: ataqueBase.name,
    description: ataqueBase.description,
    attribute: ataqueBase.preferredAttribute,
    effect: null,
    rol: 'ataque',
    energyCost: ENERGY_COST_ATAQUE_BASICO,
    energyRegen: 0,
  });

  if (npc.clase) {
    for (const unlock of classAbilityUnlocksForClase(npc.clase as Clase)) {
      if (unlock.level > npc.level) continue;
      abilities.push({
        name: unlock.ability.name,
        description: unlock.ability.description,
        attribute: unlock.ability.preferredAttribute ?? 'fuerza',
        effect: unlock.ability.effect ?? null,
        rol: unlock.ability.rol ?? 'ataque',
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
        description: raza.habilidadesRaciales.ataque.description,
        attribute: raza.habilidadesRaciales.ataque.preferredAttribute,
        effect: null,
        rol: 'ataque',
        energyCost: ENERGY_COST_BASICA,
        energyRegen: 0,
      });
      abilities.push({
        name: raza.habilidadesRaciales.defensa.name,
        description: raza.habilidadesRaciales.defensa.description,
        attribute: raza.habilidadesRaciales.defensa.preferredAttribute,
        effect: null,
        rol: 'defensa',
        energyCost: ENERGY_COST_BASICA,
        energyRegen: 0,
      });
    }
  }

  for (const racial of npc.habilidadesRaciales) {
    abilities.push({
      name: racial.name,
      description: racial.description,
      attribute: racial.preferredAttribute,
      effect: null,
      // `categoria` ya existía en worldCatalog.ts (ataque/defensa/utilidad) — antes se leía y se
      // descartaba aquí mismo, así que un Corretolvas podía "atacar" con "Fuga audaz" (utilidad,
      // huir) y hacer daño real. Ahora se respeta tal cual.
      rol: racial.categoria,
      energyCost: ENERGY_COST_BASICA,
      energyRegen: 0,
    });
  }

  // Esquivar/Defenderse genéricos (2026-07-30, petición explícita: "a los npc les falta la
  // habilidad de esquivar y defenderse") — mismo fallback SIEMPRE disponible que ya tiene
  // cualquier personaje jugable (GENERIC_COMBAT_ABILITIES, genericCombatAbilities.ts). Sin esto,
  // un NPC sin clase/raza con habilidad AGUANTE (fauna, sociales, PLANTILLA genéricas) no tenía
  // NINGUNA opción defensiva real — `chooseNpcAbility('defensa', ...)` caía siempre en el roster
  // entero (en la práctica, reusar Ataque base como si fuera una defensa). Gratis (energyCost 0)
  // y, desde 2026-07-31, RECUPERAN energía (10/5) — mismos números que el lado del jugador.
  // Descripciones idénticas a GENERIC_COMBAT_ABILITIES (genericCombatAbilities.ts) — mismo verbo
  // que ya usa el jugador para las mismas dos acciones, coherencia entre los dos lados.
  abilities.push({
    name: 'Esquivar',
    description: 'Se aparta del golpe confiando solo en sus reflejos.',
    attribute: 'destreza',
    effect: 'AGUANTE',
    rol: 'defensa',
    energyCost: 0,
    energyRegen: 5,
  });
  abilities.push({
    name: 'Defenderse',
    description: 'Se planta y aguanta el golpe con pura resistencia física.',
    attribute: 'constitucion',
    effect: 'AGUANTE',
    rol: 'defensa',
    energyCost: 0,
    energyRegen: 10,
  });

  return abilities;
}

/// Elige qué habilidad usa el NPC este intercambio (petición explícita: "por lo general usarán
/// habilidades defensivas pero siendo posible usar todas las del combate"). `side` es de qué LADO
/// del intercambio actúa el NPC este turno (atacando o defendiendo) — distinto de
/// `NpcCombatAbility.rol` (qué ES la habilidad en sí), de ahí el renombrado (rediseño de combate,
/// 2026-08-09, antes este parámetro se llamaba `rol` y chocaba con el campo nuevo).
///
/// Defendiendo: `rol:'defensa'` O `rol:'utilidad'` cuentan como "defensivo" (una utilidad
/// reactiva a un ataque rival ES una forma de defenderse, igual que antes lo era AGUANTE) — se
/// prefiere 7 de cada 10 veces, nunca al 100% (deja hueco a defenderse con una de ataque, igual
/// que puede hacer el jugador). Atacando: SOLO `rol:'ataque'` tiene sentido — ni una defensa ni
/// una utilidad "atacan" (bug real confirmado jugando en vivo, 2026-07-31, cuando esto se
/// filtraba solo por `effect==='AGUANTE'`: "el orco ataca con Esquivar"). Se excluye SIEMPRE
/// `effect==='ANALISIS'` (Analizar rival) del roster elegible, en los dos roles — no tiene ningún
/// payoff mecánico jugable desde el lado del NPC (no hay ficha del jugador que ocultar/revelar).
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
  side: 'ataque' | 'defensa',
  energiaDisponible: number,
  random: () => number = Math.random,
): NpcCombatAbility {
  const usable = abilities.filter((a) => a.effect !== 'ANALISIS');
  const affordable = usable.filter((a) => a.energyCost <= energiaDisponible);
  if (side === 'defensa') {
    const defensivas = affordable.filter((a) => a.rol === 'defensa' || a.rol === 'utilidad');
    if (defensivas.length > 0 && random() < 0.7) {
      return defensivas[Math.floor(random() * defensivas.length)];
    }
    return affordable[Math.floor(random() * affordable.length)];
  }
  const atacantes = affordable.filter((a) => a.rol === 'ataque');
  if (atacantes.length > 0) return atacantes[Math.floor(random() * atacantes.length)];
  // Sin ninguna de ataque AFRONTABLE (2026-07-31, consecuencia real de que Ataque base ya no sea
  // gratis) — antes de caer en el roster entero (que podría ser puramente defensiva/utilidad y
  // reintroducir "el orco ataca con Esquivar", el bug ya arreglado el 2026-07-31), se prueba con
  // CUALQUIER habilidad de ataque del roster completo, ignorando el coste — un NPC exhausto sigue
  // golpeando igual, nunca "ataca defendiéndose". `nextEnergia` ya topa el resultado a 0, nunca a
  // negativo.
  const cualquierAtacante = usable.filter((a) => a.rol === 'ataque');
  const pool = cualquierAtacante.length > 0 ? cualquierAtacante : affordable;
  return pool[Math.floor(random() * pool.length)];
}
