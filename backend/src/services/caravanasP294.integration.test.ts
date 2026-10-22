import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { asegurarMundoDePartida } from './mundoPartida.js';
import { avanzarComercio } from './caravanas.js';
import { ownerKeyFor } from './reinoOwner.js';

/// P294: «Comprar Cuerdas si baja de 20 · 5 por viaje · con Clan Serhu» con 10 en el Almacén.
describe('P294 — orden permanente con un socio concreto', () => {
  let saveId: string;
  let serhuId: string;

  beforeAll(async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (P294)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 }, portraitInitial: 'G',
        currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 600 } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
    const reinoId = (await prisma.faction.create({ data: { worldId, saveId, slug: 'reino-p294', name: 'Reino P294', raza: 'orcos', description: 'x' } })).id;
    await prisma.kingdomStats.create({ data: { saveId, riqueza: 202, ownerKey: ownerKeyFor({ saveId }) } });
    await prisma.building.create({ data: { saveId, locationId: lugar.id, recipeKey: 'mercado', name: 'un mercado', kind: 'mercado', status: 'ACTIVO', description: 'x' } });
    const serhu = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-serhu' } });
    serhuId = serhu.id;
    await prisma.factionRelation.create({ data: { worldId, saveId, sourceFactionId: reinoId, targetFactionId: serhuId, type: 'TRATADO_COMERCIAL' } });
    const item = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, slug: 'cuerdas' } });
    await prisma.almacenItem.createMany({ data: Array.from({ length: 10 }, () => ({ saveId, name: item.name, description: item.description, catalogSlug: 'cuerdas' })) });
    await prisma.ordenComercio.create({ data: { saveId, catalogSlug: 'cuerdas', tipo: 'COMPRA', umbral: 20, lote: 5, factionSlug: 'clan-serhu' } });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('si el socio no tiene género, la orden lo dice en el diario (una vez por semana) en vez de quedarse muda', async () => {
    expect((await avanzarComercio(prisma, saveId, 1)).salen).toBe(0);
    await avanzarComercio(prisma, saveId, 2);
    const avisos = await prisma.logEntry.findMany({ where: { saveId, channel: 'KINGDOM', text: { contains: 'La orden de comprar Cuerdas no sale' } } });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]!.text).toContain('Cuerdas');
  });

  it('con género en el almacén del socio elegido sale la caravana', async () => {
    const item = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId: (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).worldId, slug: 'cuerdas' } });
    await prisma.almacenItem.createMany({ data: Array.from({ length: 12 }, () => ({ factionId: serhuId, name: item.name, description: item.description, catalogSlug: 'cuerdas' })) });
    expect((await avanzarComercio(prisma, saveId, 3)).salen).toBe(1);
  });
});
