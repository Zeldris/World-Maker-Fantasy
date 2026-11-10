import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { detailRoutes } from './detail.js';

/// P379: las entradas que un avance de días escribe de golpe comparten `createdAt`; el canal del
/// Reino salía en el orden de la base («Día 192» antes que «Día 195» y «Día 193»).
describe('GET /saves/:id ordena kingdomLog por fecha del mundo (P379)', () => {
  let saveId: string;
  const DIAS = [195, 192, 193, 194];

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const loc = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId, worldId: world.id, characterName: 'Orden', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 6, constitucion: 7, inteligencia: 7, voluntad: 8, carisma: 6, magia: 2 }, portraitInitial: 'O', currentLocationId: loc.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 200 * 1440 } });
    const createdAt = new Date('2026-01-01T10:00:00Z'); // el mismo instante para todas
    for (const d of DIAS) {
      await prisma.logEntry.create({ data: { saveId, channel: 'KINGDOM', text: `KINGDOM día ${d}`, timeLabel: `Día ${d}`, fictionalMinutes: d * 1440, createdAt } });
    }
  });

  afterAll(async () => {
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.worldState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('el canal del Reino sale de menor a mayor día aunque se hayan escrito a la vez', async () => {
    const app = Fastify();
    await app.register(detailRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}` });
    const b = res.json() as { kingdomLog: { text: string }[] };
    expect(b.kingdomLog.map((e) => e.text)).toEqual([192, 193, 194, 195].map((d) => `KINGDOM día ${d}`));
  });
});
