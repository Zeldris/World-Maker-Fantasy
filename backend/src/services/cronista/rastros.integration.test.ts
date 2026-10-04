import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { slugify } from '../../lib/slugify.js';
import { registrarSuceso } from './sucesos.js';
import { rastrosDeRegion } from './rastros.js';

// CR-12 paso 12d (hito 0.2) — la ambientación cuenta el rastro de lo que ha pasado hace poco en la
// región del personaje.
describe('rastros de la región (CR-12)', () => {
  const saveIds: string[] = [];
  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('incendio en un lugar de la región y fauna que llega: sí; lo de hace días o de otra región: no', async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const lugar = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    const region = lugar.region;
    const otra = await prisma.location.findFirstOrThrow({ where: { worldId, region: { not: region } } });
    const ahora = 480 + 10 * 1440;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Rastros (CR-12)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'R',
        currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: ahora } },
      },
    });
    saveIds.push(save.id);
    const saveId = save.id;
    const suceso = (s: Parameters<typeof registrarSuceso>[1]) => prisma.$transaction((tx) => registrarSuceso(tx, s));
    await suceso({ saveId, tipo: 'INCENDIO', fictionalMinutes: ahora - 1440, origen: 'MUNDO', locationId: lugar.id, actores: [], datos: { lugar: lugar.name } });
    await suceso({
      saveId, tipo: 'MIGRACION_FAUNA', fictionalMinutes: ahora - 600, origen: 'MUNDO', regionSlug: slugify(otra.region),
      actores: [{ entidadTipo: 'REGION', entidadId: slugify(otra.region), papel: 'AFECTADO' }, { entidadTipo: 'REGION', entidadId: slugify(region), papel: 'BENEFICIARIO' }],
      datos: { especie: 'Corretolvas', desde: otra.region, hacia: region },
    });
    await suceso({ saveId, tipo: 'CRECIDA', fictionalMinutes: ahora - 5 * 1440, origen: 'MUNDO', locationId: lugar.id, actores: [], datos: { lugar: lugar.name } });
    await suceso({ saveId, tipo: 'INCENDIO', fictionalMinutes: ahora - 60, origen: 'MUNDO', locationId: otra.id, actores: [], datos: { lugar: otra.name } });

    expect(await rastrosDeRegion(prisma, saveId, region, ahora)).toEqual([
      'Se ven Corretolvas que antes no andaban por aquí.',
      `Todavía huele a quemado: el fuego de ${lugar.name} no queda lejos.`,
    ]);
  });
});
