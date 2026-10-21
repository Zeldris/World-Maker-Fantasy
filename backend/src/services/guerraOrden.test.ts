import { describe, it, expect } from 'vitest';
import { ordenarEnemigas } from './guerraReino.js';

// P298: el orden de la lista de guerra no depende del orden de entrada.
describe('ordenarEnemigas (P298)', () => {
  const a = { id: 'a', nombre: 'Clan Helsig', presion: 40 };
  const b = { id: 'b', nombre: 'Clan Serhu', presion: 40 };
  const c = { id: 'c', nombre: 'Clan Kar', presion: 90 };
  it('más presión primero y desempate por nombre, igual con cualquier entrada', () => {
    expect(ordenarEnemigas([a, b, c]).map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(ordenarEnemigas([b, c, a]).map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(ordenarEnemigas([c, b, a]).map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
});
