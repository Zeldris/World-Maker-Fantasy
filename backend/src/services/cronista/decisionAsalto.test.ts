import { describe, it, expect } from 'vitest';
import { decidirAtaque, defensaEstimada, margenNecesario, motivoBandidos, motivoGuerra, porQueVienenBandidos, reinoTieneQueLlevarse } from './decisionAsalto.js';

/// CR-67 (67a): asaltos por estado (principio 10 del Cronista).
describe('decisión de asalto (CR-67)', () => {
  it('defensa estimada: guarnición, milicia a 0,6, guardias, cobertura y moral', () => {
    expect(defensaEstimada({ guarnicion: 0, milicia: 0, guardias: 0, cobertura: 0, bonoMoral: 0 })).toBe(0);
    expect(defensaEstimada({ guarnicion: 4, milicia: 5, guardias: 1, cobertura: 5, bonoMoral: 2 })).toBeCloseTo(8 * 1.6);
  });

  it('el margen baja con el motivo y con la intensidad, sin bajar de 0,8', () => {
    expect(margenNecesario(0, 'NORMAL')).toBe(1.5);
    expect(margenNecesario(1, 'NORMAL')).toBeCloseTo(0.9);
    expect(margenNecesario(1, 'DURA')).toBe(0.8);
    expect(margenNecesario(0, 'CONTENIDA')).toBe(1.9);
  });

  it('ataca solo si le alcanza sin dejar su casa vacía; manda lo necesario con colchón', () => {
    const base = { enCasa: 2, defensa: 4, motivo: 0.1, intensidad: 'NORMAL' as const, tamano: 'NORMAL' as const };
    expect(decidirAtaque({ ...base, fuerza: 7 })).toMatchObject({ ataca: false, manda: 0 });
    expect(decidirAtaque({ ...base, fuerza: 12 })).toMatchObject({ ataca: true, manda: 7 });
    // Con mucho motivo se atreve con menos.
    expect(decidirAtaque({ ...base, fuerza: 7, motivo: 1 }).ataca).toBe(true);
    // Contra nadie, al menos 2.
    expect(decidirAtaque({ ...base, fuerza: 5, defensa: 0, motivo: 0.5 })).toMatchObject({ ataca: true, manda: 2 });
    // Sin motivo, nadie se mueve.
    expect(decidirAtaque({ ...base, fuerza: 50, defensa: 0, motivo: 0 }).ataca).toBe(false);
    // El tope cuenta al decidir: si lo que necesita no cabe, no sale.
    expect(decidirAtaque({ ...base, fuerza: 40, enCasa: 14, defensa: 12, motivo: 0.1, maximo: 16 }).ataca).toBe(false);
  });

  it('Fácil manda la mitad (mínimo 2) y decide igual', () => {
    const p = { fuerza: 30, enCasa: 4, defensa: 10, motivo: 0.5, intensidad: 'NORMAL' as const };
    const normal = decidirAtaque({ ...p, tamano: 'NORMAL' });
    const facil = decidirAtaque({ ...p, tamano: 'FACIL' });
    expect(facil.ataca).toBe(normal.ataca);
    expect(facil.manda).toBe(Math.ceil(normal.manda / 2));
    expect(decidirAtaque({ fuerza: 6, enCasa: 2, defensa: 0, motivo: 0.5, intensidad: 'NORMAL', tamano: 'FACIL' }).manda).toBe(2);
    expect(porQueVienenBandidos({ grupo: 'Los renegados', gente: 6, riqueza: 0, comida: 0, botinGuardado: 0, lleno: true })).toContain('no caben');
  });

  it('motivos: el botín atrae a los bandidos; la presión, a una facción en guerra', () => {
    expect(motivoBandidos({ riqueza: 0, comida: 0, botinGuardado: 500, gente: 4, tope: 8, intensidad: 'NORMAL' })).toBe(0);
    expect(motivoBandidos({ riqueza: 1000, comida: 0, botinGuardado: 0, gente: 8, tope: 8, intensidad: 'NORMAL' })).toBe(1);
    expect(motivoBandidos({ riqueza: 500, comida: 0, botinGuardado: 500, gente: 4, tope: 8, intensidad: 'DURA' })).toBeGreaterThan(motivoBandidos({ riqueza: 500, comida: 0, botinGuardado: 500, gente: 4, tope: 8, intensidad: 'CONTENIDA' }));
    // P253: la necesidad sola no mueve a nadie contra un Reino sin nada que llevarse (solo a un Reino; a un viajero se le asalta igual).
    expect(reinoTieneQueLlevarse(0, 0)).toBe(false);
    expect(reinoTieneQueLlevarse(5, 20)).toBe(false);
    expect(reinoTieneQueLlevarse(20, 0)).toBe(true);
    expect(reinoTieneQueLlevarse(0, 40)).toBe(true);
    const g = [79, 80, 90, 100].map(motivoGuerra);
    expect(g[0]).toBe(0);
    expect(g[1]).toBeCloseTo(0.2);
    expect(g[2]).toBeCloseTo(0.6);
    expect(g[3]).toBe(1);
  });
});
