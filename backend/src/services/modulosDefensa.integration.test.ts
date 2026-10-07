import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { computeBuildBlockedReason, CONSTRUCTION_RECIPES, cupoDefensaDeCuartel, DEFENSA_RECIPE_KEYS, detectsBuildIntent, EMPALIZADA_RECIPE, EMPALIZADA_MURO_RECIPE, TORRE_VIGIA_RECIPE } from './construction.js';

/// CR-65 (65a, Q1-Q3): los módulos de defensa van en la región del Ayuntamiento o en la de un Cuartel
/// Avanzado (contra su cupo local), uno de cada por asentamiento, y se mejoran en su asentamiento.
const ATTRS = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };
const LLANURAS = 'Las Llanuras del Viento Rojo';
const CRISTAL = 'Cristal Helado';

describe('módulos de defensa (CR-65 65a)', () => {
  let saveId: string;
  let worldId: string;
  let llanuras: string;
  let cristal: string;

  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    llanuras = (await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } })).id;
    cristal = (await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'campamento-helsig' } })).id;
    saveId = (await prisma.save.create({
      data: { userId: await getDefaultUserId(), worldId, characterName: 'Gorhorn (CR-65)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: ATTRS, portraitInitial: 'G', currentLocationId: llanuras },
    })).id;
  });
  afterEach(async () => {
    await prisma.building.deleteMany({ where: { saveId } });
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  const motivo = (recipeKey: string, region: string, locationId: string) =>
    computeBuildBlockedReason({ db: prisma, saveId, worldId, buildRecipe: CONSTRUCTION_RECIPES.find((r) => r.key === recipeKey)!, activeRegion: region, currentLocationRecord: { id: locationId } });
  const edificio = (recipeKey: string, locationId: string, extra: Record<string, unknown> = {}) =>
    prisma.building.create({ data: { saveId, locationId, recipeKey, name: 'x', kind: recipeKey, description: 'x', status: 'ACTIVO', ...extra } });

  it('las órdenes de construir reconocen cada módulo y escalón', () => {
    const receta = (texto: string) => CONSTRUCTION_RECIPES.find((r) => detectsBuildIntent(r, texto))?.key;
    expect(receta('construir una empalizada')).toBe('empalizada');
    expect(receta('construir un muro de piedra')).toBe('empalizada-2');
    expect(receta('levantar una muralla')).toBe('empalizada-3');
    expect(receta('construir una torre de vigía')).toBe('torre-vigia');
    expect(receta('construir una gran torre de vigía')).toBe('torre-vigia-3');
    expect(receta('construir una armería de piedra')).toBe('armeria-2');
    expect(receta('construir un barracón')).toBe('barracon');
    expect(DEFENSA_RECIPE_KEYS).toEqual(['empalizada', 'torre-vigia', 'armeria', 'barracon']);
  });

  it('en la región del Ayuntamiento, uno de cada', async () => {
    await edificio('ayuntamiento', llanuras, { tier: 1 });
    expect(await motivo('empalizada', LLANURAS, llanuras)).toBeNull();
    await edificio('empalizada', llanuras, { tier: 1 });
    expect(await motivo('empalizada', LLANURAS, llanuras)).toMatch(/máximo 1 por región/);
  });

  it('en otra región, solo con un Cuartel Avanzado y dentro de su cupo local (2, o 12 de guerra)', async () => {
    await edificio('ayuntamiento', llanuras, { tier: 1 });
    expect(await motivo('torre-vigia', CRISTAL, cristal)).toMatch(/Cuartel Avanzado/);
    const cuartel = await edificio('cuartel-avanzado', cristal);
    expect(await motivo('torre-vigia', CRISTAL, cristal)).toBeNull();
    await edificio('empalizada', cristal, { tier: 1 });
    await edificio('armeria', cristal, { tier: 1 });
    expect(await motivo('torre-vigia', CRISTAL, cristal)).toMatch(/módulos de defensa \(2\)/);
    expect(cupoDefensaDeCuartel({ recipeKey: 'cuartel-avanzado', name: 'un cuartel de guerra' })).toBe(12);
    await prisma.building.update({ where: { id: cuartel.id }, data: { name: 'un cuartel de guerra' } });
    expect(await motivo('torre-vigia', CRISTAL, cristal)).toBeNull();
  });

  it('se mejora en su asentamiento y en el escalón justo anterior', async () => {
    await edificio('ayuntamiento', llanuras, { tier: 2 });
    await edificio('cuartel-avanzado', cristal);
    await edificio('empalizada', cristal, { tier: 1 });
    expect(await motivo(EMPALIZADA_MURO_RECIPE.key, LLANURAS, llanuras)).toMatch(/no tiene ese edificio/);
    expect(await motivo(EMPALIZADA_MURO_RECIPE.key, CRISTAL, cristal)).toBeNull();
    expect(EMPALIZADA_RECIPE.edificioTipo).toBe('defensa');
    expect(TORRE_VIGIA_RECIPE.maxPerRegion).toBe(1);
  });
});
