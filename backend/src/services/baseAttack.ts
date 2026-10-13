import type { AttributeBlock, Attribute } from './dice.js';

export interface BaseAttackAbility {
  icon: string;
  name: string;
  description: string;
  preferredAttribute: Attribute;
}

/// "Ataque base" (rediseño de la vista de combate, 2026-07-28, petición explícita: "todos los
/// elementos con los que podamos combatir tengan siempre una habilidad tipo 'Ataque Básico' que
/// varía según los atributos y se describe según el arma que tenga equipada... y si no tienen
/// como la fauna utiliza la extremidad principal que usa para atacar"). Calculada, no guardada en
/// BD — todo combatiente (jugador, NPC, fauna) tiene siempre una, nunca falta en su ficha.
///
/// - Si hay arma(s) equipada(s)/en su loadout, la describe por nombre (reutiliza
///   `equippedWeaponNames` para el jugador; para NPCs, el llamador resuelve su `loadout` contra
///   `ItemCatalog.category === 'arma'` antes de llamar aquí — ver worldCatalog.ts/world.ts).
/// - Si no hay arma pero sí `ataqueNatural` (fauna, ver Npc.ataqueNatural), usa esa frase.
/// - Si no hay ninguno de los dos, cae a un golpe improvisado genérico.
///
/// `preferredAttribute` "varía según los atributos": no es un valor fijo — es el mayor entre
/// fuerza/destreza de la propia entidad (mismo criterio de fondo que `tabulatedAttackAttribute`
/// en npcScene.ts, que también arbitra entre estos dos para un golpe directo).
export function baseAttackFor(params: { attributes: AttributeBlock; weaponNames: string[]; ataqueNatural?: string | null }): BaseAttackAbility {
  const { attributes, weaponNames, ataqueNatural } = params;
  const preferredAttribute: Attribute = attributes.destreza > attributes.fuerza ? 'destreza' : 'fuerza';

  if (weaponNames.length > 0) {
    return {
      icon: '⚔️',
      name: 'Ataque Básico',
      description: `Golpe directo con ${weaponNames.join(' y ')}.`,
      preferredAttribute,
    };
  }
  if (ataqueNatural) {
    return {
      icon: '🩸',
      name: 'Ataque Básico',
      description: ataqueNatural,
      preferredAttribute,
    };
  }
  return {
    icon: '👊',
    name: 'Ataque Básico',
    description: 'Golpe improvisado, cuerpo a cuerpo, sin arma ni ventaja natural.',
    preferredAttribute,
  };
}
