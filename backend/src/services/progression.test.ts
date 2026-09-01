import { describe, it, expect } from 'vitest';
import { levelForXp, maxCombatAbilitiesFor, xpForRollSuccess, xpForHitos, applyXp, attributeCapForLevel, npcAttributesForLevel, MAX_LEVEL } from './progression.js';

describe('levelForXp', () => {
  it('nivel 1 con 0 XP', () => {
    expect(levelForXp(0)).toBe(1);
  });
  it('sube de nivel exactamente en el umbral', () => {
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
  });
  it('respeta la tabla D&D original sin tocar en el tramo 1-20 (umbral nivel 19 = 305000)', () => {
    expect(levelForXp(304_999)).toBe(18);
    expect(levelForXp(305_000)).toBe(19);
  });
  it(`tope en nivel máximo (${MAX_LEVEL}) aunque sobre XP`, () => {
    expect(levelForXp(100_000_000)).toBe(MAX_LEVEL);
  });
  it('la curva extendida más allá del nivel 20 sigue siendo estrictamente creciente', () => {
    expect(levelForXp(3_204_999)).toBe(38);
    expect(levelForXp(3_205_000)).toBe(39);
    expect(levelForXp(3_455_000)).toBe(40);
  });
});

describe('attributeCapForLevel', () => {
  it('18 por debajo del primer ASI extendido (nivel 24) — igual que antes del rediseño', () => {
    expect(attributeCapForLevel(1)).toBe(18);
    expect(attributeCapForLevel(19)).toBe(18);
    expect(attributeCapForLevel(23)).toBe(18);
  });
  it('sube en 1 por cada ASI extendido cruzado (24/28/32/36/40)', () => {
    expect(attributeCapForLevel(24)).toBe(19);
    expect(attributeCapForLevel(27)).toBe(19);
    expect(attributeCapForLevel(28)).toBe(20);
    expect(attributeCapForLevel(40)).toBe(23);
  });
});

describe('npcAttributesForLevel', () => {
  const base = { fuerza: 6, destreza: 10, constitucion: 7, inteligencia: 8, voluntad: 6, carisma: 6, magia: 0 };

  it('nivel 1 devuelve el bloque base sin cambios (sin puntos ASI que repartir)', () => {
    expect(npcAttributesForLevel(base, 1, null)).toEqual(base);
  });

  it('sin clase (fauna), reparte proporcional al perfil ya existente — el atributo que más destaca sigue creciendo más', () => {
    const scaled = npcAttributesForLevel(base, 4, null); // nivel 4 = primer ASI, 2 puntos
    expect(scaled.destreza).toBeGreaterThan(base.destreza); // ya era el atributo más alto
    const totalGained = Object.keys(base).reduce((sum, k) => sum + (scaled[k as keyof typeof base] - base[k as keyof typeof base]), 0);
    expect(totalGained).toBe(2);
  });

  it('con clase Guerrero, prioriza fuerza/constitución sobre el resto', () => {
    const scaled = npcAttributesForLevel(base, 8, 'GUERRERO'); // nivel 8 = 2 ASI, 4 puntos
    expect(scaled.fuerza).toBeGreaterThan(base.fuerza);
    expect(scaled.constitucion).toBeGreaterThan(base.constitucion);
  });

  it('nunca supera el tope de atributo real para ese nivel', () => {
    const highBase = { fuerza: 17, destreza: 5, constitucion: 5, inteligencia: 5, voluntad: 5, carisma: 5, magia: 5 };
    const scaled = npcAttributesForLevel(highBase, 19, 'GUERRERO'); // 5 ASI = 10 puntos, todos priorizarían fuerza
    expect(scaled.fuerza).toBeLessThanOrEqual(attributeCapForLevel(19));
  });
});

describe('maxCombatAbilitiesFor', () => {
  // Bajado de 10/8 a 8/6 (2026-09-01): las 2 raciales activas viejas ("Sangre del Estallido"/
  // "Piel de Guerra") ya no se siembran — la raza solo aporta la pasiva automática de
  // racialPassives.ts, que no ocupa hueco de combate.
  it('6 huecos por debajo del nivel de arma avanzada (2 de arma + 4 de clase)', () => {
    expect(maxCombatAbilitiesFor(1)).toBe(6);
    expect(maxCombatAbilitiesFor(19)).toBe(6);
  });
  it('8 huecos al cruzar el nivel de arma avanzada (4 de arma + 4 de clase)', () => {
    expect(maxCombatAbilitiesFor(20)).toBe(8);
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
