import { describe, it, expect } from 'vitest';
import { npcCombatAbilitiesFor, chooseNpcAbility, type NpcForCombatAbilities, type NpcCombatAbility } from './npcCombatAbilities.js';
import { ENERGY_COST_ATAQUE_BASICO } from './energy.js';

const ATTRS = { fuerza: 13, destreza: 10, constitucion: 5, inteligencia: 5, voluntad: 8, carisma: 2, arcano: 2 };

describe('npcCombatAbilitiesFor', () => {
  it('siempre incluye Ataque base + Esquivar/Defenderse/Descansar genéricos, aunque el NPC no tenga clase/raza/racial (p.ej. NPC social)', () => {
    const npc: NpcForCombatAbilities = { level: 1, attributes: ATTRS, raza: null, clase: null, ataqueNatural: null, habilidadesRaciales: [] };
    const abilities = npcCombatAbilitiesFor(npc, []);
    expect(abilities.map((a) => a.name)).toEqual(['Ataque base', 'Esquivar', 'Defenderse', 'Descansar']);
  });

  // Descansar (2026-08-17): tercera opción defensiva genérica — recupera mucha más energía (15)
  // que Defenderse (5), a cambio de no defender mejor (mismo `attribute:'constitucion'`, sin
  // ningún divisor especial — la fórmula estándar ya divide el atributo entre 2).
  it('Descansar genérico: gratis, AGUANTE, constitución, y recupera más energía que Defenderse', () => {
    const npc: NpcForCombatAbilities = { level: 1, attributes: ATTRS, raza: null, clase: null, ataqueNatural: null, habilidadesRaciales: [] };
    const abilities = npcCombatAbilitiesFor(npc, []);
    const descansar = abilities.find((a) => a.name === 'Descansar')!;
    expect(descansar).toMatchObject({ attribute: 'constitucion', effects: ['AGUANTE'], rol: 'defensa', energyCost: 0, energyRegen: 15 });
  });

  it('Esquivar/Defenderse genéricos son gratis (energyCost 0) y siempre AGUANTE, como el fallback del jugador', () => {
    const npc: NpcForCombatAbilities = { level: 1, attributes: ATTRS, raza: null, clase: null, ataqueNatural: null, habilidadesRaciales: [] };
    const abilities = npcCombatAbilitiesFor(npc, []);
    const esquivar = abilities.find((a) => a.name === 'Esquivar')!;
    const defenderse = abilities.find((a) => a.name === 'Defenderse')!;
    // Esquivar/Defenderse (2026-08-15): coste/regen intercambiados — Esquivar ahora cuesta 5 y
    // no regenera, Defenderse sigue gratis y regenera 5.
    expect(esquivar).toMatchObject({ attribute: 'destreza', effects: ['AGUANTE'], energyCost: 5 });
    expect(defenderse).toMatchObject({ attribute: 'constitucion', effects: ['AGUANTE'], energyCost: 0 });
  });

  it('rediseño 2026-07-31/2026-08-15: Ataque base cuesta ENERGY_COST_ATAQUE_BASICO (ya no gratis), Esquivar cuesta 5 sin regenerar, Defenderse gratis y regenera 5', () => {
    const npc: NpcForCombatAbilities = { level: 1, attributes: ATTRS, raza: null, clase: null, ataqueNatural: null, habilidadesRaciales: [] };
    const abilities = npcCombatAbilitiesFor(npc, []);
    expect(abilities.find((a) => a.name === 'Ataque base')).toMatchObject({ energyCost: ENERGY_COST_ATAQUE_BASICO, energyRegen: 0 });
    expect(abilities.find((a) => a.name === 'Esquivar')).toMatchObject({ energyCost: 5, energyRegen: 0 });
    expect(abilities.find((a) => a.name === 'Defenderse')).toMatchObject({ energyCost: 0, energyRegen: 5 });
  });

  // Roster de clase ampliado (2026-08-15): de 2 a nivel 1 a 4 (Guerrero)/3 (Cazador) repartidas
  // por nivel — a nivel 1 exacto, Guerrero solo tiene "Grito de Guerra" (Contraataque es nivel 8).
  it('a nivel 1 solo tiene la primera habilidad de su clase (Grito de Guerra), nunca las de la otra clase ni las de nivel superior', () => {
    const npc: NpcForCombatAbilities = { level: 1, attributes: ATTRS, raza: null, clase: 'Guerrero', ataqueNatural: null, habilidadesRaciales: [] };
    const abilities = npcCombatAbilitiesFor(npc, []);
    expect(abilities.some((a) => a.name === 'Grito de Guerra')).toBe(true);
    expect(abilities.some((a) => a.name === 'Contraataque')).toBe(false); // nivel 8, todavía no
    expect(abilities.some((a) => a.name === 'Analisis Salvaje')).toBe(false); // Cazador
  });

  it('a nivel 8, un Guerrero ya tiene las 4 (incluida Contraataque)', () => {
    const npc: NpcForCombatAbilities = { level: 8, attributes: ATTRS, raza: null, clase: 'Guerrero', ataqueNatural: null, habilidadesRaciales: [] };
    const abilities = npcCombatAbilitiesFor(npc, []);
    expect(abilities.some((a) => a.name === 'Grito de Guerra')).toBe(true);
    expect(abilities.some((a) => a.name === 'Detectar Puntos Débiles')).toBe(true);
    expect(abilities.some((a) => a.name === 'Grito tenebroso')).toBe(true);
    expect(abilities.some((a) => a.name === 'Contraataque')).toBe(true);
  });

  // Pasivas (2026-08-15) nunca entran al roster de combate — "Compañero cazador" (Cazador, nivel
  // 8, rol:'pasiva') se filtra antes de llegar aquí.
  it('un Cazador de nivel 8 nunca tiene "Compañero cazador" en el roster de combate (es pasiva)', () => {
    const npc: NpcForCombatAbilities = { level: 8, attributes: ATTRS, raza: null, clase: 'Cazador', ataqueNatural: null, habilidadesRaciales: [] };
    const abilities = npcCombatAbilitiesFor(npc, []);
    expect(abilities.some((a) => a.name === 'Compañero cazador')).toBe(false);
    expect(abilities.some((a) => a.name === 'Analisis Salvaje')).toBe(true);
    expect(abilities.some((a) => a.name === 'Barrido Salvaje')).toBe(true);
  });

  // Rediseño de combate (2026-08-09): las habilidades de clase pasan a rol:'utilidad' salvo
  // Barrido Salvaje (rol:'defensa', 2026-08-15) — un NPC con clase hereda el rol tal cual (mismo
  // mecanismo por el que ya hereda effects/atributo).
  it('las habilidades de clase heredadas llevan el rol asignado (reactivas, nunca atacan por su cuenta)', () => {
    const npc: NpcForCombatAbilities = { level: 8, attributes: ATTRS, raza: null, clase: 'Guerrero', ataqueNatural: null, habilidadesRaciales: [] };
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
    expect(abilities.map((a) => a.name)).toEqual(['Ataque base', 'Lana Espesa', 'Esquivar', 'Defenderse', 'Descansar']);
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
      { name: 'Zarpazo', description: 'Un zarpazo rápido.', attribute: 'fuerza', effects: [], rol: 'ataque', energyCost: 0, energyRegen: 0 },
      { name: 'Esquivar', description: 'Se aparta del golpe confiando solo en sus reflejos.', attribute: 'destreza', effects: ['AGUANTE'], rol: 'defensa', energyCost: 0, energyRegen: 5 },
      { name: 'Contraataque', description: 'Aguanta y responde.', attribute: 'voluntad', effects: ['ATAQUE'], rol: 'utilidad', energyCost: 0, energyRegen: 0 },
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
      { name: 'Ataque base', description: 'Golpe improvisado, cuerpo a cuerpo, sin arma ni ventaja natural.', attribute: 'fuerza', effects: [], rol: 'ataque', energyCost: 0, energyRegen: 0 },
    ];
    expect(chooseNpcAbility(soloAtaque, 'defensa', 999, () => 0.1)).toEqual(soloAtaque[0]);
  });

  // Rediseño de combate (2026-08-09): Analizar rival (effect:'ANALISIS') no tiene ningún payoff
  // mecánico jugable para un NPC — se excluye del roster elegible en los dos roles.
  it('excluye Analizar rival (effect:ANALISIS) del roster elegible, atacando y defendiendo', () => {
    const roster: NpcCombatAbility[] = [
      { name: 'Analizar rival', description: 'x', attribute: 'inteligencia', effects: ['ANALISIS'], rol: 'utilidad', energyCost: 0, energyRegen: 0 },
      { name: 'Ataque base', description: 'x', attribute: 'fuerza', effects: [], rol: 'ataque', energyCost: 0, energyRegen: 0 },
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
      effects: [],
      rol: 'ataque',
      energyCost: ENERGY_COST_ATAQUE_BASICO,
      energyRegen: 0,
    });
  });

  it('descarta las habilidades de coste mayor al disponible, aunque el random las habría elegido', () => {
    // Defenderse y Descansar son gratis de verdad (2026-08-15/17: Esquivar pasó a costar 5, ya no
    // 0 — ver npcCombatAbilities.ts). Ataque base tampoco es gratis desde el rediseño 2026-07-31.
    const affordable = abilities.filter((a) => a.energyCost === 0);
    expect(affordable).toHaveLength(2);
    const result = chooseNpcAbility(abilities, 'defensa', 10, () => 0.9); // Grito de Guerra cuesta ENERGY_COST_BASICA (10), no alcanza
    expect(result.energyCost).toBe(0);
  });

  it('con energía suficiente, puede elegir una habilidad de coste real (rol utilidad incluido)', () => {
    const result = chooseNpcAbility(abilities, 'defensa', 999, () => 0.1);
    expect(['defensa', 'utilidad']).toContain(result.rol);
    expect(result.energyCost).toBeGreaterThan(0);
  });
});

