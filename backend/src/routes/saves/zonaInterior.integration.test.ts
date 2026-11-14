import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { interiorComoCeldas } from '../../services/murosZona.js';

/// Revisión C3 (leve 8), P337: `GET /saves/:id/zona` expone el interior de la empalizada y sus puertas, para que el
/// menú del frontend diga que un punto sobre las estacas se toca solo desde dentro.
const { zonaRoutes } = await import('./zona.js');

describe('GET /saves/:id/zona — interior y puertas de la empalizada (P337)', () => {
  let saveId: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'campamento-serhu' } });
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(),
        worldId: world.id,
        characterName: 'Vigía de prueba (interior P337)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Serhu',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'V',
        currentLocationId: location.id,
      },
    })).id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 500 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('en el campamento con empalizada devuelve sus casillas de dentro y la puerta', async () => {
    const app = Fastify();
    await app.register(zonaRoutes);
    const res = await app.inject({ method: 'GET', url: `/saves/${saveId}/zona` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.puertas).toEqual([{ col: 12, row: 9 }]);
    expect(body.interior.length).toBeGreaterThan(0);
    expect(body.interior).toEqual(interiorComoCeldas('campamento-serhu'));
    expect(body.interior).not.toContainEqual({ col: 12, row: 9 });
  });
});
