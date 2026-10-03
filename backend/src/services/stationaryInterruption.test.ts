import { describe, it, expect, vi } from 'vitest';

// Mismo patrón que travelInterruption.test.ts: `vi.fn()` a nivel de módulo + `vi.mock` + import
// dinámico DESPUÉS del mock.
const zonePointFindMany = vi.fn();
const npcFindMany = vi.fn();
const worldPopulationFindMany = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    zonePoint: { findMany: (...args: unknown[]) => zonePointFindMany(...args) },
    npc: { findMany: (...args: unknown[]) => npcFindMany(...args) },
    worldPopulation: { findMany: (...args: unknown[]) => worldPopulationFindMany(...args) },
    // CR-6 (hito 0.2): partida con su mundo ya clonado (la población se lee por saveId).
    save: { findUniqueOrThrow: async () => ({ worldId: 'world1', worldState: { mundoClonadoEn: new Date() } }) },
  },
}));

const { pickStationaryInterruption } = await import('./stationaryInterruption.js');

describe('pickStationaryInterruption', () => {
  it('sin ningún ZonePoint en la Location: null siempre, sin llamar a nada más', async () => {
    zonePointFindMany.mockResolvedValueOnce([]);
    const result = await pickStationaryInterruption('world1', 'save1', 'loc1', 480, 1, () => 0);
    expect(result).toBeNull();
    expect(npcFindMany).not.toHaveBeenCalled();
  });

  it('un RECURSO nunca "interrumpe" — el filtro ya lo excluye en la query (comprobado por el where pasado)', async () => {
    zonePointFindMany.mockResolvedValueOnce([]);
    await pickStationaryInterruption('world1', 'save1', 'loc1', 480, 1, () => 0);
    expect(zonePointFindMany).toHaveBeenCalledWith({ where: { saveId: 'save1', locationId: 'loc1', tipo: { in: ['FAUNA', 'NPC'] } } });
  });

  it('con ZonePoint real y tirada favorable, elige un candidato ponderado por población', async () => {
    zonePointFindMany.mockResolvedValueOnce([
      { id: 'zp1', locationId: 'loc1', x: 0, y: 0, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', label: null },
    ]);
    npcFindMany.mockResolvedValueOnce([{ id: 'npc1', slug: 'kirelon-arenoso', name: 'Kirelon Arenoso', role: 'x' }]);
    worldPopulationFindMany.mockResolvedValueOnce([{ targetSlug: 'kirelon-arenoso', poblacion: 5, distribucion: {} }]);

    // random() < perChunkProbability en la primera tirada, y luego 0 para que
    // pickAmbientEncounterCandidate elija el único candidato disponible.
    const random = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0);
    const result = await pickStationaryInterruption('world1', 'save1', 'loc1', 480, 1, random);
    expect(result).toEqual({ npcId: 'npc1', npcSlug: 'kirelon-arenoso', npcName: 'Kirelon Arenoso' });
  });

  it('población 0 excluye al candidato — sin nadie más, no dispara', async () => {
    zonePointFindMany.mockResolvedValueOnce([
      { id: 'zp1', locationId: 'loc1', x: 0, y: 0, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', label: null },
    ]);
    npcFindMany.mockResolvedValueOnce([{ id: 'npc1', slug: 'kirelon-arenoso', name: 'Kirelon Arenoso', role: 'x' }]);
    worldPopulationFindMany.mockResolvedValueOnce([{ targetSlug: 'kirelon-arenoso', poblacion: 0, distribucion: {} }]);

    const result = await pickStationaryInterruption('world1', 'save1', 'loc1', 480, 1, () => 0);
    expect(result).toBeNull();
  });

  it('una acción más larga tira más veces (más bloques de CHUNK_MINUTES=120)', async () => {
    zonePointFindMany.mockResolvedValue([
      { id: 'zp1', locationId: 'loc1', x: 0, y: 0, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', label: null },
    ]);
    npcFindMany.mockResolvedValue([{ id: 'npc1', slug: 'kirelon-arenoso', name: 'Kirelon Arenoso', role: 'x' }]);
    worldPopulationFindMany.mockResolvedValue([{ targetSlug: 'kirelon-arenoso', poblacion: 5, distribucion: {} }]);

    // Probabilidad muy baja (0.01) — con 480 min (4 bloques) hay 4 tiradas, cada una con random()
    // fijo en 0.5 (falla las primeras 3 tiradas por debajo del umbral bajo, pero al llegar al
    // cuarto bloque el mock cambia a 0 para acertar) — se comprueba que SÍ llega a intentar varias
    // veces antes de rendirse, no solo una.
    const random = vi.fn().mockReturnValueOnce(0.5).mockReturnValueOnce(0.5).mockReturnValueOnce(0.5).mockReturnValueOnce(0).mockReturnValueOnce(0);
    const result = await pickStationaryInterruption('world1', 'save1', 'loc1', 480, 0.2, random);
    expect(result).not.toBeNull();
    expect(random).toHaveBeenCalledTimes(5); // 4 tiradas de bloque + 1 de pickAmbientEncounterCandidate
  });
});
