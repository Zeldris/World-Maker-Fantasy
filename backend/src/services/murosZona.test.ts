import { describe, it, expect } from 'vitest';
import { calcularCamino, celdaDePixel, type Celda } from './zonaPosicion.js';
import { claveCelda, murosComoCeldas, murosDe } from './murosZona.js';
import { zonePoints } from '../scripts/worldCatalog.js';

const muro = (...celdas: [number, number][]) => new Set(celdas.map(([col, row]) => claveCelda({ col, row })));

/// P185 (QA-27): el camino al Pozo atravesaba la empalizada de Colmillo Ceniza por donde no hay puerta.
describe('calcularCamino con muros (P185)', () => {
  it('sin muros en medio, la línea recta de siempre', () => {
    expect(calcularCamino({ col: 0, row: 0 }, { col: 3, row: 0 }, muro([5, 5]))).toEqual(calcularCamino({ col: 0, row: 0 }, { col: 3, row: 0 }));
  });

  it('rodea un muro y llega, sin pisarlo', () => {
    const muros = muro([2, 0], [2, 1], [2, 2]);
    const camino = calcularCamino({ col: 0, row: 1 }, { col: 4, row: 1 }, muros);
    expect(camino.at(-1)).toEqual({ col: 4, row: 1 });
    expect(camino.some((c) => muros.has(claveCelda(c)))).toBe(false);
  });

  it('no se cuela en diagonal entre dos muros que se tocan en la esquina', () => {
    const muros = muro([1, 0], [0, 1]);
    const camino = calcularCamino({ col: 0, row: 0 }, { col: 1, row: 1 }, muros);
    expect(camino).toEqual([]); // encerrado en la esquina: no hay paso
  });

  it('si el destino es un muro, va a la casilla libre más cercana', () => {
    const muros = muro([3, 0], [3, 1], [3, 2]);
    const camino = calcularCamino({ col: 0, row: 1 }, { col: 3, row: 1 }, muros);
    expect(camino.at(-1)).toEqual({ col: 2, row: 1 });
  });
});

describe('muros de Colmillo Ceniza', () => {
  const muros = murosDe('campamento-serhu');
  const recorrido = (origen: Celda, destino: Celda) => calcularCamino(origen, destino, muros);

  it('todo punto del catálogo se alcanza: si cae sobre un muro, tiene al lado una casilla libre', () => {
    for (const p of zonePoints) {
      const muros = murosDe(p.locationSlug);
      const c = celdaDePixel(p);
      if (!muros.has(claveCelda(c))) continue;
      const vecinas = [-1, 0, 1].flatMap((dc) => [-1, 0, 1].map((dr) => ({ col: c.col + dc, row: c.row + dr })));
      expect(vecinas.some((v) => !muros.has(claveCelda(v))), `${p.locationSlug} ${p.targetSlug}`).toBe(true);
    }
  });

  it('de fuera al Ketg\'sedsar, solo por la puerta (12,9)', () => {
    const camino = recorrido({ col: 2, row: 6 }, celdaDePixel({ x: 400, y: 300 }));
    expect(camino.at(-1)).toEqual({ col: 8, row: 6 });
    expect(camino.some((c) => muros.has(claveCelda(c)))).toBe(false);
    expect(camino).toContainEqual({ col: 12, row: 9 });
  });

  it('la zona sin muros no tiene ninguno', () => {
    expect(murosComoCeldas('hondonada-del-eco')).toEqual([]);
  });
});

// P193 (QA-27): el recinto de múrgoles, sobre las estacas (8,9), se ordeñaba desde fuera, desde (7,10).
describe('interior de la empalizada (P193)', () => {
  it('el interior es lo que queda dentro con la puerta cerrada; el recinto solo se alcanza desde dentro', async () => {
    const { interiorDe, alcanzableDesde } = await import('./murosZona.js');
    const interior = interiorDe('campamento-serhu');
    expect(interior.has(claveCelda({ col: 8, row: 8 }))).toBe(true);
    expect(interior.has(claveCelda({ col: 10, row: 6 }))).toBe(true);
    expect(interior.has(claveCelda({ col: 7, row: 10 }))).toBe(false);
    expect(interior.has(claveCelda({ col: 12, row: 10 }))).toBe(false);
    const recinto = { col: 8, row: 9 };
    expect(alcanzableDesde('campamento-serhu', { col: 8, row: 8 }, recinto)).toBe(true);
    expect(alcanzableDesde('campamento-serhu', { col: 7, row: 10 }, recinto)).toBe(false);
    expect(alcanzableDesde('campamento-serhu', { col: 8, row: 10 }, recinto)).toBe(false);
    // Un punto que no está sobre un muro, desde cualquier vecina; una zona sin empalizada, igual.
    expect(alcanzableDesde('campamento-serhu', { col: 2, row: 2 }, { col: 3, row: 3 })).toBe(true);
    expect(alcanzableDesde('otra-zona', { col: 7, row: 10 }, recinto)).toBe(true);
  });
});
