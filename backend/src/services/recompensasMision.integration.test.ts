import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { grantQuestRewardItems, idsDeRecompensas, recompensasComoObjetosNuevos } from './questResolution.js';

/// QA-54 (retro de la tercera tanda de QA-27): toda respuesta que puede cerrar misiones manda sus
/// recompensas como objetos nuevos. Cubre varias misiones en la misma petición y deja fuera lo que la
/// partida ya tenía (la revisión del 2026-10-12 vio que, buscando por nombre, solo llegaba la última).
describe('recompensasComoObjetosNuevos (QA-54)', () => {
  let saveId: string;
  let worldId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (recompensas de misión)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('manda las recompensas de dos misiones cerradas a la vez, con su efecto, y nada de lo que ya había', async () => {
    const vieja = await prisma.$transaction((tx) => grantQuestRewardItems(tx, saveId, worldId, ['Recompensa vieja (prueba)']));
    expect(vieja).toEqual(['Recompensa vieja (prueba)']);

    const nuevas = await prisma.$transaction(async (tx) => {
      const previas = await idsDeRecompensas(tx, saveId);
      await grantQuestRewardItems(tx, saveId, worldId, ['Mapa de las Llanuras']);
      await grantQuestRewardItems(tx, saveId, worldId, ['Otra recompensa (prueba)']);
      return recompensasComoObjetosNuevos(tx, saveId, worldId, previas);
    });

    expect(nuevas.map((n) => n.name).sort()).toEqual(['Mapa de las Llanuras', 'Otra recompensa (prueba)']);
    expect(nuevas.find((n) => n.name === 'Mapa de las Llanuras')?.effectKey).toBe('reveal-map-llanuras');
  });
});
