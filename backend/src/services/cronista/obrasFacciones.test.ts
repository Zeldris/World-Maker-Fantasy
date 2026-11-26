import { describe, it, expect } from 'vitest';
import { suministrosDeEdificios } from './economiaReino.js';
import {
  elegirObraDeFaccion,
  factorDePlazo,
  obrerosDisponibles,
  obrerosNecesarios,
  plazoDeObra,
  suministrosParaBocas,
  type EdificioDeFaccion,
  type EstadoDeObras,
} from './obrasFacciones.js';

const fila = (recipeKey: string, tier: number | null = null, cantidad = 1): EdificioDeFaccion => ({ id: `b-${recipeKey}`, recipeKey, tier, cantidad });

/// Estado de una facción de 30 bocas que no necesita nada, con los edificios dados.
function estado(parte: Partial<EstadoDeObras> & { edificios?: EdificioDeFaccion[] } = {}): EstadoDeObras {
  const edificios = parte.edificios ?? [fila('pozo', null, 2), fila('cisterna', null, 25), fila('granero', null, 25), fila('cocina', 1)];
  return { bocas: 30, comida: 100, tieneRebano: false, ...parte, edificios, suministros: parte.suministros ?? suministrosDeEdificios(edificios, true) };
}

describe('CR-36 36a: qué obra elige una facción (Q30)', () => {
  it('sin carencias ni oficio pendiente no construye nada de lo que no necesita', () => {
    // Con cocina de escalón 3 no queda mejora y sin rebaño no hay Corrales.
    expect(elegirObraDeFaccion(estado({ edificios: [fila('pozo', null, 2), fila('cisterna', null, 25), fila('granero', null, 25), fila('cocina', 3)] }))).toBeNull();
  });

  it('sed primero: agua por debajo de lo que beben sus bocas pide un Pozo, aunque también falte almacén y oficio', () => {
    // 30 bocas × 1,1 = 33 y solo da la fuente (20).
    expect(elegirObraDeFaccion(estado({ edificios: [], comida: 0 }))).toEqual({ recipeKey: 'pozo', mejoraDe: null });
  });

  it('con agua de sobra, el tope de bebida por debajo de 30 días pide una Cisterna', () => {
    // 30 bocas: 900 de bebida; con 7 Cisternas hay 60 + 840 = 900 (justo, no falta) y con 6, 780 (falta).
    const pozos = fila('pozo', null, 2);
    expect(elegirObraDeFaccion(estado({ edificios: [pozos, fila('cisterna', null, 6), fila('granero', null, 25), fila('cocina', 1)] }))?.recipeKey).toBe('cisterna');
    expect(elegirObraDeFaccion(estado({ edificios: [pozos, fila('cisterna', null, 7), fila('granero', null, 25), fila('cocina', 1)] }))?.recipeKey).not.toBe('cisterna');
  });

  it('hambre: la comida al 90 % del tope o un tope menor de 30 días pide un Granero', () => {
    const sinGranero = [fila('pozo', null, 2), fila('cisterna', null, 25), fila('cocina', 1)];
    expect(elegirObraDeFaccion(estado({ edificios: sinGranero, comida: 10 }))?.recipeKey).toBe('granero'); // tope 60 < 900
    const granero25 = [...sinGranero, fila('granero', null, 25)]; // tope 3060
    expect(elegirObraDeFaccion(estado({ edificios: granero25, comida: 2754 }))?.recipeKey).toBe('granero'); // 90 % de 3060
    expect(elegirObraDeFaccion(estado({ edificios: granero25, comida: 2753 }))?.recipeKey).not.toBe('granero');
  });

  it('oficio: sin Cocina la levanta; con rebaño y sin Corrales, también; después sube el escalón de la fila existente', () => {
    const base = [fila('pozo', null, 2), fila('cisterna', null, 25), fila('granero', null, 25)];
    expect(elegirObraDeFaccion(estado({ edificios: base }))).toEqual({ recipeKey: 'cocina', mejoraDe: null });
    // Una Cocina que ya es de catálogo (`cocina-serhu`) cuenta como Cocina.
    expect(elegirObraDeFaccion(estado({ edificios: [...base, fila('cocina-serhu')] }))).toBeNull();
    expect(elegirObraDeFaccion(estado({ edificios: [...base, fila('cocina', 3)], tieneRebano: true }))).toEqual({ recipeKey: 'corrales', mejoraDe: null });
    expect(elegirObraDeFaccion(estado({ edificios: [...base, fila('cocina', 1)] }))).toEqual({ recipeKey: 'cocina-obrador', mejoraDe: 'b-cocina' });
    expect(elegirObraDeFaccion(estado({ edificios: [...base, fila('cocina', 2)] }))).toEqual({ recipeKey: 'cocina-gran-obrador', mejoraDe: 'b-cocina' });
    // Sin rebaño los Corrales no se tocan; con él, suben tras la Cocina.
    const conCorrales = [...base, fila('cocina', 3), fila('corrales', 1)];
    expect(elegirObraDeFaccion(estado({ edificios: conCorrales }))).toBeNull();
    expect(elegirObraDeFaccion(estado({ edificios: conCorrales, tieneRebano: true }))).toEqual({ recipeKey: 'corrales-obrador', mejoraDe: 'b-corrales' });
  });

  it('nunca elige Leñera, Cantera ni Fibrería', () => {
    for (const e of [estado({ edificios: [] }), estado({ edificios: [], comida: 1e6 }), estado({ tieneRebano: true })]) {
      expect(['lenera', 'cantera', 'fibreria']).not.toContain(elegirObraDeFaccion(e)?.recipeKey);
    }
  });
});

