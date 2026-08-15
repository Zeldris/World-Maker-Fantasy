import { describe, it, expect } from 'vitest';
import { quantityOf, baseNameOf, totalQuantity, planConsumption, type IngredientRequirement, type CatalogLookup } from './ingredients.js';

describe('quantityOf', () => {
  it('lee la cantidad del sufijo "(N)"', () => {
    expect(quantityOf('Leña (60)')).toBe(60);
    expect(quantityOf('Piedra (3)')).toBe(3);
  });

  it('sin sufijo, cuenta como 1 unidad suelta', () => {
    expect(quantityOf('Piel de Corredor de Cauce')).toBe(1);
  });
});

describe('baseNameOf', () => {
  it('quita el sufijo de cantidad', () => {
    expect(baseNameOf('Leña (60)')).toBe('Leña');
    expect(baseNameOf('Piel de Corredor de Cauce')).toBe('Piel de Corredor de Cauce');
  });
});

const catalogBySlug = new Map<string, CatalogLookup>([
  ['piel-corredor', { tipo: 'RECURSO', category: 'piel' }],
  ['piel-gargantua', { tipo: 'RECURSO', category: 'piel' }],
  ['piedra', { tipo: 'RECURSO', category: 'piedra' }],
  ['mena-de-hierro', { tipo: 'RECURSO', category: 'mena' }],
  ['lingote-de-hierro', { tipo: 'MATERIAL', category: 'metal' }],
  ['punado-arena-iman', { tipo: 'RECURSO', category: 'piedra' }],
  ['saquito-arena-iman', { tipo: 'NARRATIVO', category: 'valor' }],
]);

describe('totalQuantity — ingrediente exacto', () => {
  it('suma solo filas con ese catalogSlug exacto, ignora otras aunque compartan tipo/categoría', () => {
    const rows = [
      { id: '1', name: 'Mena de hierro (4)', catalogSlug: 'mena-de-hierro' },
      { id: '2', name: 'Piedra (10)', catalogSlug: 'piedra' },
    ];
    const ingredient: IngredientRequirement = { match: { kind: 'exact', catalogSlug: 'mena-de-hierro' }, cantidad: 4, label: 'mena de hierro' };
    expect(totalQuantity(rows, ingredient, catalogBySlug)).toBe(4);
  });
});

describe('totalQuantity — ingrediente fungible por categoría', () => {
  it('suma entre varias filas de distinto catalogSlug que comparten tipo+categoría', () => {
    const rows = [
      { id: '1', name: 'Piel de Corredor de Cauce', catalogSlug: 'piel-corredor' },
      { id: '2', name: 'Piel de gargantúa (2)', catalogSlug: 'piel-gargantua' },
      { id: '3', name: 'Piedra (10)', catalogSlug: 'piedra' },
    ];
    const ingredient: IngredientRequirement = { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 5, label: 'piel' };
    expect(totalQuantity(rows, ingredient, catalogBySlug)).toBe(3);
  });

  it('un objeto de otro tipo con la misma etiqueta de categoría no cuenta (tipo también debe coincidir)', () => {
    const rows = [{ id: '1', name: 'Lingote de hierro', catalogSlug: 'lingote-de-hierro' }];
    const ingredient: IngredientRequirement = { match: { kind: 'category', tipo: 'RECURSO', category: 'metal' }, cantidad: 1, label: 'metal crudo' };
    expect(totalQuantity(rows, ingredient, catalogBySlug)).toBe(0);
  });

  it('filas sin catalogSlug (objetos narrativos sueltos) nunca matchean un ingrediente por categoría', () => {
    const rows = [{ id: '1', name: 'Amuleto misterioso', catalogSlug: null }];
    const ingredient: IngredientRequirement = { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 1, label: 'piel' };
    expect(totalQuantity(rows, ingredient, catalogBySlug)).toBe(0);
  });
});

const PUNADO_OR_SAQUITO: IngredientRequirement = {
  match: { kind: 'exact', catalogSlug: 'punado-arena-iman' },
  cantidad: 4,
  label: 'puñado de arena imán',
  orMatch: { match: { kind: 'exact', catalogSlug: 'saquito-arena-iman' }, unitsPerMatch: 4 },
};

