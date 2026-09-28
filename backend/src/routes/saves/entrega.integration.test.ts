import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { entregaRoutes } from './entrega.js';

/// Cobertura nueva (2026-08-31, mecánica real de "dar objeto a NPC" — antes solo existía la
/// mitigación de coherencia `hasFalseItemGivenAway`, sin ningún camino mecánico real). Mismo
/// patrón que companeros.integration.test.ts: app aislado solo con `entregaRoutes`.
async function buildApp() {
  const app = Fastify();
  await app.register(entregaRoutes);
  return app;
}

describe('Entregar objeto a NPC (2026-08-31)', () => {
  let saveId: string;
  let hondonadaId: string;
  let auladorId: string;
  let auladorSlug: string;
  let itemId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const aullador = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'aullador-rojo' } });
    hondonadaId = hondonada.id;
    auladorId = aullador.id;
    auladorSlug = aullador.slug;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (entrega)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.npcState.create({ data: { saveId, npcId: auladorId, scope: hondonadaId, condicionFisica: 'ILESO' } });
    // Restringido a solo compañeros de equipo (2026-09-06, hallazgo 7 de la sesión de pruebas) —
    // sin este Companion real, Aullador Rojo ya no sería candidato.
    await prisma.companion.create({ data: { saveId, name: 'Aullador Rojo', role: 'compañero de caza', notes: 'x', tipo: 'FAUNA', sourceSlug: auladorSlug } });

    const item = await prisma.inventoryItem.create({
      data: { saveId, name: 'Cuchillo de hielo sílice', description: 'x', origin: 'inicial' },
    });
    itemId = item.id;
  });

  afterAll(async () => {
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.companion.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('GET /entregables lista el objeto no equipado y el NPC vivo presente', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/entregables` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.map((i: { name: string }) => i.name)).toContain('Cuchillo de hielo sílice');
    expect(body.npcs).toEqual([{ npcSlug: auladorSlug, name: 'Aullador Rojo' }]);
  });

  it('POST /entregar retira el InventoryItem de verdad y narra un LogEntry determinista', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/entregar/${auladorSlug}`,
      payload: { itemId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ npcSlug: auladorSlug, itemName: 'Cuchillo de hielo sílice' });
    expect(body.logEntry.text).toContain('Cuchillo de hielo sílice');
    expect(body.logEntry.text).toContain('Aullador Rojo');

    // Bug real que este endpoint corrige (docs/registros/revisar-partida-hallazgos.md, 2026-08-28): el
    // objeto reaparecía en el inventario en turnos posteriores porque nunca se retiraba de verdad.
    const remaining = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    expect(remaining).toBeNull();

    // El objeto entregado queda disponible para saquear si el NPC es derrotado después (decisión
    // explícita: "pasa al loot del NPC, saqueable después") — verificado contra el estado real.
    const state = await prisma.npcState.findUniqueOrThrow({ where: { saveId_npcId_scope: { saveId, npcId: auladorId, scope: hondonadaId } } });
    expect(state.givenItems).toEqual([expect.objectContaining({ name: 'Cuchillo de hielo sílice' })]);
  });

  it('POST /entregar de nuevo (sin ese item ya) falla con 404 — no se puede entregar dos veces lo mismo', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/entregar/${auladorSlug}`,
      payload: { itemId },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('Entregar objeto a NPC: guards (2026-08-31)', () => {
  let saveId: string;
  let hondonadaId: string;
  let auladorId: string;
  let auladorSlug: string;
  let equippedItemId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const aullador = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'aullador-rojo' } });
    hondonadaId = hondonada.id;
    auladorId = aullador.id;
    auladorSlug = aullador.slug;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (entrega, guards)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    // MUERTO — no es un destinatario válido, mismo criterio que Capturar/Saquear.
    await prisma.npcState.create({ data: { saveId, npcId: auladorId, scope: hondonadaId, condicionFisica: 'MUERTO' } });
    await prisma.companion.create({ data: { saveId, name: 'Aullador Rojo', role: 'compañero de caza', notes: 'x', tipo: 'FAUNA', sourceSlug: auladorSlug } });

    const equipped = await prisma.inventoryItem.create({
      data: { saveId, name: 'Hacha equipada', description: 'x', origin: 'inicial', slot: 'ARMA_PRINCIPAL' },
    });
    equippedItemId = equipped.id;
  });

  afterAll(async () => {
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
    await prisma.companion.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('rechaza entregar un objeto equipado (hay que desequiparlo primero)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/entregar/${auladorSlug}`,
      payload: { itemId: equippedItemId },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Desequípalo');
  });

  it('rechaza entregar a un NPC MUERTO — no es un destinatario válido', async () => {
    const app = await buildApp();
    const item = await prisma.inventoryItem.create({ data: { saveId, name: 'Objeto suelto', description: 'x' } });
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/entregar/${auladorSlug}`,
      payload: { itemId: item.id },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('no está aquí');
  });
});

describe('Entregar objeto a NPC: restringido a solo compañeros de equipo (2026-09-06, hallazgo 7)', () => {
  let saveId: string;
  let hondonadaId: string;
  let gisteraId: string;
  let gisteraSlug: string;
  let itemId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    // Gistera Koh: NPC interactuable real, SIN Companion — el caso central de este fix ("no a
    // cualquiera que pase", solo compañeros reales de equipo).
    const gistera = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'gistera-koh' } });
    hondonadaId = hondonada.id;
    gisteraId = gistera.id;
    gisteraSlug = gistera.slug;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Gorhorn de prueba (entrega, no-compañero)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: hondonada.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.npcState.create({ data: { saveId, npcId: gisteraId, scope: '', condicionFisica: 'ILESO' } });

    const item = await prisma.inventoryItem.create({ data: { saveId, name: 'Objeto suelto', description: 'x' } });
    itemId = item.id;
  });

  afterAll(async () => {
    await prisma.npcState.deleteMany({ where: { saveId } });
    await prisma.inventoryItem.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('GET /entregables no lista a un NPC interactuable que no es compañero', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/entregables` });
    expect(res.statusCode).toBe(200);
    expect(res.json().npcs).toEqual([]);
  });

  it('POST /entregar a un NPC que no es compañero: 400', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/saves/${saveId}/entregar/${gisteraSlug}`,
      payload: { itemId },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('compañeros');
    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    expect(item).not.toBeNull();
  });
});
