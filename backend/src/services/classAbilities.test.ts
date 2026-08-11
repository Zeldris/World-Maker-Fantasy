import { describe, it, expect } from 'vitest';
import { classAbilityUnlocksFor, allClassAbilityUnlocks, classAbilityUnlocksForClase } from './classAbilities.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend").

describe('classAbilityUnlocksFor', () => {
  it('Gorhorn aprende las 4 habilidades de golpe a nivel 1 (variante especial: ambas clases)', () => {
    const result = classAbilityUnlocksFor('Gorhorn', 1);
    expect(result).toHaveLength(4);
    expect(result.map((a) => a.name).sort()).toEqual(['Analizar rival', 'Contraataque', 'Grito de Guerra', 'Instinto Salvaje'].sort());
  });

  // Rediseño de combate (2026-08-09): las 4 pasan a rol:'utilidad' — nunca hacen daño
  // incondicional por su cuenta, solo reaccionan si el rival ataca con una de rol:'ataque'.
  it('las 4 son rol:\'utilidad\'', () => {
    const result = classAbilityUnlocksFor('Gorhorn', 1);
    expect(result.every((a) => a.rol === 'utilidad')).toBe(true);
  });

  it('otro personaje sin clase asignada no aprende ninguna (fuera de alcance v1)', () => {
    expect(classAbilityUnlocksFor('Sael Vhorn', 1)).toEqual([]);
  });

  it('a otros niveles no hay nada más que desbloquear (todo se concede de golpe a nivel 1)', () => {
    expect(classAbilityUnlocksFor('Gorhorn', 2)).toEqual([]);
  });
});

describe('allClassAbilityUnlocks', () => {
  it('devuelve el roster completo (las 4), para la Enciclopedia', () => {
    expect(allClassAbilityUnlocks()).toHaveLength(4);
  });
});

describe('classAbilityUnlocksForClase', () => {
  it('Guerrero tiene 2 habilidades propias', () => {
    const result = classAbilityUnlocksForClase('Guerrero');
    expect(result).toHaveLength(2);
    expect(result.every((u) => u.clase === 'Guerrero')).toBe(true);
  });

  it('Cazador tiene 2 habilidades propias, distintas de las de Guerrero', () => {
    const result = classAbilityUnlocksForClase('Cazador');
    expect(result).toHaveLength(2);
    expect(result.every((u) => u.clase === 'Cazador')).toBe(true);
  });
});
