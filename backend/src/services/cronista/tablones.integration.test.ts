import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { tickFactionProduction } from '../kingdomTick.js';
import { CONSTRUCTION_RECIPES } from '../construction.js';
import { asegurarTablonesDePartida, tablonesDePartida, TABLON_RECIPE_KEY } from './tablones.js';

/// CR-40 40c contra Postgres real: las ciudades con interior tienen su tablón de avisos, la partida
/// nueva lo recibe al clonar el mundo y la antigua, de forma perezosa; el tablón no produce nada y el
/// Reino lo puede construir.
describe('tablones de avisos (CR-40 40c)', () => {
  let saveId: string;

  beforeAll(async () => {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: 'Tablones', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'T',
        worldState: { create: { fictionalMinutes: 480 } },
      },
    });
    saveId = save.id;
    await asegurarMundoDePartida(prisma, saveId);
  });

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: saveId } });
  });

  it('la partida nueva tiene un tablón en cada ciudad con interior', async () => {
    const tablones = await prisma.$transaction((tx) => tablonesDePartida(tx, saveId));
    expect(tablones.map((t) => t.faction!.slug).sort()).toEqual(['clan-goshg', 'clan-helsig', 'clan-serhu', 'feg-ger', 'feg-tusha', 'keseg-prisilke']);
    expect(tablones.every((t) => t.location?.name)).toBe(true);
  });

  it('una partida clonada antes de que existiera lo recibe una sola vez', async () => {
    await prisma.building.deleteMany({ where: { recipeKey: TABLON_RECIPE_KEY, faction: { saveId } } });
    expect(await prisma.$transaction((tx) => asegurarTablonesDePartida(tx, saveId))).toBe(6);
    expect(await prisma.$transaction((tx) => asegurarTablonesDePartida(tx, saveId))).toBe(0);
    expect(await prisma.building.count({ where: { recipeKey: TABLON_RECIPE_KEY, faction: { saveId } } })).toBe(6);
  });

  it('no produce nada y el Reino lo puede construir', () => {
    expect(tickFactionProduction([{ recipeKey: TABLON_RECIPE_KEY, status: 'ACTIVO' }])).toEqual({ comida: 0, riqueza: 0 });
    const receta = CONSTRUCTION_RECIPES.find((r) => r.nounRegex.test('construir un tablon de avisos'));
    expect(receta?.key).toBe(TABLON_RECIPE_KEY);
    expect(receta?.requiresAyuntamiento).toBe(true);
  });
});
