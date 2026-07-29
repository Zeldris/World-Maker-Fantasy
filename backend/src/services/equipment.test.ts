import { describe, it, expect } from 'vitest';
import { effectiveAttributes, effectiveDefense, equippedWeaponNames } from './equipment.js';
import type { AttributeBlock } from './dice.js';

// Cobertura nueva (deuda técnica 2026-07-30, "control de deuda técnica"): equipment.ts tenía
// CERO tests pese a ser el cálculo base (effectiveAttributes/effectiveDefense) que alimenta cada
// intercambio de combate del juego (ver combatExchange.ts) — un bug silencioso aquí afectaría a
// toda partida sin que ningún test lo detectara.
const BASE: AttributeBlock = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 };

describe('effectiveAttributes', () => {
  it('sin objetos equipados, la base no cambia', () => {
    expect(effectiveAttributes(BASE, [])).toEqual(BASE);
  });

  it('suma el bonificador de un objeto equipado al atributo real', () => {
    const result = effectiveAttributes(BASE, [{ statBonusAttribute: 'fuerza', statBonusAmount: 3 }]);
    expect(result.fuerza).toBe(13);
    expect(result.destreza).toBe(10); // el resto de atributos no se toca
  });

  it('varios objetos apilan sobre el mismo atributo', () => {
    const result = effectiveAttributes(BASE, [
      { statBonusAttribute: 'destreza', statBonusAmount: 2 },
      { statBonusAttribute: 'destreza', statBonusAmount: 1 },
    ]);
    expect(result.destreza).toBe(13);
  });

  it('ignora objetos sin bonificador (statBonusAttribute/Amount null)', () => {
    expect(effectiveAttributes(BASE, [{ statBonusAttribute: null, statBonusAmount: null }])).toEqual(BASE);
  });

  it('ignora un statBonusAttribute que no es uno de los 7 atributos jugables (p.ej. "defensa")', () => {
    // "defensa" es el valor real que usan los objetos de armadura/escudo (ver effectiveDefense) —
    // effectiveAttributes debe convivir con esos mismos objetos sin tocarlos por error.
    expect(effectiveAttributes(BASE, [{ statBonusAttribute: 'defensa', statBonusAmount: 5 }])).toEqual(BASE);
  });

  it('no muta el objeto base recibido', () => {
    const base = { ...BASE };
    effectiveAttributes(base, [{ statBonusAttribute: 'fuerza', statBonusAmount: 3 }]);
    expect(base.fuerza).toBe(10);
  });
});

describe('effectiveDefense', () => {
  it('sin objetos equipados, la defensa es 0', () => {
    expect(effectiveDefense([])).toBe(0);
  });

  it('suma solo los objetos con statBonusAttribute "defensa"', () => {
    const result = effectiveDefense([
      { statBonusAttribute: 'defensa', statBonusAmount: 2 },
      { statBonusAttribute: 'fuerza', statBonusAmount: 99 }, // bonificador de atributo, no cuenta aquí
      { statBonusAttribute: 'defensa', statBonusAmount: 1 },
    ]);
    expect(result).toBe(3);
  });

  it('ignora objetos de defensa sin cantidad (statBonusAmount null)', () => {
    expect(effectiveDefense([{ statBonusAttribute: 'defensa', statBonusAmount: null }])).toBe(0);
  });
});

describe('equippedWeaponNames', () => {
  it('devuelve solo los nombres de ARMA_PRINCIPAL/ARMA_SECUNDARIA', () => {
    const result = equippedWeaponNames([
      { name: 'Hacha de guerra rota', slot: 'ARMA_PRINCIPAL' },
      { name: 'Cuchillo de hielo sílice', slot: 'ARMA_SECUNDARIA' },
      { name: 'Casco de cuero', slot: 'CASCO' },
      { name: 'Ración de viaje', slot: null },
    ]);
    expect(result).toEqual(['Hacha de guerra rota', 'Cuchillo de hielo sílice']);
  });

  it('sin ningún arma equipada, devuelve vacío', () => {
    expect(equippedWeaponNames([{ name: 'Casco de cuero', slot: 'CASCO' }])).toEqual([]);
  });
});
