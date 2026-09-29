import { describe, it, expect } from 'vitest';
import {
  nivelOficioDeTrabajador,
  trabajadorPuedeProducir,
  almacenAlTope,
  tieneIngredientesEnAlmacen,
  tickOrdenesProduccion,
  companionesQueCuraCasaDeCuras,
  recetaEncajaConOficioDeEdificio,
  type TrabajadorReino,
  type OrdenProduccionInput,
} from './kingdomProduction.js';
import { CRAFTING_RECIPES, type CraftingRecipe } from './crafting.js';
import { oficioProducidoForRecipeKey } from './construction.js';
import type { InventoryRowLike, CatalogLookup } from './ingredients.js';

function recipe(overrides: Partial<CraftingRecipe> = {}): CraftingRecipe {
  return {
    key: 'testRecipe',
    verbRegex: /./,
    nounRegex: /./,
    location: null,
    ingredients: [],
    resultName: 'Resultado de prueba',
    resultDescription: 'Descripción de prueba',
    narrationWant: 'quiere',
    narrationDo: 'hace',
    ...overrides,
  };
}

function orden(overrides: Partial<OrdenProduccionInput> = {}): OrdenProduccionInput {
  return {
    id: 'orden-1',
    recipeKey: 'talarMadera',
    modo: 'reponer',
    limite: null,
    prioridad: 5,
    cantidadProducidaAcumulada: 0,
    activa: true,
    ...overrides,
  };
}

function trabajador(overrides: Partial<TrabajadorReino> = {}): TrabajadorReino {
  return { companionId: 'comp-1', xpPorOficio: {}, ...overrides };
}

/// Atajo para los tests que no ejercitan materia prima (almacén de ingredientes vacío, sin
/// catálogo) — la mayoría de los casos de este archivo, mismo criterio que `DEFAULT_KINGDOM_STATS`
/// en kingdomTick.test.ts.
function tick(
  ordenes: OrdenProduccionInput[],
  trabajadores: TrabajadorReino[],
  recipesByKey: Map<string, CraftingRecipe>,
  cantidadAlmacenPorSlug = new Map<string, number>(),
  limitePorSlug = new Map<string, number | null>(),
  almacenRows: InventoryRowLike[] = [],
  catalogBySlug = new Map<string, CatalogLookup>(),
  buildingTier: number | null = null,
) {
  return tickOrdenesProduccion(ordenes, trabajadores, recipesByKey, cantidadAlmacenPorSlug, limitePorSlug, almacenRows, catalogBySlug, buildingTier);
}

describe('nivelOficioDeTrabajador', () => {
  it('sin XP en ese oficio, nivel 1 (mismo fallback que professionLevelForXp(0))', () => {
    expect(nivelOficioDeTrabajador(trabajador(), 'herrero-orcos-llanuras')).toBe(1);
  });

  it('con XP acumulada en ese oficio, sube de nivel', () => {
    const t = trabajador({ xpPorOficio: { 'herrero-orcos-llanuras': 200 } });
    expect(nivelOficioDeTrabajador(t, 'herrero-orcos-llanuras')).toBeGreaterThan(1);
  });
});

describe('trabajadorPuedeProducir', () => {
  it('receta sin oficio: cualquier trabajador puede (recolección básica)', () => {
    expect(trabajadorPuedeProducir(trabajador(), recipe({ oficio: undefined, tier: 5 }))).toBe(true);
  });

  it('receta con oficio y tier 1: nivel 1 (sin alivio) ya alcanza', () => {
    expect(trabajadorPuedeProducir(trabajador(), recipe({ oficio: 'herrero-orcos-llanuras', tier: 1 }))).toBe(true);
  });

  it('receta de tier alto: un trabajador sin experiencia no llega', () => {
    const recetaTier5 = recipe({ oficio: 'herrero-orcos-llanuras', tier: 5 });
    expect(trabajadorPuedeProducir(trabajador(), recetaTier5)).toBe(false);
  });

  it('receta de tier alto: un trabajador con suficiente nivel de oficio sí llega', () => {
    const experto = trabajador({ xpPorOficio: { 'herrero-orcos-llanuras': 8000 } });
    const recetaTier5 = recipe({ oficio: 'herrero-orcos-llanuras', tier: 5 });
    expect(trabajadorPuedeProducir(experto, recetaTier5)).toBe(true);
  });
});

