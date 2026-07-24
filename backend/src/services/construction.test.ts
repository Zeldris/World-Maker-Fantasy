import { describe, it, expect } from 'vitest';
import {
  CAMPAMENTO_RECIPE,
  CHOZA_RECIPE,
  ATALAYA_RECIPE,
  checkRecipe,
  detectsBuildIntent,
  planConsumption,
  quantityOf,
  totalQuantity,
  type ConstructionRecipe,
} from './construction.js';
import type { AttributeBlock } from './dice.js';
import { EMPTY_SECONDARY_ATTRIBUTES } from './secondaryAttributes.js';

// Ninguna de las 3 recetas base tiene `requisitos` todavía, así que estos valores no afectan a
// checkRecipe(); existen para no repetir el bloque en cada llamada.
const attrs: AttributeBlock = { fuerza: 10, destreza: 10, sigilo: 10, voluntad: 10, carisma: 10, arcano: 10 };
const secondary = EMPTY_SECONDARY_ATTRIBUTES;

describe('quantityOf', () => {
  it('lee la cantidad del sufijo "(N)"', () => {
    expect(quantityOf('Leña (60)')).toBe(60);
    expect(quantityOf('Piedra (3)')).toBe(3);
  });

  it('sin sufijo, cuenta como 1 unidad suelta', () => {
    expect(quantityOf('Piel de Corredor de Cauce')).toBe(1);
  });
});

describe('totalQuantity', () => {
  it('suma entre varias filas fungibles con el mismo prefijo', () => {
    const rows = [
      { id: '1', name: 'Leña (15)' },
      { id: '2', name: 'Leña de matorral de cuerno (8)' },
      { id: '3', name: 'Piedra (10)' },
    ];
    expect(totalQuantity(rows, 'Leña')).toBe(23);
    expect(totalQuantity(rows, 'Piedra')).toBe(10);
  });
});

describe('checkRecipe', () => {
  it('detecta receta cumplida', () => {
    const rows = [
      { id: '1', name: 'Leña (20)' },
      { id: '2', name: 'Piedra (10)' },
      { id: '3', name: 'Piel de gargantúa (5)' },
    ];
    expect(checkRecipe(CAMPAMENTO_RECIPE, rows, attrs, secondary)).toEqual({ met: true, missing: [] });
  });

  it('reporta exactamente qué falta y cuánto', () => {
    const rows = [{ id: '1', name: 'Leña (8)' }];
    const result = checkRecipe(CAMPAMENTO_RECIPE, rows, attrs, secondary);
    expect(result.met).toBe(false);
    expect(result.missing).toEqual([
      { label: 'leña', tienes: 8, necesitas: 20 },
      { label: 'piedra', tienes: 0, necesitas: 10 },
      { label: 'piel', tienes: 0, necesitas: 5 },
    ]);
  });

  it('bloquea la construcción si no se llega al requisito de atributo de la receta', () => {
    const rows = [
      { id: '1', name: 'Leña (20)' },
      { id: '2', name: 'Piedra (10)' },
      { id: '3', name: 'Piel de gargantúa (5)' },
    ];
    const recipeConRequisito: ConstructionRecipe = { ...CAMPAMENTO_RECIPE, requisitos: { fuerza: 12 } };
    const debil: AttributeBlock = { ...attrs, fuerza: 6 };
    const result = checkRecipe(recipeConRequisito, rows, debil, secondary);
    expect(result.met).toBe(false);
    expect(result.missing).toEqual([{ label: 'fuerza', tienes: 6, necesitas: 12 }]);
  });

  it('el alivio de oficio reduce el requisito exigido de una construcción', () => {
    const rows = [
      { id: '1', name: 'Leña (20)' },
      { id: '2', name: 'Piedra (10)' },
      { id: '3', name: 'Piel de gargantúa (5)' },
    ];
    const recipeConRequisito: ConstructionRecipe = { ...CAMPAMENTO_RECIPE, requisitos: { fuerza: 12 } };
    const debil: AttributeBlock = { ...attrs, fuerza: 8 };
    expect(checkRecipe(recipeConRequisito, rows, debil, secondary, 4)).toEqual({ met: true, missing: [] });
  });
});

