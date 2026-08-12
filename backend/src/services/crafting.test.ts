import { describe, it, expect } from 'vitest';
import { CRAFTING_RECIPES, detectsCraftIntent, canCraft, craftRequisitoShortfalls, planCraftConsumption, type CraftingRecipe } from './crafting.js';
import type { AttributeBlock } from './dice.js';
import { EMPTY_SECONDARY_ATTRIBUTES } from './secondaryAttributes.js';
import type { CatalogLookup, InventoryRowLike } from './ingredients.js';

function recipe(key: string): CraftingRecipe {
  const found = CRAFTING_RECIPES.find((r) => r.key === key);
  if (!found) throw new Error(`receta de prueba no encontrada: ${key}`);
  return found;
}

// Atributos de prueba que SÍ cumplen los requisitos reales de todas las recetas base (fuerza 12
// de axeRepair, fuerza 10 de gargantuaArmor, inteligencia 8 de antidote, fuerza 8 de ironIngot,
// fuerza 6 de stoneBlock) — para que los tests de materiales/ubicación de más abajo prueben SOLO
// eso, sin toparse con el umbral de atributo.
const attrs: AttributeBlock = { fuerza: 12, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 };
const secondary = { ...EMPTY_SECONDARY_ATTRIBUTES, inteligencia: 8 };

const axeRepair = recipe('axeRepair');
const smokeMeat = recipe('smokeMeat');
const gargantuaArmor = recipe('gargantuaArmor');
const antidote = recipe('antidote');
const fieldTorch = recipe('fieldTorch');
const ironIngot = recipe('ironIngot');
const stoneBlock = recipe('stoneBlock');
const firstAidBandage = recipe('firstAidBandage');
const redSpikeInfusion = recipe('redSpikeInfusion');
const basicPoultice = recipe('basicPoultice');
const completePoultice = recipe('completePoultice');

// catalogSlug de cada fila → tipo/categoría real del catálogo (2026-07-29, refactor de
// ingredientes: crafting.ts ya no matchea por prefijo de nombre, matchea por catalogSlug/tipo/
// categoría real). Mismos slugs que crafting.ts usa de verdad, ver worldCatalog.ts.
const catalogBySlug = new Map<string, CatalogLookup>([
  ['hacha-guerra-maktor-rota', { tipo: 'EQUIPABLE', category: 'arma' }],
  ['sal-trueque', { tipo: 'NARRATIVO', category: 'valor' }],
  ['racion-carne', { tipo: 'CONSUMIBLE', category: 'consumible' }],
  ['placa-osea-gargantua', { tipo: 'RECURSO', category: 'hueso' }],
  ['cuerda-tendon', { tipo: 'EQUIPABLE', category: 'herramienta' }],
  ['manojo-salvia-polvo', { tipo: 'CONSUMIBLE', category: 'medicinal' }],
  ['petalos-flor-ceniza', { tipo: 'CONSUMIBLE', category: 'medicinal' }],
  ['lena-matorral-cuerno', { tipo: 'RECURSO', category: 'madera' }],
  ['resina-trepador-ocaso', { tipo: 'RECURSO', category: 'resina' }],
  ['mena-de-hierro', { tipo: 'RECURSO', category: 'mena' }],
  ['piedra', { tipo: 'RECURSO', category: 'piedra' }],
  ['odre-agua', { tipo: 'EQUIPABLE', category: 'herramienta' }],
  ['grano-espiga-roja', { tipo: 'CONSUMIBLE', category: 'consumible' }],
]);

function row(id: string, catalogSlug: string, cantidad?: number): InventoryRowLike {
  return { id, name: cantidad ? `${catalogSlug} (${cantidad})` : catalogSlug, catalogSlug };
}

describe('CRAFTING_RECIPES', () => {
  it('tiene las 11 recetas esperadas, cada una con una clave única', () => {
    expect(CRAFTING_RECIPES.map((r) => r.key)).toEqual([
      'axeRepair',
      'smokeMeat',
      'gargantuaArmor',
      'antidote',
      'fieldTorch',
      'ironIngot',
      'stoneBlock',
      'firstAidBandage',
      'redSpikeInfusion',
      'basicPoultice',
      'completePoultice',
    ]);
  });
});

