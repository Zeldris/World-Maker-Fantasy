import { describe, it, expect } from 'vitest';
import { atributosPorEdad, cicloVital, edadEnAnios, edadProvisional, esAdulto, MINUTOS_POR_ANIO, nacidoEnDe, probMuerteDeViejoPorDia } from './edades.js';

// CR-13 paso 13b (hito 0.2) — edad, madurez y vejez.
describe('edades (CR-13)', () => {
  const adulto = { fuerza: 16, destreza: 12, constitucion: 14, voluntad: 10, magia: 0 };

  it('madurez orca a los 10 (canon); un orco de 9 aún no es adulto', () => {
    expect(cicloVital('orcos').madurez).toBe(10);
    expect(esAdulto('orcos', 9)).toBe(false);
    expect(esAdulto('orcos', 10)).toBe(true);
  });

  it('los atributos crecen del 40 % al nacer al 100 % a la madurez', () => {
    expect(atributosPorEdad(adulto, 'orcos', 0).fuerza).toBe(Math.round(16 * 0.4));
    expect(atributosPorEdad(adulto, 'orcos', 5).fuerza).toBe(Math.round(16 * 0.7));
    expect(atributosPorEdad(adulto, 'orcos', 10)).toEqual(adulto);
    expect(atributosPorEdad(adulto, 'orcos', 0).magia).toBe(0);
  });

  it('en la vejez (80 % de la esperanza) pierden 1 de fuerza, destreza y constitución por año', () => {
    // Orcos: esperanza 60, vejez desde los 48.
    expect(atributosPorEdad(adulto, 'orcos', 48)).toEqual(adulto);
    const a51 = atributosPorEdad(adulto, 'orcos', 51);
    expect(a51).toMatchObject({ fuerza: 13, destreza: 9, constitucion: 11, voluntad: 10 });
  });

  it('morir de viejo: nunca antes de la vejez y cada vez más probable', () => {
    expect(probMuerteDeViejoPorDia('orcos', 40)).toBe(0);
    const p50 = probMuerteDeViejoPorDia('orcos', 50);
    const p60 = probMuerteDeViejoPorDia('orcos', 60);
    expect(p50).toBeGreaterThan(0);
    expect(p60).toBeGreaterThan(p50);
    expect(probMuerteDeViejoPorDia('orcos', 80)).toBeCloseTo(1 / 120);
  });

  it('edades provisionales del catálogo: deterministas, adultas y sin llegar a la vejez; los líderes, mayores', () => {
    expect(edadProvisional('dulgren', 'orcos', false)).toBe(edadProvisional('dulgren', 'orcos', false));
    for (const slug of ['dulgren', 'doshka', 'gistera-koh', 'hagar-kiugh', 'brenka']) {
      const e = edadProvisional(slug, 'orcos', false);
      expect(e).toBeGreaterThanOrEqual(10);
      expect(e).toBeLessThan(42);
      expect(edadProvisional(slug, 'orcos', true)).toBeGreaterThanOrEqual(30);
    }
    // Sin fecha guardada, la edad en el día 0 es la provisional; un año después, uno más.
    const n = nacidoEnDe({ slug: 'dulgren', raza: 'orcos', nacidoEn: null });
    expect(edadEnAnios(n, 0)).toBe(edadProvisional('dulgren', 'orcos', false));
    expect(edadEnAnios(n, MINUTOS_POR_ANIO)).toBe(edadProvisional('dulgren', 'orcos', false) + 1);
  });
});
