import { describe, it, expect, vi, beforeEach } from 'vitest';

/// Cobertura nueva (auditoría 2026-07-22): este worker tenía 0% de test pese a ser justo donde ya
/// hubo un bug real en producción (doble resolución del mismo tránsito, ver CLAIM_BUFFER_MS más
/// abajo en worldTick.ts) — se verifica aquí el reclamo atómico, que un fallo de narración deja el
/// tránsito vivo para reintentar (nunca huérfano), y que un fallo en un tránsito no bloquea los
/// demás del mismo tick.
const findMany = vi.fn();
const updateMany = vi.fn();
const del = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    characterTransit: {
      findMany: (...args: unknown[]) => findMany(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
      delete: (...args: unknown[]) => del(...args),
    },
  },
}));

const narrateAndPersistTurn = vi.fn();
// TransitCancelledError (auditoría 2026-07-28): el borrado real del CharacterTransit ahora ocurre
// DENTRO de narrateAndPersistTurn (mockeada aquí), en la misma transacción que aplica los efectos
// del turno — si el jugador canceló mientras se narraba, esa llamada mockeada rechaza con esta
// clase de error en vez de borrar nada aparte.
class TransitCancelledError extends Error {}
vi.mock('../services/turnResolution.js', () => ({
  narrateAndPersistTurn: (...args: unknown[]) => narrateAndPersistTurn(...args),
  TransitCancelledError,
}));
vi.mock('../services/timedActions.js', () => ({ computeDuration: vi.fn(() => ({ minutos: 30 })) }));
vi.mock('../services/equipment.js', () => ({
  effectiveAttributes: vi.fn((base: unknown) => base),
  effectiveSecondaryAttributes: vi.fn((base: unknown) => base),
  effectiveDefense: vi.fn(() => 0),
  equippedWeaponNames: vi.fn(() => []),
  equippedItemsSummary: vi.fn(() => []),
}));
vi.mock('../config/env.js', () => ({ env: { worldTickIntervalMinutes: 20 } }));
vi.mock('../services/worldFacts.js', () => ({ loadSessionFacts: vi.fn(() => Promise.resolve([])) }));

const { resolveDueTransits } = await import('./worldTick.js');

function transitFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 't1',
    busyUntil: new Date(Date.now() - 1000),
    zoneContext: {
      action: 'seguir caminando',
      classification: { requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'corta', duracionEstimadaMinutos: 30 },
      roll: undefined,
      travel: null,
    },
    save: {
      id: 'save1',
      worldId: 'world1',
      characterName: 'Gorhorn',
      characterArchetype: 'Guerrero',
      characterOrigin: 'Llanuras',
      characterMotivation: 'Honor',
      xp: 0,
      level: 1,
      attributes: { fuerza: 12, destreza: 10, sigilo: 8, voluntad: 10, carisma: 8, arcano: 4 },
      currentLocationId: 'loc1',
      condicionFisica: 'ILESO',
      dificultad: 'MEDIO',
      deathCount: 0,
      lastRestLocationId: null,
      worldState: { facts: [], fictionalDateLabel: 'Día 1, mañana', fictionalMinutes: 480 },
      inventoryItems: [],
    },
    ...overrides,
  };
}

