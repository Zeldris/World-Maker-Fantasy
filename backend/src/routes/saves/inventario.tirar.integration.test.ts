import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { inventarioRoutes } from './inventario.js';

/// Cobertura nueva (2026-09-06, hallazgo 8 de la sesión de pruebas: "Recoger vs Recolectar
/// mezclados" — segunda mitad, la mecánica de "tirar" que faltaba). Mismo patrón que
/// entrega.integration.test.ts: app aislado solo con `inventarioRoutes`, Postgres real.
async function buildApp() {
  const app = Fastify();
  await app.register(inventarioRoutes);
  return app;
}

describe('POST /saves/:id/inventario/:itemId/tirar', () => {
  let saveId: string;
  let hondonadaId: string;
  let itemId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    hondonadaId = hondonada.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (tirar)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
        zonaPosX: 250,
        zonaPosY: 300,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });

    const item = await prisma.inventoryItem.create({
      data: { saveId, name: 'Cuchillo de hielo sílice', description: 'x', origin: 'inicial' },
    });
    itemId = item.id;
  });

  afterAll(async () => {
    await prisma.droppedItem.deleteMany({ where: { saveId } });
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('tira un objeto: crea DroppedItem en la posición del jugador, borra el InventoryItem, narra un LogEntry determinista', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/inventario/${itemId}/tirar` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ itemName: 'Cuchillo de hielo sílice' });
    expect(body.logEntry.text).toContain('Cuchillo de hielo sílice');

    const remaining = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    expect(remaining).toBeNull();

    const dropped = await prisma.droppedItem.findFirstOrThrow({ where: { saveId } });
    expect(dropped).toMatchObject({ locationId: hondonadaId, x: 250, y: 300, name: 'Cuchillo de hielo sílice' });
  });

  it('tirar un objeto equipado: 400', async () => {
    const equipped = await prisma.inventoryItem.create({
      data: { saveId, name: 'Hacha equipada', description: 'x', origin: 'inicial', slot: 'ARMA_PRINCIPAL' },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/inventario/${equipped.id}/tirar` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Desequípalo');
  });

  it('tirar una captura en tránsito: 400', async () => {
    const npc = await prisma.npc.findFirstOrThrow({ where: { worldId: (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id, slug: 'aullador-rojo' } });
    const captura = await prisma.inventoryItem.create({
      data: { saveId, name: 'Aullador Rojo (atado)', description: 'x', origin: 'captura', capturaNpcId: npc.id, capturaScope: '' },
    });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/inventario/${captura.id}/tirar` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('captura');
  });

  it('tirar sin posición en el mapa todavía disponible: 400', async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(),
        worldId: world.id,
        characterName: 'Gorhorn de prueba (tirar, sin posición)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonadaId,
        // Sin zonaPosX/Y — partida creada antes de esa pieza.
      },
    });
    const item = await prisma.inventoryItem.create({ data: { saveId: save.id, name: 'Objeto suelto', description: 'x' } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${save.id}/inventario/${item.id}/tirar` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('posición');
    await prisma.inventoryItem.deleteMany({ where: { saveId: save.id } });
    await prisma.save.delete({ where: { id: save.id } });
  });
});

describe('POST /saves/:id/dropped-items/:droppedItemId/recoger', () => {
  let saveId: string;
  let otherSaveId: string;
  let hondonadaId: string;
  let pilaresId: string;
  let droppedId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const pilares = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'pilares-rotos' } });
    hondonadaId = hondonada.id;
    pilaresId = pilares.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (recoger)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
        zonaPosX: 250,
        zonaPosY: 300,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });

    const otherSave = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (recoger, otra ubicación)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: pilares.id,
        zonaPosX: 100,
        zonaPosY: 100,
      },
    });
    otherSaveId = otherSave.id;
    await prisma.worldState.create({ data: { saveId: otherSaveId } });

    const dropped = await prisma.droppedItem.create({
      data: { saveId, locationId: hondonadaId, x: 250, y: 300, name: 'Cuchillo de hielo sílice', description: 'x' },
    });
    droppedId = dropped.id;
  });

  afterAll(async () => {
    await prisma.droppedItem.deleteMany({ where: { saveId: { in: [saveId, otherSaveId] } } });
    await prisma.inventoryItem.deleteMany({ where: { saveId: { in: [saveId, otherSaveId] } } });
    await prisma.logEntry.deleteMany({ where: { saveId: { in: [saveId, otherSaveId] } } });
    await prisma.save.deleteMany({ where: { id: { in: [saveId, otherSaveId] } } });
  });

  it('recoger un DroppedItem de OTRA partida: 404 (nunca visible/recogible fuera de su propia save)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${otherSaveId}/dropped-items/${droppedId}/recoger` });
    expect(res.statusCode).toBe(404);
  });

  it('recoger desde OTRA Location de la MISMA partida: 400', async () => {
    // Jugador se ha movido de la Hondonada a Los Pilares Rotos sin recoger el objeto tirado allí.
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: pilaresId } });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/dropped-items/${droppedId}/recoger` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('mismo sitio');
    await prisma.save.update({ where: { id: saveId }, data: { currentLocationId: hondonadaId } });
  });

  it('recoger desde la misma Location: crea InventoryItem, borra el DroppedItem, narra un LogEntry', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/dropped-items/${droppedId}/recoger` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ itemName: 'Cuchillo de hielo sílice' });
    expect(body.logEntry.text).toContain('Cuchillo de hielo sílice');

    const stillDropped = await prisma.droppedItem.findUnique({ where: { id: droppedId } });
    expect(stillDropped).toBeNull();

    const created = await prisma.inventoryItem.findFirstOrThrow({ where: { saveId, name: 'Cuchillo de hielo sílice' } });
    expect(created.origin).toBe('recogido del suelo');
  });

  it('recoger algo que ya no existe: 404', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/dropped-items/${droppedId}/recoger` });
    expect(res.statusCode).toBe(404);
  });
});
