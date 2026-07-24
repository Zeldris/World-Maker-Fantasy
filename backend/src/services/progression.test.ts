import { describe, it, expect } from 'vitest';
import { levelForXp, habilidadSlotsForLevel, xpForRollSuccess, xpForHitos, applyXp } from './progression.js';

describe('levelForXp', () => {
  it('nivel 1 con 0 XP', () => {
    expect(levelForXp(0)).toBe(1);
  });
  it('sube de nivel exactamente en el umbral', () => {
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
  });
  it('tope en nivel 20 aunque sobre XP', () => {
    expect(levelForXp(10_000_000)).toBe(20);
  });
});

describe('habilidadSlotsForLevel', () => {
  it('3 huecos en nivel 1', () => {
    expect(habilidadSlotsForLevel(1)).toBe(3);
  });
  it('crece con floor(nivel/2)', () => {
    expect(habilidadSlotsForLevel(4)).toBe(5);
    expect(habilidadSlotsForLevel(5)).toBe(5);
  });
});

describe('xpForRollSuccess', () => {
  it('0 XP en fallo, sea cual sea la dificultad', () => {
    expect(xpForRollSuccess(22, false)).toBe(0);
  });
  it('XP correcta por dificultad en éxito', () => {
    expect(xpForRollSuccess(8, true)).toBe(0);
    expect(xpForRollSuccess(12, true)).toBe(5);
    expect(xpForRollSuccess(15, true)).toBe(25);
    expect(xpForRollSuccess(18, true)).toBe(50);
    expect(xpForRollSuccess(22, true)).toBe(100);
  });
});

describe('xpForHitos', () => {
  it('0 si no hay hitos', () => {
    expect(xpForHitos([])).toBe(0);
  });
  it('se queda con el de mayor valor, tope 1/turno', () => {
    expect(xpForHitos(['descubrimiento', 'objetivo_mayor'])).toBe(300);
  });
});

describe('applyXp', () => {
  it('no sube de nivel si no llega al umbral', () => {
    const result = applyXp(0, 1, 100);
    expect(result).toEqual({ xpDelta: 100, newXp: 100, newLevel: 1, leveledUp: false, attributePointsGained: 0 });
  });
  it('sube de nivel y da puntos de atributo en nivel ASI (4)', () => {
    const result = applyXp(2600, 3, 100); // 2700 = umbral nivel 4
    expect(result.newLevel).toBe(4);
    expect(result.leveledUp).toBe(true);
    expect(result.attributePointsGained).toBe(2);
  });
  it('no da puntos de atributo en un nivel que no es ASI', () => {
    const result = applyXp(850, 2, 100); // 900 = umbral nivel 3, no es ASI
    expect(result.newLevel).toBe(3);
    expect(result.attributePointsGained).toBe(0);
  });
  it('suma ASI de varios niveles si el salto de XP cruza más de uno', () => {
    // De nivel 1 (0xp) a un XP que cruza niveles 4 y 8 de golpe
    const result = applyXp(0, 1, 48_000); // 48000 = umbral nivel 9, cruza ASI de 4 y 8
    expect(result.newLevel).toBe(9);
    expect(result.attributePointsGained).toBe(4); // +2 en nivel 4, +2 en nivel 8
  });
});
