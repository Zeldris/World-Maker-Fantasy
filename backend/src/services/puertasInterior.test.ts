import { describe, it, expect } from 'vitest';
import { PUERTA_INTERIOR, celdaLibreCercana, enFila, posicionPuertaAInterior } from './puertasInterior.js';
import { celdaDePixel, claveCelda, pixelDeCelda } from './zonaPosicion.js';
import { murosDe } from './murosZona.js';
import { posicionesDeSalidasDeZona } from './entradasZona.js';

/// QA-27 (P7, 2026-10-09): dónde está la puerta de una zona interior, a cada lado.
describe('puertas de las zonas interiores', () => {
  const db = (edificio: { x: number; y: number } | null, fijos: { x: number; y: number }[] = [], slug = 'llanura-roja') =>
    ({
      zonePoint: { findFirst: async () => edificio, findMany: async () => fijos },
      location: { findUnique: async () => ({ slug }) },
    }) as never;

  it('fuera: dos celdas por debajo del edificio principal, sin pasar del borde de abajo', async () => {
    expect(await posicionPuertaAInterior(db({ x: 400, y: 300 }), 's1', 'l1')).toEqual({ x: 400, y: 400 });
    expect(await posicionPuertaAInterior(db({ x: 200, y: 520 }), 's1', 'l1')).toEqual({ x: 200, y: PUERTA_INTERIOR.y });
  });

  it('fuera y sin edificio: cerca del centro', async () => {
    expect(await posicionPuertaAInterior(db(null), 's1', 'l1')).toEqual({ x: 400, y: 450 });
  });

  it('varias puertas en el mismo sitio se reparten en fila, centradas', () => {
    expect(enFila({ x: 400, y: 550 }, 1, 0)).toEqual({ x: 400, y: 550 });
    expect([0, 1].map((i) => enFila({ x: 400, y: 550 }, 2, i))).toEqual([{ x: 350, y: 550 }, { x: 450, y: 550 }]);
  });

  // P211: la entrada de la capital caía en la casilla de la «Veta de Yerreo» (400,470) de la Llanura Roja.
  it('P211: la puerta de fuera no comparte casilla con un recurso ni con un edificio', async () => {
    const veta = { x: 400, y: 470 };
    const puerta = await posicionPuertaAInterior(db(null, [veta]), 's1', 'l1');
    expect(celdaDePixel(puerta)).not.toEqual(celdaDePixel(veta));
    // La casilla libre más cercana: de un paso de la que tocaba.
    const previsto = celdaDePixel({ x: 400, y: 450 });
    const celda = celdaDePixel(puerta);
    expect(Math.max(Math.abs(celda.col - previsto.col), Math.abs(celda.row - previsto.row))).toBe(1);
    // Sin recurso en esa casilla, la puerta no se mueve.
    expect(await posicionPuertaAInterior(db(null, [{ x: 100, y: 100 }]), 's1', 'l1')).toEqual({ x: 400, y: 450 });
    // Es determinista: la misma zona da siempre la misma puerta.
    expect(await posicionPuertaAInterior(db(null, [veta]), 's1', 'l1')).toEqual(puerta);
  });

  it('P211: rodea varias casillas ocupadas y devuelve el centro de una libre', () => {
    const ocupadas = new Set(['8,9', '7,9', '9,9', '8,10', '7,10', '9,10', '8,8']);
    const libre = celdaLibreCercana({ x: 400, y: 450 }, ocupadas);
    const celda = celdaDePixel(libre);
    expect(ocupadas.has(`${celda.col},${celda.row}`)).toBe(false);
    expect(libre.x % 50).toBe(25);
    expect(libre.y % 50).toBe(25);
  });

  // Revisión de P211: en el Colmillo Ceniza la empalizada (P185) también ocupa casillas; con el edificio
  // a (425,375) la puerta tocaba en (425,475), la casilla de estaca (8,9).
  it('P211: la puerta de fuera tampoco cae en un muro de la zona', async () => {
    const muros = murosDe('campamento-serhu');
    expect(muros.has('8,9')).toBe(true);
    const puerta = await posicionPuertaAInterior(db({ x: 425, y: 375 }, [], 'campamento-serhu'), 's1', 'l1');
    expect(muros.has(claveCelda(celdaDePixel(puerta)))).toBe(false);
  });

  // Revisión de P211: con dos interiores, las dos puertas recolocadas iban a la misma casilla libre (8,8).
  it('P211: dos puertas recolocadas no comparten casilla', async () => {
    const ocupadas = ['6,8', '6,9', '6,10', '7,8', '7,9', '7,10', '9,8', '9,9', '9,10', '10,8', '10,9', '10,10', '8,10'];
    const fijos = ocupadas.map((k) => {
      const [col, row] = k.split(',').map(Number);
      return pixelDeCelda({ col, row });
    });
    const interiores = [
      { id: 'capital', x: null, y: null, kind: 'interior' },
      { id: 'cuartel', x: null, y: null, kind: 'interior' },
    ];
    const posiciones = await posicionesDeSalidasDeZona(db(null, fijos), 's1', { id: 'l1', x: 10, y: 10 }, interiores);
    const celdas = [...posiciones.values()].map((p) => claveCelda(celdaDePixel(p)));
    expect(celdas).toHaveLength(2);
    expect(new Set(celdas).size).toBe(2);
    for (const c of celdas) expect(ocupadas).not.toContain(c);
  });
});