describe('planConsumption', () => {
  it('borra filas completas hasta cubrir la cantidad exacta, sin remanente', () => {
    const rows = [
      { id: '1', name: 'Leña (12)' },
      { id: '2', name: 'Leña (8)' },
    ];
    const plan = planConsumption(rows, 'Leña', 20);
    expect(plan.deleteIds.sort()).toEqual(['1', '2']);
    expect(plan.updateRemainder).toBeNull();
  });

  it('deja un remanente reducido en la última fila parcialmente consumida', () => {
    const rows = [{ id: '1', name: 'Leña (25)' }];
    const plan = planConsumption(rows, 'Leña', 20);
    expect(plan.deleteIds).toEqual([]);
    expect(plan.updateRemainder).toEqual({ id: '1', newQuantity: 5 });
  });

  it('combina filas completas + una parcial', () => {
    const rows = [
      { id: '1', name: 'Leña (10)' },
      { id: '2', name: 'Leña (15)' },
    ];
    const plan = planConsumption(rows, 'Leña', 20);
    expect(plan.deleteIds).toEqual(['1']);
    expect(plan.updateRemainder).toEqual({ id: '2', newQuantity: 5 });
  });
});

describe('detectsBuildIntent', () => {
  it('detecta construir/levantar/montar un campamento', () => {
    expect(detectsBuildIntent(CAMPAMENTO_RECIPE, 'Me quedo aquí varios días construyendo un campamento base permanente')).toBe(true);
    expect(detectsBuildIntent(CAMPAMENTO_RECIPE, 'Levanto un campamento para pasar la noche')).toBe(true);
    expect(detectsBuildIntent(CAMPAMENTO_RECIPE, 'Monto el campamento junto al río')).toBe(true);
  });

  it('no dispara para descansar en un campamento ya existente', () => {
    expect(detectsBuildIntent(CAMPAMENTO_RECIPE, 'Vuelvo al campamento a descansar')).toBe(false);
    expect(detectsBuildIntent(CAMPAMENTO_RECIPE, 'Construyo una antorcha')).toBe(false);
  });

  it('detecta construir una choza/cabaña, distinto del campamento', () => {
    expect(detectsBuildIntent(CHOZA_RECIPE, 'Levanto una choza de piel y hueso junto al pozo')).toBe(true);
    expect(detectsBuildIntent(CHOZA_RECIPE, 'Construyo una cabaña para pasar el invierno')).toBe(true);
    expect(detectsBuildIntent(CAMPAMENTO_RECIPE, 'Levanto una choza de piel y hueso junto al pozo')).toBe(false);
  });

  it('detecta construir una atalaya de vigía, distinta de las otras dos', () => {
    expect(detectsBuildIntent(ATALAYA_RECIPE, 'Levanto una atalaya de vigía en el cruce')).toBe(true);
    expect(detectsBuildIntent(CAMPAMENTO_RECIPE, 'Levanto una atalaya de vigía en el cruce')).toBe(false);
    expect(detectsBuildIntent(CHOZA_RECIPE, 'Levanto una atalaya de vigía en el cruce')).toBe(false);
  });
});

describe('checkRecipe — recetas nuevas', () => {
  it('choza: cumplida con piel/hueso largo/cuerda de tendón suficientes', () => {
    const rows = [
      { id: '1', name: 'Piel de gargantúa (10)' },
      { id: '2', name: 'Hueso largo de gargantúa (6)' },
      { id: '3', name: 'Cuerda de tendón (4)' },
    ];
    expect(checkRecipe(CHOZA_RECIPE, rows, attrs, secondary)).toEqual({ met: true, missing: [] });
  });

  it('atalaya: cumplida con piedra/leña suficientes', () => {
    const rows = [
      { id: '1', name: 'Piedra (15)' },
      { id: '2', name: 'Leña (10)' },
    ];
    expect(checkRecipe(ATALAYA_RECIPE, rows, attrs, secondary)).toEqual({ met: true, missing: [] });
  });
});
