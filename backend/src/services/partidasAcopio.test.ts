import { describe, it, expect } from 'vitest';
import { CONSTRUCTION_RECIPES } from './construction.js';
import { categoriasQueFaltan, guardiasParaRuta } from './partidasAcopio.js';
import type { CatalogLookup } from './ingredients.js';

/// CR-36b (Q-40, Q-41): puros de las partidas de acopio.
describe('guardiasParaRuta (Q-41)', () => {
  const base = { riesgo: false, bandidosCerca: false, enGuerra: false, soldados: 20 };
  it('0 sin riesgo, 2 con enlace de riesgo o campamento cerca, 4 en guerra', () => {
    expect(guardiasParaRuta(base)).toBe(0);
    expect(guardiasParaRuta({ ...base, riesgo: true })).toBe(2);
    expect(guardiasParaRuta({ ...base, bandidosCerca: true })).toBe(2);
    expect(guardiasParaRuta({ ...base, enGuerra: true })).toBe(4);
    expect(guardiasParaRuta({ ...base, riesgo: true, enGuerra: true })).toBe(4);
  });
  it('nunca más de la mitad de la guarnición', () => {
    expect(guardiasParaRuta({ ...base, enGuerra: true, soldados: 5 })).toBe(2);
    expect(guardiasParaRuta({ ...base, riesgo: true, soldados: 1 })).toBe(0);
    expect(guardiasParaRuta({ ...base, enGuerra: true, soldados: 0 })).toBe(0);
  });
});

describe('categoriasQueFaltan (Q-40)', () => {
  const pozo = CONSTRUCTION_RECIPES.find((r) => r.key === 'pozo')!;
  const catalogo = new Map<string, CatalogLookup>([
    ['madera-telda', { tipo: 'RECURSO', category: 'madera' }],
    ['roca-luclara', { tipo: 'RECURSO', category: 'piedra' }],
  ]);
  const fila = (catalogSlug: string, i: number) => ({ id: `${catalogSlug}-${i}`, name: 'x', catalogSlug });
  const obra = { dias: 1, diasHechos: 0 };

  it('sin nada faltan madera y piedra, en ese orden', () => {
    expect(categoriasQueFaltan(pozo, obra, [], catalogo)).toEqual(['madera', 'piedra']);
  });
  it('con la leña de sobra solo falta piedra', () => {
    const madera = Array.from({ length: 6 }, (_, i) => fila('madera-telda', i));
    expect(categoriasQueFaltan(pozo, obra, madera, catalogo)).toEqual(['piedra']);
  });
  it('con todo, no falta nada', () => {
    const todo = [...Array.from({ length: 6 }, (_, i) => fila('madera-telda', i)), ...Array.from({ length: 6 }, (_, i) => fila('roca-luclara', i))];
    expect(categoriasQueFaltan(pozo, obra, todo, catalogo)).toEqual([]);
  });
});
