import { describe, it, expect } from 'vitest';
import { comoRumor, distanciaRegiones, entrega } from './noticias.js';

// CR-12 paso 12d (hito 0.2) — rumor o certeza según la distancia.
describe('noticias por distancia', () => {
  const personaje = (region: string | null, conocidas: string[] = [], aliadas: string[] = []) => ({ region, faccionesConocidas: new Set(conocidas), aliadas: new Set(aliadas) });

  it('distancia en saltos entre regiones', () => {
    expect(distanciaRegiones('Ciénaga Troncal', 'Ciénaga Troncal')).toBe(0);
    expect(distanciaRegiones('Ciénaga Troncal', 'El Margen Silencioso')).toBe(1);
    expect(distanciaRegiones('Cristal Helado', 'La Meseta del Orden')).toBe(3);
    expect(distanciaRegiones('Cristal Helado', 'Atlántida')).toBeNull();
  });

  it('en su región al momento y como hecho; vecina 1 día; más lejos 2-3 días, como rumor', () => {
    const n = { texto: 'x', facciones: [], region: 'Cristal Helado' };
    expect(entrega(n, personaje('Cristal Helado'))).toEqual({ dias: 0, rumor: false });
    expect(entrega(n, personaje('Ciénaga Troncal'))).toEqual({ dias: 1, rumor: true });
    expect(entrega(n, personaje('El Margen Silencioso'))).toEqual({ dias: 2, rumor: true });
    expect(entrega(n, personaje('La Meseta del Orden'))).toEqual({ dias: 3, rumor: true });
  });

  it('las aliadas avisan al momento; sin lugar, solo si conoce la facción', () => {
    expect(entrega({ texto: 'x', facciones: ['Clan Goshg'], region: 'La Meseta del Orden' }, personaje('Cristal Helado', [], ['Clan Goshg']))).toEqual({ dias: 0, rumor: false });
    expect(entrega({ texto: 'x', facciones: ['Clan Goshg'], region: null }, personaje('Cristal Helado'))).toBeNull();
    expect(entrega({ texto: 'x', facciones: ['Clan Goshg'], region: null }, personaje('Cristal Helado', ['Clan Goshg']))).toEqual({ dias: 1, rumor: true });
  });

  it('el rumor no pone en minúscula los nombres propios', () => {
    expect(comoRumor('Una caravana viaja de A a B.')).toBe('Se dice que una caravana viaja de A a B.');
    expect(comoRumor('Clan Serhu absorbe a Clan Goshg.')).toBe('Se dice que Clan Serhu absorbe a Clan Goshg.');
  });
});
