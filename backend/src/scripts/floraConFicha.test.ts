import { describe, it, expect } from 'vitest';
import { fauna, harvestSourceDescriptions, harvestSourceDisplayName, harvestSourceRegion, harvestYields, npcs } from './worldCatalog.js';
import { worldPopulations } from './worldPopulation.js';

/// QA-243: la Enciclopedia saca el nombre y la descripción de una planta o un mineral de estos dos
/// diccionarios. Sin entrada, enseñaba el slug («musgo-callado») y una ficha vacía.
describe('flora y minerales con ficha en la Enciclopedia (QA-243)', () => {
  it('toda fuente de recolección sin NPC propio tiene nombre y descripción', () => {
    const conFicha = new Set([...npcs, ...fauna].map((n) => n.slug));
    const fuentes = [...new Set(harvestYields.map((y) => y.sourceSlug))].filter((s) => !conFicha.has(s));
    const sinFicha = fuentes.filter((s) => !harvestSourceDisplayName[s] || !harvestSourceDescriptions[s]);
    expect(sinFicha).toEqual([]);
  });
});

/// QA-243: la misma presa con dos filas de lo mismo daba la pieza dos veces y enseñaba dos condiciones.
describe('rendimientos de recolección sin repetir (QA-243)', () => {
  it('ninguna fuente da el mismo objeto dos veces por el mismo método', () => {
    const claves = harvestYields.map((y) => `${y.sourceSlug}|${y.metodoObtencion}|${y.itemSlug}`);
    expect(claves.filter((c, i) => claves.indexOf(c) !== i)).toEqual([]);
  });
});

/// QA-243: sin región, `detectsWrongRegionHarvestClaim` dejaba cazar una hielaga en las Llanuras;
/// sin fila de población, el mundo no sabía cuántas había.
describe('fauna cazable con región y población (QA-243)', () => {
  it('toda la fauna con despiece tiene región de origen y fila de población', () => {
    const cazables = [...new Set(harvestYields.filter((y) => y.sourceCategory === 'fauna').map((y) => y.sourceSlug))]
      .filter((s) => fauna.some((f) => f.slug === s));
    const conPoblacion = new Set(worldPopulations.filter((p) => p.targetType === 'FAUNA').map((p) => p.targetSlug));
    expect(cazables.filter((s) => !harvestSourceRegion[s])).toEqual([]);
    expect(cazables.filter((s) => !conPoblacion.has(s))).toEqual([]);
  });
});
