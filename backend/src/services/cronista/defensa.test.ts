import { describe, it, expect } from 'vitest';
import { efectoDefensa, golpeAEmpalizada, moduloDeRecipeKey } from './defensa.js';

/// CR-65 (65a): reglas puras de la defensa de un asentamiento.
describe('defensa del Reino (CR-65)', () => {
  it('sin módulos: nada salvo las 3 plazas de guarnición', () => {
    expect(efectoDefensa({ empalizada: 0, torre: 0, armeria: 0, barracon: 0 })).toEqual({ cobertura: 0, aguante: 0, radioTramos: 0, bonoAltura: 0, equiposMilicia: 0, plazasGuarnicion: 3, bonoMoral: 0 });
  });

  it('cobertura de D&D por escalón (+2, +2, +5); caída no cubre', () => {
    expect([1, 2, 3].map((e) => efectoDefensa({ empalizada: e, torre: 0, armeria: 0, barracon: 0 }).cobertura)).toEqual([2, 2, 5]);
    expect(efectoDefensa({ empalizada: 3, torre: 0, armeria: 0, barracon: 0, empalizadaCaida: true }).cobertura).toBe(0);
  });

  it('la Torre alcanza 1/2/3 tramos con vigía y 1 sin él; +2 desde lo alto', () => {
    expect([1, 2, 3].map((e) => efectoDefensa({ empalizada: 0, torre: e, armeria: 0, barracon: 0, vigiaEnTorre: true }).radioTramos)).toEqual([1, 2, 3]);
    expect(efectoDefensa({ empalizada: 0, torre: 3, armeria: 0, barracon: 0 })).toMatchObject({ radioTramos: 1, bonoAltura: 2 });
  });

  it('Armería y Barracón por escalón', () => {
    expect(efectoDefensa({ empalizada: 0, torre: 0, armeria: 2, barracon: 3 })).toMatchObject({ equiposMilicia: 10, plazasGuarnicion: 20, bonoMoral: 3 });
  });

  it('la Empalizada cae al llegar a su aguante', () => {
    expect(golpeAEmpalizada(1, 0)).toEqual({ golpes: 1, caida: true });
    expect(golpeAEmpalizada(3, 1)).toEqual({ golpes: 2, caida: false });
    expect(golpeAEmpalizada(3, 2)).toEqual({ golpes: 3, caida: true });
  });

  it('módulo de una clave de edificio', () => {
    expect(moduloDeRecipeKey('torre-vigia')).toBe('torre-vigia');
    expect(moduloDeRecipeKey('desolladero')).toBeNull();
  });
});
