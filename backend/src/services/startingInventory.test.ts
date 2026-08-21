import { describe, it, expect } from 'vitest';
import { startingInventoryFor } from './startingInventory.js';

// Cobertura nueva (auditoría de deuda técnica 2026-08-21) — mismo criterio que
// startingAbilities.test.ts/startingProfessions.test.ts: cualquier "de serie" de Gorhorn debería
// tener al menos una comprobación mínima, aunque la lógica de despacho por characterName sea
// trivial (el riesgo real está en los propios datos, no en el dispatcher).
describe('startingInventoryFor', () => {
  it('Gorhorn tiene su equipo inicial "de serie"; otros personajes, ninguno', () => {
    expect(startingInventoryFor('Gorhorn').length).toBeGreaterThan(0);
    expect(startingInventoryFor('Otro')).toEqual([]);
  });

  it('cada objeto tiene nombre y descripción no vacíos, sin nombres duplicados', () => {
    const items = startingInventoryFor('Gorhorn');
    for (const item of items) {
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    }
    expect(new Set(items.map((i) => i.name)).size).toBe(items.length);
  });
});
