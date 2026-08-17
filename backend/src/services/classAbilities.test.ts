import { describe, it, expect } from 'vitest';
import { classAbilityUnlocksFor, allClassAbilityUnlocks, classAbilityUnlocksForClase } from './classAbilities.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend"). Actualizada
// 2026-08-15: el roster pasó de 4 habilidades (todas a nivel 1) a 7, repartidas por nivel
// (Guerrero: 1/4/6/8, Cazador: 1/4/8) — ver classAbilities.ts.

describe('classAbilityUnlocksFor', () => {
  it('Gorhorn aprende 1 de cada clase a nivel 1 (variante especial: ambas clases)', () => {
    const result = classAbilityUnlocksFor('Gorhorn', 1);
    expect(result.map((a) => a.name).sort()).toEqual(['Analisis Salvaje', 'Grito de Guerra'].sort());
  });

  it('a nivel 4 desbloquea 1 más de cada clase', () => {
    const result = classAbilityUnlocksFor('Gorhorn', 4);
    expect(result.map((a) => a.name).sort()).toEqual(['Barrido Salvaje', 'Detectar Puntos Débiles'].sort());
  });

  it('a nivel 6 solo desbloquea la de Guerrero (Cazador no tiene nada a ese nivel)', () => {
    const result = classAbilityUnlocksFor('Gorhorn', 6);
    expect(result.map((a) => a.name)).toEqual(['Grito tenebroso']);
  });

  it('a nivel 8 desbloquea la última de cada clase, incluida la pasiva de Cazador', () => {
    const result = classAbilityUnlocksFor('Gorhorn', 8);
    expect(result.map((a) => a.name).sort()).toEqual(['Compañero cazador', 'Contraataque'].sort());
  });

  // Rediseño de combate (2026-08-09): la mayoría son rol:'utilidad' — nunca hacen daño
  // incondicional por su cuenta, solo reaccionan si el rival ataca con una de rol:'ataque'.
  // Excepciones confirmadas (2026-08-15): Barrido Salvaje es rol:'defensa', Compañero cazador
  // (pasiva, nivel 8 Cazador) es rol:'pasiva' — nunca entra al motor de turnos.
  it('todas las de nivel 1 son rol:\'utilidad\'', () => {
    const result = classAbilityUnlocksFor('Gorhorn', 1);
    expect(result.every((a) => a.rol === 'utilidad')).toBe(true);
  });

  it('Barrido Salvaje (nivel 4 Cazador) es rol:\'defensa\', no \'utilidad\'', () => {
    const barrido = classAbilityUnlocksFor('Gorhorn', 4).find((a) => a.name === 'Barrido Salvaje');
    expect(barrido?.rol).toBe('defensa');
  });

  it('Compañero cazador (nivel 8 Cazador) es rol:\'pasiva\'', () => {
    const companero = classAbilityUnlocksFor('Gorhorn', 8).find((a) => a.name === 'Compañero cazador');
    expect(companero?.rol).toBe('pasiva');
  });

  it('otro personaje sin clase asignada no aprende ninguna (fuera de alcance v1)', () => {
    expect(classAbilityUnlocksFor('Sael Vhorn', 1)).toEqual([]);
  });

  it('a niveles sin ningún desbloqueo (2, 3, 5, 7...) no hay nada nuevo', () => {
    expect(classAbilityUnlocksFor('Gorhorn', 2)).toEqual([]);
  });
});

describe('allClassAbilityUnlocks', () => {
  it('devuelve el roster completo (7: 4 de Guerrero + 3 de Cazador), para la Enciclopedia', () => {
    expect(allClassAbilityUnlocks()).toHaveLength(7);
  });
});

describe('classAbilityUnlocksForClase', () => {
  it('Guerrero tiene 4 habilidades propias', () => {
    const result = classAbilityUnlocksForClase('Guerrero');
    expect(result).toHaveLength(4);
    expect(result.every((u) => u.clase === 'Guerrero')).toBe(true);
  });

  it('Cazador tiene 3 habilidades propias, distintas de las de Guerrero', () => {
    const result = classAbilityUnlocksForClase('Cazador');
    expect(result).toHaveLength(3);
    expect(result.every((u) => u.clase === 'Cazador')).toBe(true);
  });
});
