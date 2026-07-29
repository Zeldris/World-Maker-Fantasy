import { describe, it, expect } from 'vitest';
import { typeMultiplierFor, effectiveAttributeValue, ATTRIBUTE_RING } from './attributeWheel.js';
import type { Attribute } from './dice.js';

describe('typeMultiplierFor', () => {
  it('destreza le gana a fuerza (contrario directo, distancia 1) — bonus/penalización simétrica', () => {
    expect(typeMultiplierFor('destreza', 'fuerza', 'ataque')).toBe(1.5);
    expect(typeMultiplierFor('fuerza', 'destreza', 'ataque')).toBeCloseTo(1 / 1.5);
  });

  it('fuerza le gana a carisma (cierra el ciclo del anillo, distancia 1 en sentido inverso)', () => {
    expect(typeMultiplierFor('fuerza', 'carisma', 'ataque')).toBe(1.5);
    expect(typeMultiplierFor('carisma', 'fuerza', 'ataque')).toBeCloseTo(1 / 1.5);
  });

  it('sin relación en el extremo del anillo (distancia 3, anillo de 7 impar — dos por lado) — multiplicador neutro', () => {
    expect(typeMultiplierFor('fuerza', 'arcano', 'ataque')).toBe(1);
    expect(typeMultiplierFor('arcano', 'fuerza', 'ataque')).toBe(1);
  });

  it('mismo atributo — siempre neutro, nunca se compite consigo mismo', () => {
    expect(typeMultiplierFor('constitucion', 'constitucion', 'defensa')).toBe(1);
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
    // Con 7 atributos en el anillo (impar, sin antípoda exacta), cada uno tiene multiplicador 1.5
    // con otros dos (a quien le gana y quien le gana a él), 1.15 con otros dos, y 1 (neutro) con
    // los 2 restantes — a diferencia de un anillo par, aquí no hay un único "opuesto", los dos de
    // distancia máxima (3) caen ambos en neutro.
    for (const a of ATTRIBUTE_RING) {
      const multipliers = ATTRIBUTE_RING.filter((b) => b !== a).map((b) => typeMultiplierFor(a, b, 'ataque'));
      const strong = multipliers.filter((m) => m === 1.5 || Math.abs(m - 1 / 1.5) < 1e-9);
      const mild = multipliers.filter((m) => m === 1.15 || Math.abs(m - 1 / 1.15) < 1e-9);
      const neutral = multipliers.filter((m) => m === 1);
      expect(strong.length).toBe(2);
      expect(mild.length).toBe(2);
      expect(neutral.length).toBe(2);
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
  it('tiene los 7 atributos jugables, cada uno una sola vez', () => {
    const expected: Attribute[] = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'voluntad', 'carisma', 'arcano']
    expect(new Set(ATTRIBUTE_RING)).toEqual(new Set(expected));
    expect(ATTRIBUTE_RING.length).toBe(expected.length);
  });
});
