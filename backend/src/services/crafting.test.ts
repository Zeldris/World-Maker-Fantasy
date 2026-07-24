import { describe, it, expect } from 'vitest';
import { CRAFTING_RECIPES, detectsCraftIntent, canCraft, craftRequisitoShortfalls, planCraftConsumption, type CraftingRecipe } from './crafting.js';
import type { AttributeBlock } from './dice.js';
import { EMPTY_SECONDARY_ATTRIBUTES } from './secondaryAttributes.js';

function recipe(key: string): CraftingRecipe {
  const found = CRAFTING_RECIPES.find((r) => r.key === key);
  if (!found) throw new Error(`receta de prueba no encontrada: ${key}`);
  return found;
}

// Atributos de prueba que SÍ cumplen los requisitos reales de las 5 recetas base (fuerza 12 de
// axeRepair, fuerza 10 de gargantuaArmor, inteligencia 8 de antidote) — para que los tests de
// materiales/ubicación de más abajo prueben SOLO eso, sin toparse con el umbral de atributo.
const attrs: AttributeBlock = { fuerza: 12, destreza: 10, sigilo: 10, voluntad: 10, carisma: 10, arcano: 10 };
const secondary = { ...EMPTY_SECONDARY_ATTRIBUTES, inteligencia: 8 };

const axeRepair = recipe('axeRepair');
const smokeMeat = recipe('smokeMeat');
const gargantuaArmor = recipe('gargantuaArmor');
const antidote = recipe('antidote');
const fieldTorch = recipe('fieldTorch');

describe('CRAFTING_RECIPES', () => {
  it('tiene las 5 recetas esperadas, cada una con una clave única', () => {
    expect(CRAFTING_RECIPES.map((r) => r.key)).toEqual(['axeRepair', 'smokeMeat', 'gargantuaArmor', 'antidote', 'fieldTorch']);
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
});

describe('canCraft', () => {
  it('exige la ubicación correcta cuando la receta la requiere (hacha rota)', () => {
    const materials = ['Hacha de guerra rota', 'Sal de trueque ×2'];
    expect(canCraft(axeRepair, 'campamento-serhu', materials, attrs, secondary)).toBe(true);
    expect(canCraft(axeRepair, 'hondonada-del-eco', materials, attrs, secondary)).toBe(false);
  });
  it('reconoce un lote ("×2"/"(N)") aunque el nombre exacto no coincida', () => {
    expect(canCraft(axeRepair, 'campamento-serhu', ['Hacha de guerra rota', 'Sal de trueque ×2'], attrs, secondary)).toBe(true);
    expect(canCraft(smokeMeat, null, ['Ración de carne fresca (4)'], attrs, secondary)).toBe(true);
    expect(canCraft(gargantuaArmor, 'campamento-serhu', ['Placa ósea de gargantúa (2)', 'Cuerda de tendón (2)'], attrs, secondary)).toBe(
      true,
    );
  });
  it('no permite craftear si falta cualquiera de los ingredientes', () => {
    expect(canCraft(axeRepair, 'campamento-serhu', ['Hacha de guerra rota'], attrs, secondary)).toBe(false);
    expect(canCraft(axeRepair, 'campamento-serhu', ['Sal de trueque ×2'], attrs, secondary)).toBe(false);
    expect(canCraft(gargantuaArmor, 'campamento-serhu', ['Placa ósea de gargantúa (2)'], attrs, secondary)).toBe(false);
    expect(canCraft(antidote, null, ['Manojo de salvia del polvo'], attrs, secondary)).toBe(false);
    expect(canCraft(fieldTorch, null, ['Leña de matorral de cuerno'], attrs, secondary)).toBe(false);
  });
  it('no exige ubicación en recetas sin condición de sitio', () => {
    expect(canCraft(smokeMeat, 'cualquier-sitio', ['Ración de carne fresca'], attrs, secondary)).toBe(true);
    expect(canCraft(antidote, null, ['Manojo de salvia del polvo', 'Pétalos de Flor de Ceniza'], attrs, secondary)).toBe(true);
    expect(canCraft(fieldTorch, null, ['Leña de matorral de cuerno', 'Bloque de resina de Trepador Ocaso'], attrs, secondary)).toBe(
      true,
    );
  });
  it('bloquea el crafteo si no se llega al requisito de atributo de la receta', () => {
    const debil: AttributeBlock = { ...attrs, fuerza: 4 };
    const recipeConRequisito: CraftingRecipe = { ...axeRepair, requisitos: { fuerza: 12 } };
    expect(
      canCraft(recipeConRequisito, 'campamento-serhu', ['Hacha de guerra rota', 'Sal de trueque ×2'], debil, secondary),
    ).toBe(false);
    expect(craftRequisitoShortfalls(recipeConRequisito, debil, secondary)).toEqual([{ atributo: 'fuerza', tienes: 4, necesitas: 12 }]);
  });
  it('el alivio de oficio reduce el requisito exigido', () => {
    const debil: AttributeBlock = { ...attrs, fuerza: 8 };
    const recipeConRequisito: CraftingRecipe = { ...axeRepair, requisitos: { fuerza: 12 } };
    expect(craftRequisitoShortfalls(recipeConRequisito, debil, secondary, 4)).toEqual([]);
  });
});

describe('planCraftConsumption', () => {
  it('devuelve los ids reales de las filas que hay que borrar, en el mismo orden que los ingredientes', () => {
    const rows = [
      { id: 'row-axe', name: 'Hacha de guerra rota' },
      { id: 'row-salt', name: 'Sal de trueque ×2' },
      { id: 'row-other', name: 'Odre de agua' },
    ];
    expect(planCraftConsumption(axeRepair, rows)).toEqual(['row-axe', 'row-salt']);
  });
  it('devuelve null si falta alguna fila de ingrediente (protección ante carrera con canCraft)', () => {
    const rows = [{ id: 'row-axe', name: 'Hacha de guerra rota' }];
    expect(planCraftConsumption(axeRepair, rows)).toBeNull();
  });
});
