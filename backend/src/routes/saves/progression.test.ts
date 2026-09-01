import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (auditoría de deuda técnica 2026-08-03): esta ruta tuvo un bug real (auditoría
/// 2026-07-28, ver comentario en progression.ts) — un `attribute` inválido colaba `NaN` como clave
/// espuria en el JSON de atributos, gastando un punto de ascenso sin dar ningún beneficio. Se
/// arregló con `VALID_ATTRIBUTES.includes()` pero nunca tuvo un test que bloqueara una regresión.
const findUniqueSave = vi.fn();
const updateSave = vi.fn();
const queryRawSave = vi.fn();
const createManySavedAction = vi.fn();
const createLogEntry = vi.fn();
const findManySavedAction = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: {
      findUnique: (...args: unknown[]) => findUniqueSave(...args),
      update: (...args: unknown[]) => updateSave(...args),
    },
    savedAction: {
      createMany: (...args: unknown[]) => createManySavedAction(...args),
      findMany: (...args: unknown[]) => findManySavedAction(...args),
    },
    logEntry: { create: (...args: unknown[]) => createLogEntry(...args) },
    // Dos formas reales de `$transaction` en este archivo (progression.ts): la de
    // `attribute-points` pasa un callback (`SELECT ... FOR UPDATE` + `update`, auditoría
    // 2026-08-06); la de `PATCH /clase` (2026-08-29) pasa un ARRAY de operaciones (mismo patrón
    // que otras rutas deterministas del proyecto, ej. companeros.ts) — el mock distingue por el
    // tipo del primer argumento y ejecuta cada rama de forma equivalente a Prisma real.
    $transaction: (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => unknown)({
          $queryRaw: (...args: unknown[]) => queryRawSave(...args),
          save: { update: (...args: unknown[]) => updateSave(...args) },
        });
      }
      return Promise.all(arg as Promise<unknown>[]);
    },
  },
}));

const { progressionRoutes } = await import('./progression.js');
const { classAbilityUnlocksFor } = await import('../../services/classAbilities.js');

async function buildApp() {
  const app = Fastify();
  await app.register(progressionRoutes);
  return app;
}

const BASE_ATTRIBUTES = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

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

  // Bug real (auditoría de bugs, 2026-08-21 + decisión explícita al cerrar la ronda de preguntas
  // abiertas): esta ruta nunca comprobaba `save.endedAt` — con la partida ya terminada por muerte
  // definitiva, seguía dejando repartir puntos de atributo.
  it('409 si la partida ya ha terminado (endedAt)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', endedAt: new Date('2026-08-21T12:00:00Z') });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/attribute-points', payload: { attribute: 'fuerza' } });

    expect(res.statusCode).toBe(409);
    expect(queryRawSave).not.toHaveBeenCalled();
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/attribute-points', payload: { attribute: 'fuerza' } });

    expect(res.statusCode).toBe(404);
  });
});

// Cierre del hueco "Save.clase sin ningún flujo de asignación" (2026-08-29, checklist de pruebas
// § 9): confirmado con datos reales que una partida podía llegar a nivel 3 con `clase: NULL` en
// Postgres, sin ningún endpoint para fijarla salvo un UPDATE manual — `weaponPoolFor`/`esDomador`
// se quedaban inertes en silencio, y `classAbilityUnlocksFor` ni siquiera leía la columna.
describe('PATCH /saves/:id/clase', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    updateSave.mockReset();
    createManySavedAction.mockReset();
    createLogEntry.mockReset();
    findManySavedAction.mockReset();
    findManySavedAction.mockResolvedValue([]);
  });

  it('rechaza una clase que no existe en el enum', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/clase', payload: { clase: 'PALADIN' } });

    expect(res.statusCode).toBe(400);
    expect(findUniqueSave).not.toHaveBeenCalled();
  });

  it('rechaza el campo clase ausente', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/clase', payload: {} });

    expect(res.statusCode).toBe(400);
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/clase', payload: { clase: 'GUERRERO' } });

    expect(res.statusCode).toBe(404);
  });

  it('409 si la partida ya ha terminado (endedAt)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', endedAt: new Date('2026-08-21T12:00:00Z'), clase: null });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/clase', payload: { clase: 'GUERRERO' } });

    expect(res.statusCode).toBe(409);
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('409 si la partida ya tiene una clase asignada — no es un respec libre', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', endedAt: null, clase: 'CAZADOR', level: 3, characterName: 'Gorhorn' });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/clase', payload: { clase: 'GUERRERO' } });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toMatch(/ya tiene clase asignada/);
    expect(updateSave).not.toHaveBeenCalled();
  });

  it('fija la clase y concede el tronco común ya alcanzado por el nivel actual, no solo nivel 1', async () => {
    // Nivel 3: Guerrero solo tiene desbloqueo de tronco en nivel 1 (Golpe Poderoso o equivalente,
    // ver classAbilities.ts) — igual se ejercita el bucle `1..level`, no solo `level 1` fijo.
    findUniqueSave.mockResolvedValue({ id: 'save1', endedAt: null, clase: null, level: 3, characterName: 'Sael Vhorn', worldState: null });
    updateSave.mockResolvedValue({ clase: 'GUERRERO' });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/clase', payload: { clase: 'GUERRERO' } });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ clase: 'GUERRERO' });
    expect(updateSave).toHaveBeenCalledWith({ where: { id: 'save1' }, data: { clase: 'GUERRERO' } });
    expect(createManySavedAction).toHaveBeenCalled();
    const grantedNames = (createManySavedAction.mock.calls[0][0].data as { name: string }[]).map((a) => a.name);
    expect(grantedNames.length).toBeGreaterThan(0);
    expect(createLogEntry).toHaveBeenCalled();
  });

  it('el bucle de desbloqueo cubre 1..level entero, no solo el nivel actual (nivel 2 ya incluye el hueco real de nivel 1)', () => {
    // Cazador tiene su único hueco de tronco bajo en nivel 1 (Analisis Salvaje) — a nivel 2 el
    // bucle `1..level` de progression.ts debe seguir concediéndolo (test de arriba ya confirma el
    // caso nivel 3/Guerrero; este fija el caso límite nivel 2, un solo nivel por encima de 1).
    const desde1hasta2 = Array.from({ length: 2 }, (_, i) => i + 1).flatMap((lvl) => classAbilityUnlocksFor('Sael Vhorn', lvl, 'CAZADOR'));
    expect(desde1hasta2.map((a) => a.name)).toEqual(['Analisis Salvaje']);
  });

  // Bug real encontrado ANTES de reproducirse en la partida real de la usuaria (2026-08-29): una
  // partida creada antes de este fix ya tenía "Analisis Salvaje" concedida por el fallback de
  // `characterName` dentro de `classAbilityUnlocksFor` — sin este guard, fijar la clase la
  // duplicaría en `SavedAction`.
  it('no duplica una habilidad de tronco que la partida ya tenía por el camino viejo (fallback por characterName)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', endedAt: null, clase: null, level: 3, characterName: 'Gorhorn', worldState: null });
    findManySavedAction.mockResolvedValue([{ name: 'Analisis Salvaje' }]);
    updateSave.mockResolvedValue({ clase: 'CAZADOR' });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/clase', payload: { clase: 'CAZADOR' } });

    expect(res.statusCode).toBe(200);
    // Gorhorn/Cazador a nivel 3 solo tiene el hueco de nivel 1 (Analisis Salvaje) — ya la tenía,
    // así que no queda ninguna habilidad nueva por conceder.
    expect(createManySavedAction).not.toHaveBeenCalled();
  });
});
