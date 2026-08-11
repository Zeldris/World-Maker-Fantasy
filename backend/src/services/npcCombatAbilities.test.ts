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
    expect(abilities.some((a) => a.name === 'Contraataque')).toBe(true);
    expect(abilities.some((a) => a.name === 'Grito de Guerra')).toBe(true);
    expect(abilities.some((a) => a.name === 'Analizar rival')).toBe(false); // Cazador
  });

  // Rediseño de combate (2026-08-09): las 4 habilidades de clase pasan a rol:'utilidad' — un NPC
  // con clase hereda ese rol tal cual (mismo mecanismo por el que ya hereda effect/atributo).
  it('las habilidades de clase heredadas llevan rol:\'utilidad\' (reactivas, nunca atacan por su cuenta)', () => {
    const npc: NpcForCombatAbilities = { level: 1, attributes: ATTRS, raza: null, clase: 'Guerrero', ataqueNatural: null, habilidadesRaciales: [] };
    const abilities = npcCombatAbilitiesFor(npc, []);
    expect(abilities.find((a) => a.name === 'Contraataque')?.rol).toBe('utilidad');
    expect(abilities.find((a) => a.name === 'Grito de Guerra')?.rol).toBe('utilidad');
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

  // Bug real jugando en vivo (revisión de partida 2026-08-08): un Múrgol sin arma (fauna, solo
  // `ataqueNatural`) se narró como "el orco lanudo" dando "zarpazos" — el Narrador solo recibía el
  // NOMBRE de la habilidad ("Ataque base", siempre igual), nunca su descripción real
  // ("Topetazo torpe..."), así que no tenía ninguna pista de cómo ataca de verdad esta especie.
  it('sin arma, el Ataque base lleva la descripción real de ataqueNatural (no se pierde)', () => {
    const npc: NpcForCombatAbilities = {
      level: 1,
      attributes: ATTRS,
      raza: null,
      clase: null,
      ataqueNatural: 'Topetazo torpe con su cornamenta ramificada, casi siempre sin intención real de dañar.',
      habilidadesRaciales: [],
    };
    const abilities = npcCombatAbilitiesFor(npc, []);
    const ataqueBase = abilities.find((a) => a.name === 'Ataque base')!;
    expect(ataqueBase.description).toBe('Topetazo torpe con su cornamenta ramificada, casi siempre sin intención real de dañar.');
  });
});

