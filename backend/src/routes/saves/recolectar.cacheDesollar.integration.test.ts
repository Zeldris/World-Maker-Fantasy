import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { recolectarRoutes } from './recolectar.js';

/// P98 (QA-27): tras rematar al Guchapo, Desollar decía «No hay nada recolectable» porque servía una
/// tirada vieja congelada vacía (de antes de que hubiera cadáver). La tirada solo vale para los
/// mismos cadáveres: con uno nuevo se vuelve a tirar.
describe('Desollar no sirve una tirada vieja vacía si hay un cadáver nuevo (P98)', () => {
  let saveId: string;
  let pozoId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const pozo = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'pozo-cauce-viejo' } });
    pozoId = pozo.id;
    const guchapo = await prisma.npc.findFirstOrThrow({ where: { worldId: world.id, slug: 'guchapo' } });
    const save = await prisma.save.create({
      data: {
        userId, worldId: world.id, characterName: 'Gorhorn de prueba (caché Desollar P98)', characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor', characterMotivation: 'x', portraitInitial: 'G', currentLocationId: pozoId,
        // Destreza alta: la tirada nueva saca algo seguro.
        attributes: { fuerza: 10, destreza: 30, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        // Tirada vieja vacía, de antes del cadáver (y sin firma: caché anterior a P98).
        harvestRollCache: { desollador: { locationId: pozoId, sources: [] } },
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId } });
    await prisma.npcState.create({ data: { saveId, npcId: guchapo.id, scope: pozoId, condicionFisica: 'MUERTO' } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('con el Guchapo muerto, ofrece su piel y su carne', async () => {
    const app = Fastify();
    await app.register(recolectarRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/recolectar/desollador` });
    expect(res.statusCode).toBe(200);
    const items = (res.json() as { sources: { yields: { itemSlug: string }[] }[] }).sources.flatMap((s) => s.yields.map((y) => y.itemSlug));
    expect(items).toContain('piel-guchapo');
  });

  it('al volver a abrir con los mismos cadáveres, no vuelve a tirar (la tirada sigue congelada)', async () => {
    const antes = (await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).harvestRollCache;
    const app = Fastify();
    await app.register(recolectarRoutes);
    await app.inject({ method: 'GET', url: `/saves/${saveId}/recolectar/desollador` });
    expect((await prisma.save.findUniqueOrThrow({ where: { id: saveId } })).harvestRollCache).toEqual(antes);
  });
});