describe('almacenAlTope', () => {
  it('sin límite configurado (null/undefined), nunca está al tope', () => {
    expect(almacenAlTope(999999, null)).toBe(false);
    expect(almacenAlTope(999999, undefined)).toBe(false);
  });

  it('por debajo del límite, no está al tope', () => {
    expect(almacenAlTope(5, 10)).toBe(false);
  });

  it('al llegar o superar el límite, está al tope', () => {
    expect(almacenAlTope(10, 10)).toBe(true);
    expect(almacenAlTope(11, 10)).toBe(true);
  });
});

describe('tieneIngredientesEnAlmacen', () => {
  const catalogBySlug = new Map<string, CatalogLookup>([['mineral-hierro', { tipo: 'MATERIAL', category: 'mineral' }]]);

  it('receta sin ingredientes (recolección pura) siempre cumple', () => {
    expect(tieneIngredientesEnAlmacen(recipe({ ingredients: [] }), [], catalogBySlug)).toBe(true);
  });

  it('receta con ingredientes y almacén vacío no cumple', () => {
    const receta = recipe({ ingredients: [{ match: { kind: 'exact', catalogSlug: 'mineral-hierro' }, cantidad: 2, label: 'mineral de hierro' }] });
    expect(tieneIngredientesEnAlmacen(receta, [], catalogBySlug)).toBe(false);
  });

  it('receta con ingredientes y almacén con suficiente cantidad cumple', () => {
    const receta = recipe({ ingredients: [{ match: { kind: 'exact', catalogSlug: 'mineral-hierro' }, cantidad: 2, label: 'mineral de hierro' }] });
    const rows: InventoryRowLike[] = [
      { id: '1', name: 'Mineral de hierro', catalogSlug: 'mineral-hierro' },
      { id: '2', name: 'Mineral de hierro', catalogSlug: 'mineral-hierro' },
    ];
    expect(tieneIngredientesEnAlmacen(receta, rows, catalogBySlug)).toBe(true);
  });
});

