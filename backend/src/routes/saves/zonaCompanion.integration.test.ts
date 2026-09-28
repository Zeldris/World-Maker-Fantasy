import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

/// Compañero de fauna con nombre propio en el mismo punto que su dueño (auditoría de lore
/// 2026-09-13, hallazgo C10 — "los compañeros de npc deben formar un mismo punto en el mapa de
/// zona... se mueven como 1"). Harness real contra Postgres (sin mocks), propio de este test —
/// `zona.test.ts` es unitario con `prisma` mockeado y no puede probar el join real por
/// `companionOfNpcSlug`.
const { zonaRoutes } = await import('./zona.js');

async function buildApp() {
  const app = Fastify();
  await app.register(zonaRoutes);
  return app;
}

describe('GET /saves/:id/zona — compañero de fauna con nombre propio', () => {
  let saveId: string;
  let worldId: string;
  let locationId: string;
  let duenoNpcId: string;
  let companionNpcId: string;
  let soloNpcId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;

    const location = await prisma.location.create({
      data: {
        worldId,
        slug: 'test-zona-companion',
        name: 'Zona de Prueba Companion',
        region: 'Zona de Pruebas',
        kind: 'hito',
        description: 'x',
        aliases: ['zona de prueba companion'],
      },
    });
    locationId = location.id;

    const dueno = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PRINCIPAL',
        slug: 'test-companion-dueno',
        name: 'Dueño de Prueba',
        aliases: ['dueño de prueba'],
        role: 'NPC de prueba',
        level: 5,
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 },
        bio: 'x',
        personality: 'x',
        raza: 'orcos',
        clase: 'GUERRERO',
        temperamento: 'CAUTELOSO',
      },
    });
    duenoNpcId = dueno.id;

    const companion = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PRINCIPAL',
        slug: 'test-companion-fauna',
        name: 'Fauna Compañera de Prueba',
        aliases: ['fauna compañera de prueba'],
        role: 'Fauna compañera de prueba',
        level: 5,
        attributes: { fuerza: 15, destreza: 8, constitucion: 15, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
        bio: 'x',
        personality: 'x',
        temperamento: 'CAUTELOSO',
        ataqueNatural: 'Muerde.',
        faunaCategoria: 'BESTIONES',
        companionOfNpcSlug: 'test-companion-dueno',
      },
    });
    companionNpcId = companion.id;

    // NPC "solo" (sin companion) en el mismo mapa — confirma que el join no contamina puntos que
    // no tienen compañero (regresión: `OR` de la query fusionada podría devolver falsos positivos
    // si el filtro en memoria de `npcFaunaZonePointIds`/`companionsByOwnerSlug` estuviera mal).
    const solo = await prisma.npc.create({
      data: {
        worldId,
        kind: 'PRINCIPAL',
        slug: 'test-companion-solo',
        name: 'NPC Solo de Prueba',
        aliases: ['npc solo de prueba'],
        role: 'NPC de prueba sin compañero',
        level: 5,
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 },
        bio: 'x',
        personality: 'x',
        raza: 'orcos',
        clase: 'GUERRERO',
        temperamento: 'CAUTELOSO',
      },
    });
    soloNpcId = solo.id;

    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 400, y: 300, tipo: 'NPC', targetSlug: 'test-companion-dueno', cantidad: 1, activo: true },
    });
    await prisma.zonePoint.create({
      data: { locationId, saveId, x: 200, y: 300, tipo: 'NPC', targetSlug: 'test-companion-solo', cantidad: 1, activo: true },
    });

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (companion)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
        currentLocationId: locationId,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
    // Descubrir ambos NPC de la pareja dueño+companion (nombre real esperado en el test) — el
    // NPC "solo" se deja SIN descubrir a propósito (confirma que el filtro de `'???'` no se ve
    // afectado por el join nuevo, mismo criterio que el resto del archivo, hallazgo 34).
    await prisma.discoveredEntity.createMany({
      data: [
        { saveId, entityType: 'npc', entitySlug: 'test-companion-dueno' },
        { saveId, entityType: 'fauna', entitySlug: 'test-companion-fauna' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.discoveredEntity.deleteMany({ where: { saveId } });
    await prisma.zonePoint.deleteMany({ where: { locationId } });
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.npc.deleteMany({ where: { id: { in: [duenoNpcId, companionNpcId, soloNpcId] } } });
    await prisma.location.delete({ where: { id: locationId } });
  });

  it('el punto del dueño trae el campo companion con el nombre real de la fauna, sin ZonePoint propio para ella', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/zona` });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    const puntoDueno = body.puntos.find((p: { targetSlug: string }) => p.targetSlug === 'test-companion-dueno');
    expect(puntoDueno).toMatchObject({
      nombre: 'Dueño de Prueba',
      companion: { slug: 'test-companion-fauna', nombre: 'Fauna Compañera de Prueba' },
    });

    // El companion NUNCA aparece como su propio punto en el mapa — solo colgado del dueño.
    const puntoCompanionSuelto = body.puntos.find((p: { targetSlug: string }) => p.targetSlug === 'test-companion-fauna');
    expect(puntoCompanionSuelto).toBeUndefined();
  });

  it('un punto SIN companion no trae el campo (no se contamina por el join)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/zona` });
    const body = res.json();

    const puntoSolo = body.puntos.find((p: { targetSlug: string }) => p.targetSlug === 'test-companion-solo');
    expect(puntoSolo).toBeDefined();
    expect(puntoSolo.companion).toBeUndefined();
  });
});