describe('detectsCraftIntent', () => {
  it('detecta intención de reparar el hacha', () => {
    expect(detectsCraftIntent(axeRepair, 'Quiero reparar mi hacha')).toBe(true);
    expect(detectsCraftIntent(axeRepair, 'Voy a reforjar el hacha con el herrero')).toBe(true);
  });
  it('no dispara sin mencionar el hacha', () => {
    expect(detectsCraftIntent(axeRepair, 'Quiero reparar mis botas')).toBe(false);
  });
  it('no dispara sin verbo de reparación', () => {
    expect(detectsCraftIntent(axeRepair, 'Miro mi hacha con cariño')).toBe(false);
  });

  it('detecta intención de ahumar carne, incluido "crear" como verbo', () => {
    expect(detectsCraftIntent(smokeMeat, 'Ahumo mi ración de carne sobre el fuego')).toBe(true);
    expect(detectsCraftIntent(smokeMeat, 'Quiero crear carne ahumada')).toBe(true);
    expect(detectsCraftIntent(smokeMeat, 'Como mi ración de carne')).toBe(false);
  });

  it('detecta intención de fabricar el peto, incluido "crear" como verbo', () => {
    expect(detectsCraftIntent(gargantuaArmor, 'Quiero fabricar un peto con las placas')).toBe(true);
    expect(detectsCraftIntent(gargantuaArmor, 'Voy a montar el peto de gargantúa')).toBe(true);
    expect(detectsCraftIntent(gargantuaArmor, 'Quiero fabricar una lanza')).toBe(false);
  });

  it('detecta intención de preparar un antídoto/contraveneno', () => {
    expect(detectsCraftIntent(antidote, 'Preparo un antídoto con lo que tengo')).toBe(true);
    expect(detectsCraftIntent(antidote, 'Mezclo la salvia para hacer un contraveneno')).toBe(true);
    expect(detectsCraftIntent(antidote, 'Preparo la cena')).toBe(false);
    expect(detectsCraftIntent(antidote, 'Miro mi antídoto con curiosidad')).toBe(false);
  });

  it('detecta intención de fabricar una antorcha de campo', () => {
    expect(detectsCraftIntent(fieldTorch, 'Ato una antorcha con lo que tengo')).toBe(true);
    expect(detectsCraftIntent(fieldTorch, 'Voy a fabricar una antorcha de campo')).toBe(true);
    expect(detectsCraftIntent(fieldTorch, 'Ato mis botas')).toBe(false);
  });

  it('detecta intención de fundir un lingote de hierro', () => {
    expect(detectsCraftIntent(ironIngot, 'Fundo mi mena en un lingote de hierro')).toBe(true);
    expect(detectsCraftIntent(ironIngot, 'Quiero forjar el lingote de hierro')).toBe(true);
    expect(detectsCraftIntent(ironIngot, 'Fundo mi peto')).toBe(false);
  });

  it('detecta intención de tallar un bloque de piedra', () => {
    expect(detectsCraftIntent(stoneBlock, 'Tallo la piedra en un bloque')).toBe(true);
    expect(detectsCraftIntent(stoneBlock, 'Desbasto piedra tallada')).toBe(true);
    expect(detectsCraftIntent(stoneBlock, 'Tallo un cuchillo')).toBe(false);
  });

  it('detecta intención de atar un vendaje improvisado', () => {
    expect(detectsCraftIntent(firstAidBandage, 'Ato un vendaje improvisado con mi manojo de salvia del polvo')).toBe(true);
    expect(detectsCraftIntent(firstAidBandage, 'Preparo un vendaje con lo que tengo')).toBe(true);
    expect(detectsCraftIntent(firstAidBandage, 'Ato mis botas')).toBe(false);
  });

  it('detecta intención de preparar una infusión de espiga roja', () => {
    expect(detectsCraftIntent(redSpikeInfusion, 'Preparo una infusión de espiga roja')).toBe(true);
    expect(detectsCraftIntent(redSpikeInfusion, 'Hiervo espiga roja en infusión')).toBe(true);
    expect(detectsCraftIntent(redSpikeInfusion, 'Preparo la cena')).toBe(false);
  });

  it('detecta intención de preparar cataplasma básica de salvia, distinta de la completa', () => {
    expect(detectsCraftIntent(basicPoultice, 'Preparo una cataplasma básica de salvia')).toBe(true);
    expect(detectsCraftIntent(basicPoultice, 'Preparo una cataplasma completa de salvia y ceniza')).toBe(false);
  });

  it('detecta intención de preparar cataplasma completa de salvia y ceniza, distinta de la básica', () => {
    expect(detectsCraftIntent(completePoultice, 'Preparo una cataplasma completa de salvia y ceniza')).toBe(true);
    expect(detectsCraftIntent(completePoultice, 'Preparo una cataplasma básica de salvia')).toBe(false);
  });
});

