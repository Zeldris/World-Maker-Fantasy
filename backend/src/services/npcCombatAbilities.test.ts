import { describe, it, expect } from 'vitest';
import { npcCombatAbilitiesFor, chooseNpcAbility, type NpcForCombatAbilities, type NpcCombatAbility } from './npcCombatAbilities.js';

const ATTRS = { fuerza: 13, destreza: 10, constitucion: 5, inteligencia: 5, voluntad: 8, carisma: 2, arcano: 2 };

describe('npcCombatAbilitiesFor', () => {
  it('siempre incluye Ataque base, aunque el NPC no tenga clase/raza/racial (p.ej. NPC social)', () => {
    const npc: NpcForCombatAbilities = { level: 1, attributes: ATTRS, raza: null, clase: null, ataqueNatural: null, habilidadesRaciales: [] };
    const abilities = npcCombatAbilitiesFor(npc, []);
    expect(abilities).toHaveLength(1);
    expect(abilities[0].name).toBe('Ataque base');
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
    expect(abilities.map((a) => a.name)).toEqual(['Ataque base', 'Lana Espesa']);
  });
});

describe('chooseNpcAbility', () => {
  const abilities: NpcCombatAbility[] = npcCombatAbilitiesFor(
    { level: 3, attributes: ATTRS, raza: null, clase: 'Guerrero', ataqueNatural: null, habilidadesRaciales: [] },
    [],
  );

  it('atacando, elige uniformemente entre todo el roster (nunca sesga hacia AGUANTE)', () => {
    // random()=0 siempre → primer elemento del roster completo, no filtrado.
    expect(chooseNpcAbility(abilities, 'ataque', () => 0)).toEqual(abilities[0]);
  });

  it('defendiendo con random alto (>0.7), cae al roster completo aunque haya una AGUANTE disponible', () => {
    const result = chooseNpcAbility(abilities, 'defensa', () => 0.9);
    expect(result).toEqual(abilities[Math.floor(0.9 * abilities.length)]);
  });

  it('defendiendo con random bajo (<0.7) y una AGUANTE disponible, la prefiere', () => {
    const result = chooseNpcAbility(abilities, 'defensa', () => 0.1);
    expect(result.effect).toBe('AGUANTE');
  });

  it('sin ninguna AGUANTE en el roster, defender cae también al roster completo', () => {
    const soloAtaque = npcCombatAbilitiesFor({ level: 1, attributes: ATTRS, raza: null, clase: null, ataqueNatural: null, habilidadesRaciales: [] }, []);
    expect(chooseNpcAbility(soloAtaque, 'defensa', () => 0.1)).toEqual(soloAtaque[0]);
  });
});
