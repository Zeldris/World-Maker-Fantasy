import { describe, it, expect } from 'vitest';
import { avanzarJornada, JORNADA_MINUTOS, rutaMasCorta, type Enlace } from './viajeros.js';

/// CR-63 (63a): rutas por los enlaces y jornada de 8 h.
const ENLACES: Enlace[] = [
  { fromId: 'a', toId: 'b', minutosBase: 120 },
  { fromId: 'b', toId: 'c', minutosBase: 300 },
  { fromId: 'a', toId: 'd', minutosBase: 600 },
  { fromId: 'd', toId: 'c', minutosBase: 0 },
  { fromId: 'e', toId: 'f', minutosBase: 60 },
];

describe('viajeros (CR-63 63a) — rutas', () => {
  it('la ruta más corta por minutos, con los enlaces en los dos sentidos', () => {
    expect(rutaMasCorta(ENLACES, 'a', 'c')).toEqual(['b', 'c']); // 420 frente a 600
    expect(rutaMasCorta(ENLACES, 'c', 'a')).toEqual(['b', 'a']);
    expect(rutaMasCorta(ENLACES, 'a', 'a')).toEqual([]);
    expect(rutaMasCorta(ENLACES, 'a', 'f')).toBeNull();
  });

  it('una jornada son 8 h: cruza lo que le alcanza y se queda a medio tramo', () => {
    expect(JORNADA_MINUTOS).toBe(480);
    const r = avanzarJornada({ ubicacion: 'a', ruta: ['b', 'c'], minutosEnTramo: 0 }, ENLACES);
    expect(r).toEqual({ pos: { ubicacion: 'c', ruta: [], minutosEnTramo: 0 }, cruzados: ['b', 'c'] });
    // Un tramo de 600: dos jornadas, la primera a medio camino.
    const uno = avanzarJornada({ ubicacion: 'a', ruta: ['d', 'c'], minutosEnTramo: 0 }, ENLACES);
    expect(uno).toEqual({ pos: { ubicacion: 'a', ruta: ['d', 'c'], minutosEnTramo: 480 }, cruzados: [] });
    // Al llegar a d, el enlace de 0 minutos a c se cruza en la misma jornada.
    expect(avanzarJornada(uno.pos, ENLACES)).toEqual({ pos: { ubicacion: 'c', ruta: [], minutosEnTramo: 0 }, cruzados: ['d', 'c'] });
  });
});
