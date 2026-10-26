import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

// Cobertura nueva (2026-08-13, petición explícita: "que salgan deshabilitadas si no cumples las
// condiciones para construirlas o fabricarlas, además el hover con... 5/10... en la propia
// enciclopedia también") — GET /saves/:id/recipes-status es la única fuente de "cuánto tienes de
// verdad" para Habilidades/Enciclopedia; sin test, un cambio en STONE_BLOCK_RECIPE o en
// checkIngredients podría romper el 5/10 sin que nada lo detectara.
const findUniqueSave = vi.fn();
const findManyItemCatalog = vi.fn();
const findManyLocation = vi.fn();
const findFirstBuilding = vi.fn();
const countBuilding = vi.fn();
// Guard nuevo de territorio ajeno (2026-09-08, ver computeBuildBlockedReason/construction.ts) —
// count() de ZonePoint tipo EDIFICIO en la Location actual. 0 por defecto (ningún test de este
// archivo ejercita una Location con infraestructura de otra facción sembrada).
const countZonePoint = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    itemCatalog: { findMany: (...args: unknown[]) => findManyItemCatalog(...args) },
    location: { findMany: (...args: unknown[]) => findManyLocation(...args) },
    building: {
      findFirst: (...args: unknown[]) => findFirstBuilding(...args),
      count: (...args: unknown[]) => countBuilding(...args),
    },
    zonePoint: { count: (...args: unknown[]) => countZonePoint(...args) },
  },
}));

const { recipesStatusRoutes } = await import('./recipesStatus.js');
const { CONSTRUCTION_RECIPES } = await import('../../services/construction.js');

async function buildApp() {
  const app = Fastify();
  await app.register(recipesStatusRoutes);
  return app;
}

const BASE_ATTRIBUTES = { fuerza: 6, destreza: 6, constitucion: 6, inteligencia: 6, sabiduria: 6, carisma: 6 };
const BASE_SECONDARY = { sigilo: 6, percepcion: 6 };

