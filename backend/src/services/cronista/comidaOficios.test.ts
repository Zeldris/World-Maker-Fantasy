import { describe, expect, it } from 'vitest';
import { comidaDelDia, gananciaCocinero, rendimientoRecolector, repartoDeFaccion } from './comidaOficios.js';

/// CR-61 (61a): comida por oficios.
describe('comida por oficios (CR-61)', () => {
  it('el recolector rinde según la estación', () => {
    expect(rendimientoRecolector('VERANO')).toBe(2.5);
    expect(rendimientoRecolector('OTONO')).toBe(2);
    expect(rendimientoRecolector('INVIERNO')).toBe(1);
  });

  it('el cocinero gana +5, +10 o +15 según su Cocina; sin Cocina, nada', () => {
    expect(gananciaCocinero(1)).toBe(5);
    expect(gananciaCocinero(2)).toBe(10);
    expect(gananciaCocinero(3)).toBe(15);
    expect(gananciaCocinero(null)).toBe(0);
  });

  it('un cocinero sin 10 de crudo no cocina; el pescador solo pesca con agua', () => {
    const c = { recolectores: 0, pescadores: 2, cocineros: 1, cazadores: 0 };
    expect(comidaDelDia(c, { estacion: 'OTONO', hayAgua: true, escalonCocina: 1, comidaDisponible: 0 })).toBe(6); // 6 crudo < 10
    expect(comidaDelDia(c, { estacion: 'OTONO', hayAgua: true, escalonCocina: 1, comidaDisponible: 10 })).toBe(11);
    expect(comidaDelDia(c, { estacion: 'OTONO', hayAgua: false, escalonCocina: 1, comidaDisponible: 0 })).toBe(0);
  });

  it('reparto de facción: los orcos cazan (hasta CR-63) y el resto recolecta y cocina', () => {
    const r = repartoDeFaccion('orcos', 100, false, true);
    expect(r).toEqual({ cazadores: 45, pescadores: 0, cocineros: 17, recolectores: 38 });
    expect(repartoDeFaccion('orcos', 100, false, false).cocineros).toBe(0);
    expect(repartoDeFaccion('nabieus', 100, true, true)).toMatchObject({ cazadores: 0, pescadores: 40, cocineros: 20, recolectores: 40 });
  });

  it('una facción de orcos con Cocina come más que con la comida pasiva de antes (2 por trabajador)', () => {
    const r = repartoDeFaccion('orcos', 100, false, true);
    expect(comidaDelDia(r, { estacion: 'OTONO', hayAgua: false, escalonCocina: 1, comidaDisponible: 100 })).toBeGreaterThan(200);
  });
});
