import { describe, it, expect } from 'vitest';
import { classAbilityUnlocksFor, allClassAbilityUnlocks, classAbilityUnlocksForClase } from './classAbilities.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend"). Reescrita
// 2026-08-24 (Grupo 3 § Sistema de clases, docs/rpgtarkor/clases.md): el roster pasa de listas
// planas por clase (4 Guerrero + 3 Cazador, todo tronco) a tronco común + especializaciones reales
// para GUERRERO/CAZADOR/CHAMAN — 33 huecos en total, los únicos "✅ lista" del doc verificados
// efecto a efecto contra el motor real. "Compañero cazador" (antes nivel 8 de Cazador) desaparece
// del todo: se reasignó a Domador en el doc, pero Domador se queda en 0 huecos reales (bloqueada
// por COMPANERO, sin implementar), así que hoy no vive en ningún sitio del roster.

describe('classAbilityUnlocksFor', () => {
  it('Gorhorn (Cazador, sin especialización) aprende el tronco común por nivel', () => {
    expect(classAbilityUnlocksFor('Gorhorn', 1).map((a) => a.name)).toEqual(['Analisis Salvaje']);
    expect(classAbilityUnlocksFor('Gorhorn', 4).map((a) => a.name)).toEqual(['Barrido Salvaje']);
    expect(classAbilityUnlocksFor('Gorhorn', 6).map((a) => a.name)).toEqual(['Instinto de Supervivencia']);
    expect(classAbilityUnlocksFor('Gorhorn', 8).map((a) => a.name)).toEqual(['Golpe Certero']);
  });

  it('sin especialización elegida, no aprende ningún hueco de especialización (12+)', () => {
    // Gorhorn no tiene especialización asignada in-game todavía (sin flujo de elección) —
    // `classAbilityUnlocksFor` filtra tronco puro, nunca huecos de Tirador/Instintivo/etc.
    expect(classAbilityUnlocksFor('Gorhorn', 12)).toEqual([]);
    expect(classAbilityUnlocksFor('Gorhorn', 16)).toEqual([]);
  });

  it('otro personaje sin clase asignada no aprende ninguna (fuera de alcance v1)', () => {
    expect(classAbilityUnlocksFor('Sael Vhorn', 1)).toEqual([]);
  });

  it('a niveles sin ningún desbloqueo de tronco (2, 3, 5, 7...) no hay nada nuevo', () => {
    expect(classAbilityUnlocksFor('Gorhorn', 2)).toEqual([]);
  });
});

describe('allClassAbilityUnlocks', () => {
  it('devuelve el roster completo (33 huecos: 11 Guerrero + 14 Cazador + 8 Chamán)', () => {
    const all = allClassAbilityUnlocks();
    expect(all).toHaveLength(33);
    expect(all.filter((u) => u.clase === 'GUERRERO')).toHaveLength(11);
    expect(all.filter((u) => u.clase === 'CAZADOR')).toHaveLength(14);
    expect(all.filter((u) => u.clase === 'CHAMAN')).toHaveLength(8);
  });
});

describe('classAbilityUnlocksForClase', () => {
  it('sin especialización, solo devuelve el tronco común de la clase', () => {
    expect(classAbilityUnlocksForClase('GUERRERO')).toHaveLength(3);
    expect(classAbilityUnlocksForClase('CAZADOR')).toHaveLength(4);
    expect(classAbilityUnlocksForClase('CHAMAN')).toHaveLength(3);
  });

  it('con especialización, devuelve tronco + los huecos reales de esa rama', () => {
    // Berserker: 3 tronco + 1 propio (19, único listo de 8) = 4
    expect(classAbilityUnlocksForClase('GUERRERO', 'BERSERKER')).toHaveLength(4);
    // Tirador: 4 tronco + 5 propios (12/16/19/28/32) = 9
    expect(classAbilityUnlocksForClase('CAZADOR', 'TIRADOR')).toHaveLength(9);
    // Domador: 4 tronco + 0 propios (bloqueada por completo, sin COMPANERO/INVOCACION) = 4
    expect(classAbilityUnlocksForClase('CAZADOR', 'DOMADOR')).toHaveLength(4);
    // Totémico: 3 tronco + 0 propios (bloqueada por completo, sin INVOCACION) = 3
    expect(classAbilityUnlocksForClase('CHAMAN', 'TOTEMICO')).toHaveLength(3);
  });

  it('una especialización de otra clase no se cuela en el roster', () => {
    const berserker = classAbilityUnlocksForClase('GUERRERO', 'BERSERKER');
    expect(berserker.every((u) => u.clase === 'GUERRERO')).toBe(true);
    expect(berserker.some((u) => u.especializacion === 'TIRADOR')).toBe(false);
  });
});
