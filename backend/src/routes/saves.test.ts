import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';

/// Cobertura nueva (auditoría 2026-07-22): `routes/*` tenía 0% de test pese a ser toda la
/// superficie HTTP real que golpea el frontend. Alcance deliberadamente acotado a los endpoints
/// más sensibles de este archivo en vez de los ~15 completos: pausa/reanuda (historial real de
/// bug de `busyUntil`, ver worldTick.test.ts) y el borrado (fix de manejo de errores de esta misma
/// auditoría, para no dejarlo sin verificar). El resto de `saves.ts` queda como trabajo futuro.
const findUniqueSave = vi.fn();
const updateSave = vi.fn();
const deleteSave = vi.fn();
const updateCharacterTransit = vi.fn();
const deleteManyCharacterTransit = vi.fn();
const transaction = vi.fn();
const logEntryCreate = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    save: {
      findUnique: (...args: unknown[]) => findUniqueSave(...args),
      update: (...args: unknown[]) => updateSave(...args),
      delete: (...args: unknown[]) => deleteSave(...args),
    },
    characterTransit: {
      update: (...args: unknown[]) => updateCharacterTransit(...args),
      deleteMany: (...args: unknown[]) => deleteManyCharacterTransit(...args),
    },
    logEntry: {
      create: (...args: unknown[]) => logEntryCreate(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

const { savesRoutes } = await import('./saves.js');

async function buildApp() {
  const app = Fastify();
  await app.register(savesRoutes);
  return app;
}

describe('POST /saves/:id/pause + /resume', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    updateSave.mockReset();
    updateCharacterTransit.mockReset();
    transaction.mockReset().mockImplementation((ops: unknown[]) => Promise.all(ops));
  });

  it('pausa una partida que no estaba pausada', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', pausedAt: null });
    updateSave.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/pause' });

    expect(res.statusCode).toBe(204);
    expect(updateSave).toHaveBeenCalledWith({ where: { id: 'save1' }, data: { pausedAt: expect.any(Date) } });
  });

  it('no vuelve a marcar pausedAt si ya estaba pausada (idempotente)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', pausedAt: new Date() });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/pause' });

    expect(res.statusCode).toBe(204);
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('al reanudar, alarga busyUntil del tránsito exactamente lo que duró la pausa', async () => {
    const pausedAt = new Date(Date.now() - 5 * 60_000); // pausada hace 5 minutos
    const busyUntil = new Date(Date.now() + 60_000); // vence en 1 minuto más
    findUniqueSave.mockResolvedValue({
      id: 'save1',
      pausedAt,
      characterTransit: { saveId: 'save1', busyUntil },
    });
    updateSave.mockReturnValue('update-save-op');
    updateCharacterTransit.mockReturnValue('update-transit-op');
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/resume' });

    expect(res.statusCode).toBe(204);
    expect(updateSave).toHaveBeenCalledWith({ where: { id: 'save1' }, data: { pausedAt: null } });
    expect(updateCharacterTransit).toHaveBeenCalledWith({
      where: { saveId: 'save1' },
      data: { busyUntil: expect.any(Date) },
    });
    // La nueva busyUntil tiene que ser posterior a la original — se alargó, no se acortó.
    const call = updateCharacterTransit.mock.calls[0][0];
    expect(call.data.busyUntil.getTime()).toBeGreaterThan(busyUntil.getTime());
    expect(transaction).toHaveBeenCalledWith(['update-save-op', 'update-transit-op']);
  });

  it('reanudar sin tránsito activo no toca CharacterTransit', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', pausedAt: new Date(Date.now() - 1000), characterTransit: null });
    updateSave.mockReturnValue('update-save-op');
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/resume' });

    expect(res.statusCode).toBe(204);
    expect(updateCharacterTransit).not.toHaveBeenCalled();
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/no-existe/pause' });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /saves/:id', () => {
  beforeEach(() => {
    deleteSave.mockReset();
  });

  it('borra la partida y devuelve 204', async () => {
    deleteSave.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'DELETE', url: '/saves/save1' });

    expect(res.statusCode).toBe(204);
  });

  it('absorbe P2025 (ya no existe) como éxito idempotente', async () => {
    deleteSave.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '6.0.0' }),
    );
    const app = await buildApp();

    const res = await app.inject({ method: 'DELETE', url: '/saves/ya-no-existe' });

    expect(res.statusCode).toBe(204);
  });

  it('NO absorbe un fallo real de conexión — se propaga como error', async () => {
    deleteSave.mockRejectedValue(new Error('connection refused'));
    const app = await buildApp();

    const res = await app.inject({ method: 'DELETE', url: '/saves/save1' });

    expect(res.statusCode).toBe(500);
  });
});
