import { describe, it, expect } from 'vitest';
import {
  limiteMuertes,
  resolveDeathOutcome,
  whisperText,
  nextCondicionFisica,
  nextCondicionForAttack,
  isValidRestLocationKind,
  healCeilingFor,
  condicionMalus,
} from './death.js';

describe('limiteMuertes', () => {
  it('NOVATO no tiene límite', () => {
    expect(limiteMuertes('NOVATO')).toBe(Infinity);
  });
  it('MEDIO = 4, AVANZADO = 2', () => {
    expect(limiteMuertes('MEDIO')).toBe(4);
    expect(limiteMuertes('AVANZADO')).toBe(2);
  });
});

describe('resolveDeathOutcome', () => {
  it('AVANZADO: 1ª muerte avisa y no acaba, 2ª es fin de partida', () => {
    expect(resolveDeathOutcome('AVANZADO', 0)).toEqual({ deathCount: 1, finDePartida: false, avisoUltimaVez: true });
    expect(resolveDeathOutcome('AVANZADO', 1)).toEqual({ deathCount: 2, finDePartida: true, avisoUltimaVez: false });
  });

  it('MEDIO: solo la 3ª (límite-1) avisa, la 4ª acaba la partida', () => {
    expect(resolveDeathOutcome('MEDIO', 0).avisoUltimaVez).toBe(false);
    expect(resolveDeathOutcome('MEDIO', 2)).toEqual({ deathCount: 3, finDePartida: false, avisoUltimaVez: true });
    expect(resolveDeathOutcome('MEDIO', 3)).toEqual({ deathCount: 4, finDePartida: true, avisoUltimaVez: false });
  });

  it('NOVATO nunca dispara fin de partida por muchas muertes que haya', () => {
    const result = resolveDeathOutcome('NOVATO', 50);
    expect(result.finDePartida).toBe(false);
    expect(result.deathCount).toBe(51);
  });
});

describe('whisperText', () => {
  it('incluye el nombre del personaje y el lugar de reaparición', () => {
    const text = whisperText('Gorhorn', 'La Hondonada del Eco', false);
    expect(text).toContain('Gorhorn');
    expect(text).toContain('La Hondonada del Eco');
    expect(text).not.toContain('no habrá una próxima vez');
  });
  it('añade el aviso de última oportunidad cuando corresponde', () => {
    const text = whisperText('Gorhorn', 'La Hondonada del Eco', true);
    expect(text).toContain('no habrá una próxima vez');
  });
});

describe('nextCondicionFisica', () => {
  it('fuera de combate nunca empeora, aunque el modelo lo proponga', () => {
    expect(nextCondicionFisica('ILESO', 'HERIDO', false, 'ILESO')).toBe('ILESO');
  });
  it('sin causa real (healCeiling = current), una mejora propuesta sin más NO se acepta (2026-07-29)', () => {
    expect(nextCondicionFisica('GRAVE', 'ILESO', false, 'GRAVE')).toBe('GRAVE');
  });
  it('con descanso válido (healCeiling = HERIDO), la mejora se topa en HERIDO aunque el modelo proponga ILESO', () => {
    expect(nextCondicionFisica('GRAVE', 'ILESO', false, 'HERIDO')).toBe('HERIDO');
  });
  it('con objeto médico (healCeiling = el curaHasta del objeto), la mejora puede llegar a ILESO', () => {
    expect(nextCondicionFisica('INCAPACITADO', 'ILESO', false, 'ILESO')).toBe('ILESO');
  });
  it('en combate empeora, pero tope de un escalón por turno', () => {
    expect(nextCondicionFisica('ILESO', 'HERIDO', true, 'ILESO')).toBe('HERIDO');
    expect(nextCondicionFisica('ILESO', 'MUERTO', true, 'ILESO')).toBe('HERIDO'); // nunca dos escalones de golpe
  });
  it('en combate, desde INCAPACITADO sí puede llegar a MUERTO (un solo escalón)', () => {
    expect(nextCondicionFisica('INCAPACITADO', 'MUERTO', true, 'INCAPACITADO')).toBe('MUERTO');
  });
  it('sin propuesta del modelo, se queda igual', () => {
    expect(nextCondicionFisica('HERIDO', null, true, 'HERIDO')).toBe('HERIDO');
    expect(nextCondicionFisica('HERIDO', undefined, true, 'HERIDO')).toBe('HERIDO');
  });
});