describe('canCraft — ingrediente exacto (catalogSlug concreto)', () => {
  it('exige la ubicación correcta cuando la receta la requiere (hacha rota)', () => {
    const rows = [row('1', 'hacha-guerra-maktor-rota'), row('2', 'sal-trueque', 2)];
    expect(canCraft(axeRepair, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(axeRepair, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('reconoce un lote apilado ("(N)") sumando cantidades', () => {
    expect(canCraft(axeRepair, 'campamento-serhu', [row('1', 'hacha-guerra-maktor-rota'), row('2', 'sal-trueque', 2)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(smokeMeat, null, [row('1', 'racion-carne', 4)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(
      canCraft(gargantuaArmor, 'campamento-serhu', [row('1', 'placa-osea-gargantua', 2), row('2', 'cuerda-tendon', 2)], catalogBySlug, attrs, secondary),
    ).toBe(true);
  });
  it('no permite craftear si falta cualquiera de los ingredientes', () => {
    expect(canCraft(axeRepair, 'campamento-serhu', [row('1', 'hacha-guerra-maktor-rota')], catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(axeRepair, 'campamento-serhu', [row('1', 'sal-trueque', 2)], catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(gargantuaArmor, 'campamento-serhu', [row('1', 'placa-osea-gargantua', 2)], catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(antidote, null, [row('1', 'manojo-salvia-polvo')], catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(fieldTorch, null, [row('1', 'lena-matorral-cuerno')], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('no exige ubicación en recetas sin condición de sitio', () => {
    expect(canCraft(smokeMeat, 'cualquier-sitio', [row('1', 'racion-carne')], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(antidote, null, [row('1', 'manojo-salvia-polvo'), row('2', 'petalos-flor-ceniza')], catalogBySlug, attrs, secondary)).toBe(true);
    expect(
      canCraft(fieldTorch, null, [row('1', 'lena-matorral-cuerno'), row('2', 'resina-trepador-ocaso')], catalogBySlug, attrs, secondary),
    ).toBe(true);
  });
  it('bloquea el crafteo si no se llega al requisito de atributo de la receta', () => {
    const debil: AttributeBlock = { ...attrs, fuerza: 4 };
    const recipeConRequisito: CraftingRecipe = { ...axeRepair, requisitos: { fuerza: 12 } };
    const rows = [row('1', 'hacha-guerra-maktor-rota'), row('2', 'sal-trueque', 2)];
    expect(canCraft(recipeConRequisito, 'campamento-serhu', rows, catalogBySlug, debil, secondary)).toBe(false);
    expect(craftRequisitoShortfalls(recipeConRequisito, debil, secondary)).toEqual([{ atributo: 'fuerza', tienes: 4, necesitas: 12 }]);
  });
  it('el alivio de oficio reduce el requisito exigido', () => {
    const debil: AttributeBlock = { ...attrs, fuerza: 8 };
    const recipeConRequisito: CraftingRecipe = { ...axeRepair, requisitos: { fuerza: 12 } };
    expect(craftRequisitoShortfalls(recipeConRequisito, debil, secondary, 4)).toEqual([]);
  });
});

describe('canCraft — recetas de primeros auxilios (2026-08-13)', () => {
  it('vendaje improvisado exige 1 manojo de salvia del polvo, en cualquier sitio', () => {
    expect(canCraft(firstAidBandage, null, [row('1', 'manojo-salvia-polvo')], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(firstAidBandage, null, [], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('infusión de espiga roja exige 2 granos de espiga roja', () => {
    expect(canCraft(redSpikeInfusion, null, [row('1', 'grano-espiga-roja', 2)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(redSpikeInfusion, null, [row('1', 'grano-espiga-roja', 1)], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('cataplasma básica exige 1 manojo de salvia + 1 pétalos de Flor de Ceniza', () => {
    expect(
      canCraft(basicPoultice, null, [row('1', 'manojo-salvia-polvo'), row('2', 'petalos-flor-ceniza')], catalogBySlug, attrs, secondary),
    ).toBe(true);
    expect(canCraft(basicPoultice, null, [row('1', 'manojo-salvia-polvo')], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('cataplasma completa exige 2 manojos de salvia + 1 pétalos de Flor de Ceniza — la receta final, más exigente', () => {
    expect(
      canCraft(completePoultice, null, [row('1', 'manojo-salvia-polvo', 2), row('2', 'petalos-flor-ceniza')], catalogBySlug, attrs, secondary),
    ).toBe(true);
    // Solo 1 manojo (lo que basta para la básica) no llega para la completa.
    expect(
      canCraft(completePoultice, null, [row('1', 'manojo-salvia-polvo', 1), row('2', 'petalos-flor-ceniza')], catalogBySlug, attrs, secondary),
    ).toBe(false);
  });
});

describe('canCraft — ingrediente fungible por categoría (bloque de piedra)', () => {
  it('cualquier fila tipo=RECURSO/categoría=piedra cuenta, sin importar el catalogSlug exacto', () => {
    expect(canCraft(stoneBlock, null, [row('1', 'piedra', 5)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(stoneBlock, null, [row('1', 'piedra', 4)], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('un ingrediente exacto de otra receta (mena de hierro) no cuenta como piedra', () => {
    expect(canCraft(stoneBlock, null, [row('1', 'mena-de-hierro', 5)], catalogBySlug, attrs, secondary)).toBe(false);
  });
});

describe('canCraft — ironIngot exige mena de hierro exacta y la fragua del campamento', () => {
  it('funde el lingote con 4 de mena en el campamento', () => {
    expect(canCraft(ironIngot, 'campamento-serhu', [row('1', 'mena-de-hierro', 4)], catalogBySlug, attrs, secondary)).toBe(true);
  });
  it('no funde fuera del campamento ni con menos de 4', () => {
    expect(canCraft(ironIngot, 'hondonada-del-eco', [row('1', 'mena-de-hierro', 4)], catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(ironIngot, 'campamento-serhu', [row('1', 'mena-de-hierro', 3)], catalogBySlug, attrs, secondary)).toBe(false);
  });
});

describe('planCraftConsumption', () => {
  it('devuelve un plan de consumo por ingrediente, en el mismo orden que la receta', () => {
    const rows = [row('row-axe', 'hacha-guerra-maktor-rota'), row('row-salt', 'sal-trueque'), row('row-other', 'odre-agua')];
    const plans = planCraftConsumption(axeRepair, rows, catalogBySlug);
    expect(plans).not.toBeNull();
    expect(plans!.map((p) => p.deleteIds)).toEqual([['row-axe'], ['row-salt']]);
  });
  it('deja remanente si una fila apilada trae más unidades de las que la receta consume', () => {
    const rows = [row('row-axe', 'hacha-guerra-maktor-rota'), row('row-salt', 'sal-trueque', 2)];
    const plans = planCraftConsumption(axeRepair, rows, catalogBySlug);
    expect(plans).toEqual([
      { deleteIds: ['row-axe'], updateRemainder: null },
      { deleteIds: [], updateRemainder: { id: 'row-salt', newQuantity: 1 } },
    ]);
  });
  it('devuelve null si falta alguna cantidad de algún ingrediente (protección ante carrera con canCraft)', () => {
    const rows = [row('row-axe', 'hacha-guerra-maktor-rota')];
    expect(planCraftConsumption(axeRepair, rows, catalogBySlug)).toBeNull();
  });
  it('deja remanente reducido cuando se consume solo parte de una fila apilada (bloque de piedra)', () => {
    const rows = [row('row-stone', 'piedra', 10)];
    const plans = planCraftConsumption(stoneBlock, rows, catalogBySlug);
    expect(plans).toEqual([{ deleteIds: [], updateRemainder: { id: 'row-stone', newQuantity: 5 } }]);
  });
});
