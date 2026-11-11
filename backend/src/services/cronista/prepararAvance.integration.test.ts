import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { reponerZonaActual } from './prepararAvance.js';

// P377: tras `avanzar`, los puntos de fauna vacíos del lugar actual se reponen como lo hace el juego al abrir el mapa de zona.
describe('reponerZonaActual (P377)', () => {
  const slug = 'fauna-prueba-p377';
  let worldId = '';
  let locationId = '';
  let saveId = '';

  afterAll(async () => {
    if (saveId) await prisma.save.deleteMany({ where: { id: saveId } });
    await prisma.zonePoint.deleteMany({ where: { locationId } });
    await prisma.worldPopulation.deleteMany({ where: { worldId, targetSlug: slug } });
    if (locationId) await prisma.location.delete({ where: { id: locationId } });
  });

  it('un punto de fauna en cantidad 0 vuelve a tener presas al pasar los días', async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    locationId = (await prisma.location.create({ data: { worldId, slug: 'zona-prueba-p377', name: 'Zona P377', region: 'Las Llanuras del Viento Rojo', kind: 'hito', description: 'x' } })).id;
    await prisma.worldPopulation.create({ data: { worldId, targetType: 'FAUNA', targetSlug: slug, label: 'Fauna P377', poblacion: 100, poblacionMax: 200, distribucion: { 'Llanuras del Viento Rojo': 1.0 } } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Reponer (P377)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'R',
        currentLocationId: locationId, worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveId = save.id;
    await prisma.zonePoint.create({ data: { saveId, locationId, tipo: 'FAUNA', targetSlug: slug, x: 100, y: 100, cantidad: 0, activo: true, lastUpdatedAtMinutes: 480 } });
    const total = async () => (await prisma.zonePoint.findMany({ where: { saveId, locationId, targetSlug: slug } })).reduce((n, p) => n + p.cantidad, 0);
    expect(await total()).toBe(0);
    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 480 + 5 * 1440 } });
    expect(await reponerZonaActual(prisma, saveId)).toEqual({ lugar: 'Zona P377' });
    expect(await total()).toBeGreaterThan(0);
  });

  it('sin lugar actual no hace nada', async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const s = await prisma.save.create({
      data: { userId: await getDefaultUserId(), worldId: world.id, characterName: 'Sin lugar (P377)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: { fuerza: 10 }, portraitInitial: 'S', worldState: { create: { fictionalMinutes: 480 } } },
    });
    try { expect(await reponerZonaActual(prisma, s.id)).toBeNull(); } finally { await prisma.save.delete({ where: { id: s.id } }); }
  });
});
