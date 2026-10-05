import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { asegurarMundoDePartida } from './mundoPartida.js';
import { avanzarComercio } from './caravanas.js';
import { ownerKeyFor } from './reinoOwner.js';

/// CR-47 (47b): una orden permanente saca una caravana que compra a una facción con tratado y vuelve.
describe('CR-47 — caravanas del Reino', () => {
  let saveId: string;
  let worldId: string;
  let helsigId: string;
  let reinoId: string;
  let catalogSlug: string;

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (caravanas)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 }, portraitInitial: 'G',
        currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 600 } },
      },
    })).id;
    await asegurarMundoDePartida(prisma, saveId);
    reinoId = (await prisma.faction.create({ data: { worldId, saveId, slug: 'reino-caravanas', name: 'Reino de las Caravanas', raza: 'orcos', description: 'x' } })).id;
    await prisma.kingdomStats.create({ data: { saveId, riqueza: 1000, ownerKey: ownerKeyFor({ saveId }) } });
    await prisma.building.create({ data: { saveId, locationId: lugar.id, recipeKey: 'mercado', name: 'un mercado', kind: 'mercado', status: 'ACTIVO', description: 'x' } });
    const helsig = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'clan-helsig' } });
    helsigId = helsig.id;
    await prisma.factionRelation.create({ data: { worldId, saveId, sourceFactionId: reinoId, targetFactionId: helsigId, type: 'TRATADO_COMERCIAL' } });
    const item = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, valorGoirnos: { gt: 0 }, tipo: 'RECURSO' }, select: { slug: true, name: true, description: true } });
    catalogSlug = item.slug;
    await prisma.almacenItem.deleteMany({ where: { factionId: helsigId, catalogSlug } });
    await prisma.almacenItem.createMany({ data: Array.from({ length: 12 }, () => ({ factionId: helsigId, name: item.name, description: item.description, catalogSlug })) });
    await prisma.ordenComercio.create({ data: { saveId, catalogSlug, tipo: 'COMPRA', umbral: 5, lote: 5 } });
  });

  afterAll(async () => {
    await prisma.almacenItem.deleteMany({ where: { factionId: helsigId, catalogSlug } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sale con la riqueza, compra unidad a unidad al llegar y deja lo comprado en el Reino al volver', async () => {
    expect(await avanzarComercio(prisma, saveId, 1)).toMatchObject({ salen: 1 });
    const caravana = await prisma.caravana.findFirstOrThrow({ where: { saveId } });
    expect(caravana).toMatchObject({ tipo: 'COMPRA', unidades: 5, factionId: helsigId, status: 'EN_CAMINO' });
    const llevada = caravana.riqueza;
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { saveId } })).riqueza).toBe(1000 - llevada);
    // Mientras va de camino no sale otra para la misma orden.
    expect((await avanzarComercio(prisma, saveId, 1)).salen).toBe(0);

    await avanzarComercio(prisma, saveId, caravana.diaLlegada);
    expect(await prisma.almacenItem.count({ where: { factionId: helsigId, catalogSlug } })).toBe(7);
    expect((await prisma.caravana.findUniqueOrThrow({ where: { id: caravana.id } })).status).toBe('VOLVIENDO');

    await avanzarComercio(prisma, saveId, caravana.diaRegreso);
    expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug } })).toBe(5);
    expect((await prisma.caravana.findUniqueOrThrow({ where: { id: caravana.id } })).status).toBe('TERMINADA');
    expect(await prisma.logEntry.count({ where: { saveId, channel: 'KINGDOM', text: { contains: 'caravana' } } })).toBeGreaterThanOrEqual(2);
  });

  it('vender: se lleva lo que sobra, la facción paga lo que puede y la riqueza llega al volver', async () => {
    await prisma.ordenComercio.updateMany({ where: { saveId }, data: { activa: false } });
    // Al Reino le sobran: tiene 5 (de la compra) + 5 = 10; vende por encima de 4.
    const item = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, slug: catalogSlug }, select: { name: true, description: true } });
    await prisma.almacenItem.createMany({ data: Array.from({ length: 5 }, () => ({ saveId, name: item.name, description: item.description, catalogSlug })) });
    await prisma.kingdomStats.update({ where: { factionId: helsigId }, data: { riqueza: 10_000 } });
    await prisma.ordenComercio.create({ data: { saveId, catalogSlug, tipo: 'VENTA', umbral: 4, lote: 10 } });
    const riquezaAntes = (await prisma.kingdomStats.findUniqueOrThrow({ where: { saveId } })).riqueza;

    expect((await avanzarComercio(prisma, saveId, 20)).salen).toBe(1);
    const c = await prisma.caravana.findFirstOrThrow({ where: { saveId, tipo: 'VENTA' } });
    expect(c.unidades).toBe(6);
    expect(await prisma.almacenItem.count({ where: { saveId, catalogSlug } })).toBe(4);
    await avanzarComercio(prisma, saveId, c.diaLlegada);
    await avanzarComercio(prisma, saveId, c.diaRegreso);
    const final = await prisma.caravana.findUniqueOrThrow({ where: { id: c.id } });
    expect(final.status).toBe('TERMINADA');
    expect(final.riqueza).toBeGreaterThan(0);
    expect((await prisma.kingdomStats.findUniqueOrThrow({ where: { saveId } })).riqueza).toBe(riquezaAntes + final.riqueza);
  });
});
