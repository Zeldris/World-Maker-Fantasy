import { describe, it, expect } from 'vitest';
import { parsearPeticionReino, posicionJuntoAlAyuntamiento, primerExcesoDeTope } from './darReinoLib.js';

describe('posición y topes (QA-143)', () => {
  it('coloca junto al Ayuntamiento sin coincidir con otro edificio', () => {
    const a = posicionJuntoAlAyuntamiento({ x: 400, y: 300 }, [{ x: 400, y: 300 }]);
    expect(a).not.toBeNull();
    expect(a).not.toEqual({ x: 400, y: 300 });
    const b = posicionJuntoAlAyuntamiento({ x: 400, y: 300 }, [{ x: 400, y: 300 }, a!]);
    expect(b).not.toEqual(a);
    expect(posicionJuntoAlAyuntamiento({ x: null, y: null }, [])).toBeNull();
  });
  it('rechaza lo que pasa del tope y dice el tope', () => {
    const z = { comida: 0, bebida: 0, materiales: 0 };
    expect(primerExcesoDeTope({ ...z, comida: 120 }, z, { comida: 60, bebida: 60, materiales: 60 })).toContain('tope de 60');
    expect(primerExcesoDeTope({ ...z, comida: 120 }, z, { comida: 180, bebida: 60, materiales: 60 })).toBeNull();
    expect(primerExcesoDeTope({ ...z, materiales: 10 }, { ...z, materiales: 55 }, { comida: 60, bebida: 60, materiales: 60 })).toContain('hueco 5');
  });
});

describe('petición de recursos del Reino (QA-143)', () => {
  it('lee comida, Goirnos de bolsa y tesoro, y objetos del Almacén', () => {
    expect(parsearPeticionReino(['comida=60', 'goirnos=300', 'tesoro=200', 'almacen:cuerdas:10', 'almacen:piedra'])).toEqual({
      comida: 60, bebida: 0, goirnos: 300, tesoro: 200, almacen: [{ slug: 'cuerdas', cantidad: 10 }, { slug: 'piedra', cantidad: 1 }], edificios: [],
    });
  });
  it('lee edificios terminados por clave de receta', () => {
    expect(parsearPeticionReino(['edificio:granero', 'edificio:cisterna'])).toMatchObject({ edificios: ['granero', 'cisterna'] });
    expect(parsearPeticionReino(['edificio:'])).toHaveProperty('error');
  });
  it('rechaza lo que no entiende sin dar nada', () => {
    expect(parsearPeticionReino([])).toHaveProperty('error');
    expect(parsearPeticionReino(['oro=5'])).toHaveProperty('error');
    expect(parsearPeticionReino(['comida=-3'])).toHaveProperty('error');
    expect(parsearPeticionReino(['almacen:cuerdas:0'])).toHaveProperty('error');
  });
});
