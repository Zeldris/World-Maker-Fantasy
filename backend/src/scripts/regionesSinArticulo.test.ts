import { describe, it, expect } from 'vitest';
import { worldPopulations } from './worldPopulation.js';
import { stripRegionArticle } from '../services/population.js';

/// QA-33 (retro del 2026-10-09): la población guarda la región SIN artículo («Llanuras del Viento
/// Rojo»). Las facciones la guardaban con él y `moverPoblacion` no las encontraba (P52).
describe('población: regiones sin artículo (QA-33)', () => {
  it('ninguna fila de worldPopulations guarda una región con artículo', () => {
    const conArticulo = worldPopulations.flatMap((p) => Object.keys(p.distribucion).filter((k) => stripRegionArticle(k) !== k).map((k) => `${p.targetSlug}: ${k}`));
    expect(conArticulo).toEqual([]);
  });
});
