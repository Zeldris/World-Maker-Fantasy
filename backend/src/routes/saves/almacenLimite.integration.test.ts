import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { almacenLimiteRoutes } from './almacenLimite.js';

/// CRUD de AlmacenLimite (hueco C, rediseño de Producción estilo Bellwright, 2026-09-21,
/// docs/rpgtarkor/mundo-vivo-x4.md § 4.4-ter). Test de integración real contra Postgres, sin
/// mocks — mismo patrón que parcelas.integration.test.ts.
async function buildApp() {
  const app = Fastify();
  await app.register(almacenLimiteRoutes);
  return app;
}

describe('CRUD de AlmacenLimite (2026-09-21)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (almacen-limites)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.almacenLimite.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('GET devuelve [] cuando no hay ningún límite fijado todavía', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/almacen-limites` });
    expect(res.statusCode).toBe(200);
    expect(res.json().limites).toEqual([]);
  });

  it('POST crea un límite real (upsert), GET lo lista después', async () => {
    const app = await buildApp();
    const created = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/almacen-limites`,
      payload: { catalogSlug: 'racion-carne', limite: 20 },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({ catalogSlug: 'racion-carne', limite: 20 });

    const list = await app.inject({ method: 'GET', url: `/saves/${saveId}/almacen-limites` });
    expect(list.json().limites).toEqual([{ catalogSlug: 'racion-carne', limite: 20 }]);
  });

  it('POST con el mismo catalogSlug hace upsert (actualiza en vez de duplicar)', async () => {
    const app = await buildApp();
    await app.inject({ method: 'POST', url: `/saves/${saveId}/almacen-limites`, payload: { catalogSlug: 'racion-carne', limite: 5 } });

    const list = await app.inject({ method: 'GET', url: `/saves/${saveId}/almacen-limites` });
    const filas = list.json().limites.filter((l: { catalogSlug: string }) => l.catalogSlug === 'racion-carne');
    expect(filas).toHaveLength(1);
    expect(filas[0].limite).toBe(5);
  });

  it('limite: null vuelve a "sin tope" (infinito), decisión explícita de Álvaro como default', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/almacen-limites`,
      payload: { catalogSlug: 'racion-carne', limite: null },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().limite).toBeNull();
  });

  it('rechaza un límite negativo', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/almacen-limites`,
      payload: { catalogSlug: 'racion-carne', limite: -1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404 si la partida no existe', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/no-existe/almacen-limites' });
    expect(res.statusCode).toBe(404);
  });
});
