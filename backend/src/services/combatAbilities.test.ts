import { describe, it, expect } from 'vitest';
import {
  ACTIVE_COMBAT_ABILITIES_MAX,
  sanitizeActiveCombatAbilityNames,
  defaultActiveCombatAbilityNames,
  resolveActiveCombatAbilityNames,
  type CombatAbilityLike,
} from './combatAbilities.js';

function ability(name: string, isGeneric = false): CombatAbilityLike {
  return { name, isGeneric };
}

describe('sanitizeActiveCombatAbilityNames', () => {
  it('descarta nombres que ya no existen entre las disponibles (arma cambiada/perdida)', () => {
    const available = [ability('Tajo Horizontal'), ability('Grito de Guerra')];
    const result = sanitizeActiveCombatAbilityNames(['Tajo Horizontal', 'Estocada Vieja'], available);
    expect(result).toEqual(['Tajo Horizontal']);
  });

  it('excluye las genéricas aunque se propongan a mano', () => {
    const available = [ability('Ataque Básico', true), ability('Tajo Horizontal')];
    const result = sanitizeActiveCombatAbilityNames(['Ataque Básico', 'Tajo Horizontal'], available);
    expect(result).toEqual(['Tajo Horizontal']);
  });

  it('trunca al tope (6) respetando el orden propuesto', () => {
    const available = Array.from({ length: 8 }, (_, i) => ability(`Habilidad ${i}`));
    const proposed = available.map((a) => a.name);
    const result = sanitizeActiveCombatAbilityNames(proposed, available);
    expect(result).toHaveLength(ACTIVE_COMBAT_ABILITIES_MAX);
    expect(result).toEqual(proposed.slice(0, ACTIVE_COMBAT_ABILITIES_MAX));
  });

  it('deduplica sin cambiar el orden de la primera aparición', () => {
    const available = [ability('Tajo Horizontal'), ability('Grito de Guerra')];
    const result = sanitizeActiveCombatAbilityNames(['Grito de Guerra', 'Tajo Horizontal', 'Grito de Guerra'], available);
    expect(result).toEqual(['Grito de Guerra', 'Tajo Horizontal']);
  });
});

describe('defaultActiveCombatAbilityNames', () => {
  it('con 6 o menos habilidades no genéricas, todas activas automáticamente', () => {
    const available = [ability('A'), ability('B'), ability('Ataque Básico', true)];
    expect(defaultActiveCombatAbilityNames(available)).toEqual(['A', 'B']);
  });

  it('con más de 6, ninguna activada automáticamente', () => {
    const available = Array.from({ length: 7 }, (_, i) => ability(`Habilidad ${i}`));
    expect(defaultActiveCombatAbilityNames(available)).toEqual([]);
  });
});

describe('resolveActiveCombatAbilityNames', () => {
  const available = [ability('A'), ability('B'), ability('C')];

  it('sin configurar nunca (everConfigured=false), cae al comportamiento por defecto', () => {
    expect(resolveActiveCombatAbilityNames([], available, false)).toEqual(['A', 'B', 'C']);
  });

  it('configurado una vez con un cinturón VACÍO a propósito, se respeta — nunca se reactiva solo', () => {
    expect(resolveActiveCombatAbilityNames([], available, true)).toEqual([]);
  });

  it('configurado con una selección parcial, se respeta tal cual', () => {
    expect(resolveActiveCombatAbilityNames(['B'], available, true)).toEqual(['B']);
  });
});
