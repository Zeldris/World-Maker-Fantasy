import { describe, it, expect, vi } from 'vitest';
import { companerosDeCombate } from './combateCompaneros.js';

// P445: los compañeros de la jugadora llegan al panel como su bando.
describe('companerosDeCombate (P445)', () => {
  it('devuelve solo los participantes COMPANION, con el nombre y la condición de su ficha', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'k1', name: 'Tirag Susig', condicionFisica: 'ILESO' },
      { id: 'k2', name: 'Hagar Kiugh', condicionFisica: 'HERIDO' },
    ]);
    const res = await companerosDeCombate({ companion: { findMany } } as never, [
      { id: 'pj', tipo: 'JUGADOR', companionId: null },
      { id: 'pc1', tipo: 'COMPANION', companionId: 'k1' },
      { id: 'pn', tipo: 'NPC', companionId: null },
      { id: 'pc2', tipo: 'COMPANION', companionId: 'k2' },
    ]);
    expect(res).toEqual([
      { participantId: 'pc1', name: 'Tirag Susig', condicionFisica: 'ILESO' },
      { participantId: 'pc2', name: 'Hagar Kiugh', condicionFisica: 'HERIDO' },
    ]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['k1', 'k2'] } } }));
  });

  it('sin compañeros no consulta nada', async () => {
    const findMany = vi.fn();
    expect(await companerosDeCombate({ companion: { findMany } } as never, [{ id: 'pj', tipo: 'JUGADOR', companionId: null }])).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
