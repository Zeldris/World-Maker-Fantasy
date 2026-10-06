import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { esMaterial, huecoDeMateriales, suministrosDelReino } from './economiaReino.js';

describe('economía del Reino (CR-53) — en una partida', () => {
  let saveId: string;
  let worldId: string;
  let locationId: string;

  beforeAll(async () => {
    worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    saveId = (await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'G',
        worldState: { create: { fictionalMinutes: 0 } },
      },
    })).id;
    locationId = (await prisma.location.findFirstOrThrow({ where: { worldId, slug: { not: { contains: 'cauce' } }, NOT: { slug: { contains: 'manadero' } } } })).id;
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const edificio = (recipeKey: string) =>
    prisma.building.create({ data: { saveId, locationId, recipeKey, name: recipeKey, kind: recipeKey, description: 'x', status: 'ACTIVO' } });

  it('el Pozo da agua y la Leñera hace sitio a los materiales del Almacén', async () => {
    await edificio('ayuntamiento');
    await edificio('pozo');
    expect((await suministrosDelReino(prisma, saveId)).agua).toBeGreaterThanOrEqual(12);
    const recurso = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, tipo: 'RECURSO' } });
    const arma = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId, tipo: { not: 'RECURSO' } } });
    expect(await esMaterial(prisma, saveId, recurso.slug)).toBe(true);
    expect(await esMaterial(prisma, saveId, arma.slug)).toBe(false);
    await prisma.almacenItem.createMany({ data: Array.from({ length: 60 }, () => ({ saveId, name: recurso.name, description: '', catalogSlug: recurso.slug })) });
    expect(await huecoDeMateriales(prisma, saveId)).toBe(0);
    await edificio('lenera');
    expect(await huecoDeMateriales(prisma, saveId)).toBe(120);
  });
});