describe('tickOrdenesProduccion', () => {
  const recetaSimple = recipe({ key: 'talarMadera', resultCatalogSlug: 'madera-tallada', resultCantidad: 2 });
  const recipesByKey = new Map([['talarMadera', recetaSimple]]);

  it('un trabajador libre produce la orden activa (recolección, sin ingredientes)', () => {
    const resultados = tick([orden()], [trabajador()], recipesByKey);
    expect(resultados).toEqual([
      { ordenId: 'orden-1', resultado: 'PRODUCIDA', companionId: 'comp-1', resultCatalogSlug: 'madera-tallada', resultCantidad: 2, ingredientesConsumidos: [] },
    ]);
  });

  it('sin trabajadores asignados, la orden queda SIN_TRABAJADOR_CON_NIVEL', () => {
    const resultados = tick([orden()], [], recipesByKey);
    expect(resultados).toEqual([{ ordenId: 'orden-1', resultado: 'SIN_TRABAJADOR_CON_NIVEL' }]);
  });

  it('recipeKey desconocida (huérfana) no rompe el tick, se reporta y se sigue', () => {
    const resultados = tick([orden({ recipeKey: 'noExiste' })], [trabajador()], recipesByKey);
    expect(resultados).toEqual([{ ordenId: 'orden-1', resultado: 'RECETA_DESCONOCIDA' }]);
  });

  it('orden inactiva no se procesa en absoluto', () => {
    const resultados = tick([orden({ activa: false })], [trabajador()], recipesByKey);
    expect(resultados).toEqual([]);
  });

  it('almacén ya al tope del recurso: la orden se salta SIN gastar trabajador (pieza que cierra el sistema)', () => {
    const cantidadAlmacen = new Map([['madera-tallada', 50]]);
    const limites = new Map<string, number | null>([['madera-tallada', 50]]);
    const resultados = tick([orden()], [trabajador()], recipesByKey, cantidadAlmacen, limites);
    expect(resultados).toEqual([{ ordenId: 'orden-1', resultado: 'ALMACEN_LLENO' }]);
  });

  it('almacén lleno en una orden de prioridad alta redirige al trabajador a la siguiente orden con hueco', () => {
    const recetaB = recipe({ key: 'recolectarPiedra', resultCatalogSlug: 'piedra-tallada', resultCantidad: 1 });
    const recipesByKeyDos = new Map([
      ['talarMadera', recetaSimple],
      ['recolectarPiedra', recetaB],
    ]);
    const ordenes = [orden({ id: 'o-madera', prioridad: 0 }), orden({ id: 'o-piedra', recipeKey: 'recolectarPiedra', prioridad: 1 })];
    const cantidadAlmacen = new Map([['madera-tallada', 50]]);
    const limites = new Map<string, number | null>([['madera-tallada', 50]]);
    const resultados = tick(ordenes, [trabajador()], recipesByKeyDos, cantidadAlmacen, limites);
    expect(resultados).toEqual([
      { ordenId: 'o-madera', resultado: 'ALMACEN_LLENO' },
      { ordenId: 'o-piedra', resultado: 'PRODUCIDA', companionId: 'comp-1', resultCatalogSlug: 'piedra-tallada', resultCantidad: 1, ingredientesConsumidos: [] },
    ]);
  });

  it('varias órdenes del mismo Building compiten por el mismo trabajador: gana la de mayor prioridad (menor número)', () => {
    const recetaB = recipe({ key: 'recolectarPiedra', resultCatalogSlug: 'piedra-tallada', resultCantidad: 1 });
    const recipesByKeyDos = new Map([
      ['talarMadera', recetaSimple],
      ['recolectarPiedra', recetaB],
    ]);
    const ordenes = [orden({ id: 'o-baja', recipeKey: 'talarMadera', prioridad: 9 }), orden({ id: 'o-alta', recipeKey: 'recolectarPiedra', prioridad: 0 })];
    const resultados = tick(ordenes, [trabajador()], recipesByKeyDos);
    expect(resultados).toEqual([
      { ordenId: 'o-alta', resultado: 'PRODUCIDA', companionId: 'comp-1', resultCatalogSlug: 'piedra-tallada', resultCantidad: 1, ingredientesConsumidos: [] },
      { ordenId: 'o-baja', resultado: 'SIN_TRABAJADOR_CON_NIVEL' },
    ]);
  });

  it('un trabajador ya asignado este tick no se duplica en otra orden del mismo Building', () => {
    const recetaB = recipe({ key: 'recolectarPiedra', resultCatalogSlug: 'piedra-tallada', resultCantidad: 1 });
    const recipesByKeyDos = new Map([
      ['talarMadera', recetaSimple],
      ['recolectarPiedra', recetaB],
    ]);
    const ordenes = [orden({ id: 'o-1', recipeKey: 'talarMadera', prioridad: 0 }), orden({ id: 'o-2', recipeKey: 'recolectarPiedra', prioridad: 1 })];
    const resultados = tick(ordenes, [trabajador()], recipesByKeyDos);
    expect(resultados[0].resultado).toBe('PRODUCIDA');
    expect(resultados[1].resultado).toBe('SIN_TRABAJADOR_CON_NIVEL');
  });

  it('orden única que ya alcanzó su límite se marca ORDEN_COMPLETADA sin gastar trabajador', () => {
    const resultados = tick([orden({ modo: 'unico', limite: 5, cantidadProducidaAcumulada: 5 })], [trabajador()], recipesByKey);
    expect(resultados).toEqual([{ ordenId: 'orden-1', resultado: 'ORDEN_COMPLETADA' }]);
  });

  it('trabajador sin nivel de oficio suficiente no produce, la orden queda SIN_TRABAJADOR_CON_NIVEL', () => {
    const recetaExigente = recipe({ key: 'lingoteYerreo', oficio: 'herrero-orcos-llanuras', tier: 5, resultCatalogSlug: 'lingote-yerreo' });
    const recipesByKeyExigente = new Map([['lingoteYerreo', recetaExigente]]);
    const resultados = tick([orden({ recipeKey: 'lingoteYerreo' })], [trabajador()], recipesByKeyExigente);
    expect(resultados).toEqual([{ ordenId: 'orden-1', resultado: 'SIN_TRABAJADOR_CON_NIVEL' }]);
  });

  it('entre dos trabajadores, el que tiene nivel de oficio suficiente es el asignado', () => {
    const recetaExigente = recipe({ key: 'lingoteYerreo', oficio: 'herrero-orcos-llanuras', tier: 5, resultCatalogSlug: 'lingote-yerreo' });
    const recipesByKeyExigente = new Map([['lingoteYerreo', recetaExigente]]);
    const novato = trabajador({ companionId: 'novato' });
    const experto = trabajador({ companionId: 'experto', xpPorOficio: { 'herrero-orcos-llanuras': 8000 } });
    const resultados = tick([orden({ recipeKey: 'lingoteYerreo' })], [novato, experto], recipesByKeyExigente);
    expect(resultados).toEqual([
      { ordenId: 'orden-1', resultado: 'PRODUCIDA', companionId: 'experto', resultCatalogSlug: 'lingote-yerreo', resultCantidad: 1, ingredientesConsumidos: [] },
    ]);
  });

  describe('con ingredientes reales (crafteo, no solo recolección)', () => {
    const catalogBySlug = new Map<string, CatalogLookup>([['mineral-hierro', { tipo: 'MATERIAL', category: 'mineral' }]]);
    const recetaLingote = recipe({
      key: 'lingoteHierro',
      ingredients: [{ match: { kind: 'exact', catalogSlug: 'mineral-hierro' }, cantidad: 2, label: 'mineral de hierro' }],
      resultCatalogSlug: 'lingote-hierro',
      resultCantidad: 1,
    });
    const recipesByKeyLingote = new Map([['lingoteHierro', recetaLingote]]);

    it('sin materia prima en el Almacén, la orden queda SIN_MATERIA_PRIMA sin gastar trabajador', () => {
      const resultados = tick([orden({ recipeKey: 'lingoteHierro' })], [trabajador()], recipesByKeyLingote, new Map(), new Map(), [], catalogBySlug);
      expect(resultados).toEqual([{ ordenId: 'orden-1', resultado: 'SIN_MATERIA_PRIMA' }]);
    });

    it('con materia prima suficiente, produce y consume las filas del Almacén', () => {
      const rows: InventoryRowLike[] = [
        { id: '1', name: 'Mineral de hierro', catalogSlug: 'mineral-hierro' },
        { id: '2', name: 'Mineral de hierro', catalogSlug: 'mineral-hierro' },
      ];
      const resultados = tick([orden({ recipeKey: 'lingoteHierro' })], [trabajador()], recipesByKeyLingote, new Map(), new Map(), rows, catalogBySlug);
      expect(resultados).toEqual([
        {
          ordenId: 'orden-1',
          resultado: 'PRODUCIDA',
          companionId: 'comp-1',
          resultCatalogSlug: 'lingote-hierro',
          resultCantidad: 1,
          ingredientesConsumidos: recetaLingote.ingredients,
        },
      ]);
    });

    it('dos órdenes que compiten por la misma materia prima: la segunda se queda sin ingredientes tras la primera', () => {
      const rows: InventoryRowLike[] = [
        { id: '1', name: 'Mineral de hierro', catalogSlug: 'mineral-hierro' },
        { id: '2', name: 'Mineral de hierro', catalogSlug: 'mineral-hierro' },
      ];
      const otroTrabajador = trabajador({ companionId: 'comp-2' });
      const ordenes = [orden({ id: 'o-1', recipeKey: 'lingoteHierro', prioridad: 0 }), orden({ id: 'o-2', recipeKey: 'lingoteHierro', prioridad: 1 })];
      const resultados = tick(ordenes, [trabajador(), otroTrabajador], recipesByKeyLingote, new Map(), new Map(), rows, catalogBySlug);
      expect(resultados[0].resultado).toBe('PRODUCIDA');
      expect(resultados[1]).toEqual({ ordenId: 'o-2', resultado: 'SIN_MATERIA_PRIMA' });
    });
  });

  describe('gate NIVEL_EDIFICIO_INSUFICIENTE (docs/rpgtarkor/sistemas-reino/edificios-de-oficio.md § 2/§ 7, 2026-09-28)', () => {
    const ordenTest = orden({ recipeKey: 'testRecipe' });

    it('buildingTier null (edificio sin nivel propio): nunca gatea, sin importar el tier de la receta', () => {
      const recipesByKey = new Map([['testRecipe', recipe({ tier: 9 })]]);
      const resultados = tick([ordenTest], [trabajador()], recipesByKey, new Map(), new Map(), [], new Map(), null);
      expect(resultados[0].resultado).toBe('PRODUCIDA');
    });

    it('Taller (tier 1) admite una receta de tier 3, pero no una de tier 4', () => {
      const recipesByKeyTier3 = new Map([['testRecipe', recipe({ tier: 3 })]]);
      const recipesByKeyTier4 = new Map([['testRecipe', recipe({ tier: 4 })]]);
      expect(tick([ordenTest], [trabajador()], recipesByKeyTier3, new Map(), new Map(), [], new Map(), 1)[0].resultado).toBe('PRODUCIDA');
      expect(tick([ordenTest], [trabajador()], recipesByKeyTier4, new Map(), new Map(), [], new Map(), 1)[0]).toEqual({ ordenId: 'orden-1', resultado: 'NIVEL_EDIFICIO_INSUFICIENTE' });
    });

    it('Gran obrador (tier 3) admite hasta tier 9', () => {
      const recipesByKey = new Map([['testRecipe', recipe({ tier: 9 })]]);
      const resultados = tick([ordenTest], [trabajador()], recipesByKey, new Map(), new Map(), [], new Map(), 3);
      expect(resultados[0].resultado).toBe('PRODUCIDA');
    });
  });
});

