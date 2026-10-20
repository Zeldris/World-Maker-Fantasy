import { describe, it, expect } from 'vitest';
import { parsearPeticionReino } from './darReinoLib.js';

describe('petición de recursos del Reino (QA-143)', () => {
  it('lee comida, Goirnos de bolsa y tesoro, y objetos del Almacén', () => {
    expect(parsearPeticionReino(['comida=60', 'goirnos=300', 'tesoro=200', 'almacen:cuerdas:10', 'almacen:piedra'])).toEqual({
      comida: 60, bebida: 0, goirnos: 300, tesoro: 200, almacen: [{ slug: 'cuerdas', cantidad: 10 }, { slug: 'piedra', cantidad: 1 }],
    });
  });
  it('rechaza lo que no entiende sin dar nada', () => {
    expect(parsearPeticionReino([])).toHaveProperty('error');
    expect(parsearPeticionReino(['oro=5'])).toHaveProperty('error');
    expect(parsearPeticionReino(['comida=-3'])).toHaveProperty('error');
    expect(parsearPeticionReino(['almacen:cuerdas:0'])).toHaveProperty('error');
  });
});
