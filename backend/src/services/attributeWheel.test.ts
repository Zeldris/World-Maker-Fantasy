import { describe, it, expect } from 'vitest';
import { typeMultiplierFor, effectiveAttributeValue, ATTRIBUTE_RING } from './attributeWheel.js';
import type { Attribute } from './dice.js';

describe('typeMultiplierFor', () => {
  // Solo premia, nunca penaliza (rediseño 2026-08-15, bug real "muy injusto" jugando en vivo:
  // Destreza 20 vs Fuerza 5 en el mismo intercambio — antes ganar de tipo multiplicaba TU valor
  // Y AL MISMO TIEMPO dividía el del rival, así que la diferencia real era ×magnitude² (p. ej.
  // ×1.5×1.5≈×2.25), no solo ×1.5). Ahora el lado en desventaja de tipo se queda en 1 (neutro),
  // exactamente igual que si no hubiera ninguna relación en la rueda.
  it('destreza le gana a fuerza (contrario directo, distancia 1) — solo bonus para quien gana, nunca penalización para quien pierde', () => {
    expect(typeMultiplierFor('destreza', 'fuerza', 'ataque')).toBe(1.5);
    expect(typeMultiplierFor('fuerza', 'destreza', 'ataque')).toBe(1);
  });

  it('fuerza le gana a carisma (cierra el ciclo del anillo, distancia 1 en sentido inverso)', () => {
    expect(typeMultiplierFor('fuerza', 'carisma', 'ataque')).toBe(1.5);
    expect(typeMultiplierFor('carisma', 'fuerza', 'ataque')).toBe(1);
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

  it('nunca devuelve un multiplicador por debajo de 1, para ningún par de atributos', () => {
    for (const a of ATTRIBUTE_RING) {
      for (const b of ATTRIBUTE_RING) {
        expect(typeMultiplierFor(a, b, 'ataque')).toBeGreaterThanOrEqual(1);
        expect(typeMultiplierFor(a, b, 'defensa')).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('cada atributo gana a exactamente uno (distancia 1) y a otro con menos fuerza (distancia 2) — el resto queda neutro, ninguno penaliza', () => {
    // Con 7 atributos en el anillo (impar, sin antípoda exacta): cada uno gana ×1.5 contra
    // exactamente uno, ×1.15 contra otro, y queda neutro (×1) contra los 4 restantes — los 2 que
    // antes perdían distancia 1/2 (ahora neutros, ya no ×0.67/×0.87) más los 2 de distancia 3.
    for (const a of ATTRIBUTE_RING) {
      const multipliers = ATTRIBUTE_RING.filter((b) => b !== a).map((b) => typeMultiplierFor(a, b, 'ataque'));
      expect(multipliers.filter((m) => m === 1.5)).toHaveLength(1);
      expect(multipliers.filter((m) => m === 1.15)).toHaveLength(1);
      expect(multipliers.filter((m) => m === 1)).toHaveLength(4);
    }
  });
});

describe('effectiveAttributeValue', () => {
  it('aplica el multiplicador de quien gana y redondea', () => {
    expect(effectiveAttributeValue(10, 'destreza', 'fuerza', 'ataque')).toBe(15);
  });

  it('no penaliza a quien pierde de tipo — se queda en el valor crudo, sin dividir', () => {
    expect(effectiveAttributeValue(10, 'fuerza', 'destreza', 'ataque')).toBe(10);
  });

  it('nunca deja el valor efectivo por debajo de 1, aunque el atributo crudo sea 0', () => {
    expect(effectiveAttributeValue(0, 'fuerza', 'destreza', 'ataque')).toBeGreaterThanOrEqual(1);
  });
});

describe('ATTRIBUTE_RING', () => {
  it('tiene los 7 atributos jugables, cada uno una sola vez', () => {
    const expected: Attribute[] = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'voluntad', 'carisma', 'arcano']
    expect(new Set(ATTRIBUTE_RING)).toEqual(new Set(expected));
    expect(ATTRIBUTE_RING.length).toBe(expected.length);
  });
});
