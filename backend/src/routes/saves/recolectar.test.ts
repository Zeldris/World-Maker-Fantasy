import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (auditoría de código completa, 2026-08-07) — este endpoint no tenía NINGÚN test
/// antes. El foco es el bug real encontrado auditando `confirmar`: no validaba `selections` contra
/// `HarvestYield` (la fuente de verdad de qué objeto da cada fuente y cuánto como máximo por
/// recolección) — solo comprobaba la población total del mundo. Sin esa validación, el cliente
/// podía pedir cualquier itemSlug para cualquier sourceSlug, y `cantidad` no tenía más tope que la
/// población total (cientos de unidades), saltándose el máximo real ("3 piedras por recolección").
const findUniqueSave = vi.fn();
const findFirstHarvestYield = vi.fn();
const updateManyWorldPopulation = vi.fn();
const createInventoryItem = vi.fn();
const countInventoryItem = vi.fn();
const findManyInventoryItem = vi.fn();
const transaction = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

const { recolectarRoutes } = await import('./recolectar.js');

async function buildApp() {
  const app = Fastify();
  await app.register(recolectarRoutes);
  return app;
}

describe('POST /saves/:id/recolectar/confirmar', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findFirstHarvestYield.mockReset();
    updateManyWorldPopulation.mockReset();
    createInventoryItem.mockReset();
    countInventoryItem.mockReset().mockResolvedValue(0);
    findManyInventoryItem.mockReset().mockResolvedValue([]);
    findUniqueSave.mockResolvedValue({ id: 'save1', worldId: 'world1', attributes: { fuerza: 10, constitucion: 10 } });
    transaction.mockReset().mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({
        inventoryItem: {
          count: (...args: unknown[]) => countInventoryItem(...args),
          findMany: (...args: unknown[]) => findManyInventoryItem(...args),
          create: (...args: unknown[]) => createInventoryItem(...args),
        },
        harvestYield: { findFirst: (...args: unknown[]) => findFirstHarvestYield(...args) },
        worldPopulation: { updateMany: (...args: unknown[]) => updateManyWorldPopulation(...args) },
      }),
    );
  });

  it('ignora una selección cuyo itemSlug no es un HarvestYield real de ese sourceSlug (bug real, sin validar antes)', async () => {
    findFirstHarvestYield.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'hacha-guerra-orca', cantidad: 1 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).items).toEqual([]);
    expect(updateManyWorldPopulation).not.toHaveBeenCalled();
    expect(createInventoryItem).not.toHaveBeenCalled();
  });

  it('topa la cantidad al máximo real de HarvestYield.cantidad, aunque el cliente pida más (bug real: antes solo topaba la población total)', async () => {
    findFirstHarvestYield.mockResolvedValue({ cantidad: 3, item: { slug: 'piedra', name: 'Piedra' } });
    updateManyWorldPopulation.mockResolvedValue({ count: 1 });
    createInventoryItem.mockResolvedValue({ id: 'item1' });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 500 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(updateManyWorldPopulation).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ poblacion: { gte: 3 } }), data: { poblacion: { decrement: 3 } } }),
    );
    expect(createInventoryItem).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'Piedra (3)' }) }));
  });

  it('no crea el objeto si la población ya no alcanza (otra recolección casi simultánea se lo llevó)', async () => {
    findFirstHarvestYield.mockResolvedValue({ cantidad: 3, item: { slug: 'piedra', name: 'Piedra' } });
    updateManyWorldPopulation.mockResolvedValue({ count: 0 });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).items).toEqual([]);
    expect(createInventoryItem).not.toHaveBeenCalled();
  });

  it('rechaza si no cabe en el inventario (capacidad real, Parte D)', async () => {
    countInventoryItem.mockResolvedValue(100);
    findFirstHarvestYield.mockResolvedValue({ cantidad: 3, item: { slug: 'piedra', name: 'Piedra' } });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 3 }] },
    });

    expect(res.statusCode).toBe(500);
    expect(createInventoryItem).not.toHaveBeenCalled();
  });

  it('rechaza sin ninguna selección', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/recolectar/confirmar', payload: { selections: [] } });

    expect(res.statusCode).toBe(400);
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/nope/recolectar/confirmar',
      payload: { selections: [{ sourceSlug: 'roca-pilares-rotos', itemSlug: 'piedra', cantidad: 1 }] },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('GET /saves/:id/recolectar/:oficio', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
  });

  it('rechaza un oficio que no es recolector', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', worldId: 'world1', currentLocation: { region: 'Las Llanuras del Viento Rojo' } });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recolectar/herrero' });

    expect(res.statusCode).toBe(400);
  });

  it('rechaza desollador (CAZA usa el despiece normal, no este flujo)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', worldId: 'world1', currentLocation: { region: 'Las Llanuras del Viento Rojo' } });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recolectar/desollador' });

    expect(res.statusCode).toBe(400);
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/nope/recolectar/minero' });

    expect(res.statusCode).toBe(404);
  });
});
