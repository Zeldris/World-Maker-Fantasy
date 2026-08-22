import { describe, it, expect } from 'vitest';
import { CRAFTING_RECIPES, detectsCraftIntent, canCraft, craftRequisitoShortfalls, planCraftConsumption, craftDurationSecondsFor, type CraftingRecipe } from './crafting.js';
import type { AttributeBlock } from './dice.js';
import { EMPTY_SECONDARY_ATTRIBUTES } from './secondaryAttributes.js';
import type { CatalogLookup, InventoryRowLike } from './ingredients.js';

function recipe(key: string): CraftingRecipe {
  const found = CRAFTING_RECIPES.find((r) => r.key === key);
  if (!found) throw new Error(`receta de prueba no encontrada: ${key}`);
  return found;
}

// Atributos de prueba que SÍ cumplen los requisitos reales de todas las recetas base (fuerza 12
// de axeRepair, fuerza 18 de gargantuaArmor —subido de 10 el 2026-08-15—, inteligencia 8 de
// antidote, fuerza 8 de ironIngot, fuerza 6 de stoneBlock) — para que los tests de materiales/
// ubicación de más abajo prueben SOLO eso, sin toparse con el umbral de atributo.
const attrs: AttributeBlock = { fuerza: 18, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 };
const secondary = { ...EMPTY_SECONDARY_ATTRIBUTES, inteligencia: 8 };

const axeRepair = recipe('axeRepair');
const smokeMeat = recipe('smokeMeat');
const gargantuaArmor = recipe('gargantuaArmor');
const antidote = recipe('antidote');
const fieldTorch = recipe('fieldTorch');
const ironIngot = recipe('ironIngot');
const magnetizedIronIngot = recipe('magnetizedIronIngot');
const compassNeedle = recipe('compassNeedle');
const sandPouch = recipe('sandPouch');
const stoneBlock = recipe('stoneBlock');
const firstAidBandage = recipe('firstAidBandage');
const redSpikeInfusion = recipe('redSpikeInfusion');
const basicPoultice = recipe('basicPoultice');
const completePoultice = recipe('completePoultice');
const club = recipe('club');
const gargantuaLegArmor = recipe('gargantuaLegArmor');

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
  ['infusion-petalos-flor-ceniza', { tipo: 'CONSUMIBLE', category: 'medicinal' }],
  ['lena-matorral-cuerno', { tipo: 'RECURSO', category: 'madera' }],
  ['resina-trepador-ocaso', { tipo: 'RECURSO', category: 'resina' }],
  ['mena-hierro-llanuras', { tipo: 'RECURSO', category: 'mena' }],
  ['piedra', { tipo: 'RECURSO', category: 'piedra' }],
  ['odre-agua', { tipo: 'EQUIPABLE', category: 'herramienta' }],
  ['grano-espiga-roja', { tipo: 'CONSUMIBLE', category: 'consumible' }],
  ['piel-gargantua', { tipo: 'RECURSO', category: 'piel' }],
  ['punado-arena-iman', { tipo: 'RECURSO', category: 'piedra' }],
  ['saquito-arena-iman', { tipo: 'NARRATIVO', category: 'valor' }],
  ['cardo-brujula', { tipo: 'RECURSO', category: 'hierba' }],
  ['lingote-hierro-imantado', { tipo: 'MATERIAL', category: 'metal' }],
  ['cuchillo-hielo-silice', { tipo: 'EQUIPABLE', category: 'arma', herramientaParaOficio: ['curtidor', 'desollador'] }],
]);

function row(id: string, catalogSlug: string, cantidad?: number): InventoryRowLike {
  return { id, name: cantidad ? `${catalogSlug} (${cantidad})` : catalogSlug, catalogSlug };
}

