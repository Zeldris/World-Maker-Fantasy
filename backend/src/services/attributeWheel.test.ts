import { describe, it, expect } from 'vitest';
import { typeMultiplierFor, effectiveAttributeValue, ATTRIBUTE_RING } from './attributeWheel.js';
import type { Attribute } from './dice.js';

describe('typeMultiplierFor', () => {
  it('destreza le gana a fuerza (contrario directo, distancia 1) — bonus/penalización simétrica', () => {
    expect(typeMultiplierFor('destreza', 'fuerza', 'ataque')).toBe(1.5);
    expect(typeMultiplierFor('fuerza', 'destreza', 'ataque')).toBeCloseTo(1 / 1.5);
  });

  it('fuerza le gana a arcano (cierra el ciclo del anillo, distancia 1 en sentido inverso)', () => {
    expect(typeMultiplierFor('fuerza', 'arcano', 'ataque')).toBe(1.5);
    expect(typeMultiplierFor('arcano', 'fuerza', 'ataque')).toBeCloseTo(1 / 1.5);
  });

  it('sin relación en el extremo opuesto del anillo (distancia 3) — multiplicador neutro', () => {
    expect(typeMultiplierFor('fuerza', 'voluntad', 'ataque')).toBe(1);
    expect(typeMultiplierFor('voluntad', 'fuerza', 'ataque')).toBe(1);
  });

  it('mismo atributo — siempre neutro, nunca se compite consigo mismo', () => {
    expect(typeMultiplierFor('sigilo', 'sigilo', 'defensa')).toBe(1);
  });

  it('los dos árboles (ataque/defensa) son independientes pero comparten la misma topología', () => {
    expect(typeMultiplierFor('destreza', 'fuerza', 'defensa')).toBe(typeMultiplierFor('destreza', 'fuerza', 'ataque'));
  });

  it('es antisimétrico para cualquier par: si A gana a B, B pierde contra A en la misma proporción', () => {
    for (const a of ATTRIBUTE_RING) {
      for (const b of ATTRIBUTE_RING) {
        if (a === b) continue;
        const ab = typeMultiplierFor(a, b, 'ataque');
        const ba = typeMultiplierFor(b, a, 'ataque');
        expect(ab * ba).toBeCloseTo(1, 5);
      }
    }
  });

  it('cada atributo tiene exactamente un contrario directo (distancia 1) y uno al que gana', () => {
    // Con 6 atributos en el anillo, cada uno debería tener multiplicador 1.5 con exactamente
    // otros dos (a quien le gana y quien le gana a él), 1.15 con otros dos, y 1 con el restante.
    for (const a of ATTRIBUTE_RING) {
      const multipliers = ATTRIBUTE_RING.filter((b) => b !== a).map((b) => typeMultiplierFor(a, b, 'ataque'));
      const strong = multipliers.filter((m) => m === 1.5 || Math.abs(m - 1 / 1.5) < 1e-9);
      const mild = multipliers.filter((m) => m === 1.15 || Math.abs(m - 1 / 1.15) < 1e-9);
      const neutral = multipliers.filter((m) => m === 1);
      expect(strong.length).toBe(2);
      expect(mild.length).toBe(2);
      expect(neutral.length).toBe(1);
    }
  });
});

describe('effectiveAttributeValue', () => {
  it('aplica el multiplicador y redondea', () => {
    expect(effectiveAttributeValue(10, 'destreza', 'fuerza', 'ataque')).toBe(15);
    expect(effectiveAttributeValue(10, 'fuerza', 'destreza', 'ataque')).toBe(7); // 10/1.5 = 6.67 -> redondeado a 7
  });

  it('nunca deja el valor efectivo por debajo de 1, aunque el atributo crudo sea bajo y el multiplicador desfavorable', () => {
    expect(effectiveAttributeValue(1, 'fuerza', 'destreza', 'ataque')).toBeGreaterThanOrEqual(1);
  });
});

describe('ATTRIBUTE_RING', () => {
  it('tiene los 6 atributos jugables, cada uno una sola vez', () => {
    const expected: Attribute[] = ['fuerza', 'destreza', 'sigilo', 'voluntad', 'carisma', 'arcano'];
    expect(new Set(ATTRIBUTE_RING)).toEqual(new Set(expected));
    expect(ATTRIBUTE_RING.length).toBe(expected.length);
  });
});
