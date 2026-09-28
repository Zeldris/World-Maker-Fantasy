import { describe, it, expect } from 'vitest';
import {
  SKILL_BAR_SLOTS,
  SKILL_BARS_MAX,
  sanitizeSkillBarAbilityNames,
  defaultBaseSkillBarAbilities,
  hasBaseSkillBar,
  nextFreeSkillBarSlot,
  type SkillBarAbilityLike,
} from './skillBars.js';

function ability(name: string): SkillBarAbilityLike {
  return { name };
}

describe('sanitizeSkillBarAbilityNames', () => {
  it('descarta nombres que ya no existen entre las disponibles', () => {
    const available = [ability('Curar'), ability('Comer/Beber')];
    const result = sanitizeSkillBarAbilityNames(['Curar', 'Habilidad Perdida'], available);
    expect(result).toEqual(['Curar']);
  });

  it(`trunca al tope (${SKILL_BAR_SLOTS}) respetando el orden propuesto`, () => {
    const available = Array.from({ length: 25 }, (_, i) => ability(`Habilidad ${i}`));
    const proposed = available.map((a) => a.name);
    const result = sanitizeSkillBarAbilityNames(proposed, available);
    expect(result).toHaveLength(SKILL_BAR_SLOTS);
    expect(result).toEqual(proposed.slice(0, SKILL_BAR_SLOTS));
  });

  it('deduplica sin cambiar el orden de la primera aparición', () => {
    const available = [ability('Curar'), ability('Viajar')];
    const result = sanitizeSkillBarAbilityNames(['Viajar', 'Curar', 'Viajar'], available);
    expect(result).toEqual(['Viajar', 'Curar']);
  });

  it('rediseño (2026-09-06): admite mezclar habilidades de varias categorías en la misma barra', () => {
    // "disponibles" ya representa las 3 categorías juntas (General/Profesión/Reino) — la función
    // en sí es agnóstica de categoría, el filtro por categoría vive en el caller.
    const available = [ability('Curar'), ability('Minar'), ability('Levantar Campamento')];
    const result = sanitizeSkillBarAbilityNames(['Curar', 'Minar', 'Levantar Campamento'], available);
    expect(result).toEqual(['Curar', 'Minar', 'Levantar Campamento']);
  });
});

describe('hasBaseSkillBar', () => {
  it('sin ninguna barra existente, no hay base', () => {
    expect(hasBaseSkillBar([])).toBe(false);
  });

  it('con una barra slotIndex 0, sí hay base', () => {
    expect(hasBaseSkillBar([{ slotIndex: 0 }])).toBe(true);
  });

  it('solo con barras adicionales (slotIndex distinto de 0), no hay base', () => {
    expect(hasBaseSkillBar([{ slotIndex: 1 }, { slotIndex: 2 }])).toBe(false);
  });

  it('con varias barras incluyendo la base, sí hay base', () => {
    expect(hasBaseSkillBar([{ slotIndex: 1 }, { slotIndex: 0 }])).toBe(true);
  });
});

describe('nextFreeSkillBarSlot', () => {
  it('sin barras existentes, el primero libre es el 0', () => {
    expect(nextFreeSkillBarSlot([])).toBe(0);
  });

  it('con el 0 ocupado, el siguiente libre es el 1', () => {
    expect(nextFreeSkillBarSlot([0])).toBe(1);
  });

  it(`con las ${SKILL_BARS_MAX} barras ocupadas, no queda ninguna libre`, () => {
    expect(nextFreeSkillBarSlot([0, 1, 2])).toBeNull();
  });

  it('no depende del orden de la lista de ocupados', () => {
    expect(nextFreeSkillBarSlot([2, 0])).toBe(1);
  });
});

describe('defaultBaseSkillBarAbilities (B20)', () => {
  it('rellena la barra base con las generales que la partida tiene, en orden fijo', () => {
    expect(defaultBaseSkillBarAbilities(['Curar', 'Saquear', 'Descansar', 'Cazar'])).toEqual(['Descansar', 'Curar']);
  });
  it('nunca incluye habilidades retiradas en la Fase 4 ni inventa las que no existen', () => {
    expect(defaultBaseSkillBarAbilities(['Cazar', 'Minar'])).toEqual([]);
  });
});