describe('companionesQueCuraCasaDeCuras (docs/rpgtarkor/sistemas-reino/edificios-de-oficio.md § 3/§ 7, 2026-09-28)', () => {
  it('cura un escalón a los Companion de Reino heridos, ignora a los ILESO/MUERTO y a los sin rolReino', () => {
    const resultado = companionesQueCuraCasaDeCuras([
      { id: 'c1', rolReino: 'trabajador', condicionFisica: 'HERIDO' },
      { id: 'c2', rolReino: 'trabajador', condicionFisica: 'ILESO' },
      { id: 'c3', rolReino: 'trabajador', condicionFisica: 'MUERTO' },
      { id: 'c4', rolReino: null, condicionFisica: 'GRAVE' },
      { id: 'c5', rolReino: 'guardia', condicionFisica: 'CONVALECIENTE' },
    ]);
    expect(resultado).toEqual([
      { id: 'c1', nuevaCondicion: 'ILESO' },
      { id: 'c5', nuevaCondicion: 'GRAVE' },
    ]);
  });
});

describe('filtro de recetas por oficio del edificio (P-3, decisión de Álvaro, 2026-09-29)', () => {
  it('oficioProducidoForRecipeKey: herrería y sus mejoras → herrero; Choza y null → null', () => {
    expect(oficioProducidoForRecipeKey('herreria')).toBe('herrero-orcos-llanuras');
    expect(oficioProducidoForRecipeKey('herreria-obrador')).toBe('herrero-orcos-llanuras');
    expect(oficioProducidoForRecipeKey('choza')).toBeNull();
    expect(oficioProducidoForRecipeKey(null)).toBeNull();
  });

  it('una herrería solo admite recetas de herrero (y ninguna de otro oficio ni sin oficio)', () => {
    const oficio = oficioProducidoForRecipeKey('herreria');
    const admitidas = CRAFTING_RECIPES.filter((r) => recetaEncajaConOficioDeEdificio(r, oficio));
    expect(admitidas.length).toBeGreaterThan(0);
    expect(admitidas.every((r) => r.oficio?.startsWith('herrero'))).toBe(true);
    const cocina = CRAFTING_RECIPES.find((r) => r.oficio === 'cocinero-orcos-llanuras')!;
    expect(recetaEncajaConOficioDeEdificio(cocina, oficio)).toBe(false);
    const sinOficio = CRAFTING_RECIPES.find((r) => !r.oficio)!;
    expect(recetaEncajaConOficioDeEdificio(sinOficio, oficio)).toBe(false);
  });

  it('un edificio sin oficio no filtra', () => {
    expect(CRAFTING_RECIPES.every((r) => recetaEncajaConOficioDeEdificio(r, null))).toBe(true);
  });
});