describe('GET /saves/:id/recipes-status', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findManyItemCatalog.mockReset();
    findManyLocation.mockReset();
    findFirstBuilding.mockReset();
    countBuilding.mockReset();
    countZonePoint.mockReset();
    findManyItemCatalog.mockResolvedValue([{ slug: 'roca-pilares-rotos', tipo: 'RECURSO', category: 'piedra' }]);
    findManyLocation.mockResolvedValue([]);
    countZonePoint.mockResolvedValue(0);
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/saves/nope/recipes-status' });
    expect(res.statusCode).toBe(404);
  });

  it('"Tallar bloque de piedra" (stoneBlock): 3/5 de piedra, no cumple todavía', async () => {
    findUniqueSave.mockResolvedValue({
      worldId: 'world1',
      attributes: BASE_ATTRIBUTES,
      secondaryAttributes: BASE_SECONDARY,
      currentLocation: null,
      professionProgress: [{ professionId: 'constructor-orcos-llanuras', nivel: 1 }],
      inventoryItems: [{ id: 'i1', name: 'Piedra (3)', catalogSlug: 'roca-pilares-rotos', slot: null, statBonuses: null }],
    });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recipes-status' });
    const body = res.json();
    const stoneBlock = body.recipes.find((r: { recipeKey: string }) => r.recipeKey === 'stoneBlock');

    expect(stoneBlock.met).toBe(false);
    expect(stoneBlock.ingredients).toEqual([{ label: 'piedra', tienes: 3, necesitas: 5, met: false }]);
  });

  it('"Tallar bloque de piedra": 5/5 de piedra y fuerza suficiente, sí cumple', async () => {
    findUniqueSave.mockResolvedValue({
      worldId: 'world1',
      attributes: BASE_ATTRIBUTES,
      secondaryAttributes: BASE_SECONDARY,
      currentLocation: null,
      professionProgress: [{ professionId: 'constructor-orcos-llanuras', nivel: 1 }],
      inventoryItems: [{ id: 'i1', name: 'Piedra (5)', catalogSlug: 'roca-pilares-rotos', slot: null, statBonuses: null }],
    });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recipes-status' });
    const stoneBlock = res.json().recipes.find((r: { recipeKey: string }) => r.recipeKey === 'stoneBlock');

    expect(stoneBlock.met).toBe(true);
    expect(stoneBlock.ingredients).toEqual([{ label: 'piedra', tienes: 5, necesitas: 5, met: true }]);
    expect(stoneBlock.missingRequisitos).toEqual([]);
  });

  it('receta con ubicación exigida (ironIngot, campamento-serhu): locationOk falso fuera de esa location', async () => {
    findManyLocation.mockResolvedValue([{ slug: 'campamento-serhu', name: 'Campamento de Serhu' }]);
    findUniqueSave.mockResolvedValue({
      worldId: 'world1',
      attributes: BASE_ATTRIBUTES,
      secondaryAttributes: BASE_SECONDARY,
      currentLocation: { slug: 'otro-sitio' },
      professionProgress: [],
      inventoryItems: [],
    });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recipes-status' });
    const ironIngot = res.json().recipes.find((r: { recipeKey: string }) => r.recipeKey === 'ironIngot');

    expect(ironIngot.locationOk).toBe(false);
    expect(ironIngot.requiredLocationName).toBe('Campamento de Serhu');
    expect(ironIngot.met).toBe(false);
  });

  it('receta de construcción (campamento) también aparece, con recipeCategory "construccion"', async () => {
    findUniqueSave.mockResolvedValue({
      worldId: 'world1',
      attributes: BASE_ATTRIBUTES,
      secondaryAttributes: BASE_SECONDARY,
      currentLocation: null,
      professionProgress: [],
      inventoryItems: [],
    });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recipes-status' });
    const campamento = res.json().recipes.find((r: { recipeKey: string }) => r.recipeKey === 'campamento');

    expect(campamento.recipeCategory).toBe('construccion');
    expect(campamento.met).toBe(false);
    expect(campamento.ingredients.length).toBeGreaterThan(0);
  });

  // Auditoría 2026-08-13: antes `met` de una receta de construcción solo miraba materiales/
  // atributos, sin las reglas de reino reales (construction.ts § computeBuildBlockedReason) —
  // un edificio que exige Ayuntamiento (como la Choza) podía salir "disponible" en Habilidades/
  // Enciclopedia aunque el backend lo fuera a rechazar por no tener Ayuntamiento construido.
  it('choza (requiresAyuntamiento): con materiales de sobra pero sin Ayuntamiento, bloqueada por reino y NO por materiales', async () => {
    findManyItemCatalog.mockResolvedValue([{ slug: 'piel-generica', tipo: 'RECURSO', category: 'piel' }]);
    findFirstBuilding.mockResolvedValue(null);
    findUniqueSave.mockResolvedValue({
      worldId: 'world1',
      attributes: { ...BASE_ATTRIBUTES, fuerza: 10 },
      secondaryAttributes: BASE_SECONDARY,
      currentLocation: { id: 'loc1', slug: 'algun-sitio', region: 'Las Llanuras del Viento Rojo' },
      professionProgress: [{ professionId: 'carpintero-orcos-llanuras', nivel: 2 }],
      inventoryItems: [
        { id: 'i1', name: 'Piel de algo (10)', catalogSlug: 'piel-generica', slot: null, statBonuses: null },
        { id: 'i2', name: 'Hueso largo de gargantúa (6)', catalogSlug: 'hueso-largo-gargantua', slot: null, statBonuses: null },
        { id: 'i3', name: 'Cuerda de tendón (4)', catalogSlug: 'cuerda-tendon', slot: null, statBonuses: null },
      ],
    });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/saves/save1/recipes-status' });
    const choza = res.json().recipes.find((r: { recipeKey: string }) => r.recipeKey === 'choza');

    expect(choza.ingredients.every((i: { met: boolean }) => i.met)).toBe(true);
    expect(choza.missingRequisitos).toEqual([]);
    expect(choza.blockedReason).toMatch(/Ayuntamiento/);
    expect(choza.met).toBe(false);
    expect(findFirstBuilding).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ recipeKey: 'ayuntamiento', status: 'ACTIVO' }) }));
  });

  it('P218: las recetas de construcción llevan nombre, requiresAyuntamiento y upgradesRecipeKey', async () => {
    findUniqueSave.mockResolvedValue({
      worldId: 'world1',
      attributes: BASE_ATTRIBUTES,
      secondaryAttributes: BASE_SECONDARY,
      currentLocation: null,
      professionProgress: [],
      inventoryItems: [],
    });
    const app = await buildApp();
    const body = (await app.inject({ method: 'GET', url: '/saves/save1/recipes-status' })).json();
    const por = (k: string) => body.recipes.find((r: { recipeKey: string; recipeCategory: string }) => r.recipeKey === k && r.recipeCategory === 'construccion');
    for (const k of ['pozo', 'granero', 'cisterna', 'lenera']) {
      expect(por(k).requiresAyuntamiento).toBe(true);
      expect(por(k).upgradesRecipeKey).toBeNull();
      expect(por(k).name).toBeTruthy();
    }
    expect(por('pozo').name).toBe('un pozo');
    expect(por('herreria-obrador').upgradesRecipeKey).toBe('herreria');
    expect(por('campamento').requiresAyuntamiento).toBe(false);
  });

  it('P255: una receta con tope por región ya levantada sale unicaYaLevantada; las repetibles (choza, pozo) y la que aún no está, no', async () => {
    findUniqueSave.mockResolvedValue({
      worldId: 'world1',
      attributes: BASE_ATTRIBUTES,
      secondaryAttributes: BASE_SECONDARY,
      currentLocation: { id: 'loc1', slug: 'algun-sitio', region: 'Las Llanuras del Viento Rojo' },
      professionProgress: [],
      inventoryItems: [],
    });
    // Hay un Mercado y un Pozo en la región; solo el Mercado tiene tope de 1 por región.
    countBuilding.mockImplementation(async (args: { where: { recipeKey?: string } }) => (args.where.recipeKey === 'mercado' || args.where.recipeKey === 'pozo' ? 1 : 0));
    const app = await buildApp();
    const body = (await app.inject({ method: 'GET', url: '/saves/save1/recipes-status' })).json();
    const por = (k: string) => body.recipes.find((r: { recipeKey: string; recipeCategory: string }) => r.recipeKey === k && r.recipeCategory === 'construccion');
    expect(por('mercado').unicaYaLevantada).toBe(true);
    expect(por('pozo').unicaYaLevantada).toBe(false);
    expect(por('choza').unicaYaLevantada).toBe(false);
    expect(por('tablon-avisos').unicaYaLevantada).toBe(false);
  });

  it('P255: el tope por región de lo que pide Ayuntamiento se cuenta en la región del Ayuntamiento, no en la del personaje (como «Encargar»)', async () => {
    findUniqueSave.mockResolvedValue({
      worldId: 'world1',
      attributes: BASE_ATTRIBUTES,
      secondaryAttributes: BASE_SECONDARY,
      currentLocation: { id: 'loc1', slug: 'algun-sitio', region: 'Region del personaje' },
      professionProgress: [],
      inventoryItems: [],
    });
    findFirstBuilding.mockImplementation(async (args: { where: { recipeKey?: string } }) =>
      args.where.recipeKey === 'ayuntamiento' ? { location: { region: 'Region del Ayuntamiento' } } : null,
    );
    // El Mercado y el Tablón solo existen en la región del Ayuntamiento; el Campamento (sin Ayuntamiento) solo en la del personaje.
    countBuilding.mockImplementation(async (args: { where: { recipeKey?: string; location?: { region?: string } } }) => {
      const { recipeKey, location } = args.where;
      if (recipeKey === 'mercado') return location?.region === 'Region del Ayuntamiento' ? 1 : 0;
      if (recipeKey === 'campamento') return location?.region === 'Region del personaje' ? 1 : 0;
      return 0;
    });
    const app = await buildApp();
    const body = (await app.inject({ method: 'GET', url: '/saves/save1/recipes-status' })).json();
    const por = (k: string) => body.recipes.find((r: { recipeKey: string; recipeCategory: string }) => r.recipeKey === k && r.recipeCategory === 'construccion');
    expect(por('mercado').unicaYaLevantada).toBe(true);
    expect(por('campamento').unicaYaLevantada).toBe(true);
    findFirstBuilding.mockReset();
  });

  it('P255 (usuaria 2026-10-26): un Mercado DANADO sigue ocupando el tope (se repara, no se levanta otro)', async () => {
    findUniqueSave.mockResolvedValue({
      worldId: 'world1',
      attributes: BASE_ATTRIBUTES,
      secondaryAttributes: BASE_SECONDARY,
      currentLocation: { id: 'loc1', slug: 'algun-sitio', region: 'Las Llanuras del Viento Rojo' },
      professionProgress: [],
      inventoryItems: [],
    });
    // El único Mercado de la región está DANADO: solo lo cuenta un conteo que incluya ese estado.
    countBuilding.mockImplementation(async (args: { where: { recipeKey?: string; status?: string | { in: string[] } } }) => {
      const { recipeKey, status } = args.where;
      const cuentaDanado = status === 'DANADO' || (typeof status === 'object' && status.in.includes('DANADO'));
      return recipeKey === 'mercado' && cuentaDanado ? 1 : 0;
    });
    const app = await buildApp();
    const body = (await app.inject({ method: 'GET', url: '/saves/save1/recipes-status' })).json();
    const mercado = body.recipes.find((r: { recipeKey: string; recipeCategory: string }) => r.recipeKey === 'mercado' && r.recipeCategory === 'construccion');
    expect(mercado.unicaYaLevantada).toBe(true);
  });

  it('P255: sin región conocida (sin lugar ni Ayuntamiento) no cuenta los edificios únicos de todo el mundo', async () => {
    findUniqueSave.mockResolvedValue({
      worldId: 'world1',
      attributes: BASE_ATTRIBUTES,
      secondaryAttributes: BASE_SECONDARY,
      currentLocation: null,
      professionProgress: [],
      inventoryItems: [],
    });
    findFirstBuilding.mockResolvedValue(null);
    // Hay un Mercado en alguna región: un filtro sin región lo contaría.
    countBuilding.mockImplementation(async (args: { where: { recipeKey?: string; location?: { region?: string } } }) =>
      args.where.recipeKey === 'mercado' && !args.where.location?.region ? 1 : 0,
    );
    const app = await buildApp();
    const body = (await app.inject({ method: 'GET', url: '/saves/save1/recipes-status' })).json();
    const mercado = body.recipes.find((r: { recipeKey: string; recipeCategory: string }) => r.recipeKey === 'mercado' && r.recipeCategory === 'construccion');
    expect(mercado.unicaYaLevantada).toBe(false);
  });

  it('P218: oculta las recetas de construcción de otra raza; sin raza en la receta o en el personaje siguen visibles', async () => {
    const save = (raza: string | null) => ({
      worldId: 'world1',
      raza,
      attributes: BASE_ATTRIBUTES,
      secondaryAttributes: BASE_SECONDARY,
      currentLocation: null,
      professionProgress: [],
      inventoryItems: [],
    });
    const claves = async (raza: string | null) => {
      findUniqueSave.mockResolvedValue(save(raza));
      const app = await buildApp();
      const body = (await app.inject({ method: 'GET', url: '/saves/save1/recipes-status' })).json();
      return body.recipes.filter((r: { recipeCategory: string }) => r.recipeCategory === 'construccion').map((r: { recipeKey: string }) => r.recipeKey);
    };
    const deOrcos = CONSTRUCTION_RECIPES.find((r) => r.raza === 'orcos')!.key;
    const sinRaza = CONSTRUCTION_RECIPES.find((r) => !r.raza)!.key;
    const nabieus = await claves('nabieus');
    expect(nabieus).not.toContain(deOrcos);
    expect(nabieus).toContain(sinRaza);
    expect(await claves('orcos')).toContain(deOrcos);
    expect(await claves(null)).toContain(deOrcos);
  });
});
