import { describe, it, expect } from 'vitest';
import {
  nivelOficioDeTrabajador,
  trabajadorPuedeProducir,
  almacenAlTope,
  tickOrdenesProduccion,
  type TrabajadorReino,
  type OrdenProduccionInput,
} from './kingdomProduction.js';
import type { CraftingRecipe } from './crafting.js';

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

describe('nivelOficioDeTrabajador', () => {
  it('sin XP en ese oficio, nivel 1 (mismo fallback que professionLevelForXp(0))', () => {
    expect(nivelOficioDeTrabajador(trabajador(), 'herrero-orco-llanuras')).toBe(1);
  });

  it('con XP acumulada en ese oficio, sube de nivel', () => {
    const t = trabajador({ xpPorOficio: { 'herrero-orco-llanuras': 200 } });
    expect(nivelOficioDeTrabajador(t, 'herrero-orco-llanuras')).toBeGreaterThan(1);
  });
});

describe('trabajadorPuedeProducir', () => {
  it('receta sin oficio: cualquier trabajador puede (recolección básica)', () => {
    expect(trabajadorPuedeProducir(trabajador(), recipe({ oficio: undefined, tier: 5 }))).toBe(true);
  });

  it('receta con oficio y tier 1: nivel 1 (sin alivio) ya alcanza', () => {
    expect(trabajadorPuedeProducir(trabajador(), recipe({ oficio: 'herrero-orco-llanuras', tier: 1 }))).toBe(true);
  });

  it('receta de tier alto: un trabajador sin experiencia no llega', () => {
    const recetaTier5 = recipe({ oficio: 'herrero-orco-llanuras', tier: 5 });
    expect(trabajadorPuedeProducir(trabajador(), recetaTier5)).toBe(false);
  });

  it('receta de tier alto: un trabajador con suficiente nivel de oficio sí llega', () => {
    const experto = trabajador({ xpPorOficio: { 'herrero-orco-llanuras': 8000 } });
    const recetaTier5 = recipe({ oficio: 'herrero-orco-llanuras', tier: 5 });
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

describe('tickOrdenesProduccion', () => {
  const recetaSimple = recipe({ key: 'talarMadera', resultCatalogSlug: 'madera-tallada', resultCantidad: 2 });
  const recipesByKey = new Map([['talarMadera', recetaSimple]]);

  it('un trabajador libre produce la orden activa', () => {
    const resultados = tickOrdenesProduccion([orden()], [trabajador()], recipesByKey, new Map(), new Map());
    expect(resultados).toEqual([
      { ordenId: 'orden-1', resultado: 'PRODUCIDA', companionId: 'comp-1', resultCatalogSlug: 'madera-tallada', resultCantidad: 2 },
    ]);
  });

  it('sin trabajadores asignados, la orden queda SIN_TRABAJADOR_CON_NIVEL', () => {
    const resultados = tickOrdenesProduccion([orden()], [], recipesByKey, new Map(), new Map());
    expect(resultados).toEqual([{ ordenId: 'orden-1', resultado: 'SIN_TRABAJADOR_CON_NIVEL' }]);
  });

  it('recipeKey desconocida (huérfana) no rompe el tick, se reporta y se sigue', () => {
    const resultados = tickOrdenesProduccion([orden({ recipeKey: 'noExiste' })], [trabajador()], recipesByKey, new Map(), new Map());
    expect(resultados).toEqual([{ ordenId: 'orden-1', resultado: 'RECETA_DESCONOCIDA' }]);
  });

  it('orden inactiva no se procesa en absoluto', () => {
    const resultados = tickOrdenesProduccion([orden({ activa: false })], [trabajador()], recipesByKey, new Map(), new Map());
    expect(resultados).toEqual([]);
  });

  it('almacén ya al tope del recurso: la orden se salta SIN gastar trabajador (pieza que cierra el sistema)', () => {
    const cantidadAlmacen = new Map([['madera-tallada', 50]]);
    const limites = new Map<string, number | null>([['madera-tallada', 50]]);
    const resultados = tickOrdenesProduccion([orden()], [trabajador()], recipesByKey, cantidadAlmacen, limites);
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
    const resultados = tickOrdenesProduccion(ordenes, [trabajador()], recipesByKeyDos, cantidadAlmacen, limites);
    expect(resultados).toEqual([
      { ordenId: 'o-madera', resultado: 'ALMACEN_LLENO' },
      { ordenId: 'o-piedra', resultado: 'PRODUCIDA', companionId: 'comp-1', resultCatalogSlug: 'piedra-tallada', resultCantidad: 1 },
    ]);
  });

  it('varias órdenes del mismo Building compiten por el mismo trabajador: gana la de mayor prioridad (menor número)', () => {
    const recetaB = recipe({ key: 'recolectarPiedra', resultCatalogSlug: 'piedra-tallada', resultCantidad: 1 });
    const recipesByKeyDos = new Map([
      ['talarMadera', recetaSimple],
      ['recolectarPiedra', recetaB],
    ]);
    const ordenes = [orden({ id: 'o-baja', recipeKey: 'talarMadera', prioridad: 9 }), orden({ id: 'o-alta', recipeKey: 'recolectarPiedra', prioridad: 0 })];
    const resultados = tickOrdenesProduccion(ordenes, [trabajador()], recipesByKeyDos, new Map(), new Map());
    expect(resultados).toEqual([
      { ordenId: 'o-alta', resultado: 'PRODUCIDA', companionId: 'comp-1', resultCatalogSlug: 'piedra-tallada', resultCantidad: 1 },
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
    const resultados = tickOrdenesProduccion(ordenes, [trabajador()], recipesByKeyDos, new Map(), new Map());
    expect(resultados[0].resultado).toBe('PRODUCIDA');
    expect(resultados[1].resultado).toBe('SIN_TRABAJADOR_CON_NIVEL');
  });

  it('orden única que ya alcanzó su límite se marca ORDEN_COMPLETADA sin gastar trabajador', () => {
    const resultados = tickOrdenesProduccion(
      [orden({ modo: 'unico', limite: 5, cantidadProducidaAcumulada: 5 })],
      [trabajador()],
      recipesByKey,
      new Map(),
      new Map(),
    );
    expect(resultados).toEqual([{ ordenId: 'orden-1', resultado: 'ORDEN_COMPLETADA' }]);
  });

  it('trabajador sin nivel de oficio suficiente no produce, la orden queda SIN_TRABAJADOR_CON_NIVEL', () => {
    const recetaExigente = recipe({ key: 'lingoteYerreo', oficio: 'herrero-orco-llanuras', tier: 5, resultCatalogSlug: 'lingote-yerreo' });
    const recipesByKeyExigente = new Map([['lingoteYerreo', recetaExigente]]);
    const resultados = tickOrdenesProduccion([orden({ recipeKey: 'lingoteYerreo' })], [trabajador()], recipesByKeyExigente, new Map(), new Map());
    expect(resultados).toEqual([{ ordenId: 'orden-1', resultado: 'SIN_TRABAJADOR_CON_NIVEL' }]);
  });

  it('entre dos trabajadores, el que tiene nivel de oficio suficiente es el asignado', () => {
    const recetaExigente = recipe({ key: 'lingoteYerreo', oficio: 'herrero-orco-llanuras', tier: 5, resultCatalogSlug: 'lingote-yerreo' });
    const recipesByKeyExigente = new Map([['lingoteYerreo', recetaExigente]]);
    const novato = trabajador({ companionId: 'novato' });
    const experto = trabajador({ companionId: 'experto', xpPorOficio: { 'herrero-orco-llanuras': 8000 } });
    const resultados = tickOrdenesProduccion([orden({ recipeKey: 'lingoteYerreo' })], [novato, experto], recipesByKeyExigente, new Map(), new Map());
    expect(resultados).toEqual([
      { ordenId: 'orden-1', resultado: 'PRODUCIDA', companionId: 'experto', resultCatalogSlug: 'lingote-yerreo', resultCantidad: 1 },
    ]);
  });
});
