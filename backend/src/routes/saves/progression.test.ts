import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (auditoría de deuda técnica 2026-08-03): esta ruta tuvo un bug real (auditoría
/// 2026-07-28, ver comentario en progression.ts) — un `attribute` inválido colaba `NaN` como clave
/// espuria en el JSON de atributos, gastando un punto de ascenso sin dar ningún beneficio. Se
/// arregló con `VALID_ATTRIBUTES.includes()` pero nunca tuvo un test que bloqueara una regresión.
const findUniqueSave = vi.fn();
const updateSave = vi.fn();
const queryRawSave = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: {
      findUnique: (...args: unknown[]) => findUniqueSave(...args),
      update: (...args: unknown[]) => updateSave(...args),
    },
    // Bloqueo de fila real (auditoría 2026-08-06, ver comentario en progression.ts) — la ruta
    // ahora hace `SELECT ... FOR UPDATE` + `update` dentro de una transacción; el mock simula el
    // callback recibiendo un `tx` con las mismas dos operaciones.
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: (...args: unknown[]) => queryRawSave(...args),
        save: { update: (...args: unknown[]) => updateSave(...args) },
      }),
  },
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
    queryRawSave.mockReset();
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
    findUniqueSave.mockResolvedValue({ id: 'save1' });
    queryRawSave.mockResolvedValue([{ pendingAttributePoints: 1, attributes: BASE_ATTRIBUTES }]);
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

  it('rechaza si no quedan puntos pendientes (comprobado sobre la fila bloqueada, no sobre la lectura inicial)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1' });
    queryRawSave.mockResolvedValue([{ pendingAttributePoints: 0, attributes: BASE_ATTRIBUTES }]);
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/attribute-points', payload: { attribute: 'fuerza' } });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/No quedan puntos/);
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('rechaza si el atributo ya está en el máximo (18)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1' });
    queryRawSave.mockResolvedValue([{ pendingAttributePoints: 1, attributes: { ...BASE_ATTRIBUTES, fuerza: 18 } }]);
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/attribute-points', payload: { attribute: 'fuerza' } });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/ya está en el máximo/);
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('dos peticiones simultáneas para el mismo atributo no pierden ningún punto (regresión de la condición de carrera, auditoría 2026-08-06)', async () => {
    // Simula lo que SELECT...FOR UPDATE garantiza de verdad en Postgres: la segunda transacción
    // no ve el `attributes`/`pendingAttributePoints` de partida, ve ya lo que dejó la primera.
    findUniqueSave.mockResolvedValue({ id: 'save1' });
    let pendingAttributePoints = 2;
    let attributes = BASE_ATTRIBUTES;
    queryRawSave.mockImplementation(() => Promise.resolve([{ pendingAttributePoints, attributes }]));
    updateSave.mockImplementation(({ data }: { data: { attributes: typeof BASE_ATTRIBUTES } }) => {
      pendingAttributePoints -= 1;
      attributes = data.attributes;
      return Promise.resolve({ attributes, pendingAttributePoints });
    });
    const app = await buildApp();

    const [res1, res2] = await Promise.all([
      app.inject({ method: 'POST', url: '/saves/save1/attribute-points', payload: { attribute: 'fuerza' } }),
      app.inject({ method: 'POST', url: '/saves/save1/attribute-points', payload: { attribute: 'fuerza' } }),
    ]);

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    expect(pendingAttributePoints).toBe(0);
    expect(attributes.fuerza).toBe(12);
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/attribute-points', payload: { attribute: 'fuerza' } });

    expect(res.statusCode).toBe(404);
  });
});