describe('resolveDueTransits', () => {
  beforeEach(() => {
    findMany.mockReset();
    updateMany.mockReset();
    del.mockReset();
    narrateAndPersistTurn.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('no hace nada si no hay ningún tránsito vencido', async () => {
    findMany.mockResolvedValue([]);

    await resolveDueTransits();

    expect(narrateAndPersistTurn).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it('reclama el tránsito, narra y le pide a narrateAndPersistTurn que lo finalice', async () => {
    findMany.mockResolvedValue([transitFixture()]);
    updateMany.mockResolvedValue({ count: 1 });
    narrateAndPersistTurn.mockResolvedValue(undefined);

    await resolveDueTransits();

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 't1', busyUntil: { lte: expect.any(Date) } },
      data: { busyUntil: expect.any(Date) },
    });
    expect(narrateAndPersistTurn).toHaveBeenCalledTimes(1);
    // El borrado real ya no lo hace worldTick.ts aparte (bug real, auditoría 2026-07-28: eso
    // dejaba una ventana de carrera con /saves/:id/transit/cancel) — se lo pide a
    // narrateAndPersistTurn vía `transitIdToFinalize`, para que borre dentro de su propia
    // transacción y sea atómico con el cancelar.
    expect(narrateAndPersistTurn).toHaveBeenCalledWith(
      expect.objectContaining({ saveId: 'save1', worldId: 'world1', action: 'seguir caminando', transitIdToFinalize: 't1' }),
    );
    expect(del).not.toHaveBeenCalled();
  });

  // Eventos de viaje interactivos (2026-08-05) — `travelInterruptionNpcId` viaja dentro del mismo
  // `zoneContext` que `travel`/`action`/`classification`, así que worldTick.ts solo tiene que
  // desestructurarlo y reenviarlo tal cual — este test cubre justo ese reenvío.
  it('reenvía travelInterruptionNpcId a narrateAndPersistTurn cuando el tránsito lo trae', async () => {
    findMany.mockResolvedValue([
      transitFixture({
        zoneContext: {
          action: 'viajo hacia la zona de prueba destino',
          classification: { requiereTirada: false, atributo: 'destreza', dificultad: 8, razon: 'x', banda: 'extendida', duracionEstimadaMinutos: 100 },
          roll: undefined,
          travel: { toLocationId: 'loc-mid', toLocationName: 'Zona Intermedia' },
          travelInterruptionNpcId: 'npc-agresor',
        },
      }),
    ]);
    updateMany.mockResolvedValue({ count: 1 });
    narrateAndPersistTurn.mockResolvedValue(undefined);

    await resolveDueTransits();

    expect(narrateAndPersistTurn).toHaveBeenCalledWith(expect.objectContaining({ travelInterruptionNpcId: 'npc-agresor' }));
  });

  it('reenvía travelInterruptionNpcId como undefined cuando el tránsito no es una interrupción (viaje normal o acción sin viaje)', async () => {
    findMany.mockResolvedValue([transitFixture()]); // zoneContext por defecto, sin travelInterruptionNpcId
    updateMany.mockResolvedValue({ count: 1 });
    narrateAndPersistTurn.mockResolvedValue(undefined);

    await resolveDueTransits();

    const call = narrateAndPersistTurn.mock.calls[0][0] as { travelInterruptionNpcId?: string | null };
    expect(call.travelInterruptionNpcId).toBeUndefined();
  });

  it('si narrateAndPersistTurn rechaza con TransitCancelledError, no lo trata como error (el jugador ya canceló)', async () => {
    findMany.mockResolvedValue([transitFixture()]);
    updateMany.mockResolvedValue({ count: 1 });
    narrateAndPersistTurn.mockRejectedValue(new TransitCancelledError());

    await resolveDueTransits();

    expect(narrateAndPersistTurn).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('se salta el tránsito si el reclamo atómico ya lo cogió otra ejecución (count 0)', async () => {
    findMany.mockResolvedValue([transitFixture()]);
    updateMany.mockResolvedValue({ count: 0 });

    await resolveDueTransits();

    expect(narrateAndPersistTurn).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it('si narrar falla, NO borra el tránsito (queda vivo para reintentar, nunca huérfano)', async () => {
    findMany.mockResolvedValue([transitFixture()]);
    updateMany.mockResolvedValue({ count: 1 });
    narrateAndPersistTurn.mockRejectedValue(new Error('Ollama caído'));

    await resolveDueTransits();

    expect(narrateAndPersistTurn).toHaveBeenCalledTimes(1);
    expect(del).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('un tránsito que falla no bloquea la resolución de los demás en el mismo tick', async () => {
    findMany.mockResolvedValue([transitFixture({ id: 'fails' }), transitFixture({ id: 'ok' })]);
    updateMany.mockResolvedValue({ count: 1 });
    narrateAndPersistTurn.mockRejectedValueOnce(new Error('falla el primero')).mockResolvedValueOnce(undefined);

    await resolveDueTransits();

    expect(narrateAndPersistTurn).toHaveBeenCalledTimes(2);
    expect(narrateAndPersistTurn).toHaveBeenNthCalledWith(2, expect.objectContaining({ transitIdToFinalize: 'ok' }));
  });
});
