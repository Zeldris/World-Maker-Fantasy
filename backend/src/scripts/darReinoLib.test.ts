import { describe, it, expect } from 'vitest';
import { parsearPeticionReino, posicionJuntoAlAyuntamiento, ajustarATopes, primerExcesoDeTope, quienLevanta } from './darReinoLib.js';

describe('posición y topes (QA-143)', () => {
  it('coloca junto al Ayuntamiento sin coincidir con otro edificio', () => {
    const a = posicionJuntoAlAyuntamiento({ x: 400, y: 300 }, [{ x: 400, y: 300 }]);
    expect(a).not.toBeNull();
    expect(a).not.toEqual({ x: 400, y: 300 });
    const b = posicionJuntoAlAyuntamiento({ x: 400, y: 300 }, [{ x: 400, y: 300 }, a!]);
    expect(b).not.toEqual(a);
    expect(posicionJuntoAlAyuntamiento({ x: null, y: null }, [])).toBeNull();
  });
  it('rechaza los materiales que pasan del tope y dice el tope', () => {
    expect(primerExcesoDeTope({ materiales: 70 }, { materiales: 0 }, { materiales: 60 })).toContain('tope de 60');
    expect(primerExcesoDeTope({ materiales: 10 }, { materiales: 55 }, { materiales: 60 })).toContain('hueco 5');
    expect(primerExcesoDeTope({ materiales: 5 }, { materiales: 55 }, { materiales: 60 })).toBeNull();
  });
  it('P378: comida y bebida que pasan del tope dan lo que cabe y avisan', () => {
    const t = { comida: 60, bebida: 60 };
    expect(ajustarATopes({ comida: 120, bebida: 10 }, { comida: 20, bebida: 0 }, t)).toEqual({ comida: 40, bebida: 10, avisos: ['comida: se dan 40 de 120: tope 60 (hay 20).'] });
    expect(ajustarATopes({ comida: 5, bebida: 5 }, { comida: 0, bebida: 0 }, t)).toEqual({ comida: 5, bebida: 5, avisos: [] });
    // ya por encima del tope: no da nada (nunca negativo)
    expect(ajustarATopes({ comida: 5, bebida: 0 }, { comida: 70, bebida: 0 }, t)).toMatchObject({ comida: 0 });
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

describe('quién levanta una obra (QA-269)', () => {
  it('el personaje hasta su tier máximo y la Casa de obras por encima', () => {
    expect(quienLevanta(1)).toBe('personaje');
    expect(quienLevanta(3)).toBe('personaje');
    expect(quienLevanta(4)).toBe('casa-de-obras');
    expect(quienLevanta(6)).toBe('casa-de-obras');
  });
});
