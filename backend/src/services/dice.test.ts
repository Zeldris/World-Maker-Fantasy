import { describe, it, expect } from 'vitest';
import {
  gradoExitoFor,
  rollGathering,
  gradoForRecurso,
  dificultadForTier,
  cantidadForGrado,
  SUERTE_VENTAJA_UMBRAL,
  rollOpposed,
  rollD20,
  type AttributeBlock,
} from './dice.js';

/// Extraída (2026-08-28, pasivas raciales — ver racialPassives.ts/combatExchange.ts) de la misma
/// lógica que ya usaba `rollGathering` — mismo criterio D&D: ventaja/desventaja tira 2d20, nunca
/// un modificador numérico plano.
describe('rollD20', () => {
  it("'normal': un único d20, sin descartar nada", () => {
    const result = rollD20('normal', () => 0.5);
    expect(result.rolls).toEqual([11]);
    expect(result.usedRoll).toBe(11);
  });

  it("'ventaja': dos d20, se queda con el MAYOR", () => {
    const rolls = [0.1, 0.9]; // 3 y 19
    let i = 0;
    const result = rollD20('ventaja', () => rolls[i++]);
    expect(result.rolls).toEqual([3, 19]);
    expect(result.usedRoll).toBe(19);
  });

  it("'desventaja': dos d20, se queda con el MENOR", () => {
    const rolls = [0.1, 0.9]; // 3 y 19
    let i = 0;
    const result = rollD20('desventaja', () => rolls[i++]);
    expect(result.rolls).toEqual([3, 19]);
    expect(result.usedRoll).toBe(3);
  });
});

describe('gradoExitoFor', () => {
  it('claro cuando el resultado supera la dificultad en 5 o más', () => {
    expect(gradoExitoFor(20, 15)).toBe('claro');
    expect(gradoExitoFor(19, 15)).toBe('con_coste');
  });

  it('con_coste cuando el resultado iguala o supera la dificultad, pero por menos de 5', () => {
    expect(gradoExitoFor(15, 15)).toBe('con_coste');
    expect(gradoExitoFor(18, 15)).toBe('con_coste');
  });

  it('fallo cuando el resultado no llega a la dificultad', () => {
    expect(gradoExitoFor(14, 15)).toBe('fallo');
  });
});

const ATTRS: AttributeBlock = { fuerza: 14, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

describe('rollGathering', () => {
  it('sin ventaja con Suerte por debajo del umbral: un único d20', () => {
    const result = rollGathering(ATTRS, 'fuerza', 2, SUERTE_VENTAJA_UMBRAL - 1, () => 0.5);
    expect(result.advantage).toBe(false);
    expect(result.rolls).toHaveLength(1);
    expect(result.usedRoll).toBe(11); // floor(0.5*20)+1
    expect(result.result).toBe(11 + Math.floor(14 / 2) + 2); // 20
  });

  it('con ventaja cuando Suerte alcanza el umbral: dos d20, se usa el mayor', () => {
    const rolls = [0.1, 0.9]; // 3 y 19
    let i = 0;
    const result = rollGathering(ATTRS, 'fuerza', 0, SUERTE_VENTAJA_UMBRAL, () => rolls[i++]);
    expect(result.advantage).toBe(true);
    expect(result.rolls).toEqual([3, 19]);
    expect(result.usedRoll).toBe(19);
    expect(result.result).toBe(19 + Math.floor(14 / 2));
  });

  it('bonusOficio se suma al resultado final, no al d20', () => {
    const result = rollGathering(ATTRS, 'fuerza', 3, 0, () => 0);
    expect(result.rolls).toEqual([1]);
    expect(result.result).toBe(1 + Math.floor(14 / 2) + 3);
  });
});

describe('dificultadForTier', () => {
  it('tier ausente se trata como 1 (común), mismo default que requisitos.ts', () => {
    expect(dificultadForTier(undefined)).toBe(11);
    expect(dificultadForTier(null)).toBe(11);
  });

  it('suma el tier real a la base de 10', () => {
    expect(dificultadForTier(4)).toBe(14);
  });
});

describe('gradoForRecurso', () => {
  it('mismos tres tramos que gradoExitoFor (margen +5 = claro)', () => {
    expect(gradoForRecurso(16, 11)).toBe('claro');
    expect(gradoForRecurso(15, 11)).toBe('con_coste');
    expect(gradoForRecurso(11, 11)).toBe('con_coste');
    expect(gradoForRecurso(10, 11)).toBe('fallo');
  });
});

describe('cantidadForGrado', () => {
  it('fallo no da nada', () => {
    expect(cantidadForGrado('fallo', 6)).toBe(0);
  });

  it('con_coste da la mitad redondeada arriba, mínimo 1', () => {
    expect(cantidadForGrado('con_coste', 6)).toBe(3);
    expect(cantidadForGrado('con_coste', 3)).toBe(2);
    expect(cantidadForGrado('con_coste', 1)).toBe(1);
  });

  it('claro da la cantidad máxima completa', () => {
    expect(cantidadForGrado('claro', 6)).toBe(6);
  });
});

// Grupo 3 § Compañeros y supervivencia (2026-08-25) — tirada opuesta de tameo/persuasión,
// deliberadamente separada de rollCheck/rollGathering (ver comentario de cabecera en dice.ts).
function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('rollOpposed', () => {
  const playerAttrs: AttributeBlock = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 14, magia: 0 };
  const resistenciaAttrs: AttributeBlock = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 8, carisma: 0, magia: 0 };

  it('gana el jugador si su resultado supera al de la resistencia', () => {
    // playerRoll = floor(0.9*20)+1 = 19, resistenciaRoll = floor(0.1*20)+1 = 3
    const result = rollOpposed(playerAttrs, 'carisma', resistenciaAttrs, 'voluntad', sequence([0.9, 0.1]));
    expect(result.playerResult).toBe(19 + Math.floor(14 / 2)); // 26
    expect(result.resistenciaResult).toBe(3 + Math.floor(8 / 2)); // 7
    expect(result.margen).toBe(19);
    expect(result.gano).toBe(true);
  });

  it('empate (margen 0) lo gana la resistencia, no el jugador', () => {
    // Mismo resultado en ambos lados con estos atributos: playerRoll=5 (+7=12), resistenciaRoll=8 (+4=12)
    const result = rollOpposed(
      { ...playerAttrs, carisma: 14 },
      'carisma',
      { ...resistenciaAttrs, voluntad: 8 },
      'voluntad',
      sequence([0.2, 0.35]), // floor(0.2*20)+1=5, floor(0.35*20)+1=8
    );
    expect(result.margen).toBe(0);
    expect(result.gano).toBe(false);
  });

  it('pierde el jugador si su resultado no alcanza al de la resistencia', () => {
    const result = rollOpposed(playerAttrs, 'carisma', resistenciaAttrs, 'voluntad', sequence([0.05, 0.9]));
    expect(result.margen).toBeLessThan(0);
    expect(result.gano).toBe(false);
  });
});
