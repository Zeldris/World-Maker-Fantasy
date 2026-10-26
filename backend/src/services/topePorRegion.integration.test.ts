import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { computeBuildBlockedReason, CAMPAMENTO_RECIPE } from './construction.js';

/// P255 (usuaria, 2026-10-26): un edificio con `maxPerRegion` que está DANADO sigue contando como levantado: se
/// repara, no se levanta otro. Mismo conteo que `unicaYaLevantada` (recipesStatus.ts). Contra Postgres real.
const ATTRS = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

describe('P255: tope por región con un edificio dañado', () => {
  let saveId: string;
  let worldId: string;
  let hondonadaId: string;
  let regionHondonada: string;
  let otraRegionLocationId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    hondonadaId = hondonada.id;
    regionHondonada = hondonada.region;
    const otra = await prisma.location.findFirstOrThrow({ where: { worldId, region: { not: hondonada.region } } });
    otraRegionLocationId = otra.id;
    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (tope por región)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: hondonadaId,
      },
    });
    saveId = save.id;
  });

  afterEach(async () => {
    await prisma.building.deleteMany({ where: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const motivo = (activeRegion: string | null) =>
    computeBuildBlockedReason({ db: prisma, saveId, worldId, buildRecipe: CAMPAMENTO_RECIPE, activeRegion, currentLocationRecord: { id: hondonadaId } });

  it('un Campamento DANADO en la región bloquea levantar otro y el motivo dice que lo repares', async () => {
    await prisma.building.create({
      data: { saveId, locationId: hondonadaId, recipeKey: CAMPAMENTO_RECIPE.key, name: 'x', kind: 'campamento', description: 'x', status: 'DANADO', tier: 1 },
    });
    const razon = await motivo(regionHondonada);
    expect(razon).toMatch(/dañado: repáralo/);
  });

  it('sin activeRegion, cuenta en la región del lugar donde se levanta, no en todo el mundo', async () => {
    await prisma.building.create({
      data: { saveId, locationId: otraRegionLocationId, recipeKey: CAMPAMENTO_RECIPE.key, name: 'x', kind: 'campamento', description: 'x', status: 'ACTIVO', tier: 1 },
    });
    expect(await motivo(null)).toBeNull();
  });
});