describe('chooseNpcAbility', () => {
  const abilities: NpcCombatAbility[] = npcCombatAbilitiesFor(
    { level: 3, attributes: ATTRS, raza: null, clase: 'Guerrero', ataqueNatural: null, habilidadesRaciales: [] },
    [],
  );

  // energía sobrada (999) en todos estos casos — no es lo que se está probando aquí, ver el
  // describe de abajo para el filtro por energía disponible.
  //
  // Rediseño de combate (2026-08-09): con las 4 de clase ahora rol:'utilidad' (antes 2 de ellas
  // eran effect:'AGUANTE'), el roster de un Guerrero solo tiene UNA habilidad rol:'ataque'
  // (Ataque base) — la exclusión real (defensa/utilidad nunca atacan) se prueba mejor con un
  // roster construido a mano que mezcle los 3 roles, ver el siguiente test.
  it('atacando, con las 4 de clase (todas rol:\'utilidad\'), solo queda Ataque base en el pool — nunca elige una defensiva/utilidad aunque el random señale otra', () => {
    const result = chooseNpcAbility(abilities, 'ataque', 999, () => 0.99);
    expect(result.name).toBe('Ataque base');
    expect(result.rol).toBe('ataque');
  });

  it('un roster con rol ataque/defensa/utilidad mezclados: atacar siempre elige la de rol ataque, nunca defensa/utilidad aunque el random las señale', () => {
    const roster: NpcCombatAbility[] = [
      { name: 'Zarpazo', description: 'Un zarpazo rápido.', attribute: 'fuerza', effect: null, rol: 'ataque', energyCost: 0, energyRegen: 0 },
      { name: 'Esquivar', description: 'Se aparta del golpe confiando solo en sus reflejos.', attribute: 'destreza', effect: 'AGUANTE', rol: 'defensa', energyCost: 0, energyRegen: 5 },
      { name: 'Contraataque', description: 'Aguanta y responde.', attribute: 'voluntad', effect: 'ATAQUE', rol: 'utilidad', energyCost: 0, energyRegen: 0 },
    ];
    for (const r of [0, 0.5, 0.99]) {
      expect(chooseNpcAbility(roster, 'ataque', 999, () => r)).toEqual(roster[0]);
    }
  });

  it('defendiendo con random alto (>0.7), cae al roster completo aunque haya defensivas/utilidad disponibles', () => {
    const result = chooseNpcAbility(abilities, 'defensa', 999, () => 0.9);
    expect(result).toEqual(abilities[Math.floor(0.9 * abilities.length)]);
  });

  it('defendiendo con random bajo (<0.7), prefiere rol defensa o utilidad', () => {
    const result = chooseNpcAbility(abilities, 'defensa', 999, () => 0.1);
    expect(['defensa', 'utilidad']).toContain(result.rol);
  });

  it('sin ninguna defensa/utilidad en el roster, defender cae también al roster completo', () => {
    // Construido a mano (no vía npcCombatAbilitiesFor): desde que Esquivar/Defenderse genéricos
    // son parte fija del roster real, SIEMPRE hay una defensiva — este caso ya no se puede dar en
    // la práctica, pero `chooseNpcAbility` en sí debe seguir cubriendo el hueco si algún día un
    // roster viniera sin ninguna.
    const soloAtaque: NpcCombatAbility[] = [
      { name: 'Ataque base', description: 'Golpe improvisado, cuerpo a cuerpo, sin arma ni ventaja natural.', attribute: 'fuerza', effect: null, rol: 'ataque', energyCost: 0, energyRegen: 0 },
    ];
    expect(chooseNpcAbility(soloAtaque, 'defensa', 999, () => 0.1)).toEqual(soloAtaque[0]);
  });

  // Rediseño de combate (2026-08-09): Analizar rival (effect:'ANALISIS') no tiene ningún payoff
  // mecánico jugable para un NPC — se excluye del roster elegible en los dos roles.
  it('excluye Analizar rival (effect:ANALISIS) del roster elegible, atacando y defendiendo', () => {
    const roster: NpcCombatAbility[] = [
      { name: 'Analizar rival', description: 'x', attribute: 'inteligencia', effect: 'ANALISIS', rol: 'utilidad', energyCost: 0, energyRegen: 0 },
      { name: 'Ataque base', description: 'x', attribute: 'fuerza', effect: null, rol: 'ataque', energyCost: 0, energyRegen: 0 },
    ];
    for (const r of [0, 0.5, 0.99]) {
      expect(chooseNpcAbility(roster, 'ataque', 999, () => r).name).toBe('Ataque base');
      expect(chooseNpcAbility(roster, 'defensa', 999, () => r).name).toBe('Ataque base');
    }
  });
});

describe('chooseNpcAbility — sistema de fatiga simétrico (2026-07-30)', () => {
  const abilities: NpcCombatAbility[] = npcCombatAbilitiesFor(
    { level: 3, attributes: ATTRS, raza: null, clase: 'Guerrero', ataqueNatural: null, habilidadesRaciales: [] },
    [],
  );

  it('rediseño 2026-07-31: sin energía ni para el propio Ataque base (cuesta 5), atacando sigue eligiendo una de ataque real — nunca defensa/utilidad aunque sean las únicas afrontables (mismo bug ya arreglado el 2026-07-31, ahora también en este caso límite)', () => {
    const result = chooseNpcAbility(abilities, 'ataque', 0, () => 0);
    expect(result.rol).toBe('ataque');
    expect(result).toEqual({
      name: 'Ataque base',
      description: expect.any(String),
      attribute: expect.any(String),
      effect: null,
      rol: 'ataque',
      energyCost: ENERGY_COST_ATAQUE_BASICO,
      energyRegen: 0,
    });
  });

  it('descarta las habilidades de coste mayor al disponible, aunque el random las habría elegido', () => {
    const affordable = abilities.filter((a) => a.energyCost === 0);
    expect(affordable).toHaveLength(2); // Esquivar + Defenderse genéricos (Ataque base ya no es gratis, ver rediseño 2026-07-31)
    const result = chooseNpcAbility(abilities, 'defensa', 10, () => 0.9); // Contraataque/Grito de Guerra cuestan 15, no alcanzan
    expect(result.energyCost).toBe(0);
  });

  it('con energía suficiente, puede elegir una habilidad de coste real (rol utilidad incluido)', () => {
    const result = chooseNpcAbility(abilities, 'defensa', 999, () => 0.1);
    expect(['defensa', 'utilidad']).toContain(result.rol);
    expect(result.energyCost).toBeGreaterThan(0);
  });
});
