import { describe, it, expect } from 'vitest';
import { effectiveAttributes, effectiveSecondaryAttributes, effectiveDefense, equippedWeaponNames } from './equipment.js';
import type { AttributeBlock } from './dice.js';
import { EMPTY_SECONDARY_ATTRIBUTES } from './secondaryAttributes.js';

// Cobertura nueva (deuda técnica 2026-07-30, "control de deuda técnica"): equipment.ts tenía
// CERO tests pese a ser el cálculo base (effectiveAttributes/effectiveDefense) que alimenta cada
// intercambio de combate del juego (ver combatExchange.ts) — un bug silencioso aquí afectaría a
// toda partida sin que ningún test lo detectara.
const BASE: AttributeBlock = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 };

describe('effectiveAttributes', () => {
  it('sin objetos equipados, la base no cambia', () => {
    expect(effectiveAttributes(BASE, [])).toEqual(BASE);
  });

  it('suma el bonificador de un objeto equipado al atributo real', () => {
    const result = effectiveAttributes(BASE, [{ statBonuses: { fuerza: 3 } }]);
    expect(result.fuerza).toBe(13);
    expect(result.destreza).toBe(10); // el resto de atributos no se toca
  });

  it('varios objetos apilan sobre el mismo atributo', () => {
    const result = effectiveAttributes(BASE, [{ statBonuses: { destreza: 2 } }, { statBonuses: { destreza: 1 } }]);
    expect(result.destreza).toBe(13);
  });

  // Cobertura nueva (2026-08-03, "que se puedan meter múltiples attr y valor por tipo de attr"):
  // el motivo real de pasar de un par escalar a un mapa — UN solo objeto sumando a la vez a más
  // de un atributo jugable, algo que el diseño anterior no podía expresar en absoluto.
  it('un solo objeto puede sumar a varios atributos jugables a la vez', () => {
    const result = effectiveAttributes(BASE, [{ statBonuses: { fuerza: 2, destreza: 1 } }]);
    expect(result.fuerza).toBe(12);
    expect(result.destreza).toBe(11);
    expect(result.constitucion).toBe(10);
  });

  it('ignora objetos sin bonificador (statBonuses null)', () => {
    expect(effectiveAttributes(BASE, [{ statBonuses: null }])).toEqual(BASE);
  });

  it('ignora la clave "defensa" del mapa — no es uno de los 7 atributos jugables', () => {
    // "defensa" es el valor real que usan los objetos de armadura/escudo (ver effectiveDefense) —
    // effectiveAttributes debe convivir con esos mismos objetos sin tocarlos por error, incluso
    // cuando el mismo objeto también da un atributo jugable a la vez.
    expect(effectiveAttributes(BASE, [{ statBonuses: { defensa: 5 } }])).toEqual(BASE);
    const mixed = effectiveAttributes(BASE, [{ statBonuses: { defensa: 5, fuerza: 1 } }]);
    expect(mixed.fuerza).toBe(11);
  });

  it('no muta el objeto base recibido', () => {
    const base = { ...BASE };
    effectiveAttributes(base, [{ statBonuses: { fuerza: 3 } }]);
    expect(base.fuerza).toBe(10);
  });
});

describe('effectiveDefense', () => {
  it('sin objetos equipados, la defensa es 0', () => {
    expect(effectiveDefense([])).toBe(0);
  });

  it('suma solo la clave "defensa" del mapa de cada objeto', () => {
    const result = effectiveDefense([
      { statBonuses: { defensa: 2 } },
      { statBonuses: { fuerza: 99 } }, // bonificador de atributo, no cuenta aquí
      { statBonuses: { defensa: 1 } },
    ]);
    expect(result).toBe(3);
  });

  it('un objeto con fuerza Y defensa a la vez suma solo la parte de defensa aquí', () => {
    expect(effectiveDefense([{ statBonuses: { fuerza: 4, defensa: 2 } }])).toBe(2);
  });

  it('ignora objetos sin bonificador (statBonuses null)', () => {
    expect(effectiveDefense([{ statBonuses: null }])).toBe(0);
  });
});

// Cobertura nueva (2026-08-03, hueco real encontrado tras construir el mapa de bonus múltiple:
// la petición explícita de la usuaria de cosméticos con "bonus especiales de attrs secundarios"
// nunca tuvo ningún sitio que la aplicara de verdad — normalizeSecondaryAttributes se llamaba a
// pelo en cada ruta, sin pasar nunca por el equipo puesto).
describe('effectiveSecondaryAttributes', () => {
  it('sin objetos equipados, la base no cambia', () => {
    expect(effectiveSecondaryAttributes(EMPTY_SECONDARY_ATTRIBUTES, [])).toEqual(EMPTY_SECONDARY_ATTRIBUTES);
  });

  it('suma el bonificador de un cosmético equipado al atributo secundario real', () => {
    const result = effectiveSecondaryAttributes(EMPTY_SECONDARY_ATTRIBUTES, [{ statBonuses: { sigilo: 2 } }]);
    expect(result.sigilo).toBe(2);
    expect(result.moral).toBe(0); // el resto no se toca
  });

  it('un solo objeto puede sumar a varios atributos secundarios a la vez', () => {
    const result = effectiveSecondaryAttributes(EMPTY_SECONDARY_ATTRIBUTES, [{ statBonuses: { sigilo: 1, moral: 3 } }]);
    expect(result.sigilo).toBe(1);
    expect(result.moral).toBe(3);
  });

  it('ignora claves que no son un atributo secundario real (p.ej. "fuerza" o "defensa")', () => {
    // Un mismo objeto puede dar fuerza (jugable) Y sigilo (secundario) a la vez — cada función
    // solo toca lo suyo, sin pisarse (mismo criterio que effectiveAttributes con 'defensa').
    const result = effectiveSecondaryAttributes(EMPTY_SECONDARY_ATTRIBUTES, [{ statBonuses: { fuerza: 5, defensa: 2, sigilo: 1 } }]);
    expect(result.sigilo).toBe(1);
    expect(Object.keys(result)).not.toContain('fuerza');
  });

  it('ignora objetos sin bonificador (statBonuses null)', () => {
    expect(effectiveSecondaryAttributes(EMPTY_SECONDARY_ATTRIBUTES, [{ statBonuses: null }])).toEqual(EMPTY_SECONDARY_ATTRIBUTES);
  });
});

describe('equippedWeaponNames', () => {
  it('devuelve solo los nombres de ARMA_PRINCIPAL/ARMA_SECUNDARIA', () => {
    const result = equippedWeaponNames([
      { name: 'Hacha de guerra rota', slot: 'ARMA_PRINCIPAL' },
      { name: 'Cuchillo de hielo sílice', slot: 'ARMA_SECUNDARIA' },
      { name: 'Casco de cuero', slot: 'CASCO' },
      { name: 'Ración de viaje', slot: null },
    ]);
    expect(result).toEqual(['Hacha de guerra rota', 'Cuchillo de hielo sílice']);
  });

  it('sin ningún arma equipada, devuelve vacío', () => {
    expect(equippedWeaponNames([{ name: 'Casco de cuero', slot: 'CASCO' }])).toEqual([]);
  });
});
