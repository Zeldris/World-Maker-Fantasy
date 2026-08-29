import { describe, it, expect } from 'vitest';
import { classAbilityUnlocksFor, allClassAbilityUnlocks, classAbilityUnlocksForClase } from './classAbilities.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend"). Reescrita
// 2026-08-24 (Grupo 3 § Sistema de clases, docs/rpgtarkor/clases.md): el roster pasa de listas
// planas por clase (4 Guerrero + 3 Cazador, todo tronco) a tronco común + especializaciones reales
// para GUERRERO/CAZADOR/CHAMAN — 33 huecos en total, los únicos "✅ lista" del doc verificados
// efecto a efecto contra el motor real. "Compañero cazador" (antes nivel 8 de Cazador) se reasignó
// a Domador en el doc — 2026-08-26: vuelve a sembrarse ahí (nivel 12, COMPANERO ya implementado,
// pasiva sin depender de combate multi-objetivo).

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

  // Cierre del hueco "Save.clase sin ningún flujo de asignación" (2026-08-29): `clase` explícito
  // (tercer parámetro, `Save.clase` real vía `PATCH /saves/:id/clase`) tiene prioridad sobre el
  // fallback por `characterName` — un personaje CUALQUIERA con clase fijada ya aprende su tronco,
  // sin depender de ser 'Gorhorn'.
  it('con clase explícita, cualquier characterName aprende el tronco de esa clase (no solo Gorhorn)', () => {
    expect(classAbilityUnlocksFor('Sael Vhorn', 1, 'GUERRERO').length).toBeGreaterThan(0);
    expect(classAbilityUnlocksFor('Sael Vhorn', 1, null)).toEqual([]);
  });

  it('clase explícita distinta de CAZADOR anula el fallback de Gorhorn', () => {
    const conGuerrero = classAbilityUnlocksFor('Gorhorn', 1, 'GUERRERO');
    const sinClaseExplicita = classAbilityUnlocksFor('Gorhorn', 1);
    expect(conGuerrero).not.toEqual(sinClaseExplicita);
    expect(conGuerrero.length).toBeGreaterThan(0);
  });
});

describe('allClassAbilityUnlocks', () => {
  it('devuelve el roster completo (147 huecos: 8 clases con tabla real, MAGO sin tocar)', () => {
    const all = allClassAbilityUnlocks();
    expect(all).toHaveLength(147);
    expect(all.filter((u) => u.clase === 'GUERRERO')).toHaveLength(13);
    expect(all.filter((u) => u.clase === 'CAZADOR')).toHaveLength(19);
    expect(all.filter((u) => u.clase === 'CHAMAN')).toHaveLength(12);
    expect(all.filter((u) => u.clase === 'ARQUERO')).toHaveLength(6);
    expect(all.filter((u) => u.clase === 'CABALLERO')).toHaveLength(20);
    expect(all.filter((u) => u.clase === 'SEGADOR')).toHaveLength(19);
    expect(all.filter((u) => u.clase === 'ASESINO')).toHaveLength(28);
    expect(all.filter((u) => u.clase === 'DRUIDA')).toHaveLength(30);
    expect(all.filter((u) => u.clase === 'MAGO')).toHaveLength(0);
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
    // Domador: 4 tronco + 1 propio (12, Compañero cazador, COMPANERO ya implementado) = 5
    expect(classAbilityUnlocksForClase('CAZADOR', 'DOMADOR')).toHaveLength(5);
    // Totémico: 3 tronco + 0 propios (bloqueada por completo, sin INVOCACION) = 3
    expect(classAbilityUnlocksForClase('CHAMAN', 'TOTEMICO')).toHaveLength(3);
  });

  it('una especialización de otra clase no se cuela en el roster', () => {
    const berserker = classAbilityUnlocksForClase('GUERRERO', 'BERSERKER');
    expect(berserker.every((u) => u.clase === 'GUERRERO')).toBe(true);
    expect(berserker.some((u) => u.especializacion === 'TIRADOR')).toBe(false);
  });
});
