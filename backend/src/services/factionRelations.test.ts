import { describe, it, expect } from 'vitest';
import {
  typeForPresion,
  stageForPresion,
  applyFactionEvent,
  decayPresion,
  stageFactFor,
  nivelDiplomaticoRequerido,
  PRESION_NEUTRAL,
  PRESION_MIN,
  PRESION_MAX,
} from './factionRelations.js';

describe('typeForPresion', () => {
  it('presión neutral (50) da NEUTRAL', () => {
    expect(typeForPresion(PRESION_NEUTRAL)).toBe('NEUTRAL');
  });

  it('bandas bajas dan ALIANZA/TRATADO_COMERCIAL', () => {
    expect(typeForPresion(0)).toBe('ALIANZA');
    expect(typeForPresion(19)).toBe('ALIANZA');
    expect(typeForPresion(20)).toBe('TRATADO_COMERCIAL');
    expect(typeForPresion(39)).toBe('TRATADO_COMERCIAL');
  });

  it('bandas altas dan TENSION/GUERRA', () => {
    expect(typeForPresion(60)).toBe('TENSION');
    expect(typeForPresion(79)).toBe('TENSION');
    expect(typeForPresion(80)).toBe('GUERRA');
    expect(typeForPresion(PRESION_MAX)).toBe('GUERRA');
  });
});

describe('stageForPresion', () => {
  it('fuera de TENSION/GUERRA (presion <= 59) siempre da stage 0', () => {
    expect(stageForPresion(0)).toBe(0);
    expect(stageForPresion(50)).toBe(0);
    expect(stageForPresion(59)).toBe(0);
  });

  it('dentro de TENSION/GUERRA escala 0-4 cada 10 puntos desde 60', () => {
    expect(stageForPresion(60)).toBe(0);
    expect(stageForPresion(69)).toBe(0);
    expect(stageForPresion(70)).toBe(1);
    expect(stageForPresion(100)).toBe(4);
  });
});

describe('applyFactionEvent', () => {
  it('EXPANSION_TERRITORIAL_AGRESIVA sube presión (+15)', () => {
    expect(applyFactionEvent(50, 'EXPANSION_TERRITORIAL_AGRESIVA')).toBe(65);
  });

  it('BAJA_DE_GUERRA sube presión (+8)', () => {
    expect(applyFactionEvent(50, 'BAJA_DE_GUERRA')).toBe(58);
  });

  it('TRATADO_CUMPLIDO baja presión (-10)', () => {
    expect(applyFactionEvent(50, 'TRATADO_CUMPLIDO')).toBe(40);
  });

  it('nunca se sale de [PRESION_MIN, PRESION_MAX]', () => {
    expect(applyFactionEvent(PRESION_MAX, 'EXPANSION_TERRITORIAL_AGRESIVA')).toBe(PRESION_MAX);
    expect(applyFactionEvent(PRESION_MIN, 'TRATADO_CUMPLIDO')).toBe(PRESION_MIN);
  });
});

describe('decayPresion', () => {
  it('sin semanas cruzadas, no cambia nada', () => {
    expect(decayPresion(70, 0)).toBe(70);
  });

  it('ya neutral, no cambia nada aunque crucen semanas', () => {
    expect(decayPresion(PRESION_NEUTRAL, 5)).toBe(PRESION_NEUTRAL);
  });

  it('por encima del neutro, decae 1 punto por semana hacia abajo', () => {
    expect(decayPresion(55, 1)).toBe(54);
    expect(decayPresion(55, 3)).toBe(52);
  });

  it('por debajo del neutro, decae 1 punto por semana hacia arriba', () => {
    expect(decayPresion(45, 1)).toBe(46);
  });

  it('nunca cruza el neutro de golpe (se detiene en 50, no oscila)', () => {
    expect(decayPresion(52, 10)).toBe(PRESION_NEUTRAL);
    expect(decayPresion(48, 10)).toBe(PRESION_NEUTRAL);
  });
});

describe('stageFactFor', () => {
  it('GUERRA/TENSION/ALIANZA/TRATADO_COMERCIAL narran un hecho con ambos nombres', () => {
    expect(stageFactFor('Clan Serhu', 'Clan Helsig', 'GUERRA')).toContain('Clan Serhu');
    expect(stageFactFor('Clan Serhu', 'Clan Helsig', 'GUERRA')).toContain('Clan Helsig');
    expect(stageFactFor('Clan Serhu', 'Clan Helsig', 'TENSION')).toMatch(/tensión/i);
    expect(stageFactFor('Clan Serhu', 'Clan Helsig', 'ALIANZA')).toMatch(/alianza/i);
    expect(stageFactFor('Clan Serhu', 'Clan Helsig', 'TRATADO_COMERCIAL')).toMatch(/tratado/i);
  });

  it('NEUTRAL no narra nada (vuelta al estado silencioso de siempre)', () => {
    expect(stageFactFor('Clan Serhu', 'Clan Helsig', 'NEUTRAL')).toBeNull();
  });
});

// Diplomacia del jugador (docs/rpgtarkor/mundo-vivo-x4.md § 4.4/§ 5-bis punto 6, 2026-09-21).
describe('nivelDiplomaticoRequerido', () => {
  it('en el neutro exacto (50), nivel 1 basta', () => {
    expect(nivelDiplomaticoRequerido(PRESION_NEUTRAL)).toBe(1);
  });

  it('cerca del neutro (distancia < 10), sigue exigiendo solo nivel 1', () => {
    expect(nivelDiplomaticoRequerido(55)).toBe(1);
    expect(nivelDiplomaticoRequerido(45)).toBe(1);
  });

  it('cuanto más lejos del neutro, más nivel exige (simétrico en ambas direcciones)', () => {
    expect(nivelDiplomaticoRequerido(70)).toBe(3); // distancia 20 → 1 + floor(20/10) = 3
    expect(nivelDiplomaticoRequerido(30)).toBe(3); // misma distancia hacia el otro lado
  });

  it('en los extremos (0 o 100), tope en nivel 9 (misma escala que MAX_PROFESSION_LEVEL)', () => {
    expect(nivelDiplomaticoRequerido(PRESION_MIN)).toBe(6); // distancia 50 → 1 + floor(50/10) = 6
    expect(nivelDiplomaticoRequerido(PRESION_MAX)).toBe(6);
  });
});
