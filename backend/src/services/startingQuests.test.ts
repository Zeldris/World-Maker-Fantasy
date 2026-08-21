import { describe, it, expect } from 'vitest';
import { startingQuestsFor } from './startingQuests.js';

// Cobertura nueva (auditoría de deuda técnica 2026-08-21) — mismo criterio que
// startingInventory.test.ts.
describe('startingQuestsFor', () => {
  it('Gorhorn tiene su misión "de serie"; otros personajes, ninguna', () => {
    expect(startingQuestsFor('Gorhorn').length).toBeGreaterThan(0);
    expect(startingQuestsFor('Otro')).toEqual([]);
  });

  it('cada misión tiene título, descripción y objetivo no vacíos', () => {
    for (const quest of startingQuestsFor('Gorhorn')) {
      expect(quest.title.length).toBeGreaterThan(0);
      expect(quest.description.length).toBeGreaterThan(0);
      expect(quest.objetivo.length).toBeGreaterThan(0);
    }
  });
});
