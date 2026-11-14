import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  lore: vi.fn(), npc: vi.fn(), location: vi.fn(), faction: vi.fn(),
}));
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    loreChunk: { findMany: mocks.lore },
    npc: { findMany: mocks.npc },
    location: { findMany: mocks.location },
    faction: { findMany: mocks.faction },
  },
}));

import { nombresDelMundo, invalidarNombresDelMundo, TTL_NOMBRES_MS } from './nombresDelMundo.js';

describe('nombresDelMundo: caché con caducidad (QA-289)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invalidarNombresDelMundo();
    mocks.lore.mockReset().mockResolvedValue([]);
    mocks.npc.mockReset().mockResolvedValue([{ name: 'Ulkha Ketg', aliases: [] }]);
    mocks.location.mockReset().mockResolvedValue([]);
    mocks.faction.mockReset().mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it('dentro del TTL reutiliza la carga; pasado el TTL, recarga y ve lo nuevo', async () => {
    expect((await nombresDelMundo('w1')).has('ulkha')).toBe(true);
    await nombresDelMundo('w1');
    expect(mocks.npc).toHaveBeenCalledTimes(1);
    mocks.npc.mockResolvedValue([{ name: 'Torgash', aliases: [] }]);
    vi.advanceTimersByTime(TTL_NOMBRES_MS + 1);
    const nuevos = await nombresDelMundo('w1');
    expect(mocks.npc).toHaveBeenCalledTimes(2);
    expect(nuevos.has('torgash')).toBe(true);
  });

  it('invalidarNombresDelMundo fuerza la recarga de ese mundo', async () => {
    await nombresDelMundo('w1');
    invalidarNombresDelMundo('w1');
    await nombresDelMundo('w1');
    expect(mocks.npc).toHaveBeenCalledTimes(2);
  });
});
