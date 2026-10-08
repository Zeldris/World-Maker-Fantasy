import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';

/// Cobertura nueva (2026-09-06, "nombrar las partidas con nombres custom") — `PATCH /saves/:id/name`
/// es el único endpoint de escritura nuevo de este archivo; `GET /saves` y `DELETE /saves/:id` ya
/// se ejercitan en integración (`saves.test.ts` cubre el resto de `saves.ts`).
const updateSave = vi.fn();
const deleteSave = vi.fn();
const findManySave = vi.fn();
const findUniqueWs = vi.fn();
const updateManyWs = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: {
      update: (...args: unknown[]) => updateSave(...args),
      delete: (...args: unknown[]) => deleteSave(...args),
      findMany: (...args: unknown[]) => findManySave(...args),
    },
    worldState: {
      findUnique: (...args: unknown[]) => findUniqueWs(...args),
      updateMany: (...args: unknown[]) => updateManyWs(...args),
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

// CR-12 (hito 0.2) — «Ritmo del mundo» de la partida.
describe('GET/PATCH /saves/:id/ritmo', () => {
  beforeEach(() => {
    findUniqueWs.mockReset();
    updateManyWs.mockReset();
  });

  it('devuelve el ritmo guardado (y Equilibrado si es un valor antiguo desconocido)', async () => {
    const app = await buildApp();
    findUniqueWs.mockResolvedValueOnce({ estiloNarrador: 'CAOTICO' }).mockResolvedValueOnce({ estiloNarrador: 'RARO' }).mockResolvedValueOnce(null);
    expect((await app.inject({ method: 'GET', url: '/saves/s1/ritmo' })).json()).toEqual({ estiloNarrador: 'CAOTICO', intensidadAsaltos: 'NORMAL', tamanoAsaltos: 'NORMAL' });
    expect((await app.inject({ method: 'GET', url: '/saves/s1/ritmo' })).json()).toEqual({ estiloNarrador: 'EQUILIBRADO', intensidadAsaltos: 'NORMAL', tamanoAsaltos: 'NORMAL' });
    expect((await app.inject({ method: 'GET', url: '/saves/s1/ritmo' })).statusCode).toBe(404);
  });

  it('cambia el ritmo y rechaza valores que no existen', async () => {
    const app = await buildApp();
    updateManyWs.mockResolvedValue({ count: 1 });
    const ok = await app.inject({ method: 'PATCH', url: '/saves/s1/ritmo', payload: { estiloNarrador: 'TRANQUILO' } });
    expect(ok.statusCode).toBe(200);
    expect(updateManyWs).toHaveBeenCalledWith({ where: { saveId: 's1' }, data: { estiloNarrador: 'TRANQUILO' } });

    const mal = await app.inject({ method: 'PATCH', url: '/saves/s1/ritmo', payload: { estiloNarrador: 'FRENETICO' } });
    expect(mal.statusCode).toBe(400);
    updateManyWs.mockResolvedValue({ count: 0 });
    expect((await app.inject({ method: 'PATCH', url: '/saves/nope/ritmo', payload: { estiloNarrador: 'CAOTICO' } })).statusCode).toBe(404);
  });

  it('CR-67: intensidad y tamaño de los asaltos (sin opción de quitarlos)', async () => {
    const app = await buildApp();
    updateManyWs.mockResolvedValue({ count: 1 });
    const ok = await app.inject({ method: 'PATCH', url: '/saves/s1/ritmo', payload: { intensidadAsaltos: 'DURA', tamanoAsaltos: 'FACIL' } });
    expect(ok.json()).toEqual({ intensidadAsaltos: 'DURA', tamanoAsaltos: 'FACIL' });
    expect(updateManyWs).toHaveBeenCalledWith({ where: { saveId: 's1' }, data: { intensidadAsaltos: 'DURA', tamanoAsaltos: 'FACIL' } });
    expect((await app.inject({ method: 'PATCH', url: '/saves/s1/ritmo', payload: { intensidadAsaltos: 'NINGUNA' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: '/saves/s1/ritmo', payload: {} })).statusCode).toBe(400);
  });
});
