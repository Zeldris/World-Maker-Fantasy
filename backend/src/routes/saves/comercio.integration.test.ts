import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../../services/mundoPartida.js';
import { comercioRoutes } from './comercio.js';
import { expedicionesVisibles } from '../../services/expedicionesMapa.js';

/// CR-47 (47d): órdenes del Mercado del Reino y sus caravanas en el mapa.
describe('CR-47 — Mercado del Reino', () => {
  let saveId: string;
  let worldId: string;
  let lugarId: string;
  const app = Fastify();

  beforeAll(async () => {
    await app.register(comercioRoutes);
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    lugarId = (await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } })).id;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (mercado)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 }, portraitInitial: 'G',
        currentLocationId: lugarId, worldState: { create: { fictionalMinutes: 600 } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
    await prisma.faction.create({ data: { worldId, saveId, slug: 'reino-mercado', name: 'Reino del Mercado', raza: 'orcos', description: 'x' } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
    await app.close();
  });

  it('sin Mercado no se pueden dejar órdenes', async () => {
    const item = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, valorGoirnos: { gt: 0 }, tipo: 'RECURSO' }, select: { slug: true } });
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/reino/comercio/ordenes`, payload: { catalogSlug: item.slug, tipo: 'COMPRA', umbral: 10, lote: 5 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Mercado');
  });

  it('con Mercado: crea, lista y borra órdenes; valida los números', async () => {
    await prisma.building.create({ data: { saveId, locationId: lugarId, recipeKey: 'mercado', name: 'un mercado', kind: 'mercado', status: 'ACTIVO', description: 'x' } });
    const item = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, valorGoirnos: { gt: 0 }, tipo: 'RECURSO' }, select: { slug: true, name: true } });
    expect((await app.inject({ method: 'POST', url: `/saves/${saveId}/reino/comercio/ordenes`, payload: { catalogSlug: item.slug, tipo: 'COMPRA', umbral: 10, lote: 0 } })).statusCode).toBe(400);
    const creada = await app.inject({ method: 'POST', url: `/saves/${saveId}/reino/comercio/ordenes`, payload: { catalogSlug: item.slug, tipo: 'VENTA', umbral: 30, lote: 5 } });
    expect(creada.statusCode).toBe(200);
    const lista = (await app.inject({ method: 'GET', url: `/saves/${saveId}/reino/comercio` })).json();
    expect(lista).toMatchObject({ reino: true, mercado: true });
    expect(lista.ordenes).toEqual([expect.objectContaining({ catalogSlug: item.slug, tipo: 'VENTA', umbral: 30, lote: 5, nombre: item.name })]);
    expect((await app.inject({ method: 'DELETE', url: `/saves/${saveId}/reino/comercio/ordenes/${creada.json().orden.id}` })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/saves/${saveId}/reino/comercio` })).json().ordenes).toEqual([]);
  });

  it('las caravanas en camino salen en el mapa como del Reino', async () => {
    const helsig = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-helsig' } });
    const destino = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'campamento-helsig' } });
    const c = await prisma.caravana.create({ data: { saveId, factionId: helsig.id, destinoLocationId: destino.id, tipo: 'COMPRA', catalogSlug: 'x', unidades: 3, diaSalida: 0, diaLlegada: 1, diaRegreso: 2 } });
    const vistas = await expedicionesVisibles(prisma, saveId);
    expect(vistas.find((v) => v.id === c.id)).toMatchObject({ delReino: true, origenSlug: 'hondonada-del-eco', destinoSlug: 'campamento-helsig', oficio: 'caravana de compra' });
  });
});
