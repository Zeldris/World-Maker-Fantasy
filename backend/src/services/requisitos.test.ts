import { describe, it, expect } from 'vitest';
import { checkRequisitos, shortfallLabel } from './requisitos.js';
import type { AttributeBlock } from './dice.js';
import type { SecondaryAttributeBlock } from './secondaryAttributes.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend") — usado tanto por
// crafting.ts como construction.ts, sin ningún test directo hasta ahora.

const ATTRS: AttributeBlock = { fuerza: 10, destreza: 8, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 };
const SECONDARY: SecondaryAttributeBlock = {
  magia: 0,
  poderSemilla: 0,
  moral: 5,
  resistenciaFrio: 0,
  resistenciaCalor: 0,
  suerte: 5,
  honor: 0,
};

describe('checkRequisitos', () => {
  it('sin requisitos, no hay carencias', () => {
    expect(checkRequisitos(undefined, ATTRS, SECONDARY)).toEqual([]);
  });

  it('cumple todos los requisitos, no hay carencias', () => {
    expect(checkRequisitos({ fuerza: 10 }, ATTRS, SECONDARY)).toEqual([]);
  });

  it('detecta una carencia en un atributo jugable', () => {
    expect(checkRequisitos({ destreza: 12 }, ATTRS, SECONDARY)).toEqual([{ atributo: 'destreza', tienes: 8, necesitas: 12 }]);
  });

  it('lee también atributos secundarios, sin colisión de nombres con los jugables (p.ej. moral, suerte)', () => {
    expect(checkRequisitos({ moral: 8 }, ATTRS, SECONDARY)).toEqual([{ atributo: 'moral', tienes: 5, necesitas: 8 }]);
    expect(checkRequisitos({ suerte: 8 }, ATTRS, SECONDARY)).toEqual([{ atributo: 'suerte', tienes: 5, necesitas: 8 }]);
  });

  it('un requisito de Inteligencia (jugable, ver crafting.ts § contraveneno) lee el atributo jugable, nunca el secundario', () => {
    // Confirmado por la usuaria (2026-08-03): Inteligencia es puramente jugable desde el rediseño
    // a 7 atributos — `SecondaryAttribute` ya no tiene ninguna clave 'inteligencia' con la que
    // pudiera colisionar (fix real, ver secondaryAttributes.ts). Antes del fix, este archivo tenía
    // un test documentando la colisión de nombres real que había entre ambos bloques.
    expect(checkRequisitos({ inteligencia: 8 }, ATTRS, SECONDARY)).toEqual([]);
    expect(checkRequisitos({ inteligencia: 12 }, ATTRS, SECONDARY)).toEqual([{ atributo: 'inteligencia', tienes: 10, necesitas: 12 }]);
  });

  it('devuelve varias carencias si fallan varios atributos', () => {
    const result = checkRequisitos({ destreza: 12, moral: 8 }, ATTRS, SECONDARY);
    expect(result).toHaveLength(2);
  });

  it('`alivio` (nivel de oficio) resta al mínimo exigido', () => {
    // Sin alivio, fuerza 10 no llega a 12; con alivio 3, el umbral baja a 9 y sí cumple.
    expect(checkRequisitos({ fuerza: 12 }, ATTRS, SECONDARY, 3)).toEqual([]);
  });

  it('el alivio nunca baja el umbral por debajo de 0', () => {
    expect(checkRequisitos({ fuerza: 2 }, ATTRS, SECONDARY, 999)).toEqual([]);
  });
});

describe('shortfallLabel', () => {
  it('formatea "atributo tienes/necesitas"', () => {
    expect(shortfallLabel({ atributo: 'fuerza', tienes: 8, necesitas: 12 })).toBe('fuerza 8/12');
  });
});
