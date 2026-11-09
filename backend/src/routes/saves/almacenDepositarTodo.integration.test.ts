import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { companerosRoutes } from './companeros.js';

/// P428: Reino › Almacén › «Depositar todo» — una sola petición mueve toda la mochila suelta al Almacén.
describe('POST /saves/:id/almacen/depositar-todo (P428)', () => {
  let saveId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    saveId = (
      await prisma.save.create({
        data: {
          userId,
          worldId: world.id,
          characterName: 'Depositaria de prueba (P428)',
          characterArchetype: 'guerrero',
          characterOrigin: 'Clan Serhu',
          characterMotivation: 'x',
          attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
          portraitInitial: 'D',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('deposita todo lo suelto de una vez y deja lo equipado', async () => {
    await prisma.inventoryItem.createMany({
      data: [
        ...Array.from({ length: 12 }, (_, i) => ({ saveId, name: `Cosa ${i}`, description: 'x', catalogSlug: null })),
        { saveId, name: 'Espada equipada', description: 'x', catalogSlug: null, slot: 'ARMA_PRINCIPAL' as const },
      ],
    });
    const app = Fastify();
    await app.register(companerosRoutes);
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/almacen/depositar-todo` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, depositados: 12, noCaben: 0 });
    expect(await prisma.almacenItem.count({ where: { saveId } })).toBe(12);
    expect(await prisma.inventoryItem.findMany({ where: { saveId }, select: { name: true } })).toEqual([{ name: 'Espada equipada' }]);
  });

  it('partida inexistente → 404', async () => {
    const app = Fastify();
    await app.register(companerosRoutes);
    const res = await app.inject({ method: 'POST', url: '/saves/no-existe/almacen/depositar-todo' });
    expect(res.statusCode).toBe(404);
  });
});
