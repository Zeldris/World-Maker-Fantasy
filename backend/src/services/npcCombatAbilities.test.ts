import { describe, it, expect } from 'vitest';
import { npcCombatAbilitiesFor, chooseNpcAbility, type NpcForCombatAbilities, type NpcCombatAbility } from './npcCombatAbilities.js';
import { ENERGY_COST_ATAQUE_BASICO } from './energy.js';

const ATTRS = { fuerza: 13, destreza: 10, constitucion: 5, inteligencia: 5, voluntad: 8, carisma: 2, arcano: 2 };

describe('npcCombatAbilitiesFor', () => {
  it('siempre incluye Ataque base + Esquivar/Defenderse genéricos, aunque el NPC no tenga clase/raza/racial (p.ej. NPC social)', () => {
    const npc: NpcForCombatAbilities = { level: 1, attributes: ATTRS, raza: null, clase: null, ataqueNatural: null, habilidadesRaciales: [] };
    const abilities = npcCombatAbilitiesFor(npc, []);
    expect(abilities.map((a) => a.name)).toEqual(['Ataque base', 'Esquivar', 'Defenderse']);
  });

  it('Esquivar/Defenderse genéricos son gratis (energyCost 0) y siempre AGUANTE, como el fallback del jugador', () => {
    const npc: NpcForCombatAbilities = { level: 1, attributes: ATTRS, raza: null, clase: null, ataqueNatural: null, habilidadesRaciales: [] };
    const abilities = npcCombatAbilitiesFor(npc, []);
    const esquivar = abilities.find((a) => a.name === 'Esquivar')!;
    const defenderse = abilities.find((a) => a.name === 'Defenderse')!;
    expect(esquivar).toMatchObject({ attribute: 'destreza', effect: 'AGUANTE', energyCost: 0 });
    expect(defenderse).toMatchObject({ attribute: 'constitucion', effect: 'AGUANTE', energyCost: 0 });
  });

  it('rediseño 2026-07-31: Ataque base cuesta ENERGY_COST_ATAQUE_BASICO (ya no gratis), Esquivar/Defenderse recuperan energía en vez de solo ser gratis', () => {
    const npc: NpcForCombatAbilities = { level: 1, attributes: ATTRS, raza: null, clase: null, ataqueNatural: null, habilidadesRaciales: [] };
    const abilities = npcCombatAbilitiesFor(npc, []);
    expect(abilities.find((a) => a.name === 'Ataque base')).toMatchObject({ energyCost: ENERGY_COST_ATAQUE_BASICO, energyRegen: 0 });
    expect(abilities.find((a) => a.name === 'Esquivar')).toMatchObject({ energyCost: 0, energyRegen: 5 });
    expect(abilities.find((a) => a.name === 'Defenderse')).toMatchObject({ energyCost: 0, energyRegen: 10 });
  });

  it('añade las 2 habilidades de la clase (todas desde nivel 1, tope de 10 habilidades), nunca las de la otra clase', () => {
    const npc: NpcForCombatAbilities = { level: 1, attributes: ATTRS, raza: null, clase: 'Guerrero', ataqueNatural: null, habilidadesRaciales: [] };
    const abilities = npcCombatAbilitiesFor(npc, []);
    expect(abilities.some((a) => a.name === 'Puño de Hierro')).toBe(true);
    expect(abilities.some((a) => a.name === 'Grito de Guerra')).toBe(true);
    expect(abilities.some((a) => a.name === 'Lectura de Presa')).toBe(false); // Cazador
  });

  it('añade la habilidad racial humanoide cuando tiene raza asignada', () => {
    const npc: NpcForCombatAbilities = { level: 1, attributes: ATTRS, raza: 'orcos', clase: null, ataqueNatural: null, habilidadesRaciales: [] };
    const abilities = npcCombatAbilitiesFor(npc, []);
    expect(abilities.some((a) => a.name === 'Sangre del Estallido')).toBe(true);
  });

  it('añade las habilidades raciales de fauna tal cual vienen (sin duplicar con `raza`)', () => {
    const npc: NpcForCombatAbilities = {
      level: 1,
      attributes: ATTRS,
      raza: null,
      clase: null,
      ataqueNatural: 'Topetazo',
      habilidadesRaciales: [{ icon: '🧶', name: 'Lana Espesa', description: 'x', categoria: 'defensa', preferredAttribute: 'fuerza' }],
    };
    const abilities = npcCombatAbilitiesFor(npc, []);
    expect(abilities.map((a) => a.name)).toEqual(['Ataque base', 'Lana Espesa', 'Esquivar', 'Defenderse']);
  });
});

