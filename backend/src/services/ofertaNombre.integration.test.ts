import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { nombrarOferta } from './ofertaNombre.js';
import { preguntarNoticias } from './cronista/difusion.js';

/// P165 (QA-27): la tarjeta del turno decía «Cazadora Serhu» con su ficha del mapa en «???», y un NPC
/// con nombre propio sin descubrir firmaba «¿Qué se cuenta?» con su nombre real.
describe('nombrarOferta y la firma de las noticias (P165)', () => {
  let saveId: string;
  let worldId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const location = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'campamento-serhu' } });
    const save = await prisma.save.create({
      data: {
        userId, worldId, characterName: 'Gorhorn P165', characterArchetype: 'guerrero', characterOrigin: 'Clan Maktor', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G', currentLocationId: location.id,
      },
    });
    saveId = save.id;
    await prisma.worldState.create({ data: { saveId, fictionalMinutes: 480 } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const descubierto = async (slug: string) => (await prisma.discoveredEntity.count({ where: { saveId, entitySlug: slug } })) > 0;

  it('un rol se nombra y queda descubierto, con su artículo', async () => {
    const r = await nombrarOferta(prisma, { saveId, worldId }, { tipo: 'NPC', targetSlug: 'cazadora-serhu' });
    expect(r).toEqual({ targetName: 'Cazadora Serhu', articuloNpc: 'la' });
    expect(await descubierto('cazadora-serhu')).toBe(true);
  });

  it('un nombre propio sin descubrir va por su raza y no se descubre; firma igual en «¿Qué se cuenta?»', async () => {
    const r = await nombrarOferta(prisma, { saveId, worldId }, { tipo: 'NPC', targetSlug: 'maestro-alquimista-serhu' });
    expect(r).toEqual({ targetName: 'Orco desconocido', articuloNpc: null });
    expect(await descubierto('maestro-alquimista-serhu')).toBe(false);
    expect((await preguntarNoticias(prisma, saveId, 'maestro-alquimista-serhu'))!.frase).toMatch(/^El orco desconocido/);
  });

  it('un recurso que nombra la tarjeta queda descubierto', async () => {
    await nombrarOferta(prisma, { saveId, worldId }, { tipo: 'RECURSO', targetSlug: 'murgoles-domados-campamento' });
    expect(await descubierto('murgoles-domados-campamento')).toBe(true);
  });
});
