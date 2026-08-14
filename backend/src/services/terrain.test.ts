import { describe, it, expect } from 'vitest';
import { pasaFiltroTerreno } from './terrain.js';

describe('pasaFiltroTerreno', () => {
  it('la fuente sin afinidad marcada (null) siempre pasa, sea cual sea el terreno de la zona', () => {
    expect(pasaFiltroTerreno(['arido'], null)).toBe(true);
    expect(pasaFiltroTerreno(['humedo'], undefined)).toBe(true);
    expect(pasaFiltroTerreno([], null)).toBe(true);
  });

  it('la zona sin catalogar (undefined) nunca filtra, aunque la fuente tenga afinidad marcada', () => {
    expect(pasaFiltroTerreno(undefined, 'humedo')).toBe(true);
  });

  it('la zona catalogada con array vacío tampoco filtra', () => {
    expect(pasaFiltroTerreno([], 'humedo')).toBe(true);
  });

  it('el tag de la fuente coincide con uno de los de la zona: pasa', () => {
    expect(pasaFiltroTerreno(['arido', 'rocoso'], 'rocoso')).toBe(true);
  });

  it('el tag de la fuente no está entre los de la zona: no pasa', () => {
    expect(pasaFiltroTerreno(['arido', 'rocoso'], 'humedo')).toBe(false);
  });
});
