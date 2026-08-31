import { describe, it, expect } from 'vitest';
import { valorGoirnosBaseFor } from './economia.js';
import type { ItemCatalogInput } from '../scripts/worldCatalog.js';

/// Item mínimo válido para los tests — solo los campos obligatorios de ItemCatalogInput,
/// el resto se sobreescribe por test. `valorGoirnos` es el campo que la función bajo test
/// calcula, así que se pone a 0 aquí a propósito (nunca se lee dentro de valorGoirnosBaseFor).
function baseItem(overrides: Partial<ItemCatalogInput>): ItemCatalogInput {
  return {
    slug: 'item-test',
    name: 'Item de test',
    category: 'test',
    tipo: 'RECURSO',
    description: 'Item de prueba.',
    valorGoirnos: 0,
    ...overrides,
  };
}

describe('valorGoirnosBaseFor', () => {
  describe('RECURSO', () => {
    it('tier 1 (u omitido) vale 1', () => {
      expect(valorGoirnosBaseFor(baseItem({ tipo: 'RECURSO' }))).toBe(1);
      expect(valorGoirnosBaseFor(baseItem({ tipo: 'RECURSO', tier: 1 }))).toBe(1);
    });
    it('tier 2 vale 3', () => {
      expect(valorGoirnosBaseFor(baseItem({ tipo: 'RECURSO', tier: 2 }))).toBe(3);
    });
    it('tier 3 vale 6', () => {
      expect(valorGoirnosBaseFor(baseItem({ tipo: 'RECURSO', tier: 3 }))).toBe(6);
    });
    it('tier 4 vale 10', () => {
      expect(valorGoirnosBaseFor(baseItem({ tipo: 'RECURSO', tier: 4 }))).toBe(10);
    });
    it('tier 5 vale 15', () => {
      expect(valorGoirnosBaseFor(baseItem({ tipo: 'RECURSO', tier: 5 }))).toBe(15);
    });
    it('tiers por encima de 5 extrapolan la misma progresión creciente', () => {
      const v6 = valorGoirnosBaseFor(baseItem({ tipo: 'RECURSO', tier: 6 }));
      const v9 = valorGoirnosBaseFor(baseItem({ tipo: 'RECURSO', tier: 9 }));
      expect(v6).toBeGreaterThan(15);
      expect(v9).toBeGreaterThan(v6);
    });
  });

  describe('MATERIAL', () => {
    it('escala como tier x 3', () => {
      expect(valorGoirnosBaseFor(baseItem({ tipo: 'MATERIAL', tier: 1 }))).toBe(3);
      expect(valorGoirnosBaseFor(baseItem({ tipo: 'MATERIAL', tier: 4 }))).toBe(12);
    });
  });

  describe('EQUIPABLE', () => {
    it('sin statBonuses, solo cuenta tier x 5', () => {
      expect(valorGoirnosBaseFor(baseItem({ tipo: 'EQUIPABLE', tier: 1 }))).toBe(5);
    });
    it('suma 2 Goirnos por cada punto de un único statBonus', () => {
      const item = baseItem({ tipo: 'EQUIPABLE', tier: 2, statBonuses: { destreza: 3 } });
      // tier 2 x 5 = 10, + 3 x 2 = 6 => 16
      expect(valorGoirnosBaseFor(item)).toBe(16);
    });
    it('suma todos los statBonuses cuando el equipable tiene varios atributos', () => {
      const item = baseItem({
        tipo: 'EQUIPABLE',
        tier: 4,
        statBonuses: { fuerza: 4, constitucion: 2, destreza: 1, voluntad: 1 },
      });
      // tier 4 x 5 = 20, suma de bonuses = 8 x 2 = 16 => 36
      expect(valorGoirnosBaseFor(item)).toBe(36);
    });
    it('incluye el bonus de "defensa" igual que cualquier atributo', () => {
      const item = baseItem({ tipo: 'EQUIPABLE', tier: 2, statBonuses: { defensa: 2 } });
      // tier 2 x 5 = 10, + 2 x 2 = 4 => 14
      expect(valorGoirnosBaseFor(item)).toBe(14);
    });
  });

  describe('CONSUMIBLE', () => {
    it('base por tier sin curaEnergia ni curaHasta', () => {
      expect(valorGoirnosBaseFor(baseItem({ tipo: 'CONSUMIBLE', tier: 1 }))).toBe(2);
    });
    it('suma curaEnergia dividido entre 5 (redondeo hacia abajo)', () => {
      const item = baseItem({ tipo: 'CONSUMIBLE', tier: 1, curaEnergia: 30 });
      // tier 1 x 2 = 2, + floor(30/5) = 6 => 8
      expect(valorGoirnosBaseFor(item)).toBe(8);
    });
    it('curaHasta ILESO (el tope más alto) añade más que GRAVE o HERIDO', () => {
      const grave = valorGoirnosBaseFor(baseItem({ tipo: 'CONSUMIBLE', tier: 1, curaHasta: 'GRAVE' }));
      const herido = valorGoirnosBaseFor(baseItem({ tipo: 'CONSUMIBLE', tier: 1, curaHasta: 'HERIDO' }));
      const ileso = valorGoirnosBaseFor(baseItem({ tipo: 'CONSUMIBLE', tier: 1, curaHasta: 'ILESO' }));
      expect(grave).toBeLessThan(herido);
      expect(herido).toBeLessThan(ileso);
      // tier 1 x 2 = 2, + 20 (ILESO) => 22
      expect(ileso).toBe(22);
    });
    it('combina tier + curaEnergia + curaHasta en un consumible completo', () => {
      const item = baseItem({ tipo: 'CONSUMIBLE', tier: 1, curaEnergia: 30, curaHasta: 'HERIDO' });
      // tier 1 x 2 = 2, + floor(30/5) = 6, + 10 (HERIDO) => 18
      expect(valorGoirnosBaseFor(item)).toBe(18);
    });
  });

  describe('NARRATIVO y ESPECIAL', () => {
    it('no tienen fórmula: devuelven 0 como punto de partida explícito', () => {
      expect(valorGoirnosBaseFor(baseItem({ tipo: 'NARRATIVO' }))).toBe(0);
      expect(valorGoirnosBaseFor(baseItem({ tipo: 'ESPECIAL' }))).toBe(0);
    });
    it('el tier no cambia el resultado (NARRATIVO se decide siempre a mano)', () => {
      expect(valorGoirnosBaseFor(baseItem({ tipo: 'NARRATIVO', tier: 9 }))).toBe(0);
    });
  });

  describe('pureza', () => {
    it('el mismo input siempre da el mismo output (sin efectos secundarios)', () => {
      const item = baseItem({ tipo: 'EQUIPABLE', tier: 3, statBonuses: { fuerza: 2, destreza: 1 } });
      const r1 = valorGoirnosBaseFor(item);
      const r2 = valorGoirnosBaseFor(item);
      const r3 = valorGoirnosBaseFor({ ...item });
      expect(r1).toBe(r2);
      expect(r1).toBe(r3);
    });

    it('no muta el item recibido', () => {
      const item = baseItem({ tipo: 'CONSUMIBLE', tier: 2, curaEnergia: 10 });
      const snapshot = JSON.stringify(item);
      valorGoirnosBaseFor(item);
      expect(JSON.stringify(item)).toBe(snapshot);
    });
  });
});
