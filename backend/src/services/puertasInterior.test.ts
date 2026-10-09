import { describe, it, expect } from 'vitest';
import { PUERTA_INTERIOR, enFila, posicionPuertaAInterior } from './puertasInterior.js';

/// QA-27 (P7, 2026-10-09): dónde está la puerta de una zona interior, a cada lado.
describe('puertas de las zonas interiores', () => {
  const db = (edificio: { x: number; y: number } | null) => ({ zonePoint: { findFirst: async () => edificio } }) as never;

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
});
