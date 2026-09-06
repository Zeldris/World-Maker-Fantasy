import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';

/// Cobertura nueva (2026-09-06, "nombrar las partidas con nombres custom") — `PATCH /saves/:id/name`
/// es el único endpoint de escritura nuevo de este archivo; `GET /saves` y `DELETE /saves/:id` ya
/// se ejercitan en integración (`saves.test.ts` cubre el resto de `saves.ts`).
const updateSave = vi.fn();
const deleteSave = vi.fn();
const findManySave = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: {
      update: (...args: unknown[]) => updateSave(...args),
      delete: (...args: unknown[]) => deleteSave(...args),
      findMany: (...args: unknown[]) => findManySave(...args),
    },
  },
}));

vi.mock('../../lib/defaultUser.js', () => ({
  getDefaultUserId: async () => 'user1',
}));

const { listRoutes } = await import('./list.js');

async function buildApp() {
  const app = Fastify();
  await app.register(listRoutes);
  return app;
}

describe('PATCH /saves/:id/name', () => {
  beforeEach(() => {
    updateSave.mockReset();
  });

  it('guarda el nombre editable, recortando espacios sobrantes', async () => {
    updateSave.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({
      method: 'PATCH',
      url: '/saves/save1/name',
      payload: { saveName: '  Mi partida secreta  ' },
    });

    expect(res.statusCode).toBe(200);
    expect(updateSave).toHaveBeenCalledWith({ where: { id: 'save1' }, data: { saveName: 'Mi partida secreta' } });
    expect(res.json()).toEqual({ saveName: 'Mi partida secreta' });
  });

  it('un nombre vacío o solo espacios vuelve a null (título por defecto en el frontend)', async () => {
    updateSave.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/name', payload: { saveName: '   ' } });

    expect(res.statusCode).toBe(200);
    expect(updateSave).toHaveBeenCalledWith({ where: { id: 'save1' }, data: { saveName: null } });
    expect(res.json()).toEqual({ saveName: null });
  });

  it('saveName null explícito también limpia el nombre', async () => {
    updateSave.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/name', payload: { saveName: null } });

    expect(res.statusCode).toBe(200);
    expect(updateSave).toHaveBeenCalledWith({ where: { id: 'save1' }, data: { saveName: null } });
  });

  it('devuelve 404 si la partida no existe (mismo criterio que DELETE /saves/:id)', async () => {
    updateSave.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('not found', { code: 'P2025', clientVersion: '6' }));
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/inexistente/name', payload: { saveName: 'X' } });

    expect(res.statusCode).toBe(404);
  });

  it('un error real de base de datos (no P2025) se propaga, no se traga como 404', async () => {
    updateSave.mockRejectedValue(new Error('conexión perdida'));
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/name', payload: { saveName: 'X' } });

    expect(res.statusCode).toBe(500);
  });
});