describe('chooseNpcAbility', () => {
  const abilities: NpcCombatAbility[] = npcCombatAbilitiesFor(
    { level: 3, attributes: ATTRS, raza: null, clase: 'Guerrero', ataqueNatural: null, habilidadesRaciales: [] },
    [],
  );

  // energía sobrada (999) en todos estos casos — no es lo que se está probando aquí, ver el
  // describe de abajo para el filtro por energía disponible.
  it('atacando, EXCLUYE del todo las habilidades puramente defensivas (AGUANTE) del pool — bug real confirmado jugando en vivo (2026-07-31): el NPC "atacaba" con Esquivar', () => {
    // random()=0.99 → sin excluir AGUANTE, caería en el último elemento del roster (Defenderse,
    // AGUANTE) — con el fix, cae en el último elemento del pool YA filtrado.
    const result = chooseNpcAbility(abilities, 'ataque', 999, () => 0.99);
    expect(result.effect).not.toBe('AGUANTE');
  });

  it('un roster con una única habilidad de ataque real + Esquivar/Defenderse: atacar siempre elige la de ataque, nunca Esquivar/Defenderse aunque el random las señale', () => {
    const roster: NpcCombatAbility[] = [
      { name: 'Zarpazo', attribute: 'fuerza', effect: null, energyCost: 0, energyRegen: 0 },
      { name: 'Esquivar', attribute: 'destreza', effect: 'AGUANTE', energyCost: 0, energyRegen: 5 },
      { name: 'Defenderse', attribute: 'constitucion', effect: 'AGUANTE', energyCost: 0, energyRegen: 10 },
    ];
    for (const r of [0, 0.5, 0.99]) {
      expect(chooseNpcAbility(roster, 'ataque', 999, () => r)).toEqual(roster[0]);
    }
  });

  it('defendiendo con random alto (>0.7), cae al roster completo aunque haya una AGUANTE disponible', () => {
    const result = chooseNpcAbility(abilities, 'defensa', 999, () => 0.9);
    expect(result).toEqual(abilities[Math.floor(0.9 * abilities.length)]);
  });

  it('defendiendo con random bajo (<0.7) y una AGUANTE disponible, la prefiere', () => {
    const result = chooseNpcAbility(abilities, 'defensa', 999, () => 0.1);
    expect(result.effect).toBe('AGUANTE');
  });

  it('sin ninguna AGUANTE en el roster, defender cae también al roster completo', () => {
    // Construido a mano (no vía npcCombatAbilitiesFor): desde que Esquivar/Defenderse genéricos
    // son parte fija del roster real, SIEMPRE hay una AGUANTE — este caso ya no se puede dar en
    // la práctica, pero `chooseNpcAbility` en sí debe seguir cubriendo el hueco si algún día un
    // roster viniera sin ninguna.
    const soloAtaque: NpcCombatAbility[] = [{ name: 'Ataque base', attribute: 'fuerza', effect: null, energyCost: 0, energyRegen: 0 }];
    expect(chooseNpcAbility(soloAtaque, 'defensa', 999, () => 0.1)).toEqual(soloAtaque[0]);
  });
});

describe('chooseNpcAbility — sistema de fatiga simétrico (2026-07-30)', () => {
  const abilities: NpcCombatAbility[] = npcCombatAbilitiesFor(
    { level: 3, attributes: ATTRS, raza: null, clase: 'Guerrero', ataqueNatural: null, habilidadesRaciales: [] },
    [],
  );

  it('rediseño 2026-07-31: sin energía ni para el propio Ataque base (cuesta 5), atacando sigue eligiendo una de ataque real — nunca Esquivar/Defenderse aunque sean las únicas afrontables (mismo bug ya arreglado el 2026-07-31, ahora también en este caso límite)', () => {
    const result = chooseNpcAbility(abilities, 'ataque', 0, () => 0);
    expect(result.effect).not.toBe('AGUANTE');
    expect(result).toEqual({ name: 'Ataque base', attribute: expect.any(String), effect: null, energyCost: ENERGY_COST_ATAQUE_BASICO, energyRegen: 0 });
  });

  it('descarta las habilidades de coste mayor al disponible, aunque el random las habría elegido', () => {
    const affordable = abilities.filter((a) => a.energyCost === 0);
    expect(affordable).toHaveLength(2); // Esquivar + Defenderse genéricos (Ataque base ya no es gratis, ver rediseño 2026-07-31)
    const result = chooseNpcAbility(abilities, 'defensa', 10, () => 0.9); // AGUANTE de clase cuesta 15, no alcanza
    expect(result.energyCost).toBe(0);
  });

  it('con energía suficiente, puede elegir una habilidad de coste real (AGUANTE incluida)', () => {
    const result = chooseNpcAbility(abilities, 'defensa', 999, () => 0.1);
    expect(result.effect).toBe('AGUANTE');
    expect(result.energyCost).toBeGreaterThan(0);
  });
});
