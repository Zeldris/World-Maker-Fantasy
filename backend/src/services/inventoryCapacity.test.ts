import { describe, it, expect } from 'vitest';
import { inventoryCapacityFor, totalInventoryUnits } from './inventoryCapacity.js';

describe('inventoryCapacityFor', () => {
  it('base 20 + fuerza + constitución + bonus cosmético', () => {
    expect(inventoryCapacityFor(10, 10, 0)).toBe(40);
    expect(inventoryCapacityFor(10, 10, 5)).toBe(45);
  });
});

describe('totalInventoryUnits', () => {
  it('cuenta 1 unidad por objeto sin cantidad en el nombre', () => {
    expect(totalInventoryUnits([{ name: 'Hacha de guerra rota' }, { name: 'Cuchillo de hielo sílice' }])).toBe(2);
  });

  // Bug real jugando en vivo (2026-08-08, "podemos tener inventario infinito"): una pila
  // acumulada ("Piedra (9)") es UNA fila, pero debe pesar 9 contra la capacidad, no 1.
  it('suma la cantidad real de una pila acumulada, no 1 por fila', () => {
    expect(totalInventoryUnits([{ name: 'Piedra (9)' }])).toBe(9);
  });

  it('mezcla filas sueltas y pilas acumuladas', () => {
    expect(totalInventoryUnits([{ name: 'Piedra (9)' }, { name: 'Hacha de guerra rota' }, { name: 'Leña de matorral de cuerno (3)' }])).toBe(13);
  });

  it('inventario vacío suma 0', () => {
    expect(totalInventoryUnits([])).toBe(0);
  });
});