// maxUsesPerCombat/LIMITADA (2026-08-15): una habilidad con tope de usos se descarta del roster
// elegible en cuanto `usageCounts` alcanza su `maxUsesPerCombat`, mismo criterio que `energyCost`.
describe('chooseNpcAbility — tope de usos por combate (maxUsesPerCombat)', () => {
  it('descarta una habilidad que ya agotó su tope de usos, aunque el random la habría elegido', () => {
    const roster: NpcCombatAbility[] = [
      { name: 'Golpe Certero', description: 'x', attribute: 'fuerza', effects: ['LETAL', 'LIMITADA'], rol: 'ataque', energyCost: 0, energyRegen: 0, maxUsesPerCombat: 1 },
      { name: 'Ataque base', description: 'x', attribute: 'fuerza', effects: [], rol: 'ataque', energyCost: 0, energyRegen: 0 },
    ];
    const result = chooseNpcAbility(roster, 'ataque', 999, () => 0, { 'Golpe Certero': 1 });
    expect(result.name).toBe('Ataque base');
  });

  it('con el contador todavía por debajo del tope, sigue siendo elegible', () => {
    const roster: NpcCombatAbility[] = [
      { name: 'Golpe Certero', description: 'x', attribute: 'fuerza', effects: ['LETAL', 'LIMITADA'], rol: 'ataque', energyCost: 0, energyRegen: 0, maxUsesPerCombat: 2 },
    ];
    const result = chooseNpcAbility(roster, 'ataque', 999, () => 0, { 'Golpe Certero': 1 });
    expect(result.name).toBe('Golpe Certero');
  });

  it('sin maxUsesPerCombat (null/undefined), nunca se descarta por muchos usos que acumule usageCounts', () => {
    const roster: NpcCombatAbility[] = [
      { name: 'Ataque base', description: 'x', attribute: 'fuerza', effects: [], rol: 'ataque', energyCost: 0, energyRegen: 0 },
    ];
    const result = chooseNpcAbility(roster, 'ataque', 999, () => 0, { 'Ataque base': 50 });
    expect(result.name).toBe('Ataque base');
  });
});
