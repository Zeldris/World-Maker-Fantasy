import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (auditoría de deuda técnica 2026-08-03): esta ruta tuvo un bug real (auditoría
/// 2026-07-28, ver comentario en progression.ts) — un `attribute` inválido colaba `NaN` como clave
/// espuria en el JSON de atributos, gastando un punto de ascenso sin dar ningún beneficio. Se
/// arregló con `VALID_ATTRIBUTES.includes()` pero nunca tuvo un test que bloqueara una regresión.
const findUniqueSave = vi.fn();
const updateSave = vi.fn();
const loadSessionFacts = vi.fn();
const appendSessionFacts = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: {
      findUnique: (...args: unknown[]) => findUniqueSave(...args),
      update: (...args: unknown[]) => updateSave(...args),
    },
  },
}));

vi.mock('../../services/worldFacts.js', () => ({
  loadSessionFacts: (...args: unknown[]) => loadSessionFacts(...args),
  appendSessionFacts: (...args: unknown[]) => appendSessionFacts(...args),
}));

const { progressionRoutes } = await import('./progression.js');

async function buildApp() {
  const app = Fastify();
  await app.register(progressionRoutes);
  return app;
}

const BASE_ATTRIBUTES = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 };

describe('POST /saves/:id/attribute-points', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    updateSave.mockReset();
    loadSessionFacts.mockReset().mockResolvedValue([]);
    appendSessionFacts.mockReset().mockResolvedValue(undefined);
  });

  it('rechaza un atributo no válido en runtime, ANTES de tocar la base de datos (bug real: antes esto colaba NaN)', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/attribute-points',
      payload: { attribute: 'sigilo' },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/no válido/);
    expect(findUniqueSave).not.toHaveBeenCalled();
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('rechaza el campo attribute ausente o vacío igual que uno inválido', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/attribute-points', payload: {} });

    expect(res.statusCode).toBe(400);
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('reparte un punto pendiente en un atributo válido', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', pendingAttributePoints: 1, attributes: BASE_ATTRIBUTES });
    updateSave.mockResolvedValue({ attributes: { ...BASE_ATTRIBUTES, fuerza: 11 }, pendingAttributePoints: 0 });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/attribute-points', payload: { attribute: 'fuerza' } });

    expect(res.statusCode).toBe(200);
    expect(updateSave).toHaveBeenCalledWith({
      where: { id: 'save1' },
      data: { pendingAttributePoints: { decrement: 1 }, attributes: { ...BASE_ATTRIBUTES, fuerza: 11 } },
    });
    expect(JSON.parse(res.body)).toEqual({ attributes: { ...BASE_ATTRIBUTES, fuerza: 11 }, pendingAttributePoints: 0 });
  });

  it('rechaza si no quedan puntos pendientes', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', pendingAttributePoints: 0, attributes: BASE_ATTRIBUTES });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/attribute-points', payload: { attribute: 'fuerza' } });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/No quedan puntos/);
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('rechaza si el atributo ya está en el máximo (18)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', pendingAttributePoints: 1, attributes: { ...BASE_ATTRIBUTES, fuerza: 18 } });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/attribute-points', payload: { attribute: 'fuerza' } });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/ya está en el máximo/);
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/attribute-points', payload: { attribute: 'fuerza' } });

    expect(res.statusCode).toBe(404);
  });
});

describe('POST /saves/:id/profesion', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    updateSave.mockReset();
    loadSessionFacts.mockReset().mockResolvedValue([]);
    appendSessionFacts.mockReset().mockResolvedValue(undefined);
  });

  it('rechaza profession vacía o ausente', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/profesion', payload: { profession: '   ' } });

    expect(res.statusCode).toBe(400);
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('guarda la profesión y añade un hecho de sesión', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', characterName: 'Gorhorn' });
    updateSave.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/profesion', payload: { profession: 'herrero' } });

    expect(res.statusCode).toBe(200);
    expect(updateSave).toHaveBeenCalledWith({ where: { id: 'save1' }, data: { profession: 'herrero' } });
    expect(appendSessionFacts).toHaveBeenCalledWith('save1', [], ['Gorhorn ejerce como herrero.']);
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/profesion', payload: { profession: 'herrero' } });

    expect(res.statusCode).toBe(404);
    expect(updateSave).not.toHaveBeenCalled();
  });
});
