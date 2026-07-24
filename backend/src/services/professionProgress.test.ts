import { describe, it, expect } from 'vitest';
import { professionLevelForXp, xpForCraftSuccess, alivioForLevel, applyProfessionXp, MAX_PROFESSION_LEVEL } from './professionProgress.js';

describe('professionLevelForXp', () => {
  it('nivel 1 con 0 XP', () => {
    expect(professionLevelForXp(0)).toBe(1);
  });
  it('sube de nivel exactamente en el umbral', () => {
    expect(professionLevelForXp(49)).toBe(1);
    expect(professionLevelForXp(50)).toBe(2);
  });
  it('tope en el nivel máximo aunque sobre XP', () => {
    expect(professionLevelForXp(1_000_000)).toBe(MAX_PROFESSION_LEVEL);
  });
});

describe('xpForCraftSuccess', () => {
  it('escala con el tier de la receta', () => {
    expect(xpForCraftSuccess(1)).toBe(10);
    expect(xpForCraftSuccess(2)).toBe(25);
    expect(xpForCraftSuccess(3)).toBe(50);
    expect(xpForCraftSuccess(4)).toBe(100);
    expect(xpForCraftSuccess(5)).toBe(200);
  });
  it('sin tier definido, trata la receta como tier 1', () => {
    expect(xpForCraftSuccess(undefined)).toBe(10);
  });
});

describe('alivioForLevel', () => {
  it('nivel 1 no da ningún alivio', () => {
    expect(alivioForLevel(1)).toBe(0);
  });
  it('cada nivel siguiente resta 1 al requisito exigido', () => {
    expect(alivioForLevel(3)).toBe(2);
    expect(alivioForLevel(MAX_PROFESSION_LEVEL)).toBe(MAX_PROFESSION_LEVEL - 1);
  });
});

describe('applyProfessionXp', () => {
  it('acumula XP y detecta subida de nivel', () => {
    const result = applyProfessionXp(0, 1, 60);
    expect(result).toEqual({ xpDelta: 60, newXp: 60, newLevel: 2, leveledUp: true });
  });
  it('no sube de nivel si la XP no llega al umbral', () => {
    const result = applyProfessionXp(0, 1, 10);
    expect(result.newLevel).toBe(1);
    expect(result.leveledUp).toBe(false);
  });
});