describe('totalQuantity — con orMatch', () => {
  it('falta el ingrediente normal pero sobra el alternativo: cuenta el equivalente', () => {
    const rows = [{ id: '1', name: 'Saquito de arena imán', catalogSlug: 'saquito-arena-iman' }];
    expect(totalQuantity(rows, PUNADO_OR_SAQUITO, catalogBySlug)).toBe(4);
  });

  it('sobra el normal pero falta el alternativo: cuenta solo el normal', () => {
    const rows = [{ id: '1', name: 'Puñado de arena imán (4)', catalogSlug: 'punado-arena-iman' }];
    expect(totalQuantity(rows, PUNADO_OR_SAQUITO, catalogBySlug)).toBe(4);
  });

  it('faltan los dos: no cumple', () => {
    const rows = [{ id: '1', name: 'Puñado de arena imán (2)', catalogSlug: 'punado-arena-iman' }];
    expect(totalQuantity(rows, PUNADO_OR_SAQUITO, catalogBySlug)).toBe(2);
  });

  it('suma normal + equivalente del alternativo si hay de los dos', () => {
    const rows = [
      { id: '1', name: 'Puñado de arena imán (2)', catalogSlug: 'punado-arena-iman' },
      { id: '2', name: 'Saquito de arena imán', catalogSlug: 'saquito-arena-iman' },
    ];
    expect(totalQuantity(rows, PUNADO_OR_SAQUITO, catalogBySlug)).toBe(6);
  });
});

describe('planConsumption — con orMatch', () => {
  it('prefiere la alternativa ya completa en vez de trocear el normal', () => {
    const rows = [
      { id: '1', name: 'Puñado de arena imán (4)', catalogSlug: 'punado-arena-iman' },
      { id: '2', name: 'Saquito de arena imán', catalogSlug: 'saquito-arena-iman' },
    ];
    const plan = planConsumption(rows, PUNADO_OR_SAQUITO, catalogBySlug);
    expect(plan.deleteIds).toEqual(['2']);
    expect(plan.updateRemainder).toBeNull();
  });

  it('sin alternativa disponible, consume del normal como siempre', () => {
    const rows = [{ id: '1', name: 'Puñado de arena imán (4)', catalogSlug: 'punado-arena-iman' }];
    const plan = planConsumption(rows, PUNADO_OR_SAQUITO, catalogBySlug);
    expect(plan.deleteIds).toEqual(['1']);
    expect(plan.updateRemainder).toBeNull();
  });

  it('con una pila de varios saquitos, deja remanente reducido si sobra equivalente', () => {
    const rows = [{ id: '1', name: 'Saquito de arena imán (3)', catalogSlug: 'saquito-arena-iman' }];
    const plan = planConsumption(rows, PUNADO_OR_SAQUITO, catalogBySlug);
    expect(plan.deleteIds).toEqual([]);
    expect(plan.updateRemainder).toEqual({ id: '1', newQuantity: 2 });
  });
});

describe('planConsumption', () => {
  it('borra filas enteras hasta cubrir la cantidad, sin remanente si encaja exacto', () => {
    const rows = [
      { id: '1', name: 'Piel de Corredor de Cauce', catalogSlug: 'piel-corredor' },
      { id: '2', name: 'Piel de gargantúa (4)', catalogSlug: 'piel-gargantua' },
    ];
    const ingredient: IngredientRequirement = { match: { kind: 'category', tipo: 'RECURSO', category: 'piel' }, cantidad: 5, label: 'piel' };
    const plan = planConsumption(rows, ingredient, catalogBySlug);
    expect(plan.deleteIds).toEqual(['1', '2']);
    expect(plan.updateRemainder).toBeNull();
  });

  it('deja un remanente reducido en la última fila si sobra', () => {
    const rows = [{ id: '1', name: 'Piedra (10)', catalogSlug: 'piedra' }];
    const ingredient: IngredientRequirement = { match: { kind: 'category', tipo: 'RECURSO', category: 'piedra' }, cantidad: 5, label: 'piedra' };
    const plan = planConsumption(rows, ingredient, catalogBySlug);
    expect(plan.deleteIds).toEqual([]);
    expect(plan.updateRemainder).toEqual({ id: '1', newQuantity: 5 });
  });
});
