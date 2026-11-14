import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { logRoutes } from './log.js';

/// Mismo defecto que P379 en `GET /saves/:id/diario`: las entradas que un avance de días escribe de golpe
/// comparten `createdAt`, y ordenar solo por él las dejaba en el orden de la base.
describe('GET /saves/:id/diario ordena por fecha del mundo (P379)', () => {
  let saveId: string;
  const DIAS = [195, 192, 193, 194];

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const loc = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
    const save = await prisma.save.create({
      data: {
        userId, worldId: world.id, characterName: 'OrdenDiario', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 6, constitucion: 7, inteligencia: 7, voluntad: 8, carisma: 6, magia: 2 }, portraitInitial: 'O', currentLocationId: loc.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 200 * 1440 } });
    const createdAt = new Date('2026-01-01T10:00:00Z'); // el mismo instante para todas
    for (const d of DIAS) {
      await prisma.logEntry.create({ data: { saveId, channel: 'CHARACTER', text: `diario día ${d}`, timeLabel: `Día ${d}`, fictionalMinutes: d * 1440, createdAt } });
    }
  });

  afterAll(async () => {
    await prisma.logEntry.deleteMany({ where: { saveId } });
    await prisma.worldState.deleteMany({ where: { saveId } });
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('las entradas salen de menor a mayor día aunque se hayan escrito a la vez', async () => {
    const app = Fastify();
    await app.register(logRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/diario` });
    const b = res.json() as { entries: { text: string }[] };
    expect(b.entries.map((e) => e.text)).toEqual([192, 193, 194, 195].map((d) => `diario día ${d}`));
  });
});