describe('healCeilingFor', () => {
  it('sin descanso ni objeto médico, el techo es la condición actual (ninguna mejora posible)', () => {
    expect(healCeilingFor('GRAVE', false, null)).toBe('GRAVE');
  });
  it('descansar/comer topa en HERIDO', () => {
    expect(healCeilingFor('GRAVE', true, null)).toBe('HERIDO');
    expect(healCeilingFor('HERIDO', true, null)).toBe('HERIDO');
  });
  it('descansar NO funciona desde INCAPACITADO — hace falta objeto sí o sí', () => {
    expect(healCeilingFor('INCAPACITADO', true, null)).toBe('INCAPACITADO');
  });
  it('un objeto médico manda por encima de todo, incluso desde INCAPACITADO', () => {
    expect(healCeilingFor('INCAPACITADO', false, 'HERIDO')).toBe('HERIDO');
    expect(healCeilingFor('INCAPACITADO', false, 'ILESO')).toBe('ILESO');
    expect(healCeilingFor('GRAVE', true, 'ILESO')).toBe('ILESO');
  });
});

describe('condicionMalus', () => {
  it('ILESO sin malus, HERIDO/GRAVE con malus creciente', () => {
    expect(condicionMalus('ILESO')).toBe(0);
    expect(condicionMalus('HERIDO')).toBeGreaterThan(0);
    expect(condicionMalus('GRAVE')).toBeGreaterThan(condicionMalus('HERIDO'));
  });
});

describe('nextCondicionForAttack', () => {
  it('ATAQUE normal (o sin effect) siempre empeora un solo escalón', () => {
    expect(nextCondicionForAttack('ATAQUE', 'ILESO')).toBe('HERIDO');
    expect(nextCondicionForAttack(null, 'HERIDO')).toBe('GRAVE');
    expect(nextCondicionForAttack(undefined, 'GRAVE')).toBe('INCAPACITADO');
  });

  it('REMATE contra un NPC sano (ILESO/HERIDO) se comporta como ATAQUE normal', () => {
    expect(nextCondicionForAttack('REMATE', 'ILESO')).toBe('HERIDO');
    expect(nextCondicionForAttack('REMATE', 'HERIDO')).toBe('GRAVE');
  });

  it('REMATE contra un NPC ya GRAVE o INCAPACITADO remata directamente a MUERTO', () => {
    expect(nextCondicionForAttack('REMATE', 'GRAVE')).toBe('MUERTO');
    expect(nextCondicionForAttack('REMATE', 'INCAPACITADO')).toBe('MUERTO');
  });

  it('otros efectos (ATURDIMIENTO/INTIMIDACION/AGUANTE) no cambian el escalonado normal', () => {
    expect(nextCondicionForAttack('ATURDIMIENTO', 'ILESO')).toBe('HERIDO');
    expect(nextCondicionForAttack('INTIMIDACION', 'HERIDO')).toBe('GRAVE');
  });
});

describe('isValidRestLocationKind', () => {
  it('refugio y asentamiento son válidos', () => {
    expect(isValidRestLocationKind('refugio')).toBe(true);
    expect(isValidRestLocationKind('asentamiento')).toBe(true);
  });
  it('hito y cruce no son válidos', () => {
    expect(isValidRestLocationKind('hito')).toBe(false);
    expect(isValidRestLocationKind('cruce')).toBe(false);
  });
});
