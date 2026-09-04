import { describe, it, expect } from 'vitest';
import {
  SKILL_BAR_SLOTS,
  SKILL_BARS_PER_CATEGORY_MAX,
  sanitizeSkillBarAbilityNames,
  missingBaseSkillBarCategories,
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
    const available = Array.from({ length: 15 }, (_, i) => ability(`Habilidad ${i}`));
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
});

describe('missingBaseSkillBarCategories', () => {
  it('sin ninguna barra existente, faltan las 3 categorías', () => {
    expect(missingBaseSkillBarCategories([])).toEqual(['general', 'profesion', 'reino']);
  });

  it('con la base de general ya creada, solo faltan profesion y reino', () => {
    const existing = [{ category: 'general', slotIndex: 0 }];
    expect(missingBaseSkillBarCategories(existing)).toEqual(['profesion', 'reino']);
  });

  it('una barra adicional (slotIndex distinto de 0) no cuenta como base', () => {
    const existing = [{ category: 'general', slotIndex: 1 }];
    expect(missingBaseSkillBarCategories(existing)).toEqual(['general', 'profesion', 'reino']);
  });

  it('con las 3 bases ya creadas, no falta ninguna', () => {
    const existing = [
      { category: 'general', slotIndex: 0 },
      { category: 'profesion', slotIndex: 0 },
      { category: 'reino', slotIndex: 0 },
    ];
    expect(missingBaseSkillBarCategories(existing)).toEqual([]);
  });
});

describe('nextFreeSkillBarSlot', () => {
  it('sin barras existentes, el primero libre es el 0', () => {
    expect(nextFreeSkillBarSlot([])).toBe(0);
  });

  it('con el 0 ocupado, el siguiente libre es el 1', () => {
    expect(nextFreeSkillBarSlot([0])).toBe(1);
  });

  it(`con las ${SKILL_BARS_PER_CATEGORY_MAX} barras ocupadas, no queda ninguna libre`, () => {
    expect(nextFreeSkillBarSlot([0, 1, 2])).toBeNull();
  });

  it('no depende del orden de la lista de ocupados', () => {
    expect(nextFreeSkillBarSlot([2, 0])).toBe(1);
  });
});
