import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';

/// P304: tras morir en un combate de grupo y reaparecer (POST /saves/:id/death/resolve) el
/// `CombatEncounter` seguía EN_CURSO, porque los compañeros vivos de la jugadora mantenían a su
/// bando "en combate" aunque ella ya no estuviera allí. Reaparecer cierra todos los encuentros.
const { deathRoutes } = await import('./death.js');

describe('POST /saves/:id/death/resolve cierra el combate en curso (P304)', () => {
  let saveId: string;
  let locationId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const location = await prisma.location.create({
      data: { worldId: world.id, slug: 'test-death-encuentro', name: 'Campamento de prueba (muerte)', region: 'Zona de Pruebas', kind: 'hito', description: 'x', aliases: ['campamento de prueba muerte'] },
    });
    locationId = location.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId: world.id,
        characterName: 'Ulkha de prueba (muerte en grupo)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'U',
        currentLocationId: locationId,
        lastRestLocationId: locationId,
        condicionFisica: 'MUERTO',
        pendingDeathResolution: true,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
    await prisma.location.delete({ where: { id: locationId } });
  });

  it('el encuentro EN_CURSO pasa a RESUELTO al reaparecer', async () => {
    const encuentro = await prisma.combatEncounter.create({ data: { saveId, estado: 'EN_CURSO', ronda: 5, jugable: true } });
    const app = Fastify();
    await app.register(deathRoutes);
    const res = await app.inject({ method: 'POST', url: `/saves/${saveId}/death/resolve` });
    expect(res.statusCode).toBe(200);
    const despues = await prisma.combatEncounter.findUniqueOrThrow({ where: { id: encuentro.id } });
    expect(despues.estado).toBe('RESUELTO');
    expect(despues.resolvedAt).not.toBeNull();
    expect(await prisma.combatEncounter.count({ where: { saveId, estado: 'EN_CURSO' } })).toBe(0);
  });
});