describe('CRAFTING_RECIPES', () => {
  it('tiene las 18 recetas esperadas, cada una con una clave única', () => {
    expect(CRAFTING_RECIPES.map((r) => r.key)).toEqual([
      'axeRepair',
      'smokeMeat',
      'gargantuaArmor',
      'antidote',
      'fieldTorch',
      'ironIngot',
      'magnetizedIronIngot',
      'compassNeedle',
      'sandPouch',
      'stoneBlock',
      'firstAidBandage',
      'redSpikeInfusion',
      'basicPoultice',
      'completePoultice',
      'club',
      'gargantuaLegArmor',
      'boungoRoast',
      'coraceloMace',
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

  it('detecta intención de fundir un lingote de hierro imantado, distinto del normal (2026-08-15)', () => {
    expect(detectsCraftIntent(magnetizedIronIngot, 'Fundo un lingote de hierro imantado')).toBe(true);
    expect(detectsCraftIntent(magnetizedIronIngot, 'Quiero forjar el hierro imantado')).toBe(true);
    expect(detectsCraftIntent(magnetizedIronIngot, 'Fundo mi mena en un lingote de hierro')).toBe(false);
  });

  it('"lingote de hierro imantado" ya NO dispara la receta normal (nounRegex excluye "imantado" a propósito, evita ambigüedad)', () => {
    expect(detectsCraftIntent(ironIngot, 'Fundo un lingote de hierro imantado')).toBe(false);
    expect(detectsCraftIntent(ironIngot, 'Fundo mi mena en un lingote de hierro')).toBe(true);
  });

  it('detecta intención de forjar la Aguja de Cardo Brújula (2026-08-15)', () => {
    expect(detectsCraftIntent(compassNeedle, 'Forjo una aguja de cardo brújula')).toBe(true);
    expect(detectsCraftIntent(compassNeedle, 'Quiero montar la aguja de cardo')).toBe(true);
    expect(detectsCraftIntent(compassNeedle, 'Forjo un hacha')).toBe(false);
  });

  it('detecta intención de coser el Saquito de arena imán (2026-08-15)', () => {
    expect(detectsCraftIntent(sandPouch, 'Coso un saquito de arena imán')).toBe(true);
    expect(detectsCraftIntent(sandPouch, 'Confecciono el saquito imantado')).toBe(true);
    expect(detectsCraftIntent(sandPouch, 'Coso un peto')).toBe(false);
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

  it('detecta intención de tallar un garrote (auditoría de catálogo, 2026-08-13)', () => {
    expect(detectsCraftIntent(club, 'Tallo un garrote con la leña que llevo')).toBe(true);
    expect(detectsCraftIntent(club, 'Fabrico un garrote de matorral de cuerno')).toBe(true);
    expect(detectsCraftIntent(club, 'Tallo un cuchillo')).toBe(false);
  });

  it('detecta intención de confeccionar el faldar de piel de gargantúa', () => {
    expect(detectsCraftIntent(gargantuaLegArmor, 'Confecciono un faldar con mi piel de gargantúa')).toBe(true);
    expect(detectsCraftIntent(gargantuaLegArmor, 'Curto un faldar de piel de gargantúa')).toBe(true);
    expect(detectsCraftIntent(gargantuaLegArmor, 'Confecciono un peto')).toBe(false);
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
    expect(canCraft(antidote, null, [row('1', 'manojo-salvia-polvo'), row('2', 'infusion-petalos-flor-ceniza')], catalogBySlug, attrs, secondary)).toBe(true);
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
      canCraft(basicPoultice, null, [row('1', 'manojo-salvia-polvo'), row('2', 'infusion-petalos-flor-ceniza')], catalogBySlug, attrs, secondary),
    ).toBe(true);
    expect(canCraft(basicPoultice, null, [row('1', 'manojo-salvia-polvo')], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('cataplasma completa exige 2 manojos de salvia + 1 pétalos de Flor de Ceniza — la receta final, más exigente', () => {
    expect(
      canCraft(completePoultice, null, [row('1', 'manojo-salvia-polvo', 2), row('2', 'infusion-petalos-flor-ceniza')], catalogBySlug, attrs, secondary),
    ).toBe(true);
    // Solo 1 manojo (lo que basta para la básica) no llega para la completa.
    expect(
      canCraft(completePoultice, null, [row('1', 'manojo-salvia-polvo', 1), row('2', 'infusion-petalos-flor-ceniza')], catalogBySlug, attrs, secondary),
    ).toBe(false);
  });
});

describe('canCraft — ingrediente fungible por categoría (bloque de piedra)', () => {
  it('cualquier fila tipo=RECURSO/categoría=piedra cuenta, sin importar el catalogSlug exacto', () => {
    expect(canCraft(stoneBlock, null, [row('1', 'piedra', 5)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(stoneBlock, null, [row('1', 'piedra', 4)], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('un ingrediente exacto de otra receta (mena de hierro) no cuenta como piedra', () => {
    expect(canCraft(stoneBlock, null, [row('1', 'mena-hierro-llanuras', 5)], catalogBySlug, attrs, secondary)).toBe(false);
  });
});

describe('canCraft — ironIngot exige mena de hierro exacta y la fragua del campamento', () => {
  it('funde el lingote con 4 de mena en el campamento', () => {
    expect(canCraft(ironIngot, 'campamento-serhu', [row('1', 'mena-hierro-llanuras', 4)], catalogBySlug, attrs, secondary)).toBe(true);
  });
  it('no funde fuera del campamento ni con menos de 4', () => {
    expect(canCraft(ironIngot, 'hondonada-del-eco', [row('1', 'mena-hierro-llanuras', 4)], catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(ironIngot, 'campamento-serhu', [row('1', 'mena-hierro-llanuras', 3)], catalogBySlug, attrs, secondary)).toBe(false);
  });
});

describe('canCraft — lingote de hierro imantado, aguja de cardo brújula y saquito de arena imán (2026-08-15)', () => {
  it('lingote imantado: 1 mena + 4 puñados de arena imán, en el campamento', () => {
    const rows = [row('1', 'mena-hierro-llanuras'), row('2', 'punado-arena-iman', 4)];
    expect(canCraft(magnetizedIronIngot, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(magnetizedIronIngot, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(magnetizedIronIngot, 'campamento-serhu', [row('1', 'mena-hierro-llanuras'), row('2', 'punado-arena-iman', 3)], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('lingote imantado: 1 saquito de arena imán (orMatch) equivale a los 4 puñados', () => {
    const rows = [row('1', 'mena-hierro-llanuras'), row('2', 'saquito-arena-iman')];
    expect(canCraft(magnetizedIronIngot, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
  });
  it('aguja de cardo brújula: 2 Cardo Brújula + 1 lingote imantado, en el campamento', () => {
    const rows = [row('1', 'cardo-brujula', 2), row('2', 'lingote-hierro-imantado')];
    expect(canCraft(compassNeedle, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(compassNeedle, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(compassNeedle, 'campamento-serhu', [row('1', 'cardo-brujula', 1), row('2', 'lingote-hierro-imantado')], catalogBySlug, attrs, secondary)).toBe(false);
  });
  // Herramienta requerida (2026-08-17, oficio curtidor) — el cuchillo de hielo sílice de Gorhorn
  // cuenta como herramienta de peletería; sin él en las filas, `canCraft` da false aunque el resto
  // de requisitos se cumplan (ver test dedicado más abajo, describe "herramienta requerida...").
  it('saquito de arena imán: 1 piel (cualquiera, por categoría) + 2 puñados de arena imán, en el campamento', () => {
    const rows = [row('1', 'piel-gargantua'), row('2', 'punado-arena-iman', 2), row('3', 'cuchillo-hielo-silice')];
    expect(canCraft(sandPouch, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(sandPouch, 'hondonada-del-eco', rows, catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(sandPouch, 'campamento-serhu', [row('1', 'piel-gargantua'), row('2', 'punado-arena-iman', 1)], catalogBySlug, attrs, secondary)).toBe(false);
  });
});

describe('planCraftConsumption — orMatch del lingote imantado (2026-08-15)', () => {
  it('con un saquito ya completo disponible, lo consume entero en vez de fraccionar puñados sueltos', () => {
    const rows = [row('row-mena', 'mena-hierro-llanuras'), row('row-punado', 'punado-arena-iman', 4), row('row-saquito', 'saquito-arena-iman')];
    const plans = planCraftConsumption(magnetizedIronIngot, rows, catalogBySlug);
    expect(plans).toEqual([
      { deleteIds: ['row-mena'], updateRemainder: null },
      { deleteIds: ['row-saquito'], updateRemainder: null },
    ]);
  });
  it('sin saquito disponible, consume del puñado normal como siempre', () => {
    const rows = [row('row-mena', 'mena-hierro-llanuras'), row('row-punado', 'punado-arena-iman', 4)];
    const plans = planCraftConsumption(magnetizedIronIngot, rows, catalogBySlug);
    expect(plans).toEqual([
      { deleteIds: ['row-mena'], updateRemainder: null },
      { deleteIds: ['row-punado'], updateRemainder: null },
    ]);
  });
});

describe('canCraft — 3 objetos antes inalcanzables (auditoría de catálogo, 2026-08-13)', () => {
  it('garrote: 2 de leña de matorral de cuerno, en cualquier sitio', () => {
    expect(canCraft(club, null, [row('1', 'lena-matorral-cuerno', 2)], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(club, null, [row('1', 'lena-matorral-cuerno', 1)], catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('faldar de piel de gargantúa: 2 pieles, solo en el campamento del clan', () => {
    expect(canCraft(gargantuaLegArmor, 'campamento-serhu', [row('1', 'piel-gargantua', 2), row('2', 'cuchillo-hielo-silice')], catalogBySlug, attrs, secondary)).toBe(true);
    expect(canCraft(gargantuaLegArmor, 'hondonada-del-eco', [row('1', 'piel-gargantua', 2)], catalogBySlug, attrs, secondary)).toBe(false);
    expect(canCraft(gargantuaLegArmor, 'campamento-serhu', [row('1', 'piel-gargantua', 1)], catalogBySlug, attrs, secondary)).toBe(false);
  });
});

// Herramienta requerida por oficio (2026-08-17, petición explícita: "cada profesión dependerá de
// tener la herramienta para poder usar esa profesión") — solo bloquea los oficios que de verdad
// tienen alguna herramienta dada de alta en el catálogo (curtidor/desollador hoy); el resto de
// oficios (herrería, minería...) sigue exactamente igual que antes, sin gate.
describe('canCraft — herramienta requerida por oficio (2026-08-17)', () => {
  it('sin ninguna herramienta de curtidor en las filas, una receta con oficio curtidor no se puede craftear aunque sobren ingredientes/atributos', () => {
    const rows = [row('1', 'piel-gargantua', 2)];
    expect(canCraft(gargantuaLegArmor, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(false);
  });
  it('con el cuchillo de hielo sílice en las filas (arma Y herramienta de curtidor a la vez), sí se puede craftear', () => {
    const rows = [row('1', 'piel-gargantua', 2), row('2', 'cuchillo-hielo-silice')];
    expect(canCraft(gargantuaLegArmor, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
  });
  it('un oficio SIN ninguna herramienta registrada en el catálogo (herrero) nunca se bloquea por esto — axeRepair sigue funcionando sin ningún objeto de categoría herramienta', () => {
    const rows = [row('1', 'hacha-guerra-maktor-rota'), row('2', 'sal-trueque')];
    expect(canCraft(axeRepair, 'campamento-serhu', rows, catalogBySlug, attrs, secondary)).toBe(true);
  });
});

// Recetas desbloqueables por misión (2026-08-17) — receta de prueba a mano, ninguna de las 16
// reales lleva requiresUnlock todavía (no rompe nada de lo que ya existe).
describe('canCraft — requiresUnlock (2026-08-17, recompensa de misión no-objeto)', () => {
  const lockedRecipe: CraftingRecipe = { ...axeRepair, key: 'testLockedRecipe', requiresUnlock: true, location: null, requisitos: undefined, oficio: undefined };
  it('sin la clave en unlockedRecipeKeys, se bloquea aunque sobren ingredientes/atributos', () => {
    const rows = [row('1', 'hacha-guerra-maktor-rota'), row('2', 'sal-trueque')];
    expect(canCraft(lockedRecipe, null, rows, catalogBySlug, attrs, secondary, 0, [])).toBe(false);
    expect(canCraft(lockedRecipe, null, rows, catalogBySlug, attrs, secondary, 0, ['otra-receta'])).toBe(false);
  });
  it('con la clave real en unlockedRecipeKeys, se puede craftear', () => {
    const rows = [row('1', 'hacha-guerra-maktor-rota'), row('2', 'sal-trueque')];
    expect(canCraft(lockedRecipe, null, rows, catalogBySlug, attrs, secondary, 0, ['testLockedRecipe'])).toBe(true);
  });
  it('sin requiresUnlock (todas las recetas reales de hoy), unlockedRecipeKeys nunca importa', () => {
    const rows = [row('1', 'hacha-guerra-maktor-rota'), row('2', 'sal-trueque')];
    expect(canCraft(axeRepair, 'campamento-serhu', rows, catalogBySlug, attrs, secondary, 0, [])).toBe(true);
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

describe('craftDurationSecondsFor (espera real, 2026-08-20)', () => {
  it('escala con el tier de la receta, de 5 a 60 segundos reales', () => {
    expect(craftDurationSecondsFor({ ...axeRepair, tier: 1 })).toBe(5);
    expect(craftDurationSecondsFor({ ...axeRepair, tier: 2 })).toBe(20);
    expect(craftDurationSecondsFor({ ...axeRepair, tier: 3 })).toBe(35);
    expect(craftDurationSecondsFor({ ...axeRepair, tier: 4 })).toBe(50);
    expect(craftDurationSecondsFor({ ...axeRepair, tier: 5 })).toBe(60);
  });
  it('cae al mínimo (5s) para recetas sin tier — smokeMeat, "habilidad de supervivencia básica"', () => {
    expect(smokeMeat.tier).toBeUndefined();
    expect(craftDurationSecondsFor(smokeMeat)).toBe(5);
  });
  it('coincide con el tier real ya tabulado en las recetas base', () => {
    expect(craftDurationSecondsFor(axeRepair)).toBe(35); // tier 3
    expect(craftDurationSecondsFor(antidote)).toBe(20); // tier 2
  });
});