describe('CR-36 36a: plazo según los obreros (Q29)', () => {
  it('los disponibles son un 5 % de los trabajadores y se piden 5 por tier', () => {
    expect([0, 19, 20, 100].map(obrerosDisponibles)).toEqual([0, 0, 1, 5]);
    expect([1, 2, 7].map(obrerosNecesarios)).toEqual([5, 10, 35]);
  });

  it('factor = obreros necesarios / disponibles, de ×1 a ×4; sin obreros, ×4', () => {
    expect(factorDePlazo(2, 200)).toBe(1); // 10 de 10
    expect(factorDePlazo(2, 100)).toBe(2); // 5 disponibles de 10
    expect(factorDePlazo(1, 60)).toBe(2); // 3 de 5 → ceil(1,67)
    expect(factorDePlazo(7, 100)).toBe(4); // 5 de 35 = ×7, topa en 4
    expect(factorDePlazo(1, 10)).toBe(4); // sin obreros
    expect(factorDePlazo(1, 5000)).toBe(1); // sobran: nunca menos de ×1
  });

  it('el plazo es tier × factor', () => {
    expect(plazoDeObra(2, 100)).toBe(4);
    expect(plazoDeObra(1, 200)).toBe(1);
    expect(plazoDeObra(4, 0)).toBe(16);
  });
});

describe('CR-36 36a: siembra por población máxima (Q39)', () => {
  it('Pozos para el agua con 10 % de margen; Cisternas y Graneros para 30 días', () => {
    // 100 bocas: agua 110 → (110 - 20) / 12 = 7,5 → 8; 3000 - 60 = 2940 / 120 = 24,5 → 25.
    expect(suministrosParaBocas(100)).toEqual({ pozo: 8, cisterna: 25, granero: 25 });
    // 12 bocas: la fuente (20) basta y 360 - 60 = 300 / 120 → 3.
    expect(suministrosParaBocas(12)).toEqual({ pozo: 0, cisterna: 3, granero: 3 });
    expect(suministrosParaBocas(0)).toEqual({ pozo: 0, cisterna: 0, granero: 0 });
  });

  it('lo sembrado cubre sus bocas con la regla del Reino (nadie arranca en carencia)', () => {
    for (const bocas of [10, 57, 100, 333, 1200]) {
      const n = suministrosParaBocas(bocas);
      const s = suministrosDeEdificios([{ recipeKey: 'pozo', cantidad: n.pozo }, { recipeKey: 'cisterna', cantidad: n.cisterna }, { recipeKey: 'granero', cantidad: n.granero }], true);
      expect(s.agua).toBeGreaterThanOrEqual(bocas * 1.1);
      expect(s.topeBebida).toBeGreaterThanOrEqual(bocas * 30);
      expect(s.topeComida).toBeGreaterThanOrEqual(bocas * 30);
    }
  });
});
