import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { companerosRoutes } from './companeros.js';
import { depositarEnAlmacen } from '../../services/cronista/almacenDeposito.js';
import { BASE_ALMACEN } from '../../services/cronista/economiaReino.js';
import { ownerKeyFor } from '../../services/reinoOwner.js';

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

  it('revisión C1: dos depósitos a la vez del mismo objeto → uno entra y el otro es 404, sin error', async () => {
    const it1 = await prisma.inventoryItem.create({ data: { saveId, name: 'Carrera', description: 'x', catalogSlug: null } });
    const [a, b] = await Promise.all([depositarEnAlmacen(prisma, saveId, it1.id), depositarEnAlmacen(prisma, saveId, it1.id)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const fallo = [a, b].find((x) => !x.ok);
    expect(fallo).toMatchObject({ ok: false, status: 404 });
    expect(await prisma.almacenItem.count({ where: { saveId, name: 'Carrera' } })).toBe(1);
  });

  it('partida inexistente → 404', async () => {
    const app = Fastify();
    await app.register(companerosRoutes);
    const res = await app.inject({ method: 'POST', url: '/saves/no-existe/almacen/depositar-todo' });
    expect(res.statusCode).toBe(404);
  });

  // Revisión C1 (leve 5) y P438: lo que no cabe se queda en la mochila y se dice por qué (materiales y Granero, sin repetir).
  it('con el Almacén lleno de materiales y el Granero casi lleno: deposita lo que cabe y dice los dos motivos', async () => {
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
    await prisma.almacenItem.deleteMany({ where: { saveId } });
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const material = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId: world.id, tipo: 'RECURSO' } });
    const racion = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId: world.id, slug: 'racion-viaje' } });
    const porRacion = Math.max(1, Math.floor(racion.curaHambre! / 10));
    // Granero (base, sin edificios): cabe justo una ración contando el forraje, que comparte el hueco (Q7).
    await prisma.kingdomStats.upsert({
      where: { ownerKey: ownerKeyFor({ saveId }) },
      create: { ownerKey: ownerKeyFor({ saveId }), saveId, comida: BASE_ALMACEN.comida - 1 - porRacion, forraje: 1 },
      update: { comida: BASE_ALMACEN.comida - 1 - porRacion, forraje: 1 },
    });
    await prisma.almacenItem.createMany({ data: Array.from({ length: BASE_ALMACEN.materiales }, () => ({ saveId, name: material.name, description: 'x', catalogSlug: material.slug })) });
    await prisma.inventoryItem.createMany({
      data: [
        { saveId, name: material.name, description: 'x', catalogSlug: material.slug },
        { saveId, name: material.name, description: 'x', catalogSlug: material.slug },
        { saveId, name: 'Ración de viaje', description: 'x', catalogSlug: 'racion-viaje' },
        { saveId, name: 'Ración de viaje', description: 'x', catalogSlug: 'racion-viaje' },
      ],
    });
    const app = Fastify();
    await app.register(companerosRoutes);
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/almacen/depositar-todo` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ ok: true, depositados: 1, noCaben: 3, comidaSumada: porRacion });
    expect(body.motivoNoCaben).toBe(
      `No caben más materiales en el Almacén (${BASE_ALMACEN.materiales}/${BASE_ALMACEN.materiales}): construye una Leñera. ` +
        `El Granero está lleno (${BASE_ALMACEN.comida}/${BASE_ALMACEN.comida}, la comida y el forraje comparten su hueco): la comida se queda en la mochila.`,
    );
    // P438: la comida no pasa del tope y la ración que no cabe sigue en la mochila, con los dos materiales.
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { ownerKey: ownerKeyFor({ saveId }) } })).comida).toBe(BASE_ALMACEN.comida - 1);
    expect(await prisma.inventoryItem.count({ where: { saveId, catalogSlug: 'racion-viaje' } })).toBe(1);
    expect(await prisma.inventoryItem.count({ where: { saveId, catalogSlug: material.slug } })).toBe(2);
  });
});
